package org.watershed.pawatershedwatch

import android.app.Application
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuthException
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.File

class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val graph = (application as PAWatershedApplication).graph
    private val drafts: DraftRepository = graph.local
    private val observations: ObservationRepository = graph.local
    private val saveMutex = Mutex()
    private var account: AuthAccount? = null
    private var remoteListener: AutoCloseable? = null
    private var preparingCorrection = false
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
        if (email.isBlank() || password.isBlank()) {
            authError = "Enter your institution email and password."
            return
        }
        authLoading = true
        authError = null
        viewModelScope.launch {
            graph.auth.signIn(email, password).onFailure { error ->
                authLoading = false
                authError = error.authMessage()
            }
        }
    }

    fun signOut() {
        remoteListener?.close()
        remoteListener = null
        password = ""
        graph.auth.signOut()
    }

    fun startNewObservation() {
        val owner = account ?: return
        val previous = draft
        val next = ObservationDraft(ownerUid = owner.uid, collector = owner.displayName, gpsState = GpsState.Acquiring)
        draft = next
        viewModelScope.launch {
            saveMutex.withLock {
                previous?.let { drafts.deleteDraft(it.ownerUid, it.submissionId) }
                runCatching { drafts.saveDraft(next) }.onFailure { localStoreError = it.message }
            }
        }
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

    fun setStep(step: Int) = updateDraft { it.copy(currentStep = step.coerceIn(1, 6)) }
    fun selectSite(site: Site) = updateDraft { it.copy(siteId = site.id) }
    fun selectedSite(): Site? = sites.firstOrNull { it.id == draft?.siteId }

    fun selectTestType(type: TestType) = updateDraft {
        it.copy(testType = type, method = type.suggestedMethod, instrument = type.suggestedInstrument, testTypeOther = "")
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
            if (current.method.isBlank()) issue("Enter a collection or measurement method", WorkflowStep.TestMethod)
            if (current.instrument.isBlank()) issue("Enter an instrument or laboratory", WorkflowStep.TestMethod)
            current.requiredMeasurements.filterNot(current::isComplete).forEach { issue("Enter ${it.title}", WorkflowStep.Measurements, it) }
            current.values.forEach { (kind, value) ->
                if (ProductionMeasurementCatalog.spec(kind).support != ProductionSupport.FULLY_SUPPORTED && value.isNotBlank()) {
                    issue("${kind.title} is not enabled for production submission", WorkflowStep.Measurements, kind)
                }
                measurementErrorMessage(kind, value, current.selectedUnit(kind))?.let { issue(it, WorkflowStep.Measurements, kind) }
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
            collector = record.collector, latitude = record.latitude, longitude = record.longitude, accuracyMeters = record.accuracyMeters,
            gpsState = when { record.accuracyMeters == null -> GpsState.Unavailable; record.accuracyMeters <= 20 -> GpsState.Good; else -> GpsState.Poor },
            testType = record.testType, method = record.method, instrument = record.instrument,
            values = record.measurements.associate { it.kind to it.value }, unitIds = record.measurements.associate { it.kind to it.unitId },
            notes = record.notes,
            currentStep = 4, isCorrection = true, sourceRecordId = record.id, baseRevision = record.revision,
            correctionReason = record.correctionReason,
        )
        viewModelScope.launch {
            runCatching { withContext(Dispatchers.IO) { copyCorrectionAttachments(record.attachments, base) } }
                .onSuccess { copies ->
                    val correction = base.copy(attachments = copies)
                    draft = correction
                    persistDraft(correction)
                    onReady(true)
                }
                .onFailure {
                    localStoreError = "Attached files could not be prepared for the correction revision."
                    onReady(false)
                }
            preparingCorrection = false
        }
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
        viewModelScope.launch(Dispatchers.Main) { connection = next }
    }

    override fun onCleared() {
        remoteListener?.close()
        connectivity.unregisterNetworkCallback(networkCallback)
        super.onCleared()
    }

    private fun prepareAttachment(draft: ObservationDraft, contentType: String, kind: AttachmentKind): ObservationAttachment {
        val id = AttachmentId.new()
        val extension = when (contentType) {
            "image/jpeg" -> "jpg"
            "image/png" -> "png"
            "image/heic" -> "heic"
            "audio/mp4" -> "m4a"
            else -> error("Unsupported attachment type")
        }
        val directory = File(getApplication<Application>().filesDir, "attachments/${draft.revisionId.value}").apply { mkdirs() }
        val file = File(directory, "${id.value}.$extension").apply { createNewFile() }
        return ObservationAttachment(
            id = id, ownerUid = draft.ownerUid, submissionId = draft.submissionId, revisionId = draft.revisionId,
            localPath = file.absolutePath, contentType = contentType, sizeBytes = 0, kind = kind,
        )
    }

    private fun copyCorrectionAttachments(values: List<ObservationAttachment>, draft: ObservationDraft): List<ObservationAttachment> {
        val targets = mutableListOf<File>()
        return try {
            values.map { source ->
                val sourceFile = File(source.localPath)
                require(sourceFile.isFile && sourceFile.length() == source.sizeBytes) { "Source attachment is unavailable" }
                val prepared = prepareAttachment(draft, source.contentType, source.kind)
                val target = File(prepared.localPath).also(targets::add)
                sourceFile.inputStream().use { input -> target.outputStream().use { output -> input.copyBoundedTo(output, MAX_ATTACHMENT_BYTES) } }
                require(target.length() == source.sizeBytes) { "Attachment copy is incomplete" }
                prepared.copy(sizeBytes = target.length(), caption = source.caption, createdAt = System.currentTimeMillis())
            }
        } catch (error: Exception) {
            targets.forEach(File::delete)
            throw error
        }
    }

    private fun Throwable.authMessage(): String = when ((this as? FirebaseAuthException)?.errorCode) {
        "ERROR_USER_DISABLED" -> "This account is disabled. Contact your watershed program administrator."
        "ERROR_INVALID_CREDENTIAL", "ERROR_WRONG_PASSWORD", "ERROR_USER_NOT_FOUND" -> "Email or password is incorrect."
        "ERROR_NETWORK_REQUEST_FAILED" -> "A network connection is required for sign-in. Saved field records remain on this device."
        else -> "We couldn't sign you in. Try again or contact your program administrator."
    }

    private companion object {
        const val MAX_ATTACHMENT_BYTES = 50L * 1024 * 1024
    }
}

private fun java.io.InputStream.copyBoundedTo(output: java.io.OutputStream, maximumBytes: Long) {
    val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
    var total = 0L
    while (true) {
        val count = read(buffer)
        if (count < 0) return
        total += count
        require(total <= maximumBytes) { "The selected photo is larger than 50 MB" }
        output.write(buffer, 0, count)
    }
}
