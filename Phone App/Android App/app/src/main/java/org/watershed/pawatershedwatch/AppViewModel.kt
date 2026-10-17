package org.watershed.pawatershedwatch

import android.app.Application
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.edit
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuthException
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Server-owned profile (users/{uid}) as seen by this phone. */
enum class ProfileStatus { Unknown, NeedsVerification, NeedsName, Initializing, Ready, Failed }

class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val graph = (application as PAWatershedApplication).graph
    private val drafts: DraftRepository = graph.local
    private val observations: ObservationRepository = graph.local
    private val saveMutex = Mutex()
    private var account: AuthAccount? = null
    private var remoteListener: AutoCloseable? = null
    private var preparingCorrection = false
    private var discussionListener: AutoCloseable? = null
    private var proposalListener: AutoCloseable? = null
    private var initializedProfileUid: String? = null
    private val preferences = application.getSharedPreferences("pa_watershed_watch", android.content.Context.MODE_PRIVATE)
    private val connectivity = application.getSystemService(ConnectivityManager::class.java)
    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) = refreshConnection()
        override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) = refreshConnection()
        override fun onLost(network: Network) = refreshConnection()
    }

    var isSignedIn by mutableStateOf(false)
        private set
    var authLoading by mutableStateOf(true)
        private set
    var email by mutableStateOf("")
    var password by mutableStateOf("")
    var fullName by mutableStateOf("")
    var creatingAccount by mutableStateOf(false)
        private set
    var authWorking by mutableStateOf(false)
        private set
    var authNotice by mutableStateOf<String?>(null)
        private set
    var authError by mutableStateOf<String?>(null)
        private set
    var connection by mutableStateOf(ConnectionState.Online)
        private set
    var draft by mutableStateOf<ObservationDraft?>(null)
        private set
    var records by mutableStateOf<List<ObservationRecord>>(emptyList())
        private set
    var sites by mutableStateOf<List<Site>>(emptyList())
        private set
    var sitesLoading by mutableStateOf(false)
        private set
    var siteLoadError by mutableStateOf<String?>(null)
        private set
    var lastSubmittedId by mutableStateOf<String?>(null)
        private set
    var localStoreError by mutableStateOf<String?>(null)
        private set
    var submitting by mutableStateOf(false)
        private set
    var measurementFocusTarget by mutableStateOf<MeasurementKind?>(null)
        private set
    val signedInName: String get() = account?.displayName?.ifBlank { "Watershed researcher" } ?: "Watershed researcher"
    val signedInEmail: String get() = account?.email.orEmpty()
    val signedInUid: String? get() = account?.uid

    // Onboarding: shown once on first launch, reopened on request from Account.
    var onboardingVisible by mutableStateOf(!readOnboardingComplete())
        private set
    var onboardingRevisit by mutableStateOf(false)
        private set

    // Server-owned profile.
    var profileStatus by mutableStateOf(ProfileStatus.Unknown)
        private set
    var profileMessage by mutableStateOf<String?>(null)
        private set
    var profileBusy by mutableStateOf(false)
        private set
    val profileName: String? get() = account?.profileName

    // Submission discussion (one record at a time).
    var discussionFor by mutableStateOf<String?>(null)
        private set
    var discussion by mutableStateOf<List<SubmissionMessage>>(emptyList())
        private set
    var discussionLoading by mutableStateOf(false)
        private set
    var discussionError by mutableStateOf<String?>(null)
        private set
    var sendingMessage by mutableStateOf(false)
        private set
    var messageError by mutableStateOf<String?>(null)
        private set
    private var outgoingMessage: OutgoingMessage? = null

    // Coordinate proposals.
    var proposals by mutableStateOf<List<CoordinateProposal>>(emptyList())
        private set
    var proposalsLoading by mutableStateOf(false)
        private set
    var proposalsError by mutableStateOf<String?>(null)
        private set
    var submittingProposal by mutableStateOf(false)
        private set
    var proposalError by mutableStateOf<String?>(null)
        private set
    var proposalConfirmation by mutableStateOf<String?>(null)
        private set
    private var pendingProposal: CoordinateProposalRequest? = null

    init {
        connectivity.registerDefaultNetworkCallback(networkCallback)
        refreshConnection()
        viewModelScope.launch {
            graph.auth.account.collectLatest { restored ->
                account = restored
                authLoading = false
                isSignedIn = restored != null
                if (restored == null) clearVisibleAccountData() else loadAccount(restored)
            }
        }
    }

    fun signIn() {
        if (authWorking) return
        if (email.isBlank() || password.isBlank()) {
            authError = "Enter your email and password."
            return
        }
        if (connection != ConnectionState.Online) { authError = "Reconnect to sign in. Local field work stays on this device."; return }
        authWorking = true
        authError = null; authNotice = null
        viewModelScope.launch {
            try {
                graph.auth.signIn(email, password).onSuccess { password = "" }.onFailure { authError = it.authMessage() }
            } finally { authWorking = false }
        }
    }

    fun selectAccountCreation(value: Boolean) {
        if (authWorking) return
        creatingAccount = value; authError = null; authNotice = null
    }

    fun createAccount() {
        if (authWorking) return
        val name = runCatching { CollectorName.normalized(fullName) }.getOrElse { authError = it.message; return }
        if (email.isBlank() || !email.contains('@')) { authError = "Enter a valid email address."; return }
        if (password.length < 8) { authError = "Use a password with at least 8 characters."; return }
        if (connection != ConnectionState.Online) { authError = "Reconnect to create your account."; return }
        authWorking = true; authError = null; authNotice = null
        viewModelScope.launch {
            try {
                graph.auth.createAccount(name, email, password).onSuccess { outcome ->
                    password = ""
                    account = outcome.account; isSignedIn = true
                    // The Auth listener owns local loading/listeners; don't start a second load that
                    // could replace a draft or attach a duplicate remote listener.
                    ensureProfile(outcome.account, force = true)
                    if (!outcome.verificationSent) authNotice = "Account created. Use Resend Email here to request your verification link."
                    else if (!outcome.nameSaved) authNotice = "Account created. Verify your email, then save your full name in Account."
                    creatingAccount = false; fullName = ""
                }.onFailure { authError = it.authMessage() }
            } finally { authWorking = false }
        }
    }

    fun sendPasswordReset() {
        if (authWorking) return
        val address = (if (isSignedIn) signedInEmail else email).trim()
        val requestedUid = account?.uid
        if (address.isBlank() || !address.contains('@')) { authError = "Enter the email address you sign in with."; return }
        if (connection != ConnectionState.Online) { authError = "Reconnect to reset your password."; return }
        authWorking = true; authError = null; authNotice = null
        viewModelScope.launch {
            try {
                graph.auth.sendPasswordReset(address).onSuccess {
                    if (account?.uid == requestedUid) authNotice = passwordResetConfirmation(address)
                }.onFailure { if (account?.uid == requestedUid) authError = it.authMessage() }
            } finally { authWorking = false }
        }
    }

    fun finishOnboarding() {
        runCatching { preferences.edit { putBoolean(ONBOARDING_KEY, true) } }
        onboardingVisible = false
        onboardingRevisit = false
    }

    fun reopenOnboarding() {
        onboardingRevisit = true
        onboardingVisible = true
    }

    private fun readOnboardingComplete(): Boolean = runCatching { preferences.getBoolean(ONBOARDING_KEY, false) }.getOrDefault(false)

    /**
     * Creates or refreshes the server-owned profile (users/{uid}) through initializeMyAccount once the
     * account is verified. The phone never writes users/{uid} itself.
     */
    private fun ensureProfile(value: AuthAccount, force: Boolean = false) {
        if (!force && initializedProfileUid == value.uid) return
        when {
            !value.verified -> {
                profileStatus = ProfileStatus.NeedsVerification
                profileMessage = "Verify your email address${value.email?.let { " ($it)" }.orEmpty()} to finish setting up your account. Open the link we emailed you, then tap I've Verified. Field work still saves on this phone."
            }
            value.profileName == null -> {
                profileStatus = ProfileStatus.NeedsName
                profileMessage = "Add your full name in Account. Reviewers see it beside your submissions and messages."
            }
            connection != ConnectionState.Online -> {
                profileStatus = ProfileStatus.Failed
                profileMessage = "Your account profile will finish setting up when you are back online."
            }
            else -> {
                profileStatus = ProfileStatus.Initializing
                profileMessage = null
                viewModelScope.launch {
                    graph.collaboration.initializeAccount(value.profileName).onSuccess {
                        if (account?.uid != value.uid) return@onSuccess
                        initializedProfileUid = value.uid
                        profileStatus = ProfileStatus.Ready
                        profileMessage = null
                    }.onFailure { error ->
                        if (account?.uid != value.uid) return@onFailure
                        profileStatus = ProfileStatus.Failed
                        profileMessage = error.message ?: "Your account profile could not be set up. Try again."
                    }
                }
            }
        }
    }

    fun retryProfile() {
        account?.let { ensureProfile(it, force = true) }
    }

    /** Re-reads the Auth account so a verification completed in the email link is recognized. */
    fun checkVerification() {
        if (profileBusy) return
        profileBusy = true
        viewModelScope.launch {
            graph.auth.reload().onSuccess { refreshed ->
                if (refreshed != null) {
                    account = refreshed
                    if (!refreshed.verified) profileMessage = "Your email is not verified yet. Open the link we emailed you, then try again."
                    else ensureProfile(refreshed, force = true)
                }
            }.onFailure { profileMessage = "We couldn't check your verification. Reconnect and try again." }
            profileBusy = false
        }
    }

    fun resendVerification() {
        if (profileBusy) return
        profileBusy = true
        viewModelScope.launch {
            profileMessage = graph.auth.sendEmailVerification().fold(
                onSuccess = { "We sent a new verification link to ${account?.email.orEmpty()}. Open it, then tap I've Verified." },
                onFailure = { "We couldn't send a verification email right now. Wait a minute and try again." },
            )
            profileBusy = false
        }
    }

    /** Saves the collector's full name through the server callables, then refreshes the profile. */
    fun saveProfileName(name: String, onDone: (Boolean) -> Unit) {
        val current = account ?: return onDone(false)
        val trimmed = runCatching { CollectorName.normalized(name) }.getOrElse { profileMessage = it.message; return onDone(false) }
        if (connection != ConnectionState.Online) {
            profileMessage = "Reconnect to change your name."
            return onDone(false)
        }
        if (profileBusy) return onDone(false)
        profileBusy = true
        viewModelScope.launch {
            graph.collaboration.updateDisplayName(trimmed, current.verified).onSuccess {
                val refreshed = graph.auth.reload().getOrNull() ?: current.copy(displayName = trimmed, profileName = trimmed)
                account = refreshed
                if (refreshed.verified) {
                    initializedProfileUid = refreshed.uid
                    profileStatus = ProfileStatus.Ready
                    profileMessage = "Name saved."
                } else ensureProfile(refreshed, force = true)
                profileBusy = false
                onDone(true)
            }.onFailure { error ->
                profileMessage = error.message ?: "Your name could not be saved. Try again."
                profileBusy = false
                onDone(false)
            }
        }
    }

    /** Live discussion for one submission, ordered by created_at. internalNotes are never requested. */
    fun observeDiscussion(recordId: String) {
        val record = record(recordId) ?: return
        if (discussionFor == recordId && discussionListener != null) return
        stopDiscussion()
        discussionFor = recordId
        messageError = null
        if (record.sync != SyncState.Synced) {
            discussionLoading = false
            return
        }
        discussionLoading = true
        discussionError = null
        discussionListener = graph.collaboration.observeMessages(
            recordId,
            onChange = { messages ->
                if (discussionFor == recordId) {
                    discussion = messages
                    discussionLoading = false
                    discussionError = null
                }
            },
            onError = { message ->
                if (discussionFor == recordId) {
                    discussionLoading = false
                    discussionError = message
                }
            },
        )
    }

    fun stopDiscussion() {
        discussionListener?.close()
        discussionListener = null
        discussionFor = null
        discussion = emptyList()
        discussionLoading = false
        discussionError = null
    }

    /** Sends a COLLECTOR_COMMENT; the same text retried reuses its message ID, so retries never duplicate. */
    fun sendReply(recordId: String, text: String, onSent: () -> Unit) {
        val record = record(recordId) ?: return
        messageProblem(text)?.let { messageError = it; return }
        if (sendingMessage) return
        if (connection != ConnectionState.Online) {
            messageError = "Reconnect to send a message. Your text stays in the box."
            return
        }
        val outgoing = OutgoingMessage.next(outgoingMessage, recordId, text)
        outgoingMessage = outgoing
        sendingMessage = true
        messageError = null
        viewModelScope.launch {
            graph.collaboration.sendCollectorComment(recordId, record.currentRevisionId.value, outgoing.messageId, outgoing.text)
                .onSuccess {
                    outgoingMessage = null
                    onSent()
                }
                .onFailure { messageError = it.message ?: "The message was not sent. Try again." }
            sendingMessage = false
        }
    }

    fun observeProposals() {
        val owner = account ?: return
        if (proposalListener != null) return
        proposalsLoading = true
        proposalsError = null
        proposalListener = graph.collaboration.observeProposals(
            owner.uid,
            onChange = { proposals = it; proposalsLoading = false; proposalsError = null },
            onError = { proposalsError = it; proposalsLoading = false },
        )
    }

    fun stopProposals() {
        proposalListener?.close()
        proposalListener = null
    }

    fun clearProposalFeedback() {
        proposalError = null
        proposalConfirmation = null
    }

    /**
     * Sends a NEW_SITE or COORDINATE_CORRECTION proposal. A retry of the same content reuses its
     * proposal ID; the reviewer decides in the QC Console and the site catalog is never edited here.
     */
    fun submitProposal(
        kind: ProposalKind,
        siteId: String?,
        latitude: Double?,
        longitude: Double?,
        gpsAccuracyM: Double?,
        reason: String,
        proposedSiteName: String,
        onSent: () -> Unit,
    ) {
        if (submittingProposal) return
        val problems = coordinateProposalProblems(kind, siteId, latitude, longitude, gpsAccuracyM, reason, proposedSiteName)
        if (problems.isNotEmpty()) {
            proposalError = problems.first()
            return
        }
        if (connection != ConnectionState.Online) {
            proposalError = "Reconnect to send this proposal. Your entries stay on this screen."
            return
        }
        val candidate = CoordinateProposalRequest(
            CoordinateProposalRequest.newId(), kind, siteId.takeIf { kind == ProposalKind.CoordinateCorrection },
            requireNotNull(latitude), requireNotNull(longitude), gpsAccuracyM, ProposalText.normalized(reason),
            ProposalText.normalized(proposedSiteName).takeIf { kind == ProposalKind.NewSite },
        )
        val request = pendingProposal?.takeIf { candidate.sameContent(it) } ?: candidate
        pendingProposal = request
        submittingProposal = true
        proposalError = null
        proposalConfirmation = null
        viewModelScope.launch {
            graph.collaboration.proposeCoordinates(request).onSuccess { status ->
                pendingProposal = null
                proposalConfirmation = "Proposal sent · ${status.label}. A reviewer will decide; approved coordinates change only after review."
                onSent()
            }.onFailure { proposalError = it.message ?: "The proposal was not sent. Try again." }
            submittingProposal = false
        }
    }

    fun signOut() {
        remoteListener?.close()
        remoteListener = null
        stopDiscussion()
        stopProposals()
        password = ""
        authNotice = null; authError = null
        graph.auth.signOut()
    }

    fun startNewObservation(): Boolean {
        val owner = account ?: return false
        val name = owner.profileName?.let { runCatching { CollectorName.normalized(it) }.getOrNull() }
        if (name == null) {
            profileStatus = ProfileStatus.NeedsName
            profileMessage = "Save your full name in Account before starting an observation."
            return false
        }
        val previous = draft
        val next = ObservationDraft(ownerUid = owner.uid, collector = name, gpsState = GpsState.Acquiring)
        draft = next
        viewModelScope.launch {
            saveMutex.withLock {
                previous?.let { drafts.deleteDraft(it.ownerUid, it.submissionId) }
                runCatching { drafts.saveDraft(next) }.onFailure { localStoreError = it.message }
            }
        }
        return true
    }

    fun discardDraft() {
        val current = draft ?: return
        draft = null
        viewModelScope.launch { drafts.deleteDraft(current.ownerUid, current.submissionId) }
    }

    fun updateDraft(change: (ObservationDraft) -> ObservationDraft) {
        val current = draft ?: return
        val next = change(current).copy(lastSavedAt = System.currentTimeMillis())
        require(next.submissionId == current.submissionId && next.eventId == current.eventId && next.ownerUid == current.ownerUid)
        draft = next
        persistDraft(next)
    }

    fun saveFieldCollection() {
        updateDraft { it.copy(fieldCollectedAt = System.currentTimeMillis(), collectionStage = if (it.labResultsPending) CollectionStage.LAB_PENDING else CollectionStage.FIELD_COLLECTED) }
        synchronizeFieldDraft()
    }

    private fun synchronizeFieldDraft() {
        val current = draft ?: return
        val owner = account ?: return
        if (current.fieldCollectedAt == null || connection != ConnectionState.Online) return
        viewModelScope.launch {
            runCatching {
                saveMutex.withLock { drafts.saveDraft(current) }
                graph.sync.saveFieldDraft(current.toCanonicalSnapshot(owner.uid, BuildConfig.VERSION_NAME, forDraft = true))
            }.onFailure { localStoreError = "Field collection remains saved on this phone. Reconnect and save again to synchronize it." }
        }
    }

    fun setStep(step: Int) = updateDraft { it.copy(currentStep = step.coerceIn(1, 6)) }
    fun selectSite(site: Site) = updateDraft { it.copy(siteId = site.id) }
    fun selectedSite(): Site? = sites.firstOrNull { it.id == draft?.siteId }

    fun selectTestType(type: TestType) = updateDraft {
        it.copy(testType = type, method = "", instrument = "", testTypeOther = "")
    }

    fun setLocation(latitude: Double, longitude: Double, accuracy: Float, approximateOnly: Boolean) = updateDraft {
        it.copy(
            latitude = latitude,
            longitude = longitude,
            accuracyMeters = accuracy.toDouble(),
            gpsState = when {
                approximateOnly -> GpsState.Approximate
                accuracy <= 20 -> GpsState.Good
                else -> GpsState.Poor
            },
        )
    }

    fun setGpsState(state: GpsState) = updateDraft { it.copy(gpsState = state) }

    fun setMeasurement(kind: MeasurementKind, value: String) {
        if (ProductionMeasurementCatalog.spec(kind).support != ProductionSupport.FULLY_SUPPORTED) return
        updateDraft { it.copy(values = it.values + (kind to value)) }
    }

    /** Records analysis provenance for one laboratory-dependent value; field parameters have none. */
    fun updateAnalysis(kind: MeasurementKind, change: (AnalysisProvenance) -> AnalysisProvenance) {
        if (!kind.needsAnalysisProvenance) return
        updateDraft { it.copy(analysisDetails = it.analysisDetails + (kind to change(it.analysis(kind)))) }
    }

    fun changeUnit(kind: MeasurementKind, newUnit: UnitSpec, clearIfNeeded: Boolean = false): Boolean {
        val current = draft ?: return false
        if (ProductionMeasurementCatalog.spec(kind).support != ProductionSupport.FULLY_SUPPORTED) return false
        val oldUnit = current.selectedUnit(kind)
        if (oldUnit == newUnit) return true
        val raw = current.values[kind].orEmpty().trim()
        val newValue = when {
            raw.isEmpty() -> raw
            kind.preservesQuantity -> raw.toDoubleOrNull()?.let { formatEntry(oldUnit.convert(it, newUnit)) } ?: raw
            clearIfNeeded -> ""
            else -> return false
        }
        updateDraft { it.copy(values = it.values + (kind to newValue), unitIds = it.unitIds + (kind to newUnit.id)) }
        return true
    }

    fun reviewIssues(): List<ReviewIssue> {
        val current = draft ?: return listOf(ReviewIssue("Start an observation", WorkflowStep.Site))
        return buildList {
            fun issue(message: String, step: WorkflowStep, kind: MeasurementKind? = null) = add(ReviewIssue(message, step, kind))
            if (current.siteId == null) issue("Choose a sampling site", WorkflowStep.Site)
            if (current.collector.isBlank()) issue("Enter a collector display name", WorkflowStep.VisitDetails)
            if (current.latitude == null || current.longitude == null || current.accuracyMeters == null) issue("Capture a GPS location", WorkflowStep.VisitDetails)
            if (current.latitude == 0.0 && current.longitude == 0.0) issue("Capture a valid GPS location", WorkflowStep.VisitDetails)
            if (current.testType == null) issue("Choose a test type", WorkflowStep.TestMethod)
            if (current.testType == TestType.Other && current.testTypeOther.isBlank()) issue("Describe the other test type", WorkflowStep.TestMethod)
            if (!current.visualObservationsComplete) issue("Choose weather, water color, and flow condition. Unknown is allowed.", WorkflowStep.Measurements)
            if (current.labResultsPending) issue("Complete laboratory results before submitting for review", WorkflowStep.Measurements)
            current.requiredMeasurements.filterNot(current::isComplete).forEach { issue("Enter ${it.title}", WorkflowStep.Measurements, it) }
            MeasurementKind.entries.forEach { kind ->
                current.measurementProblem(kind)?.let { issue(it, WorkflowStep.Measurements, kind) }
            }
            if (current.isCorrection && current.revisionNote.isBlank()) issue("Explain what was corrected", WorkflowStep.Review)
        }
    }

    fun requestMeasurementFocus(kind: MeasurementKind?) {
        measurementFocusTarget = kind
    }

    fun clearMeasurementFocus() {
        measurementFocusTarget = null
    }

    fun submit(onComplete: (String?) -> Unit) {
        val current = draft ?: return onComplete(null)
        if (submitting) return
        if (reviewIssues().isNotEmpty()) return onComplete(null)
        submitting = true
        viewModelScope.launch {
            runCatching {
                val workflow = if (current.isCorrection) WorkflowState.Resubmitted else WorkflowState.Submitted
                val sync = if (connection == ConnectionState.ServerUnavailable) SyncState.Failed else SyncState.Waiting
                observations.persistSubmission(current, workflow, sync, current.revisionNote.trim())
            }.onSuccess { record ->
                records = listOf(record) + records.filterNot { it.id == record.id }
                lastSubmittedId = record.id
                draft = null
                submitting = false
                onComplete(record.id)
                if (connection != ConnectionState.ServerUnavailable) graph.sync.enqueue(record.ownerUid, SubmissionId(record.id), record.currentRevisionId)
            }.onFailure { error ->
                localStoreError = error.message
                submitting = false
                onComplete(null)
            }
        }
    }

    fun startCorrection(recordId: String, onReady: (Boolean) -> Unit) {
        val record = record(recordId) ?: return onReady(false)
        val owner = account ?: return onReady(false)
        if (preparingCorrection || record.ownerUid != owner.uid || record.workflow != WorkflowState.NeedsCorrection) return onReady(false)
        preparingCorrection = true
        val nextRevision = RevisionId.new()
        val base = ObservationDraft(
            submissionId = SubmissionId(record.id), eventId = record.eventId, revisionId = nextRevision,
            revisionNo = record.revision + 1, ownerUid = owner.uid, siteId = record.site.id, collectedAt = record.collectedAt,
            weatherCondition = record.weatherCondition, waterColor = record.waterColor, flowCondition = record.flowCondition,
            collector = record.collector, latitude = record.latitude, longitude = record.longitude, accuracyMeters = record.accuracyMeters,
            gpsState = when { record.accuracyMeters == null -> GpsState.Unavailable; record.accuracyMeters <= 20 -> GpsState.Good; else -> GpsState.Poor },
            testType = record.testType, method = record.method, instrument = record.instrument,
            values = record.measurements.associate { it.kind to it.value }, unitIds = record.measurements.associate { it.kind to it.unitId },
            analysisDetails = record.measurements.mapNotNull { value -> value.analysis?.let { value.kind to it } }.toMap(),
            notes = record.notes,
            currentStep = 4, isCorrection = true, sourceRecordId = record.id, baseRevision = record.revision,
            correctionReason = record.correctionReason,
        )
        draft = base
        persistDraft(base)
        preparingCorrection = false
        onReady(true)
    }

    fun resubmitCorrection(onComplete: (String?) -> Unit) = submit(onComplete)
    fun record(id: String?): ObservationRecord? = records.firstOrNull { it.id == id }

    fun retrySync(recordId: String) {
        val record = record(recordId) ?: return
        viewModelScope.launch {
            observations.updateRemoteState(record.ownerUid, SubmissionId(record.id), record.workflow, SyncState.Waiting, record.correctionReason)
            records = observations.loadRecords(record.ownerUid)
            graph.sync.enqueue(record.ownerUid, SubmissionId(record.id), record.currentRevisionId)
        }
    }

    private fun persistDraft(value: ObservationDraft) {
        viewModelScope.launch {
            saveMutex.withLock {
                val latest = draft
                if (latest?.submissionId == value.submissionId && latest.lastSavedAt > value.lastSavedAt) return@withLock
                runCatching { drafts.saveDraft(value) }.onFailure { localStoreError = it.message }
            }
        }
    }

    private suspend fun loadAccount(value: AuthAccount) {
        remoteListener?.close()
        sitesLoading = true
        siteLoadError = null
        runCatching {
            draft = drafts.loadDraft(value.uid)
            records = observations.loadRecords(value.uid)
            sites = graph.sites.cached(value.uid)
        }.onFailure { localStoreError = it.message }
        graph.sites.refresh(value.uid)
            .onSuccess { sites = it; siteLoadError = null }
            .onFailure { siteLoadError = "Live sites are unavailable. Cached sites remain available." }
        sitesLoading = false
        synchronizeFieldDraft()
        ensureProfile(value)
        remoteListener = graph.sync.observe(value.uid) { remote ->
            viewModelScope.launch {
                observations.updateRemoteState(
                    value.uid, remote.submissionId, remote.workflow, SyncState.Synced,
                    remote.correctionReason, remote.validation, remote.flags,
                )
                records = observations.loadRecords(value.uid)
            }
        }
    }

    private fun clearVisibleAccountData() {
        remoteListener?.close()
        remoteListener = null
        stopDiscussion()
        stopProposals()
        proposals = emptyList()
        pendingProposal = null
        outgoingMessage = null
        initializedProfileUid = null
        profileStatus = ProfileStatus.Unknown
        profileMessage = null
        draft = null
        records = emptyList()
        sites = emptyList()
        lastSubmittedId = null
        measurementFocusTarget = null
        sitesLoading = false
        siteLoadError = null
    }

    private fun refreshConnection() {
        val capabilities = connectivity.getNetworkCapabilities(connectivity.activeNetwork)
        val next = if (capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true) ConnectionState.Online else ConnectionState.Offline
        viewModelScope.launch(Dispatchers.Main) {
            val previous = connection
            connection = next
            if (next == ConnectionState.Online && previous != next) {
                synchronizeFieldDraft()
                account?.let { if (profileStatus == ProfileStatus.Failed) ensureProfile(it, force = true) }
            }
        }
    }

    override fun onCleared() {
        remoteListener?.close()
        discussionListener?.close()
        proposalListener?.close()
        connectivity.unregisterNetworkCallback(networkCallback)
        super.onCleared()
    }

    private companion object {
        const val ONBOARDING_KEY = "onboarding_complete"
    }

    private fun Throwable.authMessage(): String = when ((this as? FirebaseAuthException)?.errorCode) {
        "ERROR_USER_DISABLED" -> "This account is disabled. Contact your watershed program administrator."
        "ERROR_INVALID_CREDENTIAL", "ERROR_WRONG_PASSWORD", "ERROR_USER_NOT_FOUND" -> "Email or password is incorrect."
        "ERROR_EMAIL_ALREADY_IN_USE", "ERROR_ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL" -> "An account already uses this email. Sign in using its existing method, or reset your password."
        "ERROR_INVALID_EMAIL" -> "Enter a valid email address."
        "ERROR_WEAK_PASSWORD" -> "Choose a stronger password with at least 8 characters."
        "ERROR_TOO_MANY_REQUESTS" -> "Too many attempts. Wait a few minutes and try again."
        "ERROR_OPERATION_NOT_ALLOWED" -> "Email registration is not enabled. Contact your program administrator."
        "ERROR_NETWORK_REQUEST_FAILED" -> "A network connection is required for sign-in. Saved field records remain on this device."
        else -> "We couldn't complete the account request. Try again or contact your program administrator."
    }
}
