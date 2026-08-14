import AVFoundation
import CryptoKit
@preconcurrency import FirebaseAuth
@preconcurrency import FirebaseFirestore
@preconcurrency import FirebaseStorage
import Foundation
import SwiftData

enum ProductionSupport: String, Codable { case fullySupported = "FULLY_SUPPORTED", featureGated = "FEATURE_GATED" }

struct ProductionMeasurementSpec {
    let code: String?
    let unit: String?
    let support: ProductionSupport
}

extension MeasurementKind {
    var productionSpec: ProductionMeasurementSpec {
        switch self {
        case .temperature: .init(code: "WATER_TEMP_C", unit: "degC", support: .fullySupported)
        case .ph: .init(code: "PH", unit: "pH", support: .fullySupported)
        case .dissolvedOxygen: .init(code: "DO_MG_L", unit: "mg/L", support: .fullySupported)
        case .dissolvedOxygenSaturation: .init(code: "DO_PERCENT", unit: "percent", support: .fullySupported)
        case .conductivity: .init(code: "CONDUCTIVITY_US_CM", unit: "uS/cm", support: .fullySupported)
        case .tds: .init(code: "TDS_MG_L", unit: "mg/L", support: .fullySupported)
        case .orp: .init(code: "ORP_MV", unit: "mV", support: .fullySupported)
        case .chloride: .init(code: "CHLORIDE_MG_L", unit: "mg/L", support: .fullySupported)
        case .sulfate: .init(code: "SULFATE_MG_L", unit: "mg/L", support: .fullySupported)
        case .nitrate: .init(code: "NITRATE_MG_L", unit: "mg/L as N", support: .fullySupported)
        case .phosphate: .init(code: "PHOSPHATE_MG_L", unit: "mg/L as P", support: .fullySupported)
        case .flow: .init(code: "DISCHARGE_M3_S", unit: "m3/s", support: .fullySupported)
        default: .init(code: nil, unit: nil, support: .featureGated)
        }
    }
}

extension TestType {
    var contractValue: String {
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

    static func contract(_ value: String) -> TestType? { allCases.first { $0.contractValue == value } }
}

enum EasternTime {
    static let zone = TimeZone(identifier: "America/New_York")!
    static var calendar: Calendar {
        var value = Calendar(identifier: .gregorian)
        value.timeZone = zone
        return value
    }
    static func offsetString(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.timeZone = zone
        formatter.formatOptions = [.withInternetDateTime, .withColonSeparatorInTimeZone]
        return formatter.string(from: date)
    }
}

enum CanonicalID {
    static func measurement(revisionID: UUID, parameterCode: String) -> UUID {
        var bytes = Array(SHA256.hash(data: Data("\(revisionID.uuidString.lowercased())|\(parameterCode)".utf8)).prefix(16))
        bytes[6] = (bytes[6] & 0x0f) | 0x50
        bytes[8] = (bytes[8] & 0x3f) | 0x80
        return UUID(uuid: (bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7], bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]))
    }
}

struct CanonicalMeasurement: Codable, Hashable {
    let id: UUID
    let kind: MeasurementKind
    let parameterCode: String
    let displayName: String
    let enteredValue: Double
    let enteredUnitID: String
    let enteredUnit: String
    let value: Double
    let unitCode: String
}

struct CanonicalSnapshot: Codable, Hashable {
    let submissionID: UUID
    let eventID: UUID
    let revisionID: UUID
    let revisionNumber: Int
    let ownerUID: String
    let siteID: String
    let createdAt: Date
    let collectedAt: Date
    let submittedAt: Date
    let latitude: Double
    let longitude: Double
    let accuracyMeters: Double
    let collector: String
    let testType: String
    let testTypeOther: String?
    let method: String
    let instrument: String
    let notes: String?
    let temperatureEnteredValue: Double
    let temperatureEnteredUnit: String
    let tempC: Double
    let tempF: Double
    let measurements: [CanonicalMeasurement]
    let attachments: [AttachmentRecord]
    let appVersion: String
    let correction: Bool
}

enum CanonicalizationError: LocalizedError {
    case invalid(String, section: WorkflowSection? = nil, measurement: MeasurementKind? = nil)

    var errorDescription: String? { if case .invalid(let value, _, _) = self { value } else { nil } }
    /// The workflow step that can fix this failure, used to route the collector there.
    var section: WorkflowSection? { if case .invalid(_, let section, _) = self { section } else { nil } }
    /// The measurement field that caused this failure, used to open the keyboard on it.
    var measurement: MeasurementKind? { if case .invalid(_, _, let kind) = self { kind } else { nil } }
}

/// Hard ranges mirror `config/validation_rules.json` (`temperature.hardRangeC` and `parameters[*].hardRange`).
/// The numbers are duplicated here deliberately: the app does not read the server rules file, so the
/// client rejects an out-of-range entry in the field instead of letting the server bounce it later.
struct ProductionHardRange {
    let bounds: ClosedRange<Double>
    let display: String

    static let temperatureC = ProductionHardRange(bounds: -5...60, display: "between -5 and 60 °C")

    /// Only parameters with a documented upper hard bound appear here. Parameters with `hardMin: 0`
    /// stay on the shared non-negative check, and ORP is signed with no hard range at all.
    static func forParameter(_ code: String) -> ProductionHardRange? {
        switch code {
        case "PH": ProductionHardRange(bounds: 0...14, display: "between 0 and 14")
        case "DO_MG_L": ProductionHardRange(bounds: 0...50, display: "between 0 and 50 mg/L")
        case "DO_PERCENT": ProductionHardRange(bounds: 0...300, display: "between 0 and 300 %")
        default: nil
        }
    }

    func message(for name: String) -> String { "\(name) must be \(display)." }
}

extension ObservationDraft {
    /// The archive value for an entered reading, rounded exactly as it is stored.
    func canonicalValue(_ entered: Double, for kind: MeasurementKind) -> Double {
        (selectedUnit(for: kind).convert(entered, to: kind.defaultUnit) * 1_000_000_000_000).rounded(.toNearestOrEven) / 1_000_000_000_000
    }

