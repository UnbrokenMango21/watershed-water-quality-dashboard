package org.watershed.pawatershedwatch

import com.google.firebase.Timestamp
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.GeoPoint
import java.security.MessageDigest
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Date
import java.util.UUID

@JvmInline value class SubmissionId(val value: String) { companion object { fun new() = SubmissionId(UUID.randomUUID().toString()) } }
@JvmInline value class EventId(val value: String) { companion object { fun new() = EventId(UUID.randomUUID().toString()) } }
@JvmInline value class RevisionId(val value: String) { companion object { fun new() = RevisionId(UUID.randomUUID().toString()) } }
@JvmInline value class MeasurementId(val value: String)
@JvmInline value class AttachmentId(val value: String) { companion object { fun new() = AttachmentId(UUID.randomUUID().toString()) } }
@JvmInline value class SiteId(val value: String)

enum class ProductionSupport { FULLY_SUPPORTED, FEATURE_GATED }

data class ProductionMeasurementSpec(
    val kind: MeasurementKind,
    val parameterCode: String?,
    val canonicalUnit: String?,
    val target: String?,
    val support: ProductionSupport,
)

object ProductionMeasurementCatalog {
    val entries = MeasurementKind.entries.map { kind ->
        when (kind) {
            MeasurementKind.Temperature -> ProductionMeasurementSpec(kind, "WATER_TEMP_C", "degC", "revision_temperature", ProductionSupport.FULLY_SUPPORTED)
            MeasurementKind.Ph -> ProductionMeasurementSpec(kind, "PH", "pH", "measurement", ProductionSupport.FULLY_SUPPORTED)
            MeasurementKind.DissolvedOxygen -> ProductionMeasurementSpec(kind, "DO_MG_L", "mg/L", "measurement", ProductionSupport.FULLY_SUPPORTED)
            MeasurementKind.DissolvedOxygenSaturation -> ProductionMeasurementSpec(kind, "DO_PERCENT", "percent", "measurement", ProductionSupport.FULLY_SUPPORTED)
            MeasurementKind.Conductivity -> ProductionMeasurementSpec(kind, "CONDUCTIVITY_US_CM", "uS/cm", "measurement", ProductionSupport.FULLY_SUPPORTED)
            MeasurementKind.Tds -> ProductionMeasurementSpec(kind, "TDS_MG_L", "mg/L", "measurement", ProductionSupport.FULLY_SUPPORTED)
            MeasurementKind.Orp -> ProductionMeasurementSpec(kind, "ORP_MV", "mV", "measurement", ProductionSupport.FULLY_SUPPORTED)
            MeasurementKind.Chloride -> ProductionMeasurementSpec(kind, "CHLORIDE_MG_L", "mg/L", "measurement", ProductionSupport.FULLY_SUPPORTED)
            MeasurementKind.Sulfate -> ProductionMeasurementSpec(kind, "SULFATE_MG_L", "mg/L", "measurement", ProductionSupport.FULLY_SUPPORTED)
            MeasurementKind.Nitrate -> ProductionMeasurementSpec(kind, "NITRATE_MG_L", "mg/L as N", "measurement", ProductionSupport.FULLY_SUPPORTED)
            MeasurementKind.Phosphate -> ProductionMeasurementSpec(kind, "PHOSPHATE_MG_L", "mg/L as P", "measurement", ProductionSupport.FULLY_SUPPORTED)
            MeasurementKind.Flow -> ProductionMeasurementSpec(kind, "DISCHARGE_M3_S", "m3/s", "measurement", ProductionSupport.FULLY_SUPPORTED)
            else -> ProductionMeasurementSpec(kind, null, null, null, ProductionSupport.FEATURE_GATED)
        }
    }
    private val byKind = entries.associateBy(ProductionMeasurementSpec::kind)
    fun spec(kind: MeasurementKind) = requireNotNull(byKind[kind])
}

enum class AttachmentKind { SITE_PHOTO, INSTRUMENT_PHOTO, TEST_RESULT, OTHER }
enum class AttachmentTransferState { LOCAL_ONLY, WAITING, UPLOADING, UPLOADED, FAILED }

