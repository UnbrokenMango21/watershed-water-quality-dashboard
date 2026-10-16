package org.watershed.pawatershedwatch

import java.math.BigDecimal
import java.math.MathContext
import java.text.DateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

enum class ConnectionState(val label: String) {
    Online("Online"),
    Offline("Work Offline"),
    ServerUnavailable("Archive Unavailable"),
}

enum class SyncState(val label: String) {
    SavedLocally("Saved locally"),
    Waiting("Waiting to sync"),
    Syncing("Syncing"),
    Synced("Synced"),
    Failed("Sync failed"),
}

enum class WorkflowState(val label: String, val backendValue: String) {
    Draft("Draft", "DRAFT"),
    Submitted("Submitted", "SUBMITTED"),
    Validating("Validating", "VALIDATING"),
    PendingReview("Pending Review", "PENDING_REVIEW"),
    NeedsCorrection("Needs Correction", "NEEDS_CORRECTION"),
    Resubmitted("Resubmitted", "RESUBMITTED"),
    Approved("Approved", "APPROVED"),
    Rejected("Rejected", "REJECTED"),
    Publishing("Publishing", "PUBLISHING"),
    PublishFailed("Publish Failed", "PUBLISH_FAILED"),
    Published("Published", "PUBLISHED");

    companion object {
        fun fromBackend(value: String): WorkflowState? = entries.firstOrNull { it.backendValue == value }
    }
}

enum class GpsState(val label: String) {
    Acquiring("Acquiring location"),
    Good("Good accuracy"),
    Poor("Poor accuracy"),
    Approximate("Approximate location"),
    Denied("Location denied"),
    Unavailable("Location unavailable"),
}

data class Site(
    val id: String,
    val name: String,
    val county: String,
    val watershed: String,
    val latitude: Double,
    val longitude: Double,
    val cached: Boolean,
    val distance: String,
) {
    val position: String
        get() = String.format(Locale.US, "%.4f° N · %.4f° W", latitude, -longitude)
}

object FieldObservationVocabulary {
    val weather = listOf("Clear", "Partly Cloudy", "Cloudy", "Overcast", "Light Rain", "Heavy Rain", "Snow", "Windy", "Other", "Unknown")
    val waterColor = listOf("Clear", "Light Brown", "Dark Brown", "Greenish", "Turbid/Murky", "Other", "Unknown")
    val flow = listOf("No Visible Flow", "Low", "Moderate", "High", "Unknown")
}

enum class CollectionStage { DRAFT, FIELD_COLLECTED, LAB_PENDING, LAB_COMPLETED, READY_FOR_REVIEW }

/** Where a value was analyzed. Laboratory-dependent parameters default to LAB. */
enum class AnalysisStage(val label: String) {
    LAB("Laboratory"),
    FIELD("Field — documented protocol"),
}

/**
 * Per-parameter analysis provenance for a laboratory-dependent value (chloride, sulfate, nitrate,
 * phosphate). [analyzedAt] stays null until the collector records it; it is never invented.
 */
data class AnalysisProvenance(
    val stage: AnalysisStage = AnalysisStage.LAB,
    val method: String = "",
    val instrument: String = "",
    val analyzedAt: Long? = null,
    val fieldExceptionReason: String = "",
)

const val FIELD_EXCEPTION_REASON_MAX = 1000
/** Clock skew tolerated before an analysis time counts as "in the future" (matches iOS). */
const val ANALYSIS_FUTURE_TOLERANCE_MS = 5 * 60 * 1000L

enum class TestType(
    val label: String,
    val suggestedMethod: String,
    val suggestedInstrument: String,
) {
    FieldInstrument("In-situ / Field Instrument", "Direct instrument reading", "YSI ProDSS · Unit 4412"),
    PennStateLab("Penn State Lab", "Grab sample", "Penn State Agricultural Analytical Services Laboratory"),
    ExternalLab("External Lab", "Grab sample", "DEP Accredited Laboratory"),
    FieldKit("Field Kit / Colorimetric", "Colorimetric field test", "Hach Colorimetric Field Kit"),
    Sonde("Continuous Sensor / Sonde", "15 minute deployment", "EXO2 Multiparameter Sonde"),
    Mixed("Mixed In-situ + Lab", "Direct reading and grab sample", "YSI ProDSS · Unit 4412"),
    Other("Other", "Other", ""),
    ;

    companion object {
        /**
         * Choices offered for a new observation (parity with iOS). Sonde and combined field-and-lab stay
         * valid stored values for older records and corrections, but are not offered until the program
         * confirms they are part of this collection protocol (docs/SUPERVISOR_QUESTIONS.md).
         */
        val offeredForNewObservations = listOf(FieldInstrument, FieldKit, PennStateLab, ExternalLab, Other)
    }
}

