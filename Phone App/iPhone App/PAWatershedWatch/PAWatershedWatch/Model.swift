import Foundation
@preconcurrency import FirebaseAuth
@preconcurrency import FirebaseFirestore
@preconcurrency import Network
import Observation
import SwiftData
import SwiftUI

extension Date {
    var fieldTimestamp: String {
        let formatter = DateFormatter()
        formatter.locale = .current
        formatter.timeZone = TimeZone(identifier: "America/New_York")
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: self)
    }
}

enum AppTab: Hashable { case home, recent, account }

enum HomeRoute: Hashable {
    case selectSite, visitDetails, testMethod, measurements, media, review, submit, status
}

enum RecentRoute: Hashable {
    case detail(UUID), correction(UUID), status(UUID)
}

/// The workflow step that owns a validation failure, so Review and Submit can send the collector
/// back to the screen that can actually fix it instead of matching on message text.
enum WorkflowSection: Hashable, Sendable {
    case visitDetails, testMethod, measurements, notesMedia

    var route: HomeRoute {
        switch self {
        case .visitDetails: .visitDetails
        case .testMethod: .testMethod
        case .measurements: .measurements
        case .notesMedia: .media
        }
    }

    var step: Int {
        switch self {
        case .visitDetails: 2
        case .testMethod: 3
        case .measurements: 4
        case .notesMedia: 5
        }
    }
}

enum ConnectionState: String, CaseIterable, Identifiable, Equatable {
    case online, offline, serverUnavailable
    var id: Self { self }
    var title: LocalizedStringResource {
        switch self {
        case .online: "Online"
        case .offline: "Work Offline"
        case .serverUnavailable: "Archive Unavailable"
        }
    }
}

enum SyncState: String, Hashable, Equatable {
    case savedLocally, waiting, syncing, synced, failed
    var title: LocalizedStringResource {
        switch self {
        case .savedLocally: "Saved on This Phone"
        case .waiting: "Waiting to Sync"
        case .syncing: "Syncing"
        case .synced: "Synced"
        case .failed: "Sync Failed"
        }
    }
    var icon: String {
        switch self {
        case .savedLocally: "iphone.and.arrow.forward"
        case .waiting: "clock.arrow.circlepath"
        case .syncing: "arrow.triangle.2.circlepath"
        case .synced: "checkmark.icloud.fill"
        case .failed: "exclamationmark.icloud.fill"
        }
    }
    var color: Color {
        switch self {
        case .savedLocally: FieldTheme.water
        case .waiting: FieldTheme.goldenrod
        case .syncing: FieldTheme.water
        case .synced: FieldTheme.fern
        case .failed: .red
        }
    }
}

enum WorkflowState: String, Hashable, Equatable, Codable {
    case draft, submitted, validating, pendingReview, needsCorrection, resubmitted, approved, rejected, publishing, publishFailed, published
    var title: LocalizedStringResource {
        switch self {
        case .draft: "Draft"
        case .submitted: "Submitted"
        case .validating: "Validating"
        case .pendingReview: "Pending Review"
        case .needsCorrection: "Needs Correction"
        case .resubmitted: "Resubmitted"
        case .approved: "Approved"
        case .rejected: "Rejected"
        case .publishing: "Publishing"
        case .publishFailed: "Publish Failed"
        case .published: "Published"
        }
    }
    var icon: String {
        switch self {
        case .draft: "pencil"
        case .submitted, .pendingReview, .approved, .published: "doc.badge.checkmark"
        case .validating, .publishing: "arrow.triangle.2.circlepath"
        case .needsCorrection: "exclamationmark.bubble.fill"
        case .resubmitted: "arrow.uturn.forward.circle.fill"
        case .rejected, .publishFailed: "xmark.octagon.fill"
        }
    }
    var color: Color {
        switch self {
        case .draft: FieldTheme.water
        case .submitted, .resubmitted, .pendingReview, .approved, .published: FieldTheme.fern
        case .validating, .publishing: FieldTheme.water
        case .needsCorrection: FieldTheme.goldenrod
        case .rejected, .publishFailed: .red
        }
    }
}

enum GPSState: String, CaseIterable, Identifiable, Equatable, Codable {
    case locating, good, poor, denied, unavailable
    var id: Self { self }
    var title: LocalizedStringResource {
        switch self {
        case .locating: "Locating"
        case .good: "Good Accuracy"
        case .poor: "Poor Accuracy"
        case .denied: "Location Denied"
        case .unavailable: "Location Unavailable"
        }
    }
    var icon: String {
        switch self {
        case .locating: "location.viewfinder"
        case .good: "location.fill"
        case .poor: "location.circle"
        case .denied, .unavailable: "location.slash.fill"
        }
    }
    var color: Color {
        switch self {
        case .locating: FieldTheme.water
        case .good: FieldTheme.fern
        case .poor: FieldTheme.goldenrod
        case .denied, .unavailable: .red
        }
    }
}

struct Site: Identifiable, Hashable {
    let id: String
    let name: String
    let county: String
    let watershed: String
    let latitude: Double
    let longitude: Double
    let cached: Bool
    let distance: String

    var position: String {
        "\(latitude.formatted(.number.precision(.fractionLength(4))))° N · \(abs(longitude).formatted(.number.precision(.fractionLength(4))))° W"
    }
}