    /// Why this entry cannot be recorded, or nil when it is blank or acceptable. Blank is never a problem
    /// here — requiredness is reported by `productionProfileComplete`. Shared by the inline field error on
    /// the Measurements screen and by `canonicalSnapshot()`, so both say exactly the same thing.
    func measurementProblem(for kind: MeasurementKind) -> String? {
        let raw = values[kind, default: ""].trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return nil }
        let name = String(localized: kind.title)
        let spec = kind.productionSpec
        guard spec.support == .fullySupported, let code = spec.code else { return "\(name) is not enabled by the production contract." }
        guard let entered = Double(raw), entered.isFinite else { return "\(name) must be a number." }
        guard kind != .temperature else {
            let celsius = selectedUnit(for: .temperature).convert(entered, to: .celsius)
            return ProductionHardRange.temperatureC.bounds.contains(celsius) ? nil : ProductionHardRange.temperatureC.message(for: name)
        }
        if kind != .orp && entered < 0 { return "\(name) cannot be negative." }
        guard let range = ProductionHardRange.forParameter(code) else { return nil }
        return range.bounds.contains(canonicalValue(entered, for: kind)) ? nil : range.message(for: name)
    }

    /// Every unusable entry in display order, so the screen can show a banner and focus the first one.
    var measurementProblems: [(kind: MeasurementKind, message: String)] {
        (requiredMeasurements + optionalMeasurements).compactMap { kind in
            measurementProblem(for: kind).map { (kind, $0) }
        }
    }

    func canonicalSnapshot(submittedAt: Date = .now) throws -> CanonicalSnapshot {
        guard !ownerUID.isEmpty else { throw CanonicalizationError.invalid("Authenticated owner is required") }
        guard let site, let latitude, let longitude, let accuracyMeters,
              (-90...90).contains(latitude), (-180...180).contains(longitude), !(latitude == 0 && longitude == 0), accuracyMeters >= 0
        else { throw CanonicalizationError.invalid("A valid field GPS position is required", section: .visitDetails) }
        guard !collector.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else { throw CanonicalizationError.invalid("A collector name is required", section: .visitDetails) }
        guard let testType else { throw CanonicalizationError.invalid("Test type is required", section: .testMethod) }
        guard testType != .other || !testTypeOther.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw CanonicalizationError.invalid("Describe the other test type", section: .testMethod) }
        guard !method.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              !instrument.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else { throw CanonicalizationError.invalid("Method and instrument or laboratory are required", section: .testMethod) }
        if let problem = measurementProblems.first {
            throw CanonicalizationError.invalid(problem.message, section: .measurements, measurement: problem.kind)
        }
        guard let enteredTemperature = Double(values[.temperature, default: ""]), enteredTemperature.isFinite
        else { throw CanonicalizationError.invalid("\(String(localized: MeasurementKind.temperature.title)) is required.", section: .measurements, measurement: .temperature) }
        guard productionProfileComplete else {
            let missing = firstIncompleteRequirement
            let message = missing.map { "\(String(localized: $0.title)) is required." }
                ?? "Enter at least one measurement result in addition to temperature. This test type requires it."
            throw CanonicalizationError.invalid(message, section: .measurements, measurement: missing)
        }
        let temperatureUnit = selectedUnit(for: .temperature)
        let tempC = temperatureUnit.convert(enteredTemperature, to: .celsius)
        let tempF = MeasurementUnit.celsius.convert(tempC, to: .fahrenheit)
        let canonical = try values.compactMap { kind, raw -> CanonicalMeasurement? in
            let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            guard kind != .temperature, !trimmed.isEmpty else { return nil }
            let spec = kind.productionSpec
            guard let code = spec.code, let unitCode = spec.unit, let entered = Double(trimmed), entered.isFinite
            else { throw CanonicalizationError.invalid("\(String(localized: kind.title)) could not be recorded.", section: .measurements, measurement: kind) }
            let selected = selectedUnit(for: kind)
            return CanonicalMeasurement(
                id: CanonicalID.measurement(revisionID: revisionID, parameterCode: code), kind: kind,
                parameterCode: code, displayName: String(localized: kind.title), enteredValue: entered,
                enteredUnitID: selected.id, enteredUnit: selected.menuTitle, value: canonicalValue(entered, for: kind), unitCode: unitCode
            )
        }.sorted { MeasurementKind.allCases.firstIndex(of: $0.kind)! < MeasurementKind.allCases.firstIndex(of: $1.kind)! }
        for attachment in attachments {
            guard attachment.ownerUID == ownerUID, attachment.submissionID == id, attachment.revisionID == revisionID,
                  (1...50 * 1024 * 1024).contains(attachment.sizeBytes)
            else { throw CanonicalizationError.invalid("Attachment identity or size is invalid", section: .notesMedia) }
        }
        return CanonicalSnapshot(
            submissionID: id, eventID: eventID, revisionID: revisionID, revisionNumber: revisionNumber, ownerUID: ownerUID,
            siteID: site.id, createdAt: createdAt, collectedAt: date, submittedAt: submittedAt,
            latitude: latitude, longitude: longitude, accuracyMeters: accuracyMeters,
            collector: collector.trimmingCharacters(in: .whitespacesAndNewlines), testType: testType.contractValue,
            testTypeOther: testTypeOther.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : testTypeOther,
            method: method.trimmingCharacters(in: .whitespacesAndNewlines), instrument: instrument.trimmingCharacters(in: .whitespacesAndNewlines),
            notes: notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : notes,
            temperatureEnteredValue: enteredTemperature, temperatureEnteredUnit: temperatureUnit == .celsius ? "C" : "F",
            tempC: tempC, tempF: tempF, measurements: canonical, attachments: attachments,
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0", correction: isCorrection
        )
    }
}

enum FirebaseMapper {
    static let schemaVersion = "0.1.0"

    /// `submitted_at` is a trusted server timestamp. Firestore rules require it to equal `request.time`
    /// on every collector write, so a concrete client `Timestamp` from the phone clock is always rejected.
    /// A draft has not been submitted yet and keeps a null.
    static func submittedAt(_ status: String) -> Any {
        status == "DRAFT" ? NSNull() : FieldValue.serverTimestamp()
    }

    static func submission(_ value: CanonicalSnapshot, status: String) -> [String: Any] {
        [
            "submission_id": value.submissionID.uuidString.lowercased(), "event_id": value.eventID.uuidString.lowercased(),
            "collector_user_id": value.ownerUID, "site_id": value.siteID, "status": status,
            "current_revision_id": value.revisionID.uuidString.lowercased(), "current_revision_no": value.revisionNumber,
            "latest_collected_at": Timestamp(date: value.collectedAt), "created_at": Timestamp(date: value.createdAt),
            "updated_at": Timestamp(date: value.submittedAt), "submitted_at": submittedAt(status),
            "schema_version": schemaVersion, "mobile_app_version": value.appVersion,
        ]
    }