data class UnitSpec(
    val id: String,
    val numerator: String,
    val denominator: String? = null,
    val menuTitle: String,
    val spokenName: String,
    val scaleToBase: Double = 1.0,
    val offsetToBase: Double = 0.0,
) {
    val inlineSymbol: String get() = denominator?.let { "$numerator/$it" } ?: numerator

    fun convert(value: Double, to: UnitSpec): Double =
        (value * scaleToBase + offsetToBase - to.offsetToBase) / to.scaleToBase
}

object Units {
    val Celsius = UnitSpec("celsius", "°C", menuTitle = "Degrees Celsius (°C)", spokenName = "degrees Celsius")
    val Fahrenheit = UnitSpec("fahrenheit", "°F", menuTitle = "Degrees Fahrenheit (°F)", spokenName = "degrees Fahrenheit", scaleToBase = 5.0 / 9.0, offsetToBase = -160.0 / 9.0)
    val Ph = UnitSpec("ph-standard", "pH", menuTitle = "pH standard units", spokenName = "pH standard units")
    val Percent = UnitSpec("percent", "%", menuTitle = "Percent saturation (%)", spokenName = "percent saturation")
    val MgO2L = UnitSpec("mg-o2-l", "mg O₂", "L", "mg/L as O₂", "milligrams per liter as oxygen")
    val UmolO2L = UnitSpec("umol-o2-l", "µmol O₂", "L", "µmol/L as O₂", "micromoles per liter as oxygen", .0319988)
    val UsCm = UnitSpec("us-cm", "µS", "cm", "µS/cm", "microsiemens per centimeter")
    val MsCm = UnitSpec("ms-cm", "mS", "cm", "mS/cm", "millisiemens per centimeter", 1_000.0)
    val SM = UnitSpec("s-m", "S", "m", "S/m", "siemens per meter", 10_000.0)
    val MgL = UnitSpec("mg-l", "mg", "L", "mg/L", "milligrams per liter")
    val UgL = UnitSpec("ug-l", "µg", "L", "µg/L", "micrograms per liter", .001)
    val GL = UnitSpec("g-l", "g", "L", "g/L", "grams per liter", 1_000.0)
    val Mv = UnitSpec("mv", "mV", menuTitle = "Millivolts (mV)", spokenName = "millivolts")
    val V = UnitSpec("v", "V", menuTitle = "Volts (V)", spokenName = "volts", scaleToBase = 1_000.0)
    val MgNL = UnitSpec("mg-n-l", "mg N", "L", "mg/L as N", "milligrams per liter as nitrogen")
    val UgNL = UnitSpec("ug-n-l", "µg N", "L", "µg/L as N", "micrograms per liter as nitrogen", .001)
    val MgNo3L = UnitSpec("mg-no3-l", "mg NO₃⁻", "L", "mg/L as NO₃", "milligrams per liter as nitrate", 14.0 / 62.0)
    val UgNo3L = UnitSpec("ug-no3-l", "µg NO₃⁻", "L", "µg/L as NO₃", "micrograms per liter as nitrate", .014 / 62.0)
    val MgNo2L = UnitSpec("mg-no2-l", "mg NO₂⁻", "L", "mg/L as NO₂", "milligrams per liter as nitrite", 14.0 / 46.0)
    val UgNo2L = UnitSpec("ug-no2-l", "µg NO₂⁻", "L", "µg/L as NO₂", "micrograms per liter as nitrite", .014 / 46.0)
    val MgPL = UnitSpec("mg-p-l", "mg P", "L", "mg/L as P", "milligrams per liter as phosphorus")
    val UgPL = UnitSpec("ug-p-l", "µg P", "L", "µg/L as P", "micrograms per liter as phosphorus", .001)
    val MgPo4L = UnitSpec("mg-po4-l", "mg PO₄³⁻", "L", "mg/L as PO₄", "milligrams per liter as phosphate", .326315789)
    val UgPo4L = UnitSpec("ug-po4-l", "µg PO₄³⁻", "L", "µg/L as PO₄", "micrograms per liter as phosphate", .000326315789)
    val Meters = UnitSpec("m", "m", menuTitle = "Meters (m)", spokenName = "meters")
    val Centimeters = UnitSpec("cm", "cm", menuTitle = "Centimeters (cm)", spokenName = "centimeters", scaleToBase = 0.01)
    val Feet = UnitSpec("ft", "ft", menuTitle = "Feet (ft)", spokenName = "feet", scaleToBase = 0.3048)
    val M3S = UnitSpec("m3-s", "m³", "s", "m³/s", "cubic meters per second")
    val LS = UnitSpec("l-s", "L", "s", "L/s", "liters per second", .001)
    val Ft3S = UnitSpec("ft3-s", "ft³", "s", "ft³/s (cfs)", "cubic feet per second", .028316846592)
    val GalMin = UnitSpec("gal-min", "gal", "min", "US gal/min", "US gallons per minute", .0000630901964)
    val Ntu = UnitSpec("ntu", "NTU", menuTitle = "NTU · white-light method", spokenName = "nephelometric turbidity units")
    val Fnu = UnitSpec("fnu", "FNU", menuTitle = "FNU · infrared method", spokenName = "formazin nephelometric units")
    val Pss78 = UnitSpec("pss78", "PSS-78", menuTitle = "PSS-78 · unitless", spokenName = "unitless practical salinity scale 1978")
    val Ppt = UnitSpec("ppt", "‰", menuTitle = "Parts per thousand (‰)", spokenName = "parts per thousand")
    val MgCaCo3L = UnitSpec("mg-caco3-l", "mg CaCO₃", "L", "mg/L as CaCO₃", "milligrams per liter as calcium carbonate")
    val MeqL = UnitSpec("meq-l", "meq", "L", "meq/L", "milliequivalents per liter", 50.04345)
    val UgChlaL = UnitSpec("ug-chla-l", "µg Chl-a", "L", "µg/L chlorophyll a", "micrograms chlorophyll a per liter")
    val MgChlaM3 = UnitSpec("mg-chla-m3", "mg Chl-a", "m³", "mg/m³ chlorophyll a", "milligrams chlorophyll a per cubic meter")
    val Cfu100 = UnitSpec("cfu-100ml", "CFU", "100 mL", "CFU/100 mL · membrane count", "colony-forming units per 100 milliliters")
    val Mpn100 = UnitSpec("mpn-100ml", "MPN", "100 mL", "MPN/100 mL · statistical estimate", "most probable number per 100 milliliters")