enum TestType: String, CaseIterable, Identifiable, Hashable, Codable {
    case fieldInstrument, pennStateLab, externalLab, fieldKit, sonde, mixed, other
    var id: Self { self }
    var title: LocalizedStringResource {
        switch self {
        case .fieldInstrument: "In-situ / Field Instrument"
        case .pennStateLab: "Penn State Lab"
        case .externalLab: "External Lab"
        case .fieldKit: "Field Kit / Colorimetric"
        case .sonde: "Continuous Sensor / Sonde"
        case .mixed: "Mixed In-situ + Lab"
        case .other: "Other"
        }
    }
    var icon: String {
        switch self {
        case .fieldInstrument: "thermometer.variable"
        case .pennStateLab: "building.columns"
        case .externalLab: "shippingbox"
        case .fieldKit: "testtube.2"
        case .sonde: "waveform.path.ecg"
        case .mixed: "arrow.triangle.branch"
        case .other: "ellipsis.circle"
        }
    }
    var suggestedMethod: String {
        switch self {
        case .fieldInstrument: "Direct instrument reading"
        case .pennStateLab: "Grab sample"
        case .externalLab: "Grab sample"
        case .fieldKit: "Colorimetric field test"
        case .sonde: "15 minute deployment"
        case .mixed: "Direct reading and grab sample"
        case .other: "Other"
        }
    }

    var suggestedInstrument: String {
        switch self {
        case .fieldInstrument: "YSI ProDSS · Unit 4412"
        case .pennStateLab: "Penn State Agricultural Analytical Services Laboratory"
        case .externalLab: "DEP Accredited Laboratory"
        case .fieldKit: "Hach Colorimetric Field Kit"
        case .sonde: "EXO2 Multiparameter Sonde"
        case .mixed: "YSI ProDSS · Unit 4412"
        case .other: ""
        }
    }
}

struct MeasurementUnit: Identifiable, Hashable {
    let id: String
    let numerator: String
    let denominator: String?
    let menuTitle: String
    let spokenName: String
    fileprivate let scaleToBase: Double
    fileprivate let offsetToBase: Double

    var inlineSymbol: String {
        denominator.map { "\(numerator)/\($0)" } ?? numerator
    }

    func convert(_ value: Double, to unit: MeasurementUnit) -> Double {
        (value * scaleToBase + offsetToBase - unit.offsetToBase) / unit.scaleToBase
    }

    private static func unit(
        _ id: String,
        _ numerator: String,
        per denominator: String? = nil,
        title: String,
        spoken: String,
        scale: Double = 1,
        offset: Double = 0
    ) -> MeasurementUnit {
        MeasurementUnit(
            id: id,
            numerator: numerator,
            denominator: denominator,
            menuTitle: title,
            spokenName: spoken,
            scaleToBase: scale,
            offsetToBase: offset
        )
    }

    static let celsius = unit("celsius", "°C", title: "Degrees Celsius (°C)", spoken: "degrees Celsius")
    static let fahrenheit = unit("fahrenheit", "°F", title: "Degrees Fahrenheit (°F)", spoken: "degrees Fahrenheit", scale: 5 / 9, offset: -160 / 9)
    static let pHStandard = unit("ph-standard", "pH", title: "pH standard units", spoken: "pH standard units")
    static let percent = unit("percent", "%", title: "Percent saturation (%)", spoken: "percent saturation")

    static let milligramsOxygenPerLiter = unit("mg-o2-l", "mg O₂", per: "L", title: "mg/L as O₂", spoken: "milligrams per liter as oxygen")
    static let micromolesOxygenPerLiter = unit("umol-o2-l", "µmol O₂", per: "L", title: "µmol/L as O₂", spoken: "micromoles per liter as oxygen", scale: 0.0319988)

    static let microsiemensPerCentimeter = unit("us-cm", "µS", per: "cm", title: "µS/cm", spoken: "microsiemens per centimeter")
    static let millisiemensPerCentimeter = unit("ms-cm", "mS", per: "cm", title: "mS/cm", spoken: "millisiemens per centimeter", scale: 1_000)
    static let siemensPerMeter = unit("s-m", "S", per: "m", title: "S/m", spoken: "siemens per meter", scale: 10_000)

    static let milligramsPerLiter = unit("mg-l", "mg", per: "L", title: "mg/L", spoken: "milligrams per liter")
    static let microgramsPerLiter = unit("ug-l", "µg", per: "L", title: "µg/L", spoken: "micrograms per liter", scale: 0.001)
    static let gramsPerLiter = unit("g-l", "g", per: "L", title: "g/L", spoken: "grams per liter", scale: 1_000)
    static let millivolts = unit("mv", "mV", title: "Millivolts (mV)", spoken: "millivolts")
    static let volts = unit("v", "V", title: "Volts (V)", spoken: "volts", scale: 1_000)

    static let milligramsNitrogenPerLiter = unit("mg-n-l", "mg N", per: "L", title: "mg/L as N", spoken: "milligrams per liter as nitrogen")
    static let microgramsNitrogenPerLiter = unit("ug-n-l", "µg N", per: "L", title: "µg/L as N", spoken: "micrograms per liter as nitrogen", scale: 0.001)
    static let milligramsNitratePerLiter = unit("mg-no3-l", "mg NO₃⁻", per: "L", title: "mg/L as NO₃", spoken: "milligrams per liter as nitrate", scale: 14 / 62)
    static let microgramsNitratePerLiter = unit("ug-no3-l", "µg NO₃⁻", per: "L", title: "µg/L as NO₃", spoken: "micrograms per liter as nitrate", scale: 0.014 / 62)
    static let milligramsNitritePerLiter = unit("mg-no2-l", "mg NO₂⁻", per: "L", title: "mg/L as NO₂", spoken: "milligrams per liter as nitrite", scale: 14 / 46)
    static let microgramsNitritePerLiter = unit("ug-no2-l", "µg NO₂⁻", per: "L", title: "µg/L as NO₂", spoken: "micrograms per liter as nitrite", scale: 0.014 / 46)