    static func revision(_ value: CanonicalSnapshot, status: String) -> [String: Any] {
        [
            "revision_id": value.revisionID.uuidString.lowercased(), "revision_no": value.revisionNumber,
            "submission_id": value.submissionID.uuidString.lowercased(), "event_id": value.eventID.uuidString.lowercased(),
            "collector_user_id": value.ownerUID, "site_id": value.siteID, "revision_status": status,
            "created_at": Timestamp(date: value.createdAt), "submitted_at": submittedAt(status),
            "collected_at": Timestamp(date: value.collectedAt), "time_known": true, "time_imputed": false,
            "latitude": value.latitude, "longitude": value.longitude, "location": GeoPoint(latitude: value.latitude, longitude: value.longitude),
            "gps_accuracy_m": value.accuracyMeters, "site_distance_m": NSNull(), "weather_condition": "",
            "data_collected_by": value.collector, "test_type": value.testType, "test_type_other": value.testTypeOther ?? NSNull(),
            "method_name": value.method, "instrument_name": value.instrument, "instrument_other": NSNull(),
            "temp_entered_value": value.temperatureEnteredValue, "temp_entered_unit": value.temperatureEnteredUnit,
            "temp_c": value.tempC, "temp_f": value.tempF, "field_notes_original": value.notes ?? NSNull(),
            "schema_version": schemaVersion, "mobile_app_version": value.appVersion,
        ]
    }

    static func measurement(_ item: CanonicalMeasurement, in value: CanonicalSnapshot) -> [String: Any] {
        [
            "measurement_id": item.id.uuidString.lowercased(), "parameter_code": item.parameterCode,
            "display_name": item.displayName, "value": item.value, "unit_code": item.unitCode,
            // Provenance required by config/firebase_schema.json: exactly what the collector typed and the
            // stable MeasurementUnit id they picked. Never used as conversion authority.
            "entered_value": item.enteredValue, "entered_unit_code": item.enteredUnitID,
            "method_name": value.method, "instrument_name": value.instrument, "qualifier": NSNull(), "notes": NSNull(),
            "entered_at": Timestamp(date: value.collectedAt),
        ]
    }

    static func attachment(_ item: AttachmentRecord, in value: CanonicalSnapshot, storagePath: String) -> [String: Any] {
        [
            "attachment_id": item.id.uuidString.lowercased(), "storage_path": storagePath,
            "content_type": item.contentType, "size_bytes": item.sizeBytes, "kind": item.kind.rawValue,
            "caption": item.caption ?? NSNull(), "created_at": Timestamp(date: item.createdAt),
        ]
    }
}

@Model final class LocalDraftEntity {
    @Attribute(.unique) var submissionID: String
    var eventID: String
    var revisionID: String
    var ownerUID: String
    var payload: Data
    var savedAt: Date
    init(submissionID: String, eventID: String, revisionID: String, ownerUID: String, payload: Data, savedAt: Date) {
        self.submissionID = submissionID; self.eventID = eventID; self.revisionID = revisionID; self.ownerUID = ownerUID; self.payload = payload; self.savedAt = savedAt
    }
}

@Model final class LocalObservationEntity {
    @Attribute(.unique) var submissionID: String
    var eventID: String
    var currentRevisionID: String
    var ownerUID: String
    var workflow: String
    var sync: String
    var correctionReason: String?
    var validationErrorCount: Int?
    var validationWarningCount: Int?
    var validationInfoCount: Int?
    var overallQualityScore: Double?
    var payload: Data
    var updatedAt: Date
    init(submissionID: String, eventID: String, currentRevisionID: String, ownerUID: String, workflow: String, sync: String, correctionReason: String?, payload: Data, updatedAt: Date) {
        self.submissionID = submissionID; self.eventID = eventID; self.currentRevisionID = currentRevisionID; self.ownerUID = ownerUID; self.workflow = workflow; self.sync = sync; self.correctionReason = correctionReason; self.payload = payload; self.updatedAt = updatedAt
    }
}

@Model final class LocalRevisionEntity {
    @Attribute(.unique) var revisionID: String
    var submissionID: String
    var eventID: String
    var ownerUID: String
    var revisionNumber: Int
    var snapshot: Data
    var revisionNote: String
    init(_ value: CanonicalSnapshot, data: Data, note: String) {
        revisionID = value.revisionID.uuidString.lowercased(); submissionID = value.submissionID.uuidString.lowercased(); eventID = value.eventID.uuidString.lowercased(); ownerUID = value.ownerUID; revisionNumber = value.revisionNumber; snapshot = data; revisionNote = note
    }
}

@Model final class LocalSyncQueueEntity {
    @Attribute(.unique) var submissionID: String
    var revisionID: String
    var ownerUID: String
    var state: String
    var attempts: Int
    var nextAttemptAt: Date
    var lastError: String?
    init(submissionID: String, revisionID: String, ownerUID: String) {
        self.submissionID = submissionID; self.revisionID = revisionID; self.ownerUID = ownerUID; state = "WAITING"; attempts = 0; nextAttemptAt = .distantPast
    }
}

@Model final class LocalSiteEntity {
    @Attribute(.unique) var siteID: String
    var name: String
    var county: String
    var watershed: String
    var latitude: Double
    var longitude: Double
    var active: Bool
    var updatedAt: Date
    init(siteID: String, name: String, county: String, watershed: String, latitude: Double, longitude: Double, active: Bool, updatedAt: Date = .now) {
        self.siteID = siteID; self.name = name; self.county = county; self.watershed = watershed; self.latitude = latitude; self.longitude = longitude; self.active = active; self.updatedAt = updatedAt
    }
    var site: Site { Site(id: siteID, name: name, county: county, watershed: watershed, latitude: latitude, longitude: longitude, cached: true, distance: "") }
}

@Model final class LocalValidationFlagEntity {
    @Attribute(.unique) var storageID: String
    var ownerUID: String
    var revisionID: String
    var flagID: String
    var severity: String
    var ruleCode: String
    var message: String
    init(ownerUID: String, revisionID: String, value: ValidationFlag) {
        storageID = "\(ownerUID)|\(revisionID)|\(value.id)"
        self.ownerUID = ownerUID; self.revisionID = revisionID; flagID = value.id
        severity = value.severity; ruleCode = value.ruleCode; message = value.message
    }
    var value: ValidationFlag { ValidationFlag(id: flagID, severity: severity, ruleCode: ruleCode, message: message) }
}