    val all = listOf(
        Celsius, Fahrenheit, Ph, Percent, MgO2L, UmolO2L, UsCm, MsCm, SM, MgL, UgL, GL,
        Mv, V, MgNL, UgNL, MgNo3L, UgNo3L, MgNo2L, UgNo2L, MgPL, UgPL, MgPo4L, UgPo4L,
        Meters, Centimeters, Feet, M3S, LS, Ft3S, GalMin, Ntu, Fnu, Pss78, Ppt, MgCaCo3L, MeqL, UgChlaL, MgChlaM3,
        Cfu100, Mpn100,
    )

    fun byId(id: String): UnitSpec? = all.firstOrNull { it.id == id }
}

enum class MeasurementKind(val title: String, val contractCode: String? = null) {
    Temperature("Water Temperature", "WATER_TEMP_C"),
    Ph("pH", "PH"),
    DissolvedOxygen("Dissolved Oxygen", "DO_MG_L"),
    DissolvedOxygenSaturation("Dissolved Oxygen Saturation", "DO_PERCENT"),
    Conductivity("Conductivity", "CONDUCTIVITY_US_CM"),
    Tds("Total Dissolved Solids", "TDS_MG_L"),
    Orp("ORP", "ORP_MV"),
    Chloride("Chloride", "CHLORIDE_MG_L"),
    Sulfate("Sulfate", "SULFATE_MG_L"),
    Nitrate("Nitrate", "NITRATE_MG_L"),
    Phosphate("Phosphate", "PHOSPHATE_MG_L"),
    Flow("Discharge / Flow", "DISCHARGE_M3_S"),
    WaterDepth("Water Depth", "WATER_DEPTH_M"),
    Turbidity("Turbidity"),
    Salinity("Salinity"),
    TotalSuspendedSolids("Total Suspended Solids"),
    Alkalinity("Alkalinity"),
    Hardness("Hardness"),
    AmmoniaNitrogen("Ammonia Nitrogen"),
    NitriteNitrogen("Nitrite Nitrogen"),
    TotalPhosphorus("Total Phosphorus"),
    ChlorophyllA("Chlorophyll a"),
    EColi("E. coli"),
}