    static let milligramsPhosphorusPerLiter = unit("mg-p-l", "mg P", per: "L", title: "mg/L as P", spoken: "milligrams per liter as phosphorus")
    static let microgramsPhosphorusPerLiter = unit("ug-p-l", "µg P", per: "L", title: "µg/L as P", spoken: "micrograms per liter as phosphorus", scale: 0.001)
    static let milligramsPhosphatePerLiter = unit("mg-po4-l", "mg PO₄³⁻", per: "L", title: "mg/L as PO₄", spoken: "milligrams per liter as phosphate", scale: 0.326315789)
    static let microgramsPhosphatePerLiter = unit("ug-po4-l", "µg PO₄³⁻", per: "L", title: "µg/L as PO₄", spoken: "micrograms per liter as phosphate", scale: 0.000326315789)

    static let cubicMetersPerSecond = unit("m3-s", "m³", per: "s", title: "m³/s", spoken: "cubic meters per second")
    static let litersPerSecond = unit("l-s", "L", per: "s", title: "L/s", spoken: "liters per second", scale: 0.001)
    static let cubicFeetPerSecond = unit("ft3-s", "ft³", per: "s", title: "ft³/s (cfs)", spoken: "cubic feet per second", scale: 0.028316846592)
    static let gallonsPerMinute = unit("gal-min", "gal", per: "min", title: "US gal/min", spoken: "US gallons per minute", scale: 0.0000630901964)

    static let ntu = unit("ntu", "NTU", title: "NTU · white-light method", spoken: "nephelometric turbidity units")
    static let fnu = unit("fnu", "FNU", title: "FNU · infrared method", spoken: "formazin nephelometric units")
    static let practicalSalinity = unit("pss78", "PSS-78", title: "PSS-78 · unitless", spoken: "unitless practical salinity scale 1978")
    static let partsPerThousand = unit("ppt", "‰", title: "Parts per thousand (‰)", spoken: "parts per thousand")

    static let milligramsCaCO3PerLiter = unit("mg-caco3-l", "mg CaCO₃", per: "L", title: "mg/L as CaCO₃", spoken: "milligrams per liter as calcium carbonate")
    static let milliequivalentsPerLiter = unit("meq-l", "meq", per: "L", title: "meq/L", spoken: "milliequivalents per liter", scale: 50.04345)
    static let microgramsChlorophyllPerLiter = unit("ug-chla-l", "µg Chl-a", per: "L", title: "µg/L chlorophyll a", spoken: "micrograms chlorophyll a per liter")
    static let milligramsChlorophyllPerCubicMeter = unit("mg-chla-m3", "mg Chl-a", per: "m³", title: "mg/m³ chlorophyll a", spoken: "milligrams chlorophyll a per cubic meter")
    static let cfuPer100Milliliters = unit("cfu-100ml", "CFU", per: "100 mL", title: "CFU/100 mL · membrane count", spoken: "colony-forming units per 100 milliliters")
    static let mpnPer100Milliliters = unit("mpn-100ml", "MPN", per: "100 mL", title: "MPN/100 mL · statistical estimate", spoken: "most probable number per 100 milliliters")
}

enum MeasurementKind: String, CaseIterable, Identifiable, Hashable, Codable {
    case temperature, ph, dissolvedOxygen, dissolvedOxygenSaturation, conductivity, tds, orp, chloride, sulfate, nitrate, phosphate, flow
    case turbidity, salinity, totalSuspendedSolids, alkalinity, hardness, ammoniaNitrogen, nitriteNitrogen, totalPhosphorus, chlorophyllA, eColi
    var id: Self { self }
    var title: LocalizedStringResource {
        switch self {
        case .temperature: "Water Temperature"
        case .ph: "pH"
        case .dissolvedOxygen: "Dissolved Oxygen"
        case .dissolvedOxygenSaturation: "Dissolved Oxygen Saturation"
        case .conductivity: "Conductivity"
        case .tds: "Total Dissolved Solids"
        case .orp: "ORP"
        case .chloride: "Chloride"
        case .sulfate: "Sulfate"
        case .nitrate: "Nitrate"
        case .phosphate: "Phosphate"
        case .flow: "Discharge / Flow"
        case .turbidity: "Turbidity"
        case .salinity: "Salinity"
        case .totalSuspendedSolids: "Total Suspended Solids"
        case .alkalinity: "Alkalinity"
        case .hardness: "Hardness"
        case .ammoniaNitrogen: "Ammonia Nitrogen"
        case .nitriteNitrogen: "Nitrite Nitrogen"
        case .totalPhosphorus: "Total Phosphorus"
        case .chlorophyllA: "Chlorophyll a"
        case .eColi: "E. coli"
        }
    }
    var unitOptions: [MeasurementUnit] {
        switch self {
        case .temperature: [.celsius, .fahrenheit]
        case .ph: [.pHStandard]
        case .dissolvedOxygen: [.milligramsOxygenPerLiter, .micromolesOxygenPerLiter]
        case .dissolvedOxygenSaturation: [.percent]
        case .conductivity: [.microsiemensPerCentimeter, .millisiemensPerCentimeter, .siemensPerMeter]
        case .tds, .totalSuspendedSolids: [.milligramsPerLiter, .gramsPerLiter]
        case .orp: [.millivolts, .volts]
        case .chloride, .sulfate: [.milligramsPerLiter, .microgramsPerLiter]
        case .nitrate: [.milligramsNitrogenPerLiter, .microgramsNitrogenPerLiter, .milligramsNitratePerLiter, .microgramsNitratePerLiter]
        case .phosphate: [.milligramsPhosphorusPerLiter, .microgramsPhosphorusPerLiter, .milligramsPhosphatePerLiter, .microgramsPhosphatePerLiter]
        case .flow: [.cubicMetersPerSecond, .litersPerSecond, .cubicFeetPerSecond, .gallonsPerMinute]
        case .turbidity: [.ntu, .fnu]
        case .salinity: [.practicalSalinity, .partsPerThousand]
        case .alkalinity, .hardness: [.milligramsCaCO3PerLiter, .milliequivalentsPerLiter]
        case .ammoniaNitrogen: [.milligramsNitrogenPerLiter, .microgramsNitrogenPerLiter]
        case .nitriteNitrogen: [.milligramsNitrogenPerLiter, .microgramsNitrogenPerLiter, .milligramsNitritePerLiter, .microgramsNitritePerLiter]
        case .totalPhosphorus: [.milligramsPhosphorusPerLiter, .microgramsPhosphorusPerLiter, .milligramsPhosphatePerLiter, .microgramsPhosphatePerLiter]
        case .chlorophyllA: [.microgramsChlorophyllPerLiter, .milligramsChlorophyllPerCubicMeter]
        case .eColi: [.cfuPer100Milliliters, .mpnPer100Milliliters]
        }
    }

