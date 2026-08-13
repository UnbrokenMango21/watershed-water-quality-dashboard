import Foundation
import Observation
import SwiftUI

extension Date {
    var fieldTimestamp: String {
        "\(formatted(date: .abbreviated, time: .omitted)) · \(formatted(date: .omitted, time: .shortened))"
    }
}

enum AppTab: Hashable { case home, recent, account }

enum HomeRoute: Hashable {
    case selectSite, visitDetails, testMethod, measurements, media, review, submit, status
}

enum RecentRoute: Hashable {
    case detail(UUID), correction(UUID), status(UUID)
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

enum WorkflowState: String, Hashable, Equatable {
    case draft, submitted, needsCorrection, resubmitted
    var title: LocalizedStringResource {
        switch self {
        case .draft: "Draft"
        case .submitted: "Submitted"
        case .needsCorrection: "Needs Correction"
        case .resubmitted: "Resubmitted"
        }
    }
    var icon: String {
        switch self {
        case .draft: "pencil"
        case .submitted: "doc.badge.checkmark"
        case .needsCorrection: "exclamationmark.bubble.fill"
        case .resubmitted: "arrow.uturn.forward.circle.fill"
        }
    }
    var color: Color {
        switch self {
        case .draft: FieldTheme.water
        case .submitted, .resubmitted: FieldTheme.fern
        case .needsCorrection: FieldTheme.goldenrod
        }
    }
}

enum GPSState: String, CaseIterable, Identifiable, Equatable {
    case locating, good, poor, denied
    var id: Self { self }
    var title: LocalizedStringResource {
        switch self {
        case .locating: "Locating"
        case .good: "±6 m"
        case .poor: "±84 m"
        case .denied: "Location Denied"
        }
    }
    var icon: String {
        switch self {
        case .locating: "location.viewfinder"
        case .good: "location.fill"
        case .poor: "location.circle"
        case .denied: "location.slash.fill"
        }
    }
    var color: Color {
        switch self {
        case .locating: FieldTheme.water
        case .good: FieldTheme.fern
        case .poor: FieldTheme.goldenrod
        case .denied: .red
        }
    }
}

struct Site: Identifiable, Hashable {
    let id: UUID
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

enum TestType: String, CaseIterable, Identifiable, Hashable {
    case fieldInstrument, pennStateLab, externalLab, fieldKit, sonde, mixed, other
    var id: Self { self }
    var title: LocalizedStringResource {
        switch self {
        case .fieldInstrument: "In-situ / Field Instrument"
        case .pennStateLab: "Penn State Lab"
        case .externalLab: "External Lab"
        case .fieldKit: "Field Kit"
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

    fileprivate func convert(_ value: Double, to unit: MeasurementUnit) -> Double {
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

enum MeasurementKind: String, CaseIterable, Identifiable, Hashable {
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

struct ObservationRecord: Identifiable, Hashable {
    let id: UUID
    var site: Site
    var date: Date
    var collector: String
    var testType: TestType
    var method: String
    var instrument: String
    var measurements: [MeasurementValue]
    var notes: String
    var photoCount: Int
    var workflow: WorkflowState
    var sync: SyncState
    var revision: Int
    var correctionReason: String?
    var revisions: [RevisionSummary]
}

@MainActor
@Observable
final class ObservationDraft {
    let id: UUID
    var site: Site?
    var date = Date.now { didSet { lastSaved = .now } }
    var collector = "Maya Chen"
    var gpsState: GPSState = .good
    var testType: TestType?
    var method = "" { didSet { lastSaved = .now } }
    var instrument = ""
    var values: [MeasurementKind: String] = [:]
    var selectedUnits: [MeasurementKind: MeasurementUnit] = [:]
    var labResultsPending = true
    var requestedAnalytes: Set<MeasurementKind> = [.chloride, .nitrate, .phosphate]
    var notes = "" { didSet { lastSaved = .now } }
    var photoCount = 0 { didSet { lastSaved = .now } }
    var hasAudio = false { didSet { lastSaved = .now } }
    var lastSaved = Date.now
    var currentStep = 1
    var isCorrection = false
    var baseRevision: Int?
    var correctionReason: String?
    var revisionNote = ""

    init(id: UUID = UUID()) { self.id = id }

    var includesLab: Bool {
        testType == .pennStateLab || testType == .externalLab || testType == .mixed
    }

    var requiredMeasurements: [MeasurementKind] {
        switch testType {
        case .fieldInstrument, .sonde, .mixed:
            [.temperature, .ph, .dissolvedOxygen, .conductivity]
        case .fieldKit:
            [.ph, .nitrate, .phosphate]
        case .pennStateLab, .externalLab:
            labResultsPending ? [] : [.nitrate, .phosphate, .chloride, .sulfate]
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

    var invalidMeasurementKinds: [MeasurementKind] {
        values.compactMap { kind, value in
            let trimmed = value.trimmingCharacters(in: .whitespaces)
            return !trimmed.isEmpty && Double(trimmed) == nil ? kind : nil
        }
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
            lastSaved = .now
        }
    }
}

@MainActor
@Observable
final class AppModel {
    var isSignedIn = false
    var email = "maya.chen@psu.edu"
    var password = "watershed"
    var authError: String?
    var selectedTab: AppTab = .home
    var homePath: [HomeRoute] = []
    var recentPath: [RecentRoute] = []
    var connection: ConnectionState = .online
    var syncState: SyncState = .synced
    var workflowState: WorkflowState = .draft
    var draft: ObservationDraft?
    var records: [ObservationRecord]
    var sites: [Site]

    var workOffline: Bool {
        get { connection == .offline }
        set { connection = newValue ? .offline : .online }
    }

    init() {
        let sampleSites = Self.sampleSites
        sites = sampleSites
        records = Self.sampleRecords(sites: sampleSites)
    }

    func signIn() {
        if email.lowercased() == "maya.chen@psu.edu" && !password.isEmpty {
            authError = nil
            isSignedIn = true
        } else {
            authError = "Authentication failed. Check email and password."
        }
    }

    func startNewObservation() {
        draft = ObservationDraft()
        workflowState = .draft
        syncState = .savedLocally
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
        draft?.lastSaved = .now
        syncState = .savedLocally
        homePath.append(route)
    }

    func submitDraft() {
        workflowState = draft?.isCorrection == true ? .resubmitted : .submitted
        switch connection {
        case .online: syncState = .syncing
        case .offline: syncState = .waiting
        case .serverUnavailable: syncState = .failed
        }
        addOrUpdateRecordFromDraft()
        homePath.append(.status)
        if connection == .online {
            Task {
                try? await Task.sleep(for: .seconds(1.2))
                guard connection == .online else { return }
                syncState = .synced
                updateNewestRecordSync(.synced)
            }
        }
    }

    func retrySync(recordID: UUID? = nil) {
        guard connection == .online else {
            syncState = connection == .offline ? .waiting : .failed
            if let recordID, let index = records.firstIndex(where: { $0.id == recordID }) {
                records[index].sync = syncState
            }
            return
        }
        syncState = .syncing
        setRecordSync(.syncing, recordID: recordID)
        Task {
            try? await Task.sleep(for: .seconds(1))
            syncState = .synced
            setRecordSync(.synced, recordID: recordID)
        }
    }

    func finishStatus() {
        draft = nil
        homePath = []
    }

    func startCorrection(for record: ObservationRecord) {
        let correction = ObservationDraft()
        correction.site = record.site
        correction.date = record.date
        correction.collector = record.collector
        correction.testType = record.testType
        correction.method = record.method
        correction.instrument = record.instrument
        correction.notes = record.notes
        correction.photoCount = record.photoCount
        correction.values = Dictionary(uniqueKeysWithValues: record.measurements.map { ($0.kind, $0.value) })
        correction.selectedUnits = Dictionary(uniqueKeysWithValues: record.measurements.map { ($0.kind, $0.unit) })
        correction.isCorrection = true
        correction.baseRevision = record.revision
        correction.correctionReason = record.correctionReason
        draft = correction
        workflowState = .needsCorrection
        syncState = .savedLocally
    }

    func resubmitCorrection(recordID: UUID) {
        guard let draft, let index = records.firstIndex(where: { $0.id == recordID }) else { return }
        let nextRevision = records[index].revision + 1
        records[index].measurements = draft.values.map { kind, value in
            MeasurementValue(id: UUID(), kind: kind, value: value, unit: draft.selectedUnit(for: kind))
        }.sorted { $0.kind.rawValue < $1.kind.rawValue }
        records[index].revision = nextRevision
        records[index].workflow = .resubmitted
        records[index].sync = connection == .online ? .syncing : (connection == .offline ? .waiting : .failed)
        records[index].revisions.append(
            RevisionSummary(id: UUID(), number: nextRevision, date: .now, state: .resubmitted, note: draft.revisionNote)
        )
        workflowState = .resubmitted
        syncState = records[index].sync
        recentPath.append(.status(recordID))
        if connection == .online {
            Task {
                try? await Task.sleep(for: .seconds(1))
                guard let refreshed = records.firstIndex(where: { $0.id == recordID }) else { return }
                records[refreshed].sync = .synced
                syncState = .synced
            }
        }
    }

    func record(id: UUID) -> ObservationRecord? { records.first { $0.id == id } }

    private func addOrUpdateRecordFromDraft() {
        guard let draft, let site = draft.site, let type = draft.testType else { return }
        let values = draft.values.map { kind, value in
            MeasurementValue(id: UUID(), kind: kind, value: value, unit: draft.selectedUnit(for: kind))
        }.sorted { $0.kind.rawValue < $1.kind.rawValue }
        let record = ObservationRecord(
            id: UUID(), site: site, date: draft.date, collector: draft.collector, testType: type,
            method: draft.method, instrument: draft.instrument, measurements: values, notes: draft.notes, photoCount: draft.photoCount,
            workflow: workflowState, sync: syncState, revision: 1, correctionReason: nil,
            revisions: [RevisionSummary(id: UUID(), number: 1, date: .now, state: workflowState, note: "Field observation submitted.")]
        )
        records.insert(record, at: 0)
    }

    private func updateNewestRecordSync(_ state: SyncState) {
        guard !records.isEmpty else { return }
        records[0].sync = state
    }

    private func setRecordSync(_ state: SyncState, recordID: UUID?) {
        if let recordID, let index = records.firstIndex(where: { $0.id == recordID }) {
            records[index].sync = state
        } else {
            for index in records.indices where records[index].sync != .synced {
                records[index].sync = state
            }
        }
    }

    static let sampleSites: [Site] = [
        Site(id: UUID(uuidString: "10000000-0000-0000-0000-000000000001")!, name: "Spring Creek at Houserville Road Bridge", county: "Centre County", watershed: "Spring Creek · Susquehanna", latitude: 40.83091, longitude: -77.83172, cached: true, distance: "0.4 mi"),
        Site(id: UUID(uuidString: "10000000-0000-0000-0000-000000000002")!, name: "Spring Creek below Benner Spring Fish Hatchery", county: "Centre County", watershed: "Spring Creek · Susquehanna", latitude: 40.88742, longitude: -77.79311, cached: true, distance: "4.8 mi"),
        Site(id: UUID(uuidString: "10000000-0000-0000-0000-000000000003")!, name: "Pine Creek below Slate Run", county: "Lycoming County", watershed: "Pine Creek · West Branch Susquehanna", latitude: 41.47272, longitude: -77.50044, cached: true, distance: "52 mi"),
        Site(id: UUID(uuidString: "10000000-0000-0000-0000-000000000004")!, name: "Susquehanna River at City Island, Harrisburg", county: "Dauphin County", watershed: "Lower Susquehanna", latitude: 40.25294, longitude: -76.88812, cached: true, distance: "89 mi"),
        Site(id: UUID(uuidString: "10000000-0000-0000-0000-000000000005")!, name: "Wissahickon Creek at Valley Green Road", county: "Philadelphia County", watershed: "Wissahickon · Delaware", latitude: 40.05574, longitude: -75.21862, cached: false, distance: "171 mi"),
        Site(id: UUID(uuidString: "10000000-0000-0000-0000-000000000006")!, name: "Lehigh River below Jim Thorpe", county: "Carbon County", watershed: "Lehigh · Delaware", latitude: 40.86364, longitude: -75.73912, cached: false, distance: "124 mi")
    ]

    static func sampleRecords(sites: [Site]) -> [ObservationRecord] {
        let calendar = Calendar(identifier: .gregorian)
        let date1 = calendar.date(from: DateComponents(year: 2026, month: 8, day: 11, hour: 8, minute: 42))!
        let date2 = calendar.date(from: DateComponents(year: 2026, month: 8, day: 8, hour: 14, minute: 15))!
        let date3 = calendar.date(from: DateComponents(year: 2026, month: 8, day: 2, hour: 10, minute: 5))!
        return [
            ObservationRecord(
                id: UUID(uuidString: "20000000-0000-0000-0000-000000000001")!, site: sites[0], date: date1, collector: "Maya Chen", testType: .fieldInstrument,
                method: "Direct instrument reading",
                instrument: "YSI ProDSS · Unit 4412",
                measurements: [
                    MeasurementValue(id: UUID(), kind: .temperature, value: "17.8", unit: .celsius),
                    MeasurementValue(id: UUID(), kind: .ph, value: "7.42", unit: .pHStandard),
                    MeasurementValue(id: UUID(), kind: .dissolvedOxygen, value: "9.10", unit: .milligramsOxygenPerLiter),
                    MeasurementValue(id: UUID(), kind: .conductivity, value: "328", unit: .microsiemensPerCentimeter)
                ], notes: "Clear flow after overnight rain. Sample taken from main current, 20 cm below surface.", photoCount: 2,
                workflow: .submitted, sync: .synced, revision: 1, correctionReason: nil,
                revisions: [RevisionSummary(id: UUID(), number: 1, date: date1, state: .submitted, note: "Original field submission.")]
            ),
            ObservationRecord(
                id: UUID(uuidString: "20000000-0000-0000-0000-000000000002")!, site: sites[2], date: date2, collector: "Maya Chen", testType: .sonde,
                method: "15 minute deployment",
                instrument: "EXO2 Multiparameter Sonde",
                measurements: [
                    MeasurementValue(id: UUID(), kind: .temperature, value: "19.2", unit: .celsius),
                    MeasurementValue(id: UUID(), kind: .ph, value: "7.18", unit: .pHStandard),
                    MeasurementValue(id: UUID(), kind: .dissolvedOxygen, value: "91", unit: .milligramsOxygenPerLiter),
                    MeasurementValue(id: UUID(), kind: .conductivity, value: "146", unit: .microsiemensPerCentimeter)
                ], notes: "Sonde stabilized for 15 minutes in the shaded run.", photoCount: 1,
                workflow: .needsCorrection, sync: .synced, revision: 1,
                correctionReason: "Dissolved oxygen appears to be percent saturation, not mg L⁻¹. Confirm the source reading and correct the unit or value.",
                revisions: [RevisionSummary(id: UUID(), number: 1, date: date2, state: .submitted, note: "Original submission; correction requested August 10.")]
            ),
            ObservationRecord(
                id: UUID(uuidString: "20000000-0000-0000-0000-000000000003")!, site: sites[3], date: date3, collector: "Alex Rivera", testType: .mixed,
                method: "Direct reading and grab sample",
                instrument: "YSI ProDSS · Unit 4412",
                measurements: [MeasurementValue(id: UUID(), kind: .temperature, value: "23.6", unit: .celsius)],
                notes: "Brown water, moderate floating debris near west channel.", photoCount: 3,
                workflow: .submitted, sync: .failed, revision: 1, correctionReason: nil,
                revisions: [RevisionSummary(id: UUID(), number: 1, date: date3, state: .submitted, note: "Saved on device; upload failed.")]
            )
        ]
    }
}
