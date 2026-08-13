package org.watershed.pawatershedwatch

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.UUID

class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val repository: ObservationRepository = MockObservationRepository(application)

    var isSignedIn by mutableStateOf(false)
        private set
    var email by mutableStateOf("maya.chen@psu.edu")
    var password by mutableStateOf("watershed")
    var authError by mutableStateOf<String?>(null)
        private set
    var connection by mutableStateOf(ConnectionState.Online)
        private set
    var draft by mutableStateOf(repository.loadDraft())
        private set
    var records by mutableStateOf(repository.loadRecords())
        private set
    var lastSubmittedId by mutableStateOf<String?>(null)
        private set

    val sites: List<Site> = PennsylvaniaSites

    fun signIn() {
        if (email.trim().lowercase() == "maya.chen@psu.edu" && password == "watershed") {
            isSignedIn = true
            authError = null
        } else {
            authError = "We couldn't sign you in. Check your email and password, then try again."
        }
    }

    fun signOut() {
        isSignedIn = false
        password = ""
    }

    fun startNewObservation() {
        persistDraft(ObservationDraft())
    }

    fun discardDraft() {
        draft = null
        repository.clearDraft()
    }

    fun updateDraft(change: (ObservationDraft) -> ObservationDraft) {
        val current = draft ?: return
        persistDraft(change(current).copy(lastSavedAt = System.currentTimeMillis()))
    }

    fun setStep(step: Int) = updateDraft { it.copy(currentStep = step.coerceIn(1, 6)) }

    fun selectSite(site: Site) = updateDraft { it.copy(siteId = site.id) }

    fun selectedSite(): Site? = sites.firstOrNull { it.id == draft?.siteId }

    fun selectTestType(type: TestType) = updateDraft {
        it.copy(testType = type, method = type.suggestedMethod, instrument = type.suggestedInstrument)
    }

    fun setLocation(latitude: Double, longitude: Double, accuracy: Float, approximateOnly: Boolean) = updateDraft {
        it.copy(
            latitude = latitude,
            longitude = longitude,
            accuracyMeters = accuracy,
            gpsState = when {
                approximateOnly -> GpsState.Approximate
                accuracy <= 20 -> GpsState.Good
                else -> GpsState.Poor
            },
        )
    }

    fun setGpsState(state: GpsState) = updateDraft { it.copy(gpsState = state) }

    fun setMeasurement(kind: MeasurementKind, value: String) = updateDraft {
        it.copy(values = it.values + (kind to value))
    }

    fun changeUnit(kind: MeasurementKind, newUnit: UnitSpec, clearIfNeeded: Boolean = false): Boolean {
        val current = draft ?: return false
        val oldUnit = current.selectedUnit(kind)
        if (oldUnit == newUnit) return true
        val raw = current.values[kind].orEmpty().trim()
        val newValue = when {
            raw.isEmpty() -> raw
            kind.preservesQuantity -> raw.toDoubleOrNull()?.let { formatEntry(oldUnit.convert(it, newUnit)) } ?: raw
            clearIfNeeded -> ""
            else -> return false
        }
        persistDraft(
            current.copy(
                values = current.values + (kind to newValue),
                unitIds = current.unitIds + (kind to newUnit.id),
                lastSavedAt = System.currentTimeMillis(),
            )
        )
        return true
    }

    fun reviewIssues(): List<String> {
        val current = draft ?: return listOf("Start an observation")
        return buildList {
            if (current.siteId == null) add("Choose a sampling site")
            if (current.collector.isBlank()) add("Enter a collector")
            if (current.latitude == null || current.longitude == null || current.accuracyMeters == null) add("Capture a GPS location")
            if (current.testType == null) add("Choose a test type")
            if (current.method.isBlank()) add("Enter a collection or measurement method")
            current.requiredMeasurements.filterNot(current::isComplete).forEach { add("Enter ${it.title}") }
            current.values.forEach { (kind, value) -> measurementError(kind, value)?.let { add("${kind.title}: $it") } }
            if (current.isCorrection && current.revisionNote.isBlank()) add("Explain what was corrected")
        }
    }

    fun submit(): String? {
        val current = draft ?: return null
        if (reviewIssues().isNotEmpty()) return null
        val site = selectedSite() ?: return null
        val testType = current.testType ?: return null
        val measurements = current.measurementValues()
        val now = System.currentTimeMillis()
        val sync = transportStateForSubmission()
        val record = ObservationRecord(
            id = UUID.randomUUID().toString(),
            site = site,
            collectedAt = current.collectedAt,
            collector = current.collector,
            testType = testType,
            method = current.method,
            instrument = current.instrument,
            measurements = measurements,
            notes = current.notes,
            photoCount = current.photoCount,
            workflow = WorkflowState.Submitted,
            sync = sync,
            revision = 1,
            revisions = listOf(Revision(1, now, WorkflowState.Submitted, "Original field submission", measurements)),
            latitude = current.latitude,
            longitude = current.longitude,
            accuracyMeters = current.accuracyMeters,
            hasAudio = current.hasAudio,
            labResultsPending = current.labResultsPending,
            requestedAnalytes = current.requestedAnalytes,
        )
        records = listOf(record) + records
        saveRecords()
        lastSubmittedId = record.id
        draft = null
        repository.clearDraft()
        finishSyncIfOnline(record.id)
        return record.id
    }

    fun startCorrection(recordId: String): Boolean {
        val record = record(recordId) ?: return false
        val values = record.measurements.associate { it.kind to it.value }
        val units = record.measurements.associate { it.kind to it.unitId }
        persistDraft(
            ObservationDraft(
                siteId = record.site.id,
                collectedAt = record.collectedAt,
                collector = record.collector,
                latitude = record.latitude ?: record.site.latitude,
                longitude = record.longitude ?: record.site.longitude,
                accuracyMeters = record.accuracyMeters ?: 6f,
                gpsState = GpsState.Good,
                testType = record.testType,
                method = record.method,
                instrument = record.instrument,
                labResultsPending = record.labResultsPending,
                requestedAnalytes = record.requestedAnalytes,
                values = values,
                unitIds = units,
                notes = record.notes,
                photoCount = record.photoCount,
                hasAudio = record.hasAudio,
                currentStep = 4,
                isCorrection = true,
                sourceRecordId = record.id,
                baseRevision = record.revision,
                correctionReason = record.correctionReason,
            )
        )
        return true
    }

    fun resubmitCorrection(): String? {
        val current = draft ?: return null
        if (!current.isCorrection || reviewIssues().isNotEmpty()) return null
        val recordId = current.sourceRecordId ?: return null
        val source = record(recordId) ?: return null
        val nextRevision = source.revision + 1
        val measurements = current.measurementValues()
        val revision = Revision(nextRevision, System.currentTimeMillis(), WorkflowState.Resubmitted, current.revisionNote.trim(), measurements)
        val updated = source.copy(
            measurements = measurements,
            notes = current.notes,
            photoCount = current.photoCount,
            hasAudio = current.hasAudio,
            workflow = WorkflowState.Resubmitted,
            sync = transportStateForSubmission(),
            revision = nextRevision,
            correctionReason = null,
            revisions = source.revisions + revision,
        )
        records = records.map { if (it.id == recordId) updated else it }
        saveRecords()
        lastSubmittedId = recordId
        draft = null
        repository.clearDraft()
        finishSyncIfOnline(recordId)
        return recordId
    }

    fun record(id: String?): ObservationRecord? = records.firstOrNull { it.id == id }

    fun retrySync(recordId: String) {
        val target = record(recordId) ?: return
        val next = when (connection) {
            ConnectionState.Online -> SyncState.Syncing
            ConnectionState.Offline -> SyncState.Waiting
            ConnectionState.ServerUnavailable -> SyncState.Failed
        }
        replaceRecord(target.copy(sync = next))
        if (next == SyncState.Syncing) finishSyncIfOnline(recordId)
    }

    fun updateConnection(state: ConnectionState) {
        connection = state
    }

    private fun persistDraft(value: ObservationDraft) {
        draft = value
        repository.saveDraft(value)
    }

    private fun ObservationDraft.measurementValues(): List<MeasurementValue> =
        MeasurementKind.entries.mapNotNull { kind ->
            values[kind]?.trim()?.takeIf(String::isNotEmpty)?.let { MeasurementValue(kind, it, selectedUnit(kind).id) }
        }

    private fun transportStateForSubmission(): SyncState = when (connection) {
        ConnectionState.Online -> SyncState.Syncing
        ConnectionState.Offline -> SyncState.Waiting
        ConnectionState.ServerUnavailable -> SyncState.Failed
    }

    private fun finishSyncIfOnline(recordId: String) {
        if (connection != ConnectionState.Online) return
        viewModelScope.launch {
            delay(1_200)
            val current = record(recordId) ?: return@launch
            if (current.sync == SyncState.Syncing && connection == ConnectionState.Online) {
                replaceRecord(current.copy(sync = SyncState.Synced))
            }
        }
    }

    private fun replaceRecord(updated: ObservationRecord) {
        records = records.map { if (it.id == updated.id) updated else it }
        saveRecords()
    }

    private fun saveRecords() = repository.saveRecords(records)
}