    var defaultUnit: MeasurementUnit { unitOptions[0] }

    var unitChangePreservesQuantity: Bool {
        self != .turbidity && self != .salinity && self != .eColi
    }
    var symbol: String {
        switch self {
        case .temperature: "thermometer.medium"
        case .ph: "drop.degreesign"
        case .dissolvedOxygen, .dissolvedOxygenSaturation: "bubbles.and.sparkles"
        case .conductivity: "bolt.horizontal.circle"
        case .tds: "circle.grid.cross"
        case .orp: "plusminus.circle"
        case .chloride, .sulfate, .nitrate, .phosphate: "testtube.2"
        case .flow: "water.waves"
        case .turbidity: "aqi.medium"
        case .salinity: "waterbottle.fill"
        case .totalSuspendedSolids: "circle.grid.2x2.fill"
        case .alkalinity, .hardness: "scalemass.fill"
        case .ammoniaNitrogen, .nitriteNitrogen, .totalPhosphorus: "testtube.2"
        case .chlorophyllA: "leaf.fill"
        case .eColi: "microbe.fill"
        }
    }
}

struct MeasurementValue: Identifiable, Hashable {
    let id: UUID
    let kind: MeasurementKind
    let value: String
    let unit: MeasurementUnit

    var displayValue: String {
        guard kind == .temperature, let number = Double(value) else {
            return kind == .ph ? value : "\(value) \(unit.inlineSymbol)"
        }
        if unit == .fahrenheit {
            let celsius = (number - 32) * 5 / 9
            return "\(value) °F · \(celsius.formatted(.number.precision(.fractionLength(1)))) °C"
        }
        let fahrenheit = number * 9 / 5 + 32
        return "\(value) °C · \(fahrenheit.formatted(.number.precision(.fractionLength(1)))) °F"
    }
}

struct RevisionSummary: Identifiable, Hashable {
    let id: UUID
    let number: Int
    let date: Date
    let state: WorkflowState
    let note: String
}

struct ValidationSummary: Hashable {
    let errorCount: Int
    let warningCount: Int
    let infoCount: Int
    let overallQualityScore: Double?
}

struct ValidationFlag: Identifiable, Hashable {
    let id: String
    let severity: String
    let ruleCode: String
    let message: String
}

enum AttachmentKind: String, Codable, Hashable { case sitePhoto = "SITE_PHOTO", instrumentPhoto = "INSTRUMENT_PHOTO", testResult = "TEST_RESULT", other = "OTHER" }
enum AttachmentTransferState: String, Codable, Hashable { case localOnly, waiting, uploading, uploaded, failed }

struct AttachmentRecord: Identifiable, Hashable, Codable {
    let id: UUID
    let ownerUID: String
    let submissionID: UUID
    let revisionID: UUID
    let localURL: URL
    let contentType: String
    let sizeBytes: Int64
    let kind: AttachmentKind
    var caption: String?
    let createdAt: Date
    var transferState: AttachmentTransferState
    var remoteStoragePath: String?
    var lastError: String?

    var isPhoto: Bool { contentType.hasPrefix("image/") }
    var isAudio: Bool { contentType.hasPrefix("audio/") }
}

struct ObservationRecord: Identifiable, Hashable {
    let id: UUID
    var eventID = UUID()
    var currentRevisionID = UUID()
    var ownerUID = ""
    var site: Site
    var date: Date
    var collector: String
    var testType: TestType
    var method: String
    var instrument: String
    var measurements: [MeasurementValue]
    var notes: String
    var photoCount: Int
    var attachments: [AttachmentRecord] = []
    var workflow: WorkflowState
    var sync: SyncState
    var revision: Int
    var correctionReason: String?
    var revisions: [RevisionSummary]
    var latitude: Double?
    var longitude: Double?
    var accuracyMeters: Double?
    var validation: ValidationSummary? = nil
    var validationFlags: [ValidationFlag] = []