val MeasurementKind.units: List<UnitSpec>
    get() = when (this) {
        MeasurementKind.Temperature -> listOf(Units.Celsius, Units.Fahrenheit)
        MeasurementKind.Ph -> listOf(Units.Ph)
        MeasurementKind.DissolvedOxygen -> listOf(Units.MgO2L, Units.UmolO2L)
        MeasurementKind.DissolvedOxygenSaturation -> listOf(Units.Percent)
        MeasurementKind.Conductivity -> listOf(Units.UsCm, Units.MsCm, Units.SM)
        MeasurementKind.Tds, MeasurementKind.TotalSuspendedSolids -> listOf(Units.MgL, Units.GL)
        MeasurementKind.Orp -> listOf(Units.Mv, Units.V)
        MeasurementKind.Chloride, MeasurementKind.Sulfate -> listOf(Units.MgL, Units.UgL)
        MeasurementKind.Nitrate -> listOf(Units.MgNL, Units.UgNL, Units.MgNo3L, Units.UgNo3L)
        MeasurementKind.Phosphate -> listOf(Units.MgPL, Units.UgPL, Units.MgPo4L, Units.UgPo4L)
        MeasurementKind.WaterDepth -> listOf(Units.Meters, Units.Centimeters, Units.Feet)
        MeasurementKind.Flow -> listOf(Units.M3S, Units.LS, Units.Ft3S, Units.GalMin)
        MeasurementKind.Turbidity -> listOf(Units.Ntu, Units.Fnu)
        MeasurementKind.Salinity -> listOf(Units.Pss78, Units.Ppt)
        MeasurementKind.Alkalinity, MeasurementKind.Hardness -> listOf(Units.MgCaCo3L, Units.MeqL)
        MeasurementKind.AmmoniaNitrogen -> listOf(Units.MgNL, Units.UgNL)
        MeasurementKind.NitriteNitrogen -> listOf(Units.MgNL, Units.UgNL, Units.MgNo2L, Units.UgNo2L)
        MeasurementKind.TotalPhosphorus -> listOf(Units.MgPL, Units.UgPL, Units.MgPo4L, Units.UgPo4L)
        MeasurementKind.ChlorophyllA -> listOf(Units.UgChlaL, Units.MgChlaM3)
        MeasurementKind.EColi -> listOf(Units.Cfu100, Units.Mpn100)
    }

val MeasurementKind.preservesQuantity: Boolean
    get() = this !in setOf(MeasurementKind.Turbidity, MeasurementKind.Salinity, MeasurementKind.EColi)

val MeasurementKind.allowsNegative: Boolean
    get() = this == MeasurementKind.Orp || this == MeasurementKind.Temperature

/** Laboratory-dependent parameters: each value records its own analysis stage, method and time. */
val MeasurementKind.needsAnalysisProvenance: Boolean
    get() = this == MeasurementKind.Chloride || this == MeasurementKind.Sulfate ||
        this == MeasurementKind.Nitrate || this == MeasurementKind.Phosphate

enum class WorkflowStep(val number: Int) {
    Site(1),
    VisitDetails(2),
    TestMethod(3),
    Measurements(4),
    NotesMedia(5),
    Review(6),
}