@Model final class LocalAttachmentEntity {
    @Attribute(.unique) var storageID: String
    var attachmentID: String
    var ownerUID: String
    var submissionID: String
    var revisionID: String
    var localPath: String
    var contentType: String
    var sizeBytes: Int64
    var kind: String
    var caption: String?
    var createdAt: Date
    var transferState: String
    var remoteStoragePath: String?
    var lastError: String?

    init(_ value: AttachmentRecord) {
        storageID = "\(value.ownerUID)|\(value.id.uuidString.lowercased())"
        attachmentID = value.id.uuidString.lowercased(); ownerUID = value.ownerUID
        submissionID = value.submissionID.uuidString.lowercased(); revisionID = value.revisionID.uuidString.lowercased()
        localPath = value.localURL.path; contentType = value.contentType; sizeBytes = value.sizeBytes
        kind = value.kind.rawValue; caption = value.caption; createdAt = value.createdAt
        transferState = value.transferState.rawValue; remoteStoragePath = value.remoteStoragePath; lastError = value.lastError
    }

    var value: AttachmentRecord? {
        guard let id = UUID(uuidString: attachmentID), let submission = UUID(uuidString: submissionID), let revision = UUID(uuidString: revisionID),
              let kind = AttachmentKind(rawValue: kind), let state = AttachmentTransferState(rawValue: transferState)
        else { return nil }
        return AttachmentRecord(
            id: id, ownerUID: ownerUID, submissionID: submission, revisionID: revision,
            localURL: URL(fileURLWithPath: localPath), contentType: contentType, sizeBytes: sizeBytes, kind: kind,
            caption: caption, createdAt: createdAt, transferState: state, remoteStoragePath: remoteStoragePath, lastError: lastError
        )
    }
}

enum MobileModelContainer {
    static func make(inMemory: Bool = false) throws -> ModelContainer {
        let schema = Schema([LocalDraftEntity.self, LocalObservationEntity.self, LocalRevisionEntity.self, LocalSyncQueueEntity.self, LocalSiteEntity.self, LocalValidationFlagEntity.self, LocalAttachmentEntity.self])
        return try ModelContainer(for: schema, configurations: ModelConfiguration("PAWatershedWatch", schema: schema, isStoredInMemoryOnly: inMemory, allowsSave: true))
    }
}

private struct DraftPayload: Codable {
    let submissionID: UUID, eventID: UUID, revisionID: UUID
    let revisionNumber: Int, ownerUID: String, createdAt: Date, siteID: String?, collectedAt: Date, collector: String
    let latitude: Double?, longitude: Double?, accuracyMeters: Double?, gpsState: GPSState, testType: TestType?, testTypeOther: String
    let method: String, instrument: String, values: [MeasurementKind: String], unitIDs: [MeasurementKind: String]
    let labResultsPending: Bool, requestedAnalytes: Set<MeasurementKind>, notes: String, attachments: [AttachmentRecord]
    let currentStep: Int, isCorrection: Bool, baseRevision: Int?, correctionReason: String?, revisionNote: String, savedAt: Date
}

@MainActor protocol LocalMobileRepository: AnyObject {
    func save(_ draft: ObservationDraft) throws
    func loadDraft(ownerUID: String, sites: [Site]) throws -> ObservationDraft?
    func cachedSites() throws -> [Site]
    func replaceSites(_ sites: [Site]) throws
    func persist(_ snapshot: CanonicalSnapshot, workflow: WorkflowState, sync: SyncState, note: String) throws
    func snapshot(ownerUID: String, submissionID: UUID) throws -> CanonicalSnapshot?
    func loadRecords(ownerUID: String) throws -> [ObservationRecord]
    func deleteDraft(ownerUID: String, submissionID: UUID) throws
    func updateAttachment(ownerUID: String, attachmentID: UUID, state: AttachmentTransferState, remotePath: String?, error: String?) throws
    func updateRemoteState(ownerUID: String, submissionID: UUID, workflow: WorkflowState, sync: SyncState, correctionReason: String?, validation: ValidationSummary?, flags: [ValidationFlag]) throws
    func queue(ownerUID: String) throws -> [LocalSyncQueueEntity]
    func markQueue(_ item: LocalSyncQueueEntity, state: String, error: String?) throws
}

@MainActor final class LocalMobileStore: LocalMobileRepository {
    let context: ModelContext
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    init(context: ModelContext) { self.context = context }

    func save(_ draft: ObservationDraft) throws {
        let payload = DraftPayload(
            submissionID: draft.id, eventID: draft.eventID, revisionID: draft.revisionID, revisionNumber: draft.revisionNumber,
            ownerUID: draft.ownerUID, createdAt: draft.createdAt, siteID: draft.site?.id, collectedAt: draft.date, collector: draft.collector,
            latitude: draft.latitude, longitude: draft.longitude, accuracyMeters: draft.accuracyMeters, gpsState: draft.gpsState,
            testType: draft.testType, testTypeOther: draft.testTypeOther, method: draft.method, instrument: draft.instrument,
            values: draft.values, unitIDs: draft.selectedUnits.mapValues(\.id), labResultsPending: draft.labResultsPending,
            requestedAnalytes: draft.requestedAnalytes, notes: draft.notes, attachments: draft.attachments,
            currentStep: draft.currentStep, isCorrection: draft.isCorrection, baseRevision: draft.baseRevision,
            correctionReason: draft.correctionReason, revisionNote: draft.revisionNote, savedAt: draft.lastSaved
        )
        for existing in try context.fetch(FetchDescriptor<LocalDraftEntity>()).filter({ $0.ownerUID == draft.ownerUID }) { context.delete(existing) }
        context.insert(LocalDraftEntity(
            submissionID: draft.id.uuidString.lowercased(), eventID: draft.eventID.uuidString.lowercased(),
            revisionID: draft.revisionID.uuidString.lowercased(), ownerUID: draft.ownerUID,
            payload: try encoder.encode(payload), savedAt: draft.lastSaved
        ))
        replaceAttachments(ownerUID: draft.ownerUID, revisionID: draft.revisionID.uuidString.lowercased(), values: draft.attachments)
        try context.save()
    }

