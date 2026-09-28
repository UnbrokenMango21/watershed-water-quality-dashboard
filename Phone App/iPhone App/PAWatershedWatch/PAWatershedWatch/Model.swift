import CoreLocation
import Foundation
@preconcurrency import FirebaseAuth
@preconcurrency import FirebaseFirestore
@preconcurrency import Network
import Observation
import OSLog
import SwiftData
import SwiftUI
import UIKit

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

/// Bottom navigation is operational only. Account and settings open from the top-right control.
enum AppTab: Hashable { case home, recent }

enum HomeRoute: Hashable {
    case selectSite, visitDetails, testMethod, measurements, media, review, status
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

enum WorkflowState: String, CaseIterable, Hashable, Equatable, Codable {
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
    /// Each state has its own shape, so status never depends on color alone.
    var icon: String {
        switch self {
        case .draft: "pencil"
        case .submitted: "paperplane.fill"
        case .validating: "arrow.triangle.2.circlepath"
        case .pendingReview: "hourglass"
        case .needsCorrection: "exclamationmark.bubble.fill"
        case .resubmitted: "arrow.uturn.forward.circle.fill"
        case .approved: "checkmark.seal.fill"
        case .rejected: "xmark.octagon.fill"
        case .publishing: "icloud.and.arrow.up"
        case .publishFailed: "exclamationmark.triangle.fill"
        case .published: "globe.americas.fill"
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

/// An authoritative catalog site. Coordinates come only from `siteCatalog`; collectors select a site,
/// they never move one.
struct Site: Identifiable, Hashable {
    let id: String
    let name: String
    var code: String = ""
    let county: String
    let watershed: String
    let latitude: Double
    let longitude: Double
    /// `site_tolerance_m`: the expected sampling radius used by server validation for its distance warning.
    var toleranceMeters: Double? = nil
    var cached: Bool = true

    var coordinate: CLLocationCoordinate2D { CLLocationCoordinate2D(latitude: latitude, longitude: longitude) }

    var subtitle: String { [county, watershed].filter { !$0.isEmpty }.joined(separator: " · ") }

    func distance(from location: CLLocation) -> CLLocationDistance {
        location.distance(from: CLLocation(latitude: latitude, longitude: longitude))
    }

    func distance(latitude: Double, longitude: Double) -> CLLocationDistance {
        distance(from: CLLocation(latitude: latitude, longitude: longitude))
    }

    func matches(_ query: String) -> Bool {
        let query = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { return true }
        return [name, code, county, watershed].contains { $0.localizedStandardContains(query) }
    }

    var position: String {
        "\(latitude.formatted(.number.precision(.fractionLength(4))))° N · \(abs(longitude).formatted(.number.precision(.fractionLength(4))))° W"
    }

    /// Distance for display, in the collector's regional units.
    static func distanceText(_ meters: CLLocationDistance) -> String {
        Measurement(value: meters, unit: UnitLength.meters).formatted(.measurement(width: .abbreviated, usage: .road))
    }
}

/// How an observation was measured. Display labels are plain language; the stored value is always
/// `contractValue`, which the Firestore rules and validation engine enumerate exactly.
enum TestType: String, CaseIterable, Identifiable, Hashable, Codable {
    case fieldInstrument, pennStateLab, externalLab, fieldKit, sonde, mixed, other
    var id: Self { self }

    /// Choices offered for a new observation. Sonde and combined field-and-lab stay valid stored values
    /// (older records and corrections still show them) but are not offered until the program confirms
    /// they are part of this collection protocol — see docs/SUPERVISOR_QUESTIONS.md.
    static let offeredForNewObservations: [TestType] = [.fieldInstrument, .fieldKit, .pennStateLab, .externalLab, .other]

    var title: LocalizedStringResource {
        switch self {
        case .fieldInstrument: "Field instrument (in situ)"
        case .pennStateLab: "Penn State laboratory"
        case .externalLab: "External laboratory"
        case .fieldKit: "Field test kit / colorimetric"
        case .sonde: "Continuous sensor / sonde"
        case .mixed: "Field instrument and laboratory"
        case .other: "Other method"
        }
    }

    var detail: LocalizedStringResource {
        switch self {
        case .fieldInstrument: "A meter or probe read directly in the water."
        case .pennStateLab: "A sample analyzed by a Penn State laboratory."
        case .externalLab: "A sample analyzed by another laboratory."
        case .fieldKit: "A test kit or color comparison done on site."
        case .sonde: "A deployed sensor that logs readings over time."
        case .mixed: "Some values read in the field, others from a lab."
        case .other: "Describe the approach below."
        }
    }

    var isLaboratory: Bool { self == .pennStateLab || self == .externalLab }

    /// Label for `instrument_name`: what produced the values.
    var sourceLabel: LocalizedStringResource {
        switch self {
        case .fieldInstrument, .sonde: "Instrument"
        case .fieldKit: "Test kit"
        case .pennStateLab, .externalLab: "Laboratory"
        case .mixed: "Instrument and laboratory"
        case .other: "Instrument, kit, or laboratory"
        }
    }

    var sourcePrompt: LocalizedStringResource {
        switch self {
        case .fieldInstrument, .sonde: "Make and model you used"
        case .fieldKit: "Kit name or manufacturer"
        case .pennStateLab, .externalLab: "Laboratory name"
        case .mixed: "Instrument used and laboratory name"
        case .other: "What produced these values"
        }
    }

    /// Label for `method_name`: how the reading or sample was taken.
    var methodLabel: LocalizedStringResource {
        isLaboratory ? "Sample collection" : "Method"
    }

    var methodPrompt: LocalizedStringResource {
        isLaboratory ? "How the sample was collected" : "How the reading was taken"
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

    /// Counts taken from the flags themselves, for when the server summary fields are not present yet.
    /// Anything that is neither ERROR nor INFO (for example PLAUSIBILITY_WARNING) counts as a warning.
    static func derived(from flags: [ValidationFlag]) -> ValidationSummary {
        let errors = flags.count { $0.severity == "ERROR" }
        let info = flags.count { $0.severity == "INFO" }
        return ValidationSummary(errorCount: errors, warningCount: flags.count - errors - info, infoCount: info, overallQualityScore: nil)
    }
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

    func touch() {
        lastSaved = .now
        onChange?()
    }

    /// Water Temperature is the only required measurement, for every test type, without exception —
    /// see docs/PHASE_11_SUPERVISOR_DECISIONS.md. Every other supported measurement is optional.
    var requiredMeasurements: [MeasurementKind] { [.temperature] }

    /// Optional measurements the production contract enables. A parameter that is not enabled is never
    /// shown to collectors — unless an older draft already holds a value for it, in which case the row
    /// stays visible so the collector can clear it (it cannot be submitted).
    var optionalMeasurements: [MeasurementKind] {
        MeasurementKind.allCases.filter { kind in
            guard !requiredMeasurements.contains(kind) else { return false }
            return kind.productionSpec.support == .fullySupported
                || !values[kind, default: ""].trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
    }

    var completedRequiredCount: Int {
        requiredMeasurements.count { Double(values[$0] ?? "") != nil }
    }

    var firstIncompleteRequirement: MeasurementKind? {
        requiredMeasurements.first { Double(values[$0] ?? "") == nil }
    }

    /// Progress text for the Required Measurements header: the ratio of required fields entered.
    /// Temperature is the only required measurement, so this reaches "1/1" the moment it is filled,
    /// with no further condition.
    var measurementProgressText: String { "\(completedRequiredCount)/\(requiredMeasurements.count)" }

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
    /// Full name typed while creating an account.
    var fullName = ""
    var authError: String?
    /// A non-error outcome to confirm, such as "reset email sent".
    var authNotice: String?
    var workflowError: String?
    /// The collector's research-facing name, from the Firebase Auth profile. Never an email fragment:
    /// when it is missing the app asks for a real name before collection starts.
    var userDisplayName = ""
    var userEmail = ""
    var userEmailVerified = false
    var signInProviders: [SignInProvider] = []
    /// Set once the person has confirmed the name that will identify their observations on this device.
    var identityConfirmed = false
    var isSavingName = false
    var selectedTab: AppTab = .home
    var showAccount = false
    var lastSubmittedID: UUID?
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

    var needsIdentity: Bool { isSignedIn && (!identityConfirmed || userDisplayName.isEmpty) }

    func signIn() {
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanEmail.isEmpty, !password.isEmpty else { authError = "Enter your email and password."; return }
        guard connection == .online, let remote else { authError = "A network connection is required for sign-in."; return }
        authError = nil; authNotice = nil; isAuthenticating = true
        Task {
            do { _ = try await remote.signIn(email: cleanEmail, password: password); password = "" }
            catch { authError = Self.authMessage(error) }
            isAuthenticating = false
        }
    }

    /// Creates an email/password account and records the full name on the Auth profile before the
    /// first observation. Firebase keeps one account per email, so an address already registered
    /// (including through Google) is reported instead of creating a second person.
    func createAccount() {
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let name = IdentityName.normalized(fullName)
        if let problem = IdentityName.problem(fullName) { authError = problem; return }
        guard !cleanEmail.isEmpty else { authError = "Enter your email address."; return }
        guard password.count >= 8 else { authError = "Use a password with at least 8 characters."; return }
        guard connection == .online, let remote else { authError = "A network connection is required to create an account."; return }
        authError = nil; authNotice = nil; isAuthenticating = true
        Task {
            do {
                let user = try await remote.createAccount(fullName: name, email: cleanEmail, password: password)
                Self.authLog.info("Account created")
                password = ""
                applySession(user, displayNameOverride: name)
                identityConfirmed = true
                storeIdentityConfirmation(uid: user.uid)
            } catch { authError = Self.authMessage(error) }
            isAuthenticating = false
        }
    }

    /// Sends Firebase's password-reset email. The confirmation is the same whether or not the address
    /// has an account, so the screen never reveals who is registered.
    func sendPasswordReset(to address: String? = nil) {
        let cleanEmail = (address ?? email).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanEmail.isEmpty, cleanEmail.contains("@") else { authError = "Enter the email address you sign in with."; return }
        guard connection == .online, let remote else { authError = "A network connection is required to reset a password."; return }
        authError = nil; authNotice = nil; isAuthenticating = true
        Task {
            do {
                try await remote.sendPasswordReset(email: cleanEmail)
                authNotice = "If an account uses \(cleanEmail), a password reset email is on its way. Check your inbox and spam folder."
            } catch {
                if let code = AuthErrorCode(rawValue: (error as NSError).code), code == .userNotFound {
                    authNotice = "If an account uses \(cleanEmail), a password reset email is on its way. Check your inbox and spam folder."
                } else {
                    authError = Self.authMessage(error)
                }
            }
            isAuthenticating = false
        }
    }

    /// Changes the name that identifies new observations. Historical revisions keep the name they were
    /// submitted with; only future records and the research profile change.
    @discardableResult
    func updateDisplayName(_ raw: String) async -> Bool {
        if let problem = IdentityName.problem(raw) { authError = problem; return false }
        let name = IdentityName.normalized(raw)
        guard connection == .online, let remote else { authError = "A network connection is required to change your name."; return false }
        authError = nil; isSavingName = true
        defer { isSavingName = false }
        do {
            try await remote.updateDisplayName(name)
            userDisplayName = name
            if let draft, !draft.isCorrection { draft.collector = name }
            return true
        } catch {
            authError = "Your name could not be saved. Check your connection and try again."
            return false
        }
    }

    /// Confirms (and if needed saves) the name shown on the Ready step of onboarding.
    func confirmIdentity(_ raw: String) async {
        let name = IdentityName.normalized(raw)
        if name != userDisplayName {
            guard await updateDisplayName(raw) else { return }
        } else if let problem = IdentityName.problem(raw) {
            authError = problem; return
        }
        identityConfirmed = true
        if let ownerUID { storeIdentityConfirmation(uid: ownerUID) }
    }

    func signInWithGoogle() {
        guard connection == .online, let remote else {
            authError = "A network connection is required for Google Sign-In."
            return
        }
        guard let presenter = Self.presentingViewController() else {
            authError = "Google Sign-In could not open. Try again."
            return
        }
        authError = nil
        isAuthenticating = true
        Task {
            do {
                _ = try await remote.signInWithGoogle(presenting: presenter)
            } catch {
                authError = Self.googleAuthMessage(error)
            }
            isAuthenticating = false
        }
    }

    func signOut() {
        Self.authLog.info("Sign-out requested")
        do { try remote?.signOut(); showAccount = false }
        catch { authError = "We couldn't sign out. Try again." }
    }

    func startNewObservation() {
        guard let ownerUID else { authError = "Sign in before starting an observation."; return }
        guard !userDisplayName.isEmpty else { identityConfirmed = false; return }
        if let draft { try? store.deleteDraft(ownerUID: ownerUID, submissionID: draft.id) }
        let value = ObservationDraft(ownerUID: ownerUID)
        value.collector = userDisplayName
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
            lastSubmittedID = snapshot.submissionID
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

    @discardableResult
    func startCorrection(for record: ObservationRecord) -> Bool {
        guard record.workflow == .needsCorrection, record.ownerUID == ownerUID else {
            workflowError = "This record cannot be corrected from the current account."
            return false
        }
        guard record.sync == .synced else {
            workflowError = "A correction revision is already saved on this phone but has not been confirmed by the archive. Retry that sync before creating another revision."
            if connection == .online { retrySync(recordID: record.id) }
            return false
        }
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
        return true
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

    private func applySession(_ user: User?, displayNameOverride: String? = nil) {
        authResolved = true
        guard let user else {
            Self.authLog.info("Session ended")
            remoteListener?.remove(); remoteListener = nil
            ownerUID = nil; isSignedIn = false; userDisplayName = ""; userEmail = ""; userEmailVerified = false
            signInProviders = []; identityConfirmed = false; showAccount = false
            draft = nil; records = []; homePath = []; recentPath = []; selectedTab = .home
            return
        }
        let sameSession = ownerUID == user.uid && isSignedIn
        Self.authLog.info("Session applied: sameSession=\(sameSession, privacy: .public) hasName=\(!(user.displayName ?? "").isEmpty, privacy: .public)")
        ownerUID = user.uid; isSignedIn = true; userEmail = user.email ?? ""
        userEmailVerified = user.isEmailVerified
        signInProviders = user.providerData.compactMap { SignInProvider(rawValue: $0.providerID) }
        userDisplayName = displayNameOverride
            ?? user.displayName.map(IdentityName.normalized)?.nilIfEmpty
            ?? (sameSession ? userDisplayName : "")
        identityConfirmed = identityConfirmed(uid: user.uid) && !userDisplayName.isEmpty
        // A repeat callback for the same account (for example after its profile name is set) keeps the
        // existing listener and draft; only a new account resets them.
        guard !sameSession else { return }
        remoteListener?.remove(); remoteListener = nil
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

    private static let identityKeyPrefix = "identityConfirmed."

    private func identityConfirmed(uid: String) -> Bool {
        UserDefaults.standard.bool(forKey: Self.identityKeyPrefix + uid)
    }

    private func storeIdentityConfirmation(uid: String) {
        UserDefaults.standard.set(true, forKey: Self.identityKeyPrefix + uid)
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
                    let acknowledged = try await remote.sync(snapshot)
                    try store.markQueue(item, state: "CONFIRMED", error: nil)
                    try store.updateRemoteState(ownerUID: ownerUID, submissionID: id, workflow: acknowledged, sync: .synced, correctionReason: nil, validation: nil, flags: [])
                    syncState = .synced; workflowState = acknowledged
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

    private static func presentingViewController() -> UIViewController? {
        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }),
              let root = scene.windows.first(where: \.isKeyWindow)?.rootViewController
        else { return nil }
        var presenter = root
        while let presented = presenter.presentedViewController { presenter = presented }
        return presenter
    }

    private static func googleAuthMessage(_ error: Error) -> String {
        let nsError = error as NSError
        authLog.error("Google sign-in failed: \(nsError.domain, privacy: .public) \(nsError.code, privacy: .public)")
        if nsError.domain == "com.google.GIDSignIn", nsError.code == -5 {
            return "Google Sign-In was canceled."
        }
        if let code = AuthErrorCode(rawValue: nsError.code), code == .networkError {
            return "A network connection is required for Google Sign-In."
        }
        if let failure = error as? GoogleSignInFailure {
            return failure.localizedDescription
        }
        if let code = AuthErrorCode(rawValue: nsError.code) {
            switch code {
            case .accountExistsWithDifferentCredential, .credentialAlreadyInUse:
                return "This email already has a PA Watershed Watch account that uses a password. Sign in with your email and password instead."
            case .userDisabled:
                return "This account is disabled. Contact your watershed program administrator."
            default: break
            }
        }
        return "We couldn't sign you in with Google. Try again or contact your program administrator."
    }

    private static let authLog = Logger(subsystem: "org.centralpawatershed.mobile", category: "auth")

    private static func authMessage(_ error: Error) -> String {
        let nsError = error as NSError
        // Domain and code only: never the email, password, or token.
        authLog.error("Auth request failed: \(nsError.domain, privacy: .public) \(nsError.code, privacy: .public)")
        guard let code = AuthErrorCode(rawValue: (error as NSError).code) else { return "We couldn't sign you in. Try again." }
        return switch code {
        case .userDisabled: "This account is disabled. Contact your watershed program administrator."
        case .wrongPassword, .userNotFound, .invalidCredential: "Email or password is incorrect."
        case .invalidEmail: "Enter a valid email address."
        case .emailAlreadyInUse: "An account already uses this email. Sign in instead — use Continue with Google if that is how the account was created."
        case .weakPassword: "Choose a stronger password with at least 8 characters."
        case .tooManyRequests: "Too many attempts. Wait a few minutes, then try again."
        case .operationNotAllowed: "Email sign-up is not enabled for this program. Use Continue with Google or contact your program administrator."
        case .networkError: "A network connection is required. Saved field records remain on this phone."
        default: "We couldn't complete that request. Try again or contact your program administrator."
        }
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

enum SignInProvider: String, Hashable {
    case password, google = "google.com"
    var title: LocalizedStringResource {
        switch self {
        case .password: "Email and password"
        case .google: "Google"
        }
    }
}

/// The research identity rule, mirrored by `profile/display_name.mjs` on the server: a real name of
/// 2–80 characters with whitespace collapsed. It is not a username.
enum IdentityName {
    static func normalized(_ raw: String) -> String {
        raw.trimmingCharacters(in: .whitespacesAndNewlines)
            .split(whereSeparator: \.isWhitespace)
            .joined(separator: " ")
    }

    static func problem(_ raw: String) -> String? {
        let value = normalized(raw)
        if value.count < 2 { return "Enter your full name as your research team knows you." }
        if value.count > 80 { return "Full name must be 80 characters or fewer." }
        if value.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }) { return "Full name contains characters that can't be used." }
        return nil
    }
}