data class ReviewIssue(val message: String, val step: WorkflowStep, val measurementKind: MeasurementKind? = null)

data class ObservationDraft(
    val submissionId: SubmissionId = SubmissionId.new(),
    val eventId: EventId = EventId.new(),
    val revisionId: RevisionId = RevisionId.new(),
    val revisionNo: Int = 1,
    val ownerUid: String = "",
    val createdAt: Long = System.currentTimeMillis(),
    val siteId: String? = null,
    val collectedAt: Long = System.currentTimeMillis(),
    val collector: String = "",
    val latitude: Double? = null,
    val longitude: Double? = null,
    val accuracyMeters: Double? = null,
    val gpsState: GpsState = GpsState.Acquiring,
    val testType: TestType? = null,
    val testTypeOther: String = "",
    val method: String = "",
    val instrument: String = "",
    val labResultsPending: Boolean = false,
    val weatherCondition: String = "",
    val waterColor: String = "",
    val flowCondition: String = "",
    val collectionStage: CollectionStage = CollectionStage.DRAFT,
    val fieldCollectedAt: Long? = null,
    val labCompletedAt: Long? = null,
    val requestedAnalytes: Set<MeasurementKind> = setOf(MeasurementKind.Chloride, MeasurementKind.Nitrate, MeasurementKind.Phosphate),
    val values: Map<MeasurementKind, String> = emptyMap(),
    val unitIds: Map<MeasurementKind, String> = emptyMap(),
    val analysisDetails: Map<MeasurementKind, AnalysisProvenance> = emptyMap(),
    val notes: String = "",
    val attachments: List<ObservationAttachment> = emptyList(),
    val currentStep: Int = 1,
    val isCorrection: Boolean = false,
    val sourceRecordId: String? = null,
    val baseRevision: Int? = null,
    val correctionReason: String? = null,
    val revisionNote: String = "",
    val lastSavedAt: Long = System.currentTimeMillis(),
) {
    val id: String get() = submissionId.value

    /** Supervisor protocol v0.2: all numerical measurements are optional. */
    val requiredMeasurements: List<MeasurementKind>
        get() = emptyList()

    val visualObservationsComplete: Boolean get() = weatherCondition in FieldObservationVocabulary.weather && waterColor in FieldObservationVocabulary.waterColor && flowCondition in FieldObservationVocabulary.flow
    val canonicalMethod: String get() = if (testType == TestType.Other) testTypeOther.trim() else method.trim().ifBlank { testType?.label.orEmpty() }
    val canonicalInstrument: String get() = if (testType == TestType.Other) testTypeOther.trim() else instrument.trim()

    val optionalMeasurements: List<MeasurementKind>
        get() = MeasurementKind.entries.filterNot(requiredMeasurements::contains)

    fun selectedUnit(kind: MeasurementKind): UnitSpec =
        unitIds[kind]?.let(Units::byId) ?: kind.units.first()

    fun isComplete(kind: MeasurementKind): Boolean = values[kind]?.toDoubleOrNull() != null

    val completedRequiredCount: Int get() = requiredMeasurements.count(::isComplete)
    val requiredComplete: Boolean get() = completedRequiredCount == requiredMeasurements.size

    fun analysis(kind: MeasurementKind): AnalysisProvenance = analysisDetails[kind] ?: AnalysisProvenance()

    /**
     * Why the analysis provenance of an entered laboratory-dependent value is incomplete, or null.
     * Messages match the iOS client. Blank values and field parameters never have a problem here.
     */
    fun analysisProblem(kind: MeasurementKind, now: Long = System.currentTimeMillis()): String? {
        if (!kind.needsAnalysisProvenance || values[kind].isNullOrBlank()) return null
        val analysis = analysisDetails[kind]
        val analyzedAt = analysis?.analyzedAt
        if (analysis == null || analysis.method.isBlank() || analyzedAt == null) {
            return "Record the analysis method and time for ${kind.title}."
        }
        // Pickers choose whole minutes, so the sampling minute itself counts as "on or after sampling"
        // (well inside the server's five-minute clock tolerance).
        if (analyzedAt < collectedAt - Math.floorMod(collectedAt, 60_000L) || analyzedAt > now + ANALYSIS_FUTURE_TOLERANCE_MS) {
            return "Analysis time must be on or after sampling and cannot be in the future."
        }
        if (analysis.stage == AnalysisStage.FIELD) {
            val reason = analysis.fieldExceptionReason.trim()
            if (reason.isEmpty()) return "Describe the field-analysis protocol or exception for ${kind.title}."
            if (reason.length > FIELD_EXCEPTION_REASON_MAX) return "Keep the field-analysis exception for ${kind.title} to $FIELD_EXCEPTION_REASON_MAX characters or fewer."
        }
        return null
    }

    /**
     * Why this entry cannot be recorded, or null when it is blank or acceptable. Shared by the inline
     * messages, the review issues and [toCanonicalSnapshot], so all three say exactly the same thing.
     */
    fun measurementProblem(kind: MeasurementKind, now: Long = System.currentTimeMillis()): String? {
        val raw = values[kind].orEmpty()
        if (raw.isBlank()) return null
        if (ProductionMeasurementCatalog.spec(kind).support != ProductionSupport.FULLY_SUPPORTED) {
            return "${kind.title} is not enabled by the production contract."
        }
        return measurementErrorMessage(kind, raw, selectedUnit(kind)) ?: analysisProblem(kind, now)
    }

    /** The documented exception for a laboratory parameter analyzed in the field; null otherwise. */
    fun fieldExceptionReason(kind: MeasurementKind): String? {
        if (!kind.needsAnalysisProvenance) return null
        val analysis = analysisDetails[kind]?.takeIf { it.stage == AnalysisStage.FIELD } ?: return null
        return analysis.fieldExceptionReason.trim().ifEmpty { null }
    }
}