    func loadDraft(ownerUID: String, sites: [Site]) throws -> ObservationDraft? {
        guard let stored = try context.fetch(FetchDescriptor<LocalDraftEntity>()).filter({ $0.ownerUID == ownerUID }).max(by: { $0.savedAt < $1.savedAt }) else { return nil }
        let value = try decoder.decode(DraftPayload.self, from: stored.payload)
        let draft = ObservationDraft(id: value.submissionID, eventID: value.eventID, revisionID: value.revisionID, revisionNumber: value.revisionNumber, ownerUID: value.ownerUID, createdAt: value.createdAt)
        draft.site = sites.first { $0.id == value.siteID }; draft.date = value.collectedAt; draft.collector = value.collector
        draft.latitude = value.latitude; draft.longitude = value.longitude; draft.accuracyMeters = value.accuracyMeters; draft.gpsState = value.gpsState
        draft.testType = value.testType; draft.testTypeOther = value.testTypeOther; draft.method = value.method; draft.instrument = value.instrument
        draft.values = value.values; draft.selectedUnits = value.unitIDs.reduce(into: [:]) { result, entry in
            if let unit = MeasurementKind.allCases.flatMap(\.unitOptions).first(where: { $0.id == entry.value }) { result[entry.key] = unit }
        }
        draft.labResultsPending = value.labResultsPending; draft.requestedAnalytes = value.requestedAnalytes; draft.notes = value.notes; draft.attachments = value.attachments
        draft.currentStep = value.currentStep; draft.isCorrection = value.isCorrection; draft.baseRevision = value.baseRevision
        draft.correctionReason = value.correctionReason; draft.revisionNote = value.revisionNote; draft.lastSaved = value.savedAt
        return draft
    }

    func cachedSites() throws -> [Site] { try context.fetch(FetchDescriptor<LocalSiteEntity>()).filter(\.active).map(\.site) }
    func replaceSites(_ sites: [Site]) throws {
        try context.fetch(FetchDescriptor<LocalSiteEntity>()).forEach(context.delete)
        sites.forEach { context.insert(LocalSiteEntity(siteID: $0.id, name: $0.name, county: $0.county, watershed: $0.watershed, latitude: $0.latitude, longitude: $0.longitude, active: true)) }
        try context.save()
    }

    func persist(_ snapshot: CanonicalSnapshot, workflow: WorkflowState, sync: SyncState, note: String) throws {
        let submission = snapshot.submissionID.uuidString.lowercased()
        let revision = snapshot.revisionID.uuidString.lowercased()
        let snapshotData = try encoder.encode(snapshot)
        let existing = try context.fetch(FetchDescriptor<LocalObservationEntity>()).first(where: { $0.submissionID == submission && $0.ownerUID == snapshot.ownerUID })
        let revisions = try context.fetch(FetchDescriptor<LocalRevisionEntity>()).filter { $0.submissionID == submission && $0.ownerUID == snapshot.ownerUID }
        if snapshot.correction {
            guard let existing, existing.eventID == snapshot.eventID.uuidString.lowercased(), existing.workflow == WorkflowState.needsCorrection.rawValue,
                  snapshot.revisionNumber == (revisions.map(\.revisionNumber).max() ?? 0) + 1,
                  workflow == .resubmitted, !note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            else { throw CanonicalizationError.invalid("Correction must append the next immutable revision after a correction request") }
        } else {
            guard existing == nil, snapshot.revisionNumber == 1, workflow == .submitted else { throw CanonicalizationError.invalid("New submission identity is already in use") }
        }
        if try context.fetch(FetchDescriptor<LocalRevisionEntity>()).contains(where: { $0.revisionID == revision }) { throw CanonicalizationError.invalid("This immutable revision already exists") }
        context.insert(LocalRevisionEntity(snapshot, data: snapshotData, note: note))
        replaceAttachments(ownerUID: snapshot.ownerUID, revisionID: revision, values: snapshot.attachments)
        if let existing {
            existing.currentRevisionID = revision; existing.workflow = workflow.rawValue; existing.sync = sync.rawValue; existing.correctionReason = nil; existing.payload = snapshotData; existing.updatedAt = .now
        } else {
            context.insert(LocalObservationEntity(submissionID: submission, eventID: snapshot.eventID.uuidString.lowercased(), currentRevisionID: revision, ownerUID: snapshot.ownerUID, workflow: workflow.rawValue, sync: sync.rawValue, correctionReason: nil, payload: snapshotData, updatedAt: .now))
        }
        if let queued = try context.fetch(FetchDescriptor<LocalSyncQueueEntity>()).first(where: { $0.submissionID == submission && $0.ownerUID == snapshot.ownerUID }) {
            queued.revisionID = revision
            queued.state = "WAITING"
            queued.attempts = 0
            queued.nextAttemptAt = .distantPast
            queued.lastError = nil
        } else {
            context.insert(LocalSyncQueueEntity(submissionID: submission, revisionID: revision, ownerUID: snapshot.ownerUID))
        }
        try context.fetch(FetchDescriptor<LocalDraftEntity>()).filter { $0.submissionID == submission && $0.ownerUID == snapshot.ownerUID }.forEach(context.delete)
        try context.save()
    }

    func snapshot(ownerUID: String, submissionID: UUID) throws -> CanonicalSnapshot? {
        let key = submissionID.uuidString.lowercased()
        guard let observation = try context.fetch(FetchDescriptor<LocalObservationEntity>()).first(where: { $0.submissionID == key && $0.ownerUID == ownerUID }),
              let revision = try context.fetch(FetchDescriptor<LocalRevisionEntity>()).first(where: { $0.revisionID == observation.currentRevisionID && $0.ownerUID == ownerUID })
        else { return nil }
        return try decoder.decode(CanonicalSnapshot.self, from: revision.snapshot)
    }

