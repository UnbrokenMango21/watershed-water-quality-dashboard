package org.watershed.pawatershedwatch

import android.content.Context
import androidx.core.content.edit
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

interface ObservationRepository {
    fun loadDraft(): ObservationDraft?
    fun saveDraft(draft: ObservationDraft)
    fun clearDraft()
    fun loadRecords(): List<ObservationRecord>
    fun saveRecords(records: List<ObservationRecord>)
}

class MockObservationRepository(context: Context) : ObservationRepository {
    private val preferences = context.getSharedPreferences("field_frontend", Context.MODE_PRIVATE)

    override fun loadDraft(): ObservationDraft? = preferences.getString("draft", null)?.let { raw ->
        runCatching { decodeDraft(JSONObject(raw)) }.getOrNull()
    }

    override fun saveDraft(draft: ObservationDraft) {
        preferences.edit { putString("draft", encodeDraft(draft).toString()) }
    }

    override fun clearDraft() {
        preferences.edit { remove("draft") }
    }

    override fun loadRecords(): List<ObservationRecord> = preferences.getString("records", null)?.let { raw ->
        runCatching {
            val array = JSONArray(raw)
            List(array.length()) { decodeRecord(array.getJSONObject(it)) }
        }.getOrNull()
    } ?: seedRecords()

    override fun saveRecords(records: List<ObservationRecord>) {
        val array = JSONArray().apply { records.forEach { put(encodeRecord(it)) } }
        preferences.edit { putString("records", array.toString()) }
    }

    private fun encodeDraft(draft: ObservationDraft) = JSONObject().apply {
        put("id", draft.id)
        put("siteId", draft.siteId)
        put("collectedAt", draft.collectedAt)
        put("collector", draft.collector)
        put("latitude", draft.latitude)
        put("longitude", draft.longitude)
        put("accuracy", draft.accuracyMeters?.toDouble())
        put("gpsState", draft.gpsState.name)
        put("testType", draft.testType?.name)
        put("method", draft.method)
        put("instrument", draft.instrument)
        put("labResultsPending", draft.labResultsPending)
        put("requested", JSONArray(draft.requestedAnalytes.map { it.name }))
        put("values", JSONObject().apply { draft.values.forEach { (kind, value) -> put(kind.name, value) } })
        put("units", JSONObject().apply { draft.unitIds.forEach { (kind, unit) -> put(kind.name, unit) } })
        put("notes", draft.notes)
        put("photoCount", draft.photoCount)
        put("hasAudio", draft.hasAudio)
        put("currentStep", draft.currentStep)
        put("isCorrection", draft.isCorrection)
        put("sourceRecordId", draft.sourceRecordId)
        put("baseRevision", draft.baseRevision)
        put("correctionReason", draft.correctionReason)
        put("revisionNote", draft.revisionNote)
        put("lastSavedAt", draft.lastSavedAt)
    }

    private fun decodeDraft(json: JSONObject) = ObservationDraft(
        id = json.getString("id"),
        siteId = json.optionalString("siteId"),
        collectedAt = json.optLong("collectedAt", System.currentTimeMillis()),
        collector = json.optString("collector", "Maya Chen"),
        latitude = json.optionalDouble("latitude"),
        longitude = json.optionalDouble("longitude"),
        accuracyMeters = json.optionalDouble("accuracy")?.toFloat(),
        gpsState = json.optString("gpsState").enumOr(GpsState.Acquiring),
        testType = json.optionalString("testType")?.enumOrNull<TestType>(),
        method = json.optString("method"),
        instrument = json.optString("instrument"),
        labResultsPending = json.optBoolean("labResultsPending", true),
        requestedAnalytes = json.optJSONArray("requested").enumSetOr(setOf(MeasurementKind.Chloride, MeasurementKind.Nitrate, MeasurementKind.Phosphate)),
        values = json.optJSONObject("values").enumStringMap(),
        unitIds = json.optJSONObject("units").enumStringMap(),
        notes = json.optString("notes"),
        photoCount = json.optInt("photoCount"),
        hasAudio = json.optBoolean("hasAudio"),
        currentStep = json.optInt("currentStep", 1),
        isCorrection = json.optBoolean("isCorrection"),
        sourceRecordId = json.optionalString("sourceRecordId"),
        baseRevision = json.optionalInt("baseRevision"),
        correctionReason = json.optionalString("correctionReason"),
        revisionNote = json.optString("revisionNote"),
        lastSavedAt = json.optLong("lastSavedAt", System.currentTimeMillis()),
    )