data class MeasurementValue(
    val kind: MeasurementKind,
    val value: String,
    val unitId: String,
    /** Recorded analysis provenance for a laboratory-dependent value; null for field parameters. */
    val analysis: AnalysisProvenance? = null,
)

data class Revision(
    val number: Int,
    val createdAt: Long,
    val state: WorkflowState,
    val note: String,
    val measurements: List<MeasurementValue>,
    val id: String? = null,
)

data class ValidationSummary(
    val errorCount: Int,
    val warningCount: Int,
    val infoCount: Int,
    val overallQualityScore: Double?,
)

data class ValidationFlag(val id: String, val severity: String, val ruleCode: String, val message: String)

data class ObservationRecord(
    val id: String,
    val eventId: EventId = EventId.new(),
    val currentRevisionId: RevisionId = RevisionId.new(),
    val ownerUid: String = "",
    val site: Site,
    val collectedAt: Long,
    val collector: String,
    val testType: TestType,
    val method: String,
    val instrument: String,
    val measurements: List<MeasurementValue>,
    val notes: String,
    val attachments: List<ObservationAttachment>,
    val workflow: WorkflowState,
    val sync: SyncState,
    val revision: Int,
    val correctionReason: String? = null,
    val revisions: List<Revision>,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val accuracyMeters: Double? = null,
    val labResultsPending: Boolean = false,
    val requestedAnalytes: Set<MeasurementKind> = emptySet(),
    val validation: ValidationSummary? = null,
    val validationFlags: List<ValidationFlag> = emptyList(),
    val weatherCondition: String = "",
    val waterColor: String = "",
    val flowCondition: String = "",
)

fun formatEntry(value: Double): String {
    if (!value.isFinite()) return ""
    val formatted = BigDecimal(value, MathContext(7)).stripTrailingZeros().toPlainString()
    return if (formatted == "-0") "0" else formatted
}

fun displayMeasurement(value: MeasurementValue): String {
    val unit = Units.byId(value.unitId) ?: value.kind.units.first()
    if (value.kind == MeasurementKind.Ph) return value.value
    if (value.kind == MeasurementKind.Temperature) {
        val number = value.value.toDoubleOrNull() ?: return value.value
        val other = if (unit == Units.Celsius) Units.Fahrenheit else Units.Celsius
        return "${value.value} ${unit.inlineSymbol} · ${String.format(Locale.US, "%.1f", unit.convert(number, other))} ${other.inlineSymbol}"
    }
    return "${value.value} ${unit.inlineSymbol}"
}