    var hasAudio: Bool { attachments.contains(where: \.isAudio) }
}

@MainActor
@Observable
final class ObservationDraft {
    let id: UUID
    let eventID: UUID
    let revisionID: UUID
    let createdAt: Date
    var revisionNumber: Int
    var ownerUID: String
    var site: Site? { didSet { touch() } }
    var date = Date.now { didSet { touch() } }
    var collector = "" { didSet { touch() } }
    var latitude: Double? { didSet { touch() } }
    var longitude: Double? { didSet { touch() } }
    var accuracyMeters: Double? { didSet { touch() } }
    var gpsState: GPSState = .locating { didSet { touch() } }
    var testType: TestType? { didSet { touch() } }
    var testTypeOther = "" { didSet { touch() } }
    var method = "" { didSet { touch() } }
    var instrument = "" { didSet { touch() } }
    var values: [MeasurementKind: String] = [:] { didSet { touch() } }
    var selectedUnits: [MeasurementKind: MeasurementUnit] = [:] { didSet { touch() } }
    var labResultsPending = true { didSet { touch() } }
    var requestedAnalytes: Set<MeasurementKind> = [.chloride, .nitrate, .phosphate] { didSet { touch() } }
    var notes = "" { didSet { touch() } }
    var attachments: [AttachmentRecord] = [] { didSet { touch() } }
    var lastSaved = Date.now
    var currentStep = 1 { didSet { touch() } }
    var isCorrection = false { didSet { touch() } }
    var baseRevision: Int? { didSet { touch() } }
    var correctionReason: String? { didSet { touch() } }
    var revisionNote = "" { didSet { touch() } }

    var onChange: (() -> Void)?

    init(id: UUID = UUID(), eventID: UUID = UUID(), revisionID: UUID = UUID(), revisionNumber: Int = 1, ownerUID: String = "", createdAt: Date = .now) {
        self.id = id
        self.eventID = eventID
        self.revisionID = revisionID
        self.createdAt = createdAt
        self.revisionNumber = revisionNumber
        self.ownerUID = ownerUID
    }

    var photoCount: Int { attachments.count(where: \.isPhoto) }
    var hasAudio: Bool { attachments.contains(where: \.isAudio) }

    func touch() {
        lastSaved = .now
        onChange?()
    }

    var includesLab: Bool {
        testType == .pennStateLab || testType == .externalLab || testType == .mixed
    }

    var requiredMeasurements: [MeasurementKind] {
        switch testType {
        case .fieldInstrument, .sonde, .mixed:
            [.temperature, .ph, .dissolvedOxygen, .conductivity]
        case .fieldKit, .pennStateLab, .externalLab:
            [.temperature]
        case .other, .none:
            [.temperature]
        }
    }

    var optionalMeasurements: [MeasurementKind] {
        MeasurementKind.allCases.filter { !requiredMeasurements.contains($0) }
    }

    var completedRequiredCount: Int {
        requiredMeasurements.count { Double(values[$0] ?? "") != nil }
    }

    var firstIncompleteRequirement: MeasurementKind? {
        requiredMeasurements.first { Double(values[$0] ?? "") == nil }
    }

    /// Lab, field kit, and other test types must carry at least one measurement document beyond the
    /// temperature fields the revision itself stores. Mirrors `minimumMeasurementCount` for those
    /// profiles in `config/validation_rules.json`; temperature is not a measurement document.
    var requiresAdditionalResult: Bool {
        switch testType {
        case .fieldInstrument, .sonde, .mixed, .none: false
        default: true
        }
    }

    var hasAdditionalResult: Bool {
        values.contains { $0.key != .temperature && Double($0.value) != nil }
    }

    /// The single completeness rule consulted by the Measurements gate, the Review gate, and
    /// `canonicalSnapshot()`, so no screen can imply the record is finished while it is not.
    var productionProfileComplete: Bool {
        guard testType != nil, completedRequiredCount == requiredMeasurements.count else { return false }
        return !requiresAdditionalResult || hasAdditionalResult
    }

    /// Progress text for the Required Measurements header. It stays honest about the additional
    /// result `productionProfileComplete` needs instead of showing a finished "1/1".
    var measurementProgressText: String {
        let progress = "\(completedRequiredCount)/\(requiredMeasurements.count)"
        guard requiresAdditionalResult, !hasAdditionalResult else { return progress }
        return "\(progress) required · +1 result needed below"
    }

    var temperatureConversion: String? {
        guard let value = Double(values[.temperature] ?? "") else { return nil }
        let source = selectedUnit(for: .temperature)
        let target: MeasurementUnit = source == .celsius ? .fahrenheit : .celsius
        return "\(source.convert(value, to: target).formatted(.number.precision(.fractionLength(1)))) \(target.inlineSymbol)"
    }

    func displayValue(for kind: MeasurementKind) -> String {
        let value = values[kind, default: ""]
        if kind == .temperature, let conversion = temperatureConversion {
            return "\(value) \(selectedUnit(for: kind).inlineSymbol) · \(conversion)"
        }
        return kind == .ph ? value : "\(value) \(selectedUnit(for: kind).inlineSymbol)"
    }

    func selectedUnit(for kind: MeasurementKind) -> MeasurementUnit {
        selectedUnits[kind] ?? kind.defaultUnit
    }