data class ObservationAttachment(
    val id: AttachmentId = AttachmentId.new(),
    val ownerUid: String,
    val submissionId: SubmissionId,
    val revisionId: RevisionId,
    val localPath: String,
    val contentType: String,
    val sizeBytes: Long,
    val kind: AttachmentKind,
    val caption: String? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val transferState: AttachmentTransferState = AttachmentTransferState.LOCAL_ONLY,
    val remoteStoragePath: String? = null,
    val lastError: String? = null,
) {
    val isPhoto: Boolean get() = contentType.startsWith("image/")
    val isAudio: Boolean get() = contentType.startsWith("audio/")
}

data class CanonicalMeasurement(
    val id: MeasurementId,
    val kind: MeasurementKind,
    val parameterCode: String,
    val displayName: String,
    val enteredValue: Double,
    val enteredUnitId: String,
    val enteredUnit: String,
    val value: Double,
    val unitCode: String,
)

data class CanonicalObservationSnapshot(
    val submissionId: SubmissionId,
    val eventId: EventId,
    val revisionId: RevisionId,
    val revisionNo: Int,
    val ownerUid: String,
    val siteId: SiteId,
    val createdAt: Long,
    val collectedAt: Long,
    val submittedAt: Long,
    val latitude: Double,
    val longitude: Double,
    val gpsAccuracyM: Double,
    val collectorDisplayName: String,
    val testType: String,
    val testTypeOther: String?,
    val methodName: String,
    val instrumentName: String,
    val fieldNotes: String?,
    val temperatureEnteredValue: Double,
    val temperatureEnteredUnit: String,
    val tempC: Double,
    val tempF: Double,
    val measurements: List<CanonicalMeasurement>,
    val attachments: List<ObservationAttachment>,
    val appVersion: String,
    val correction: Boolean,
)

object CanonicalIds {
    fun measurement(revisionId: RevisionId, parameterCode: String): MeasurementId {
        val bytes = MessageDigest.getInstance("SHA-256")
            .digest("${revisionId.value}|$parameterCode".toByteArray(Charsets.UTF_8))
            .copyOfRange(0, 16)
        bytes[6] = ((bytes[6].toInt() and 0x0f) or 0x50).toByte()
        bytes[8] = ((bytes[8].toInt() and 0x3f) or 0x80).toByte()
        return MeasurementId(UUID(
            bytes.take(8).fold(0L) { acc, byte -> (acc shl 8) or (byte.toLong() and 0xff) },
            bytes.drop(8).fold(0L) { acc, byte -> (acc shl 8) or (byte.toLong() and 0xff) },
        ).toString())
    }
}

object EasternTime {
    val zone: ZoneId = ZoneId.of("America/New_York")
    fun display(epochMillis: Long): ZonedDateTime = Instant.ofEpochMilli(epochMillis).atZone(zone)
    fun replaceDate(epochMillis: Long, year: Int, monthOneBased: Int, day: Int): Long =
        display(epochMillis).withYear(year).withMonth(monthOneBased).withDayOfMonth(day).toInstant().toEpochMilli()
    fun replaceTime(epochMillis: Long, hour: Int, minute: Int): Long =
        display(epochMillis).withHour(hour).withMinute(minute).withSecond(0).withNano(0).toInstant().toEpochMilli()
    fun offsetString(epochMillis: Long): String = display(epochMillis).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)
}