    func loadRecords(ownerUID: String) throws -> [ObservationRecord] {
        let sites = Dictionary(uniqueKeysWithValues: try cachedSites().map { ($0.id, $0) })
        return try context.fetch(FetchDescriptor<LocalObservationEntity>())
            .filter { $0.ownerUID == ownerUID }
            .sorted { $0.updatedAt > $1.updatedAt }
            .compactMap { observation in
                let revisions = try context.fetch(FetchDescriptor<LocalRevisionEntity>())
                    .filter { $0.ownerUID == ownerUID && $0.submissionID == observation.submissionID }
                    .sorted { $0.revisionNumber < $1.revisionNumber }
                guard let current = revisions.first(where: { $0.revisionID == observation.currentRevisionID }) else { return nil }
                let snapshot = try decoder.decode(CanonicalSnapshot.self, from: current.snapshot)
                let site = sites[snapshot.siteID] ?? Site(id: snapshot.siteID, name: "Cached site unavailable", county: "", watershed: "", latitude: 0, longitude: 0, cached: true, distance: "")
                let temperatureUnit: MeasurementUnit = snapshot.temperatureEnteredUnit == "F" ? .fahrenheit : .celsius
                let measurements = [MeasurementValue(
                    id: CanonicalID.measurement(revisionID: snapshot.revisionID, parameterCode: "WATER_TEMP_C"),
                    kind: .temperature, value: Self.entry(snapshot.temperatureEnteredValue), unit: temperatureUnit
                )] + snapshot.measurements.map { measurement in
                    let unit = measurement.kind.unitOptions.first(where: { $0.id == measurement.enteredUnitID }) ?? measurement.kind.defaultUnit
                    return MeasurementValue(id: measurement.id, kind: measurement.kind, value: Self.entry(measurement.enteredValue), unit: unit)
                }
                let history = try revisions.map { revision -> RevisionSummary in
                    let value = try decoder.decode(CanonicalSnapshot.self, from: revision.snapshot)
                    return RevisionSummary(id: value.revisionID, number: value.revisionNumber, date: value.submittedAt, state: value.correction ? .resubmitted : .submitted, note: revision.revisionNote)
                }
                let attachmentStates = Dictionary(uniqueKeysWithValues: try context.fetch(FetchDescriptor<LocalAttachmentEntity>())
                    .filter { $0.ownerUID == ownerUID && $0.revisionID == observation.currentRevisionID }
                    .compactMap { $0.value.map { ($0.id, $0) } })
                let attachments = snapshot.attachments.map { attachmentStates[$0.id] ?? $0 }
                let validation = observation.validationErrorCount.map {
                    ValidationSummary(errorCount: $0, warningCount: observation.validationWarningCount ?? 0, infoCount: observation.validationInfoCount ?? 0, overallQualityScore: observation.overallQualityScore)
                }
                let flags = try context.fetch(FetchDescriptor<LocalValidationFlagEntity>())
                    .filter { $0.ownerUID == ownerUID && $0.revisionID == observation.currentRevisionID }
                    .map(\.value)
                return ObservationRecord(
                    id: snapshot.submissionID, eventID: snapshot.eventID, currentRevisionID: snapshot.revisionID, ownerUID: ownerUID,
                    site: site, date: snapshot.collectedAt, collector: snapshot.collector,
                    testType: TestType.contract(snapshot.testType) ?? .other, method: snapshot.method, instrument: snapshot.instrument,
                    measurements: measurements, notes: snapshot.notes ?? "", photoCount: attachments.count(where: \.isPhoto), attachments: attachments,
                    workflow: WorkflowState(rawValue: observation.workflow) ?? .submitted,
                    sync: SyncState(rawValue: observation.sync) ?? .waiting, revision: snapshot.revisionNumber,
                    correctionReason: observation.correctionReason, revisions: history,
                    latitude: snapshot.latitude, longitude: snapshot.longitude, accuracyMeters: snapshot.accuracyMeters,
                    validation: validation, validationFlags: flags
                )
            }
    }

    func deleteDraft(ownerUID: String, submissionID: UUID) throws {
        let key = submissionID.uuidString.lowercased()
        let drafts = try context.fetch(FetchDescriptor<LocalDraftEntity>()).filter { $0.ownerUID == ownerUID && $0.submissionID == key }
        let revisionIDs = Set(drafts.map(\.revisionID))
        let attachments = try context.fetch(FetchDescriptor<LocalAttachmentEntity>()).filter { $0.ownerUID == ownerUID && revisionIDs.contains($0.revisionID) }
        attachments.forEach { value in
            try? FileManager.default.removeItem(atPath: value.localPath)
            context.delete(value)
        }
        drafts.forEach(context.delete)
        try context.save()
    }

    func updateAttachment(ownerUID: String, attachmentID: UUID, state: AttachmentTransferState, remotePath: String? = nil, error: String? = nil) throws {
        let key = attachmentID.uuidString.lowercased()
        guard let value = try context.fetch(FetchDescriptor<LocalAttachmentEntity>()).first(where: { $0.ownerUID == ownerUID && $0.attachmentID == key }) else { return }
        value.transferState = state.rawValue; value.remoteStoragePath = remotePath; value.lastError = error
        try context.save()
    }

    func updateRemoteState(ownerUID: String, submissionID: UUID, workflow: WorkflowState, sync: SyncState, correctionReason: String?, validation: ValidationSummary?, flags: [ValidationFlag]) throws {
        let key = submissionID.uuidString.lowercased()
        guard let observation = try context.fetch(FetchDescriptor<LocalObservationEntity>()).first(where: { $0.ownerUID == ownerUID && $0.submissionID == key }) else { return }
        observation.workflow = workflow.rawValue; observation.sync = sync.rawValue; observation.correctionReason = correctionReason; observation.updatedAt = .now
        observation.validationErrorCount = validation?.errorCount; observation.validationWarningCount = validation?.warningCount
        observation.validationInfoCount = validation?.infoCount; observation.overallQualityScore = validation?.overallQualityScore
        try context.fetch(FetchDescriptor<LocalValidationFlagEntity>())
            .filter { $0.ownerUID == ownerUID && $0.revisionID == observation.currentRevisionID }
            .forEach(context.delete)
        flags.forEach { context.insert(LocalValidationFlagEntity(ownerUID: ownerUID, revisionID: observation.currentRevisionID, value: $0)) }
        try context.save()
    }

    func queue(ownerUID: String) throws -> [LocalSyncQueueEntity] { try context.fetch(FetchDescriptor<LocalSyncQueueEntity>()).filter { $0.ownerUID == ownerUID && $0.state != "CONFIRMED" } }
    func markQueue(_ item: LocalSyncQueueEntity, state: String, error: String? = nil) throws { item.state = state; item.lastError = error; item.attempts += 1; try context.save() }

    private static func entry(_ value: Double) -> String {
        value.formatted(.number.locale(Locale(identifier: "en_US_POSIX")).grouping(.never).precision(.significantDigits(1...12)))
    }

    private func replaceAttachments(ownerUID: String, revisionID: String, values: [AttachmentRecord]) {
        let current = (try? context.fetch(FetchDescriptor<LocalAttachmentEntity>()))?.filter { $0.ownerUID == ownerUID && $0.revisionID == revisionID } ?? []
        current.forEach(context.delete)
        values.forEach { context.insert(LocalAttachmentEntity($0)) }
    }
}

/// The scientific record reached the archive but some media did not. This never reports a failed
/// submission: the workflow the server acknowledged travels with it so callers can record the truth.
struct AttachmentSyncFailure: LocalizedError {
    let workflow: WorkflowState
    let count: Int

    var errorDescription: String? {
        count == 1
            ? "The observation reached the archive. One attachment could not be sent and stays on this phone."
            : "The observation reached the archive. \(count) attachments could not be sent and stay on this phone."
    }
}