    @discardableResult
    func changeUnit(_ unit: MeasurementUnit, for kind: MeasurementKind, clearingValueIfNeeded: Bool = false) -> Bool {
        let current = selectedUnit(for: kind)
        guard current != unit else { return true }
        let rawValue = values[kind, default: ""].trimmingCharacters(in: .whitespacesAndNewlines)

        if rawValue.isEmpty {
            selectedUnits[kind] = unit
        } else if let value = Double(rawValue), kind.unitChangePreservesQuantity {
            values[kind] = Self.formatEntry(current.convert(value, to: unit))
            selectedUnits[kind] = unit
        } else if clearingValueIfNeeded {
            values[kind] = ""
            selectedUnits[kind] = unit
        } else {
            return false
        }
        lastSaved = .now
        return true
    }

    private static func formatEntry(_ value: Double) -> String {
        value.formatted(
            .number
                .locale(Locale(identifier: "en_US_POSIX"))
                .grouping(.never)
                .precision(.significantDigits(1...7))
        )
    }

    subscript(valueFor kind: MeasurementKind) -> String {
        get { values[kind, default: ""] }
        set {
            values[kind] = newValue
        }
    }
}

@MainActor
@Observable
final class AppModel {
    private let store: any LocalMobileRepository
    private let remote: (any RemoteMobileRepository)?
    private let monitor = NWPathMonitor()
    private let monitorQueue = DispatchQueue(label: "org.watershed.pawatershedwatch.connectivity")
    private var authHandle: AuthStateDidChangeListenerHandle?
    private var remoteListener: ListenerRegistration?

    var authResolved = false
    var isSignedIn = false
    var isAuthenticating = false
    var email = ""
    var password = ""
    var authError: String?
    var workflowError: String?
    var userDisplayName = ""
    var userEmail = ""
    var selectedTab: AppTab = .home
    var homePath: [HomeRoute] = []
    var recentPath: [RecentRoute] = []
    var connection: ConnectionState = .online
    var syncState: SyncState = .synced
    var workflowState: WorkflowState = .draft
    var draft: ObservationDraft?
    var records: [ObservationRecord] = []
    var sites: [Site] = []
    var sitesLoading = false
    /// Set when a validation failure names a measurement. The measurement screens consume it to open
    /// the keyboard on the offending field, then clear it.
    var pendingMeasurementFocus: MeasurementKind?

    private var ownerUID: String?