fun ObservationDraft.toCanonicalSnapshot(ownerUid: String, appVersion: String, submittedAt: Long = System.currentTimeMillis()): CanonicalObservationSnapshot {
    require(this.ownerUid == ownerUid) { "Draft owner does not match authenticated user" }
    require(ownerUid.isNotBlank()) { "Authenticated owner is required" }
    require(revisionNo >= 1) { "Revision number must be positive" }
    val siteId = requireNotNull(siteId) { "Sampling site is required" }
    val latitude = requireNotNull(latitude) { "GPS latitude is required" }
    val longitude = requireNotNull(longitude) { "GPS longitude is required" }
    val accuracy = requireNotNull(accuracyMeters) { "GPS accuracy is required" }
    require(latitude in -90.0..90.0 && longitude in -180.0..180.0 && !(latitude == 0.0 && longitude == 0.0)) { "Valid field GPS is required" }
    require(accuracy.isFinite() && accuracy >= 0) { "GPS accuracy must be finite and non-negative" }
    val test = requireNotNull(testType) { "Test type is required" }
    require(test != TestType.Other || testTypeOther.isNotBlank()) { "Other test type requires a description" }
    require(collector.isNotBlank()) { "Collector display name is required" }
    require(method.isNotBlank()) { "Measurement method is required" }
    require(instrument.isNotBlank()) { "Instrument or laboratory is required" }
    require(requiredComplete) { "Measurements do not meet the production validation profile" }
    attachments.forEach { attachment ->
        require(attachment.ownerUid == ownerUid && attachment.submissionId == submissionId && attachment.revisionId == revisionId) { "Attachment identity does not match this revision" }
        require(attachment.sizeBytes in 1..50L * 1024 * 1024) { "Attachment size is invalid" }
        require(attachment.contentType in setOf("image/jpeg", "image/png", "image/heic", "audio/mp4", "audio/m4a", "application/pdf")) { "Attachment type is not allowed" }
    }
    val temperatureRaw = requireNotNull(values[MeasurementKind.Temperature]?.trim()?.toDoubleOrNull()) { "Water temperature is required" }
    require(temperatureRaw.isFinite()) { "Water temperature must be finite" }
    val temperatureUnit = selectedUnit(MeasurementKind.Temperature)
    measurementErrorMessage(MeasurementKind.Temperature, values.getValue(MeasurementKind.Temperature), temperatureUnit)
        ?.let { throw IllegalArgumentException(it) }
    val tempC = temperatureUnit.convert(temperatureRaw, Units.Celsius)
    val tempF = Units.Celsius.convert(tempC, Units.Fahrenheit)
    val canonicalMeasurements = values.mapNotNull { (kind, raw) ->
        if (kind == MeasurementKind.Temperature || raw.isBlank()) return@mapNotNull null
        val spec = ProductionMeasurementCatalog.spec(kind)
        require(spec.support == ProductionSupport.FULLY_SUPPORTED) { "${kind.title} is not enabled by the production contract" }
        val entered = requireNotNull(raw.toDoubleOrNull()) { "${kind.title} must be numeric" }
        require(entered.isFinite()) { "${kind.title} must be finite" }
        val selected = selectedUnit(kind)
        measurementErrorMessage(kind, raw, selected)?.let { throw IllegalArgumentException(it) }
        val canonicalUnit = kind.units.first()
        val canonical = BigDecimal.valueOf(selected.convert(entered, canonicalUnit)).setScale(12, RoundingMode.HALF_EVEN).stripTrailingZeros().toDouble()
        CanonicalMeasurement(
            id = CanonicalIds.measurement(revisionId, requireNotNull(spec.parameterCode)),
            kind = kind,
            parameterCode = spec.parameterCode,
            displayName = kind.title,
            enteredValue = entered,
            enteredUnitId = selected.id,
            enteredUnit = selected.menuTitle,
            value = canonical,
            unitCode = requireNotNull(spec.canonicalUnit),
        )
    }.sortedBy { it.kind.ordinal }

    return CanonicalObservationSnapshot(
        submissionId, eventId, revisionId, revisionNo, ownerUid, SiteId(siteId), createdAt, collectedAt,
        submittedAt, latitude, longitude, accuracy, collector.trim(), test.label, testTypeOther.trim().ifBlank { null },
        method.trim(), instrument.trim(), notes.trim().ifBlank { null }, temperatureRaw,
        if (temperatureUnit == Units.Celsius) "C" else "F", tempC, tempF, canonicalMeasurements,
        attachments, appVersion, isCorrection,
    )
}

object FirestoreObservationMapper {
    const val SCHEMA_VERSION = "0.1.0"