@MainActor protocol RemoteMobileRepository: AnyObject {
    func signIn(email: String, password: String) async throws -> User
    func signOut() throws
    func fetchSites() async throws -> [Site]
    func sync(_ snapshot: CanonicalSnapshot, onAttachmentTransfer: @escaping @MainActor (UUID, AttachmentTransferState, String?, String?) -> Void) async throws -> WorkflowState
    func listen(ownerUID: String, onChange: @escaping @MainActor (UUID, WorkflowState, String?, ValidationSummary?, [ValidationFlag]) -> Void) -> ListenerRegistration
}

@MainActor final class FirebaseMobileService: RemoteMobileRepository {
    private let firestore = Firestore.firestore()
    private let storage = Storage.storage()

    func signIn(email: String, password: String) async throws -> User { try await Auth.auth().signIn(withEmail: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password).user }
    func signOut() throws { try Auth.auth().signOut() }

    func fetchSites() async throws -> [Site] {
        let result = try await firestore.collection("siteCatalog").whereField("active", isEqualTo: true).getDocuments(source: .server)
        return result.documents.compactMap { document in
            let data = document.data()
            guard data["site_id"] as? String == document.documentID,
                  let name = data["site_name_display"] as? String,
                  let latitude = data["latitude"] as? Double ?? (data["location"] as? GeoPoint)?.latitude,
                  let longitude = data["longitude"] as? Double ?? (data["location"] as? GeoPoint)?.longitude,
                  (-90...90).contains(latitude), (-180...180).contains(longitude)
            else { return nil }
            return Site(id: document.documentID, name: name, county: data["county_display"] as? String ?? "", watershed: data["watershed_display"] as? String ?? "", latitude: latitude, longitude: longitude, cached: false, distance: "")
        }
    }

    func sync(
        _ snapshot: CanonicalSnapshot,
        onAttachmentTransfer: @escaping @MainActor (UUID, AttachmentTransferState, String?, String?) -> Void = { _, _, _, _ in }
    ) async throws -> WorkflowState {
        guard Auth.auth().currentUser?.uid == snapshot.ownerUID else { throw CanonicalizationError.invalid("Authenticated account does not own this record") }
        let submission = firestore.collection("submissions").document(snapshot.submissionID.uuidString.lowercased())
        let revision = submission.collection("revisions").document(snapshot.revisionID.uuidString.lowercased())
        let existing = try await submission.getDocument(source: .server)
        if existing.exists {
            guard existing.get("collector_user_id") as? String == snapshot.ownerUID, existing.get("event_id") as? String == snapshot.eventID.uuidString.lowercased() else { throw CanonicalizationError.invalid("Remote identity does not match") }
            if let status = existing.get("status") as? String, Self.acknowledged.contains(status) {
                guard existing.get("current_revision_id") as? String == snapshot.revisionID.uuidString.lowercased(), let workflow = WorkflowState.backend(status) else { throw CanonicalizationError.invalid("Server acknowledged a different revision") }
                return workflow
            }
            if snapshot.correction, existing.get("status") as? String != "NEEDS_CORRECTION" { throw CanonicalizationError.invalid("Correction is not currently requested") }
        } else {
            guard !snapshot.correction else { throw CanonicalizationError.invalid("Correction parent is missing") }
            try await submission.setData(FirebaseMapper.submission(snapshot, status: "DRAFT"))
        }
        let existingRevision = try await revision.getDocument(source: .server)
        let revisionStatus = existingRevision.get("revision_status") as? String
        if !existingRevision.exists { try await revision.setData(FirebaseMapper.revision(snapshot, status: "DRAFT")) }
        var failedAttachments = 0
        if revisionStatus != "SUBMITTED" {
            guard revisionStatus == nil || revisionStatus == "DRAFT" else { throw CanonicalizationError.invalid("Remote revision is immutable") }
            for measurement in snapshot.measurements {
                try await revision.collection("measurements").document(measurement.id.uuidString.lowercased()).setData(FirebaseMapper.measurement(measurement, in: snapshot))
            }
            let remoteMeasurements = try await revision.collection("measurements").getDocuments(source: .server)
            guard Set(remoteMeasurements.documents.map(\.documentID)) == Set(snapshot.measurements.map { $0.id.uuidString.lowercased() })
            else { throw CanonicalizationError.invalid("Server draft is incomplete") }
            // Media is best effort and each attachment is isolated. Storage and Firestore rules only accept
            // attachments while this revision is still DRAFT, so the loop has to run before the transition
            // below, but a failure here is recorded against that one attachment and never blocks the
            // scientific record from committing. Local files are always kept.
            for attachment in snapshot.attachments {
                do { try await upload(attachment, snapshot: snapshot, revision: revision, onAttachmentTransfer: onAttachmentTransfer) }
                catch {
                    failedAttachments += 1
                    onAttachmentTransfer(attachment.id, .failed, nil, error.localizedDescription)
                }
            }
            try await revision.updateData(["revision_status": "SUBMITTED", "submitted_at": FieldValue.serverTimestamp()])
        }
        let target = snapshot.correction ? "RESUBMITTED" : "SUBMITTED"
        try await submission.updateData([
            "status": target, "current_revision_id": snapshot.revisionID.uuidString.lowercased(), "current_revision_no": snapshot.revisionNumber,
            "latest_collected_at": Timestamp(date: snapshot.collectedAt), "updated_at": FieldValue.serverTimestamp(), "submitted_at": FieldValue.serverTimestamp(), "mobile_app_version": snapshot.appVersion,
        ])
        let acknowledgement = try await submission.getDocument(source: .server)
        guard let status = acknowledgement.get("status") as? String, Self.acknowledged.contains(status), let workflow = WorkflowState.backend(status) else { throw CanonicalizationError.invalid("Server did not acknowledge submission") }
        guard failedAttachments == 0 else { throw AttachmentSyncFailure(workflow: workflow, count: failedAttachments) }
        return workflow
    }