    init(context: ModelContext, startServices: Bool = true) {
        store = LocalMobileStore(context: context)
        remote = startServices ? FirebaseMobileService() : nil
        sites = (try? store.cachedSites()) ?? []
        guard startServices else { authResolved = true; return }
        startConnectivity()
        authHandle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            Task { @MainActor in self?.applySession(user) }
        }
    }

    func signIn() {
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanEmail.isEmpty, !password.isEmpty else { authError = "Enter your email and password."; return }
        guard connection == .online, let remote else { authError = "A network connection is required for sign-in."; return }
        authError = nil; isAuthenticating = true
        Task {
            do { _ = try await remote.signIn(email: cleanEmail, password: password) }
            catch { authError = Self.authMessage(error) }
            isAuthenticating = false
        }
    }

    func signOut() {
        do { try remote?.signOut() }
        catch { authError = "We couldn't sign out. Try again." }
    }

    func startNewObservation() {
        guard let ownerUID else { authError = "Sign in before starting an observation."; return }
        if let draft { try? store.deleteDraft(ownerUID: ownerUID, submissionID: draft.id) }
        let value = ObservationDraft(ownerUID: ownerUID)
        value.collector = userDisplayName.isEmpty ? userEmail : userDisplayName
        draft = value
        attachAutosave(to: value)
        saveDraft(value)
        workflowState = .draft
        syncState = .savedLocally
        workflowError = nil
        homePath = [.selectSite]
    }

    func resumeObservation() {
        guard let draft else { startNewObservation(); return }
        let route: HomeRoute = switch draft.currentStep {
        case 1: .selectSite
        case 2: .visitDetails
        case 3: .testMethod
        case 4: .measurements
        case 5: .media
        case 6: .review
        default: .selectSite
        }
        homePath = [route]
    }

    func advance(to route: HomeRoute, step: Int) {
        draft?.currentStep = step
        syncState = .savedLocally
        workflowError = nil
        homePath.append(route)
    }

    /// Reports a validation failure on the screen that owns it: the message stays visible, the offending
    /// section is opened, and the offending measurement is queued for keyboard focus. Entered values are
    /// never cleared — `canonicalSnapshot()` is a read-only check.
    func present(_ error: CanonicalizationError, navigating: Bool = true) {
        workflowError = error.localizedDescription
        pendingMeasurementFocus = error.measurement
        guard navigating, let section = error.section else { return }
        draft?.currentStep = section.step
        if homePath.last != section.route { homePath.append(section.route) }
    }

    func submitDraft() {
        guard let draft else { return }
        do {
            let snapshot = try draft.canonicalSnapshot()
            let workflow: WorkflowState = draft.isCorrection ? .resubmitted : .submitted
            let note = draft.isCorrection ? draft.revisionNote.trimmingCharacters(in: .whitespacesAndNewlines) : "Field observation submitted."
            if draft.isCorrection && note.isEmpty { throw CanonicalizationError.invalid("Document what you checked before resubmitting") }
            try store.persist(snapshot, workflow: workflow, sync: .waiting, note: note)
            workflowState = workflow; syncState = .waiting; workflowError = nil
            reloadRecords()
            if !homePath.contains(.status) { homePath.append(.status) }
            if connection == .online { retrySync(recordID: snapshot.submissionID) }
        } catch let error as CanonicalizationError {
            present(error, navigating: !draft.isCorrection)
        } catch { workflowError = error.localizedDescription }
    }

    func retrySync(recordID: UUID? = nil) {
        guard connection == .online else { syncState = .waiting; return }
        Task { await syncPending(only: recordID) }
    }

    func finishStatus() {
        draft = nil
        homePath = []
    }

    func startCorrection(for record: ObservationRecord) {
        guard record.workflow == .needsCorrection, record.ownerUID == ownerUID else { workflowError = "This record cannot be corrected from the current account."; return }
        let correction = ObservationDraft(
            id: record.id, eventID: record.eventID, revisionID: UUID(), revisionNumber: record.revision + 1,
            ownerUID: record.ownerUID
        )
        correction.site = record.site
        correction.date = record.date
        correction.collector = record.collector
        correction.latitude = record.latitude
        correction.longitude = record.longitude
        correction.accuracyMeters = record.accuracyMeters
        correction.gpsState = (record.accuracyMeters ?? .infinity) <= 20 ? .good : .poor
        correction.testType = record.testType
        correction.method = record.method
        correction.instrument = record.instrument
        correction.notes = record.notes
        do { correction.attachments = try copyAttachments(record.attachments, to: correction) }
        catch { workflowError = "Attached files could not be prepared for the correction revision."; return }
        correction.values = Dictionary(uniqueKeysWithValues: record.measurements.map { ($0.kind, $0.value) })
        correction.selectedUnits = Dictionary(uniqueKeysWithValues: record.measurements.map { ($0.kind, $0.unit) })
        correction.isCorrection = true
        correction.baseRevision = record.revision
        correction.correctionReason = record.correctionReason
        draft = correction
        attachAutosave(to: correction)
        saveDraft(correction)
        workflowState = .needsCorrection
        syncState = .savedLocally
    }

    func resubmitCorrection(recordID: UUID) {
        guard draft?.id == recordID else { return }
        submitDraft()
        if workflowError == nil {
            homePath = []
            if !recentPath.contains(.status(recordID)) { recentPath.append(.status(recordID)) }
        }
    }

    func record(id: UUID) -> ObservationRecord? { records.first { $0.id == id } }

    func refreshSites() {
        guard connection == .online, let remote else { return }
        sitesLoading = true
        Task {
            do {
                let values = try await remote.fetchSites()
                try store.replaceSites(values)
                sites = try store.cachedSites()
            } catch {
                workflowError = sites.isEmpty ? "Sites could not be updated. Connect and try again." : nil
            }
            sitesLoading = false
        }
    }

    func addAttachment(data: Data, contentType: String, kind: AttachmentKind) {
        guard let draft else { return }
        do {
            if kind == .sitePhoto, draft.photoCount >= 5 {
                throw CanonicalizationError.invalid("Up to five site photos can be attached")
            }
            guard ["image/jpeg", "image/png", "image/heic", "audio/mp4"].contains(contentType), data.count > 0, data.count <= 50 * 1024 * 1024 else {
                throw CanonicalizationError.invalid("The attachment format or size is not supported")
            }
            let id = UUID()
            let ext = switch contentType { case "image/jpeg": "jpg"; case "image/png": "png"; case "image/heic": "heic"; default: "m4a" }
            let url = try attachmentURL(revisionID: draft.revisionID, id: id, extension: ext)
            try data.write(to: url, options: .atomic)
            draft.attachments.append(AttachmentRecord(
                id: id, ownerUID: draft.ownerUID, submissionID: draft.id, revisionID: draft.revisionID,
                localURL: url, contentType: contentType, sizeBytes: Int64(data.count), kind: kind,
                createdAt: .now, transferState: .localOnly
            ))
        } catch { workflowError = error.localizedDescription }
    }

    func addRecordedAttachment(_ attachment: AttachmentRecord) {
        guard let draft, !draft.hasAudio, attachment.isAudio, attachment.sizeBytes > 0,
              attachment.ownerUID == draft.ownerUID, attachment.submissionID == draft.id, attachment.revisionID == draft.revisionID
        else { return }
        draft.attachments.append(attachment)
    }

    func removeAttachment(_ id: UUID) {
        guard let draft, let attachment = draft.attachments.first(where: { $0.id == id }) else { return }
        try? FileManager.default.removeItem(at: attachment.localURL)
        draft.attachments.removeAll { $0.id == id }
    }

    private func applySession(_ user: User?) {
        authResolved = true
        remoteListener?.remove(); remoteListener = nil
        guard let user else {
            ownerUID = nil; isSignedIn = false; userDisplayName = ""; userEmail = ""
            draft = nil; records = []; homePath = []; recentPath = []; selectedTab = .home
            return
        }
        ownerUID = user.uid; isSignedIn = true; userEmail = user.email ?? ""
        userDisplayName = user.displayName?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
            ?? user.email?.split(separator: "@").first.map(String.init) ?? "Field Researcher"
        sites = (try? store.cachedSites()) ?? []
        draft = try? store.loadDraft(ownerUID: user.uid, sites: sites)
        if let draft { attachAutosave(to: draft) }
        reloadRecords()
        remoteListener = remote?.listen(ownerUID: user.uid) { [weak self] id, workflow, comment, validation, flags in
            guard let self else { return }
            do {
                let reason = comment ?? flags.first(where: { $0.severity == "ERROR" })?.message
                try self.store.updateRemoteState(ownerUID: user.uid, submissionID: id, workflow: workflow, sync: .synced, correctionReason: reason, validation: validation, flags: flags)
                self.reloadRecords()
                if self.records.first(where: { $0.id == id }) != nil {
                    self.workflowState = workflow
                }
            } catch { self.workflowError = error.localizedDescription }
        }
        refreshSites()
        if connection == .online { retrySync() }
    }

    private func attachAutosave(to value: ObservationDraft) {
        value.onChange = { [weak self, weak value] in
            guard let self, let value else { return }
            self.saveDraft(value)
        }
    }

    private func saveDraft(_ value: ObservationDraft) {
        do { try store.save(value); syncState = .savedLocally }
        catch { workflowError = "This draft could not be saved on this phone." }
    }

    private func copyAttachments(_ attachments: [AttachmentRecord], to draft: ObservationDraft) throws -> [AttachmentRecord] {
        var copies: [AttachmentRecord] = []
        do {
            for attachment in attachments {
                let id = UUID()
                let ext = switch attachment.contentType { case "image/jpeg": "jpg"; case "image/png": "png"; case "image/heic": "heic"; case "application/pdf": "pdf"; default: "m4a" }
                let url = try attachmentURL(revisionID: draft.revisionID, id: id, extension: ext)
                try FileManager.default.copyItem(at: attachment.localURL, to: url)
                let count = ((try FileManager.default.attributesOfItem(atPath: url.path)[.size]) as? NSNumber)?.int64Value ?? 0
                guard count == attachment.sizeBytes, count > 0 else { throw CanonicalizationError.invalid("Attachment copy is incomplete") }
                copies.append(AttachmentRecord(
                    id: id, ownerUID: draft.ownerUID, submissionID: draft.id, revisionID: draft.revisionID,
                    localURL: url, contentType: attachment.contentType, sizeBytes: count, kind: attachment.kind,
                    caption: attachment.caption, createdAt: .now, transferState: .localOnly
                ))
            }
            return copies
        } catch {
            copies.forEach { try? FileManager.default.removeItem(at: $0.localURL) }
            throw error
        }
    }

    private func reloadRecords() {
        guard let ownerUID else { records = []; return }
        do { records = try store.loadRecords(ownerUID: ownerUID) }
        catch { workflowError = "Saved observations could not be loaded." }
    }

    private func syncPending(only recordID: UUID?) async {
        guard let ownerUID, let remote, connection == .online else { return }
        do {
            let items = try store.queue(ownerUID: ownerUID).filter { recordID == nil || $0.submissionID == recordID?.uuidString.lowercased() }
            for item in items {
                guard let id = UUID(uuidString: item.submissionID), let snapshot = try store.snapshot(ownerUID: ownerUID, submissionID: id) else { continue }
                do {
                    try store.markQueue(item, state: "SYNCING", error: nil)
                    let currentWorkflow = records.first(where: { $0.id == id })?.workflow ?? (snapshot.correction ? .resubmitted : .submitted)
                    try store.updateRemoteState(ownerUID: ownerUID, submissionID: id, workflow: currentWorkflow, sync: .syncing, correctionReason: nil, validation: nil, flags: [])
                    syncState = .syncing; reloadRecords()
                    let acknowledged = try await remote.sync(snapshot) { [weak self] attachmentID, state, path, error in
                        try? self?.store.updateAttachment(ownerUID: ownerUID, attachmentID: attachmentID, state: state, remotePath: path, error: error)
                    }
                    try store.markQueue(item, state: "CONFIRMED", error: nil)
                    try store.updateRemoteState(ownerUID: ownerUID, submissionID: id, workflow: acknowledged, sync: .synced, correctionReason: nil, validation: nil, flags: [])
                    syncState = .synced; workflowState = acknowledged
                } catch let media as AttachmentSyncFailure {
                    // The scientific record reached the archive; only media is missing. The revision is now
                    // immutable, so retrying cannot resend it — report it truthfully instead of as a failed record.
                    try? store.markQueue(item, state: "CONFIRMED", error: media.localizedDescription)
                    try? store.updateRemoteState(ownerUID: ownerUID, submissionID: id, workflow: media.workflow, sync: .synced, correctionReason: nil, validation: nil, flags: [])
                    syncState = .synced; workflowState = media.workflow
                    workflowError = media.localizedDescription
                } catch {
                    try? store.markQueue(item, state: "RETRYABLE_FAILURE", error: error.localizedDescription)
                    try? store.updateRemoteState(ownerUID: ownerUID, submissionID: id, workflow: records.first(where: { $0.id == id })?.workflow ?? .submitted, sync: .failed, correctionReason: nil, validation: nil, flags: [])
                    syncState = .failed; workflowError = "Sync failed. The record remains saved on this phone."
                }
                reloadRecords()
            }
        } catch { workflowError = "The on-device sync queue is unavailable." }
    }

    private func startConnectivity() {
        monitor.pathUpdateHandler = { [weak self] path in
            let online = path.status == .satisfied
            Task { @MainActor in
                guard let self else { return }
                let wasOffline = self.connection != .online
                self.connection = online ? .online : .offline
                if online && wasOffline { self.refreshSites(); self.retrySync() }
            }
        }
        monitor.start(queue: monitorQueue)
    }

    private static func authMessage(_ error: Error) -> String {
        guard let code = AuthErrorCode(rawValue: (error as NSError).code) else { return "We couldn't sign you in. Try again." }
        return switch code {
        case .userDisabled: "This account is disabled. Contact your watershed program administrator."
        case .wrongPassword, .userNotFound, .invalidCredential, .invalidEmail: "Email or password is incorrect."
        case .networkError: "A network connection is required for sign-in."
        default: "We couldn't sign you in. Try again or contact your program administrator."
        }
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