    /**
     * firebase/firestore.rules requires `submitted_at == request.time` on every collector-authored
     * submission and revision write, so the value has to be the trusted server sentinel rather than a
     * client clock reading. Drafts keep writing null until the record is actually submitted.
     */
    private fun submittedAt(status: String): Any? = if (status == "DRAFT") null else FieldValue.serverTimestamp()

    fun submission(snapshot: CanonicalObservationSnapshot, status: String): Map<String, Any?> = mapOf(
        "submission_id" to snapshot.submissionId.value,
        "event_id" to snapshot.eventId.value,
        "collector_user_id" to snapshot.ownerUid,
        "site_id" to snapshot.siteId.value,
        "status" to status,
        "current_revision_id" to snapshot.revisionId.value,
        "current_revision_no" to snapshot.revisionNo,
        "latest_collected_at" to Timestamp(Date(snapshot.collectedAt)),
        "created_at" to Timestamp(Date(snapshot.createdAt)),
        "updated_at" to Timestamp(Date(snapshot.submittedAt)),
        "submitted_at" to submittedAt(status),
        "schema_version" to SCHEMA_VERSION,
        "mobile_app_version" to snapshot.appVersion,
    )

    fun revision(snapshot: CanonicalObservationSnapshot, status: String): Map<String, Any?> = mapOf(
        "revision_id" to snapshot.revisionId.value,
        "revision_no" to snapshot.revisionNo,
        "submission_id" to snapshot.submissionId.value,
        "event_id" to snapshot.eventId.value,
        "collector_user_id" to snapshot.ownerUid,
        "site_id" to snapshot.siteId.value,
        "revision_status" to status,
        "created_at" to Timestamp(Date(snapshot.createdAt)),
        "submitted_at" to submittedAt(status),
        "collected_at" to Timestamp(Date(snapshot.collectedAt)),
        "time_known" to true,
        "time_imputed" to false,
        "latitude" to snapshot.latitude,
        "longitude" to snapshot.longitude,
        "location" to GeoPoint(snapshot.latitude, snapshot.longitude),
        "gps_accuracy_m" to snapshot.gpsAccuracyM,
        "site_distance_m" to null,
        "weather_condition" to "",
        "data_collected_by" to snapshot.collectorDisplayName,
        "test_type" to snapshot.testType,
        "test_type_other" to snapshot.testTypeOther,
        "method_name" to snapshot.methodName,
        "instrument_name" to snapshot.instrumentName,
        "instrument_other" to null,
        "temp_entered_value" to snapshot.temperatureEnteredValue,
        "temp_entered_unit" to snapshot.temperatureEnteredUnit,
        "temp_c" to snapshot.tempC,
        "temp_f" to snapshot.tempF,
        "field_notes_original" to snapshot.fieldNotes,
        "schema_version" to SCHEMA_VERSION,
        "mobile_app_version" to snapshot.appVersion,
    )

    fun measurement(snapshot: CanonicalObservationSnapshot, value: CanonicalMeasurement): Map<String, Any?> = mapOf(
        "measurement_id" to value.id.value,
        "parameter_code" to value.parameterCode,
        "display_name" to value.displayName,
        "value" to value.value,
        "unit_code" to value.unitCode,
        "entered_value" to value.enteredValue,
        "entered_unit_code" to value.enteredUnitId,
        "method_name" to snapshot.methodName,
        "instrument_name" to snapshot.instrumentName,
        "qualifier" to null,
        "notes" to null,
        "entered_at" to Timestamp(Date(snapshot.collectedAt)),
    )

    fun attachment(snapshot: CanonicalObservationSnapshot, value: ObservationAttachment, storagePath: String): Map<String, Any?> = mapOf(
        "attachment_id" to value.id.value,
        "storage_path" to storagePath,
        "content_type" to value.contentType,
        "size_bytes" to value.sizeBytes,
        "kind" to value.kind.name,
        "caption" to value.caption,
        "created_at" to Timestamp(Date(value.createdAt)),
    )
}

fun Timestamp.isoInstant(): String = toDate().toInstant().toString()