    private fun encodeRecord(record: ObservationRecord) = JSONObject().apply {
        put("id", record.id)
        put("siteId", record.site.id)
        put("collectedAt", record.collectedAt)
        put("collector", record.collector)
        put("testType", record.testType.name)
        put("method", record.method)
        put("instrument", record.instrument)
        put("measurements", encodeMeasurements(record.measurements))
        put("notes", record.notes)
        put("photoCount", record.photoCount)
        put("hasAudio", record.hasAudio)
        put("latitude", record.latitude)
        put("longitude", record.longitude)
        put("accuracy", record.accuracyMeters?.toDouble())
        put("labResultsPending", record.labResultsPending)
        put("requested", JSONArray(record.requestedAnalytes.map { it.name }))
        put("workflow", record.workflow.name)
        put("sync", record.sync.name)
        put("revision", record.revision)
        put("correctionReason", record.correctionReason)
        put("revisions", JSONArray().apply {
            record.revisions.forEach { revision ->
                put(JSONObject().apply {
                    put("number", revision.number)
                    put("createdAt", revision.createdAt)
                    put("state", revision.state.name)
                    put("note", revision.note)
                    put("measurements", encodeMeasurements(revision.measurements))
                })
            }
        })
    }

    private fun decodeRecord(json: JSONObject): ObservationRecord {
        val site = PennsylvaniaSites.firstOrNull { it.id == json.getString("siteId") } ?: PennsylvaniaSites.first()
        val revisions = json.getJSONArray("revisions").let { array ->
            List(array.length()) { index ->
                val item = array.getJSONObject(index)
                Revision(
                    number = item.getInt("number"),
                    createdAt = item.getLong("createdAt"),
                    state = item.getString("state").enumOr(WorkflowState.Submitted),
                    note = item.optString("note"),
                    measurements = decodeMeasurements(item.getJSONArray("measurements")),
                )
            }
        }
        return ObservationRecord(
            id = json.getString("id"),
            site = site,
            collectedAt = json.getLong("collectedAt"),
            collector = json.getString("collector"),
            testType = json.getString("testType").enumOr(TestType.FieldInstrument),
            method = json.getString("method"),
            instrument = json.optString("instrument"),
            measurements = decodeMeasurements(json.getJSONArray("measurements")),
            notes = json.optString("notes"),
            photoCount = json.optInt("photoCount"),
            workflow = json.getString("workflow").enumOr(WorkflowState.Submitted),
            sync = json.getString("sync").enumOr(SyncState.Synced),
            revision = json.getInt("revision"),
            correctionReason = json.optionalString("correctionReason"),
            revisions = revisions,
            latitude = json.optionalDouble("latitude") ?: site.latitude,
            longitude = json.optionalDouble("longitude") ?: site.longitude,
            accuracyMeters = json.optionalDouble("accuracy")?.toFloat() ?: 6f,
            hasAudio = json.optBoolean("hasAudio"),
            labResultsPending = json.optBoolean("labResultsPending"),
            requestedAnalytes = json.optJSONArray("requested").enumSetOr(emptySet()),
        )
    }

    private fun encodeMeasurements(values: List<MeasurementValue>) = JSONArray().apply {
        values.forEach { value ->
            put(JSONObject().apply {
                put("kind", value.kind.name)
                put("value", value.value)
                put("unitId", value.unitId)
            })
        }
    }