/**
 * Hard measurement ranges, expressed in each kind's canonical unit. These mirror
 * config/validation_rules.json (`temperature.hardRangeC` and `parameters[*].hardRange`); parameters
 * that only declare `hardMin: 0` there stay on the shared non-negative check below.
 */
private val HardMeasurementRanges: Map<MeasurementKind, ClosedFloatingPointRange<Double>> = mapOf(
    MeasurementKind.Temperature to -5.0..60.0,
    MeasurementKind.Ph to 0.0..14.0,
    MeasurementKind.DissolvedOxygen to 0.0..50.0,
    MeasurementKind.DissolvedOxygenSaturation to 0.0..300.0,
)

/**
 * Validates one entry and returns a sentence fragment, because every caller prefixes the field name.
 * Use [measurementErrorMessage] for the composed, user-facing sentence.
 */
fun measurementError(kind: MeasurementKind, raw: String, unit: UnitSpec = kind.units.first()): String? {
    if (raw.isBlank()) return null
    val number = raw.toDoubleOrNull() ?: return "must be a number"
    if (!number.isFinite()) return "must be a finite number"
    val canonicalUnit = kind.units.first()
    val range = HardMeasurementRanges[kind]
    if (range != null) {
        val canonical = unit.convert(number, canonicalUnit)
        if (canonical !in range) {
            return "must be between ${formatEntry(range.start)} and ${formatEntry(range.endInclusive)} ${canonicalUnit.inlineSymbol}"
        }
        return null
    }
    if (!kind.allowsNegative && number < 0) return "cannot be negative"
    return null
}

fun measurementErrorMessage(kind: MeasurementKind, raw: String, unit: UnitSpec = kind.units.first()): String? =
    measurementError(kind, raw, unit)?.let { "${kind.title} $it." }

/** One readable line for a recorded laboratory-dependent analysis, e.g. on Review and Detail. */
fun analysisSummary(analysis: AnalysisProvenance): String = buildList {
    add(if (analysis.stage == AnalysisStage.LAB) "Laboratory" else "Field (documented exception)")
    analysis.method.trim().takeIf(String::isNotEmpty)?.let(::add) ?: add("method not recorded")
    analysis.instrument.trim().takeIf(String::isNotEmpty)?.let(::add)
    add(analysis.analyzedAt?.let { "analyzed ${formatDateTime(it)}" } ?: "analysis time not recorded")
    if (analysis.stage == AnalysisStage.FIELD) analysis.fieldExceptionReason.trim().takeIf(String::isNotEmpty)?.let { add("exception: $it") }
}.joinToString(" · ")

fun formatDateTime(epochMillis: Long): String =
    DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).apply {
        timeZone = java.util.TimeZone.getTimeZone(EasternTime.zone)
    }.format(Date(epochMillis))

val PennsylvaniaSites = listOf(
    Site("spring-houserville", "Spring Creek at Houserville Road Bridge", "Centre County", "Spring Creek · Susquehanna", 40.83091, -77.83172, true, "0.4 mi"),
    Site("spring-benner", "Spring Creek below Benner Spring Fish Hatchery", "Centre County", "Spring Creek · Susquehanna", 40.88742, -77.79311, true, "4.8 mi"),
    Site("little-juniata", "Little Juniata River at Spruce Creek, Route 45 Access", "Huntingdon County", "Juniata · Susquehanna", 40.61261, -78.14092, true, "31 mi"),
    Site("city-island", "Susquehanna River at City Island, Harrisburg", "Dauphin County", "Lower Susquehanna", 40.25294, -76.88812, true, "89 mi"),
    Site("loyalhanna", "Loyalhanna Creek below Kingston Dam and Saint Vincent College", "Westmoreland County", "Kiskiminetas · Allegheny", 40.29413, -79.39342, false, "112 mi"),
    Site("lehigh-jim-thorpe", "Lehigh River below Jim Thorpe", "Carbon County", "Lehigh · Delaware", 40.86364, -75.73912, false, "124 mi"),
)