    /// Uploads one attachment and writes its metadata document. Retry and idempotency behaviour is
    /// unchanged: an object that already matches is reused, and a missing object is uploaded.
    private func upload(
        _ attachment: AttachmentRecord,
        snapshot: CanonicalSnapshot,
        revision: DocumentReference,
        onAttachmentTransfer: @MainActor (UUID, AttachmentTransferState, String?, String?) -> Void
    ) async throws {
        let path = storagePath(attachment, snapshot: snapshot)
        let reference = storage.reference(withPath: path)
        onAttachmentTransfer(attachment.id, .uploading, nil, nil)
        let expected = ["ownerUid": snapshot.ownerUID, "submissionId": snapshot.submissionID.uuidString.lowercased(), "revisionId": snapshot.revisionID.uuidString.lowercased(), "attachmentId": attachment.id.uuidString.lowercased()]
        do {
            let remote = try await reference.getMetadata()
            guard remote.customMetadata == expected, remote.contentType == attachment.contentType, remote.size == attachment.sizeBytes
            else { throw CanonicalizationError.invalid("Remote attachment identity does not match the queued file") }
        } catch where StorageErrorCode(rawValue: (error as NSError).code) == .objectNotFound {
            let attributes = try FileManager.default.attributesOfItem(atPath: attachment.localURL.path)
            guard (attributes[.size] as? NSNumber)?.int64Value == attachment.sizeBytes else { throw CanonicalizationError.invalid("An attachment file is missing or changed") }
            let metadata = StorageMetadata(); metadata.contentType = attachment.contentType; metadata.customMetadata = expected
            _ = try await reference.putFileAsync(from: attachment.localURL, metadata: metadata)
        }
        try await revision.collection("attachments").document(attachment.id.uuidString.lowercased()).setData(FirebaseMapper.attachment(attachment, in: snapshot, storagePath: path))
        onAttachmentTransfer(attachment.id, .uploaded, path, nil)
    }

    func listen(ownerUID: String, onChange: @escaping @MainActor (UUID, WorkflowState, String?, ValidationSummary?, [ValidationFlag]) -> Void) -> ListenerRegistration {
        firestore.collection("submissions").whereField("collector_user_id", isEqualTo: ownerUID).addSnapshotListener { snapshot, _ in
            for document in snapshot?.documents ?? [] {
                guard let id = UUID(uuidString: document.documentID), let status = document.get("status") as? String,
                      Self.acknowledged.contains(status), let workflow = WorkflowState.backend(status) else { continue }
                let validation = (document.get("error_flag_count") as? Int).map {
                    ValidationSummary(
                        errorCount: $0, warningCount: document.get("warning_flag_count") as? Int ?? 0,
                        infoCount: document.get("info_flag_count") as? Int ?? 0,
                        overallQualityScore: document.get("overall_quality_score") as? Double
                    )
                }
                guard let revisionID = document.get("current_revision_id") as? String else {
                    Task { @MainActor in onChange(id, workflow, document.get("review_comment") as? String, validation, []) }
                    continue
                }
                document.reference.collection("revisions").document(revisionID).collection("validationFlags").getDocuments { flags, _ in
                    let values = flags?.documents.compactMap { flag -> ValidationFlag? in
                        guard let severity = flag.get("severity") as? String, let code = flag.get("rule_code") as? String, let message = flag.get("message") as? String else { return nil }
                        return ValidationFlag(id: flag.documentID, severity: severity, ruleCode: code, message: message)
                    } ?? []
                    Task { @MainActor in onChange(id, workflow, document.get("review_comment") as? String, validation, values) }
                }
            }
        }
    }

    private func storagePath(_ attachment: AttachmentRecord, snapshot: CanonicalSnapshot) -> String {
        let ext = switch attachment.contentType { case "image/jpeg": "jpg"; case "image/png": "png"; case "image/heic": "heic"; case "application/pdf": "pdf"; default: "m4a" }
        return "users/\(snapshot.ownerUID)/submissions/\(snapshot.submissionID.uuidString.lowercased())/revisions/\(snapshot.revisionID.uuidString.lowercased())/\(attachment.id.uuidString.lowercased()).\(ext)"
    }

    private static let acknowledged: Set<String> = ["SUBMITTED", "VALIDATING", "PENDING_REVIEW", "NEEDS_CORRECTION", "RESUBMITTED", "APPROVED", "REJECTED", "PUBLISHING", "PUBLISH_FAILED", "PUBLISHED"]
}

extension WorkflowState {
    static func backend(_ value: String) -> WorkflowState? {
        switch value {
        case "DRAFT": .draft; case "SUBMITTED": .submitted; case "VALIDATING": .validating; case "PENDING_REVIEW": .pendingReview
        case "NEEDS_CORRECTION": .needsCorrection; case "RESUBMITTED": .resubmitted; case "APPROVED": .approved; case "REJECTED": .rejected
        case "PUBLISHING": .publishing; case "PUBLISH_FAILED": .publishFailed; case "PUBLISHED": .published; default: nil
        }
    }
}

@MainActor final class AudioNoteRecorder {
    private var recorder: AVAudioRecorder?
    private(set) var attachment: AttachmentRecord?
    func start(for draft: ObservationDraft) throws {
        guard recorder == nil else { throw CanonicalizationError.invalid("An audio note is already recording") }
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .spokenAudio)
        try session.setActive(true)
        let id = UUID(), url = try attachmentURL(revisionID: draft.revisionID, id: id, extension: "m4a")
        recorder = try AVAudioRecorder(url: url, settings: [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC), AVSampleRateKey: 44_100, AVNumberOfChannelsKey: 1, AVEncoderBitRateKey: 128_000,
        ])
        guard recorder?.record() == true else { throw CanonicalizationError.invalid("Audio recording could not start") }
        attachment = AttachmentRecord(id: id, ownerUID: draft.ownerUID, submissionID: draft.id, revisionID: draft.revisionID, localURL: url, contentType: "audio/mp4", sizeBytes: 0, kind: .other, createdAt: .now, transferState: .localOnly)
    }
    func stop() throws -> AttachmentRecord {
        recorder?.stop(); recorder = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        guard let value = attachment else { throw CanonicalizationError.invalid("No audio note is recording") }
        let size = try FileManager.default.attributesOfItem(atPath: value.localURL.path)[.size] as? NSNumber
        guard let count = size?.int64Value, count > 0, count <= 50 * 1024 * 1024 else { throw CanonicalizationError.invalid("The audio note is empty or larger than 50 MB") }
        attachment = nil
        return AttachmentRecord(id: value.id, ownerUID: value.ownerUID, submissionID: value.submissionID, revisionID: value.revisionID, localURL: value.localURL, contentType: value.contentType, sizeBytes: count, kind: value.kind, caption: value.caption, createdAt: value.createdAt, transferState: .localOnly)
    }
}

func attachmentURL(revisionID: UUID, id: UUID, extension ext: String) throws -> URL {
    let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appending(path: "Attachments/\(revisionID.uuidString.lowercased())", directoryHint: .isDirectory)
    try FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
    return base.appending(path: "\(id.uuidString.lowercased()).\(ext)")
}