    private fun decodeMeasurements(array: JSONArray) = List(array.length()) { index ->
        val item = array.getJSONObject(index)
        val kind = item.getString("kind").enumOr(MeasurementKind.Temperature)
        MeasurementValue(kind, item.getString("value"), item.optString("unitId", kind.units.first().id))
    }

    private fun seedRecords(): List<ObservationRecord> {
        val now = System.currentTimeMillis()
        val correctionMeasurements = listOf(
            MeasurementValue(MeasurementKind.Temperature, "17.8", Units.Celsius.id),
            MeasurementValue(MeasurementKind.Ph, "7.42", Units.Ph.id),
            MeasurementValue(MeasurementKind.DissolvedOxygen, "91", Units.MgO2L.id),
            MeasurementValue(MeasurementKind.Conductivity, "328", Units.UsCm.id),
        )
        val submittedMeasurements = listOf(
            MeasurementValue(MeasurementKind.Temperature, "22.1", Units.Celsius.id),
            MeasurementValue(MeasurementKind.Ph, "7.8", Units.Ph.id),
            MeasurementValue(MeasurementKind.DissolvedOxygen, "8.4", Units.MgO2L.id),
            MeasurementValue(MeasurementKind.Conductivity, "412", Units.UsCm.id),
        )
        return listOf(
            ObservationRecord(
                id = "obs-needs-correction",
                site = PennsylvaniaSites[0],
                collectedAt = now - 86_400_000,
                collector = "Maya Chen",
                testType = TestType.FieldInstrument,
                method = "Direct instrument reading at mid-channel, 10 cm depth",
                instrument = "YSI ProDSS · Unit 4412",
                measurements = correctionMeasurements,
                notes = "Clear water following overnight rain. Moderate riffle flow.",
                photoCount = 2,
                workflow = WorkflowState.NeedsCorrection,
                sync = SyncState.Synced,
                revision = 1,
                correctionReason = "Dissolved oxygen appears to be off by one decimal place. Verify the source sheet and submit a correction.",
                revisions = listOf(Revision(1, now - 86_400_000, WorkflowState.Submitted, "Original field submission", correctionMeasurements)),
            ),
            ObservationRecord(
                id = "obs-city-island",
                site = PennsylvaniaSites[3],
                collectedAt = now - 3 * 86_400_000,
                collector = "Maya Chen",
                testType = TestType.Mixed,
                method = "Direct reading and grab sample from river-right bank",
                instrument = "YSI ProDSS · Unit 4412",
                measurements = submittedMeasurements,
                notes = "River stage stable; light boat traffic during collection.",
                photoCount = 1,
                workflow = WorkflowState.Submitted,
                sync = SyncState.Synced,
                revision = 1,
                revisions = listOf(Revision(1, now - 3 * 86_400_000, WorkflowState.Submitted, "Original field submission", submittedMeasurements)),
            ),
        )
    }
}

private fun JSONObject.optionalString(key: String): String? =
    if (isNull(key)) null else optString(key).takeIf(String::isNotBlank)

private fun JSONObject.optionalDouble(key: String): Double? =
    if (isNull(key) || !has(key)) null else optDouble(key).takeIf(Double::isFinite)

private fun JSONObject.optionalInt(key: String): Int? =
    if (isNull(key) || !has(key)) null else getInt(key)

private inline fun <reified T : Enum<T>> String.enumOr(fallback: T): T =
    enumValues<T>().firstOrNull { it.name == this } ?: fallback

private inline fun <reified T : Enum<T>> String.enumOrNull(): T? =
    enumValues<T>().firstOrNull { it.name == this }

private inline fun <reified T : Enum<T>> JSONArray?.enumSetOr(fallback: Set<T>): Set<T> {
    if (this == null) return fallback
    return (0 until length()).mapNotNull { optString(it).enumOrNull<T>() }.toSet()
}

private inline fun <reified T : Enum<T>> JSONObject?.enumStringMap(): Map<T, String> {
    if (this == null) return emptyMap()
    return keys().asSequence().mapNotNull { key -> key.enumOrNull<T>()?.let { it to getString(key) } }.toMap()
}
