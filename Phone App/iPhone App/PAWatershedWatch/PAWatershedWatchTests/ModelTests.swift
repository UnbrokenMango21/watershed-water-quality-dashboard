import FirebaseFirestore
import SwiftData
import XCTest
@testable import PAWatershedWatch

final class ModelTests: XCTestCase {
    @MainActor
    func testTemperatureAndUnitConversionsPreserveQuantity() {
        let draft = ObservationDraft()
        draft[valueFor: .temperature] = "20"
        draft[valueFor: .conductivity] = "328"
        draft[valueFor: .nitrate] = "10"

        XCTAssertTrue(draft.changeUnit(.fahrenheit, for: .temperature))
        XCTAssertEqual(draft[valueFor: .temperature], "68")
        XCTAssertTrue(draft.changeUnit(.millisiemensPerCentimeter, for: .conductivity))
        XCTAssertEqual(draft[valueFor: .conductivity], "0.328")
        XCTAssertTrue(draft.changeUnit(.milligramsNitratePerLiter, for: .nitrate))
        XCTAssertEqual(Double(draft[valueFor: .nitrate])!, 44.28571, accuracy: 0.00001)
    }

    @MainActor
    func testProductionCatalogGatesUnsupportedScience() throws {
        let draft = completeDraft()
        draft[valueFor: .turbidity] = "12.4"
        XCTAssertEqual(MeasurementKind.turbidity.productionSpec.support, .featureGated)
        XCTAssertThrowsError(try draft.canonicalSnapshot())
        draft[valueFor: .turbidity] = ""
        XCTAssertNoThrow(try draft.canonicalSnapshot())
    }

    @MainActor
    func testNumericBoundaryDistinguishesBlankZeroLocaleAndNegativeORP() throws {
        let draft = completeDraft()
        draft[valueFor: .ph] = ""
        // pH is optional for every test type — a blank optional measurement never blocks submission.
        XCTAssertNoThrow(try draft.canonicalSnapshot())
        draft[valueFor: .ph] = "0"
        draft[valueFor: .orp] = "-.5"
        let snapshot = try draft.canonicalSnapshot()
        XCTAssertEqual(snapshot.measurements.first { $0.parameterCode == "PH" }?.value, 0)
        XCTAssertEqual(snapshot.measurements.first { $0.parameterCode == "ORP_MV" }?.value, -0.5)
        draft[valueFor: .ph] = "7,2"
        XCTAssertThrowsError(try draft.canonicalSnapshot())
        draft[valueFor: .ph] = "14.1"
        XCTAssertThrowsError(try draft.canonicalSnapshot())
    }

    @MainActor
    func testGoldenCanonicalMappingAndStableMeasurementIDs() throws {
        let submissionID = try XCTUnwrap(UUID(uuidString: "11111111-1111-4111-8111-111111111111"))
        let eventID = try XCTUnwrap(UUID(uuidString: "22222222-2222-4222-8222-222222222222"))
        let revisionID = try XCTUnwrap(UUID(uuidString: "33333333-3333-4333-8333-333333333333"))
        let createdAt = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-08-08T20:25:00Z"))
        let submittedAt = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-08-08T20:45:00Z"))
        let draft = completeDraft(id: submissionID, eventID: eventID, revisionID: revisionID, createdAt: createdAt)
        draft.date = try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-08-08T20:30:00Z"))
        draft[valueFor: .temperature] = "68"
        XCTAssertTrue(draft.changeUnit(.fahrenheit, for: .temperature))
        draft[valueFor: .temperature] = "68"
        draft[valueFor: .ph] = "7.2"
        draft[valueFor: .dissolvedOxygen] = "9"
        draft[valueFor: .conductivity] = "0.35"
        XCTAssertTrue(draft.changeUnit(.millisiemensPerCentimeter, for: .conductivity))
        draft[valueFor: .conductivity] = "0.35"
        draft[valueFor: .orp] = "-0.1224"
        XCTAssertTrue(draft.changeUnit(.volts, for: .orp))
        draft[valueFor: .orp] = "-0.1224"
        draft.notes = "Clear flow after overnight rain."
        let attachmentID = try XCTUnwrap(UUID(uuidString: "55555555-5555-4555-8555-555555555555"))
        draft.attachments = [AttachmentRecord(
            id: attachmentID, ownerUID: "collector-a", submissionID: submissionID, revisionID: revisionID,
            localURL: URL(fileURLWithPath: "/fixtures/photo.jpg"), contentType: "image/jpeg", sizeBytes: 2_487_312,
            kind: .sitePhoto, caption: "Upstream view", createdAt: draft.date, transferState: .localOnly
        )]

        let snapshot = try draft.canonicalSnapshot(submittedAt: submittedAt)
        XCTAssertEqual(snapshot.tempC, 20, accuracy: 0.0000001)
        XCTAssertEqual(snapshot.tempF, 68, accuracy: 0.0000001)
        XCTAssertEqual(snapshot.testType, "In-situ / Field Instrument")
        XCTAssertEqual(snapshot.measurements.first { $0.parameterCode == "PH" }?.id.uuidString.lowercased(), "f890767f-9220-5b4e-aafd-77f053f17390")
        XCTAssertEqual(snapshot.measurements.first { $0.parameterCode == "DO_MG_L" }?.id.uuidString.lowercased(), "3c684016-17ac-5891-ad9b-7280b67d9e6a")
        XCTAssertEqual(snapshot.measurements.first { $0.parameterCode == "CONDUCTIVITY_US_CM" }?.value, 350)
        XCTAssertEqual(snapshot.measurements.first { $0.parameterCode == "ORP_MV" }?.value, -122.4)

        let submission = FirebaseMapper.submission(snapshot, status: "SUBMITTED")
        let revision = FirebaseMapper.revision(snapshot, status: "SUBMITTED")
        XCTAssertEqual(submission["submission_id"] as? String, submissionID.uuidString.lowercased())
        XCTAssertEqual(submission["event_id"] as? String, eventID.uuidString.lowercased())
        XCTAssertEqual(submission["collector_user_id"] as? String, "collector-a")
        XCTAssertEqual((submission["latest_collected_at"] as? Timestamp)?.dateValue(), draft.date)
        XCTAssertEqual(revision["temp_entered_unit"] as? String, "F")
        XCTAssertEqual(revision["temp_c"] as? Double, 20)
        XCTAssertEqual(revision["test_type"] as? String, "In-situ / Field Instrument")

        // submitted_at is FieldValue.serverTimestamp(): an opaque sentinel with no concrete
        // value until the server commits the write, so JSONSerialization cannot encode it and
        // it cannot be diffed against the golden fixture's static ISO string. Assert the trusted
        // mechanism directly, then drop the key from both sides so every other field - including
        // all science/provenance data - still goes through the exact same byte-for-byte golden
        // comparison as before.
        XCTAssertTrue(submission["submitted_at"] is FieldValue, "submission submitted_at must use the trusted Firestore server-timestamp sentinel, not a client timestamp")
        XCTAssertTrue(revision["submitted_at"] is FieldValue, "revision submitted_at must use the trusted Firestore server-timestamp sentinel, not a client timestamp")

        let fixture = try Self.goldenFixture()
        let fixtureCase = try XCTUnwrap((fixture["serializationCases"] as? [[String: Any]])?.first)
        let expected = try XCTUnwrap(fixtureCase["expected"] as? [String: Any])
        XCTAssertEqual(
            try Self.jsonData(Self.droppingServerTimestampSentinel(submission)),
            try Self.jsonData(Self.droppingServerTimestampSentinel(try XCTUnwrap(expected["submission"] as? [String: Any])))
        )
        XCTAssertEqual(
            try Self.jsonData(Self.droppingServerTimestampSentinel(revision)),
            try Self.jsonData(Self.droppingServerTimestampSentinel(try XCTUnwrap(expected["revision"] as? [String: Any])))
        )
        XCTAssertEqual(
            try Self.jsonData(snapshot.measurements.map { FirebaseMapper.measurement($0, in: snapshot) }),
            try Self.jsonData(try XCTUnwrap(expected["measurements"]))
        )
        let path = "users/collector-a/submissions/11111111-1111-4111-8111-111111111111/revisions/33333333-3333-4333-8333-333333333333/55555555-5555-4555-8555-555555555555.jpg"
        XCTAssertEqual(
            try Self.jsonData(snapshot.attachments.map { FirebaseMapper.attachment($0, in: snapshot, storagePath: path) }),
            try Self.jsonData(try XCTUnwrap(expected["attachments"]))
        )
    }

    func testSharedGoldenFixtureRemainsAvailableToBothNativeSuites() throws {
        let json = try Self.goldenFixture()
        XCTAssertEqual(json["fixtureVersion"] as? String, "1.0.0")
        XCTAssertEqual((json["testTypes"] as? [String])?.count, 7)
        XCTAssertEqual((json["serializationCases"] as? [[String: Any]])?.count, 3)
    }

    private static func goldenFixture() throws -> [String: Any] {
        let url = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "mobile_golden", withExtension: "json"))
        return try XCTUnwrap(JSONSerialization.jsonObject(with: Data(contentsOf: url)) as? [String: Any])
    }

    private static func jsonData(_ value: Any) throws -> Data {
        try JSONSerialization.data(withJSONObject: normalize(value), options: [.sortedKeys])
    }

    /// Removes `submitted_at` so a trusted-server-timestamp sentinel never reaches
    /// `JSONSerialization`. Applied identically to the actual and golden-fixture sides, so
    /// this only removes a field that is asserted separately - it never masks a real mismatch
    /// in any other field.
    private static func droppingServerTimestampSentinel(_ dictionary: [String: Any]) -> [String: Any] {
        var copy = dictionary
        copy.removeValue(forKey: "submitted_at")
        return copy
    }

    private static func normalize(_ value: Any) -> Any {
        switch value {
        case let timestamp as Timestamp:
            return ISO8601DateFormatter().string(from: timestamp.dateValue())
        case let point as GeoPoint:
            return ["latitude": point.latitude, "longitude": point.longitude]
        case let dictionary as [String: Any]:
            return dictionary.mapValues(normalize)
        case let values as [Any]:
            return values.map(normalize)
        default:
            return value
        }
    }

    @MainActor
    func testEasternTimezoneAndDSTGoldenCases() throws {
        let cases = [
            ("2026-01-15T15:00:00Z", "2026-01-15T10:00:00-05:00"),
            ("2026-08-08T20:30:00Z", "2026-08-08T16:30:00-04:00"),
            ("2026-03-08T06:30:00Z", "2026-03-08T01:30:00-05:00"),
            ("2026-03-08T07:30:00Z", "2026-03-08T03:30:00-04:00"),
            ("2026-11-01T05:30:00Z", "2026-11-01T01:30:00-04:00"),
            ("2026-11-01T06:30:00Z", "2026-11-01T01:30:00-05:00"),
        ]
        for (instant, expected) in cases {
            XCTAssertEqual(EasternTime.offsetString(try XCTUnwrap(ISO8601DateFormatter().date(from: instant))), expected)
        }
    }

    @MainActor
    func testSwiftDataOwnerIsolationStableRetryAndImmutableCorrection() throws {
        let container = try MobileModelContainer.make(inMemory: true)
        let store = LocalMobileStore(context: container.mainContext)
        let first = completeDraft(ownerUID: "collector-a")
        let other = completeDraft(ownerUID: "collector-b")
        try store.save(first)
        try store.save(other)
        let restored = try XCTUnwrap(store.loadDraft(ownerUID: "collector-a", sites: [first.site!]))
        XCTAssertEqual(restored.id, first.id)
        XCTAssertEqual(restored.eventID, first.eventID)
        XCTAssertEqual(restored.revisionID, first.revisionID)
        XCTAssertEqual(restored.values, first.values)
        XCTAssertEqual(restored.selectedUnits, first.selectedUnits)
        XCTAssertEqual(try store.loadDraft(ownerUID: "collector-b", sites: [other.site!])?.id, other.id)

        let original = try first.canonicalSnapshot()
        try store.persist(original, workflow: .submitted, sync: .waiting, note: "Original submission")
        XCTAssertEqual(try store.snapshot(ownerUID: "collector-a", submissionID: first.id)?.revisionID, first.revisionID)
        XCTAssertEqual(try store.queue(ownerUID: "collector-a").first?.revisionID, first.revisionID.uuidString.lowercased())
        XCTAssertThrowsError(try store.persist(original, workflow: .submitted, sync: .waiting, note: "Duplicate"))

        try store.updateRemoteState(ownerUID: "collector-a", submissionID: first.id, workflow: .needsCorrection, sync: .synced, correctionReason: "Verify DO", validation: ValidationSummary(errorCount: 1, warningCount: 0, infoCount: 0, overallQualityScore: nil), flags: [ValidationFlag(id: "DO", severity: "ERROR", ruleCode: "DO", message: "Verify DO")])
        let correction = completeDraft(id: first.id, eventID: first.eventID, revisionID: UUID(), revisionNumber: 2, ownerUID: "collector-a")
        correction.isCorrection = true
        correction.baseRevision = 1
        correction.revisionNote = "Checked source instrument export."
        correction[valueFor: .dissolvedOxygen] = "9.1"
        try store.persist(try correction.canonicalSnapshot(), workflow: .resubmitted, sync: .waiting, note: correction.revisionNote)
        let record = try XCTUnwrap(store.loadRecords(ownerUID: "collector-a").first)
        XCTAssertEqual(record.id, first.id)
        XCTAssertEqual(record.eventID, first.eventID)
        XCTAssertEqual(record.revisions.map(\.number), [1, 2])
        XCTAssertEqual(record.revision, 2)
        let correctionQueue = try XCTUnwrap(store.queue(ownerUID: "collector-a").first)
        XCTAssertEqual(correctionQueue.revisionID, correction.revisionID.uuidString.lowercased())
        XCTAssertEqual(correctionQueue.state, "WAITING")
        XCTAssertEqual(correctionQueue.attempts, 0)
        let snapshots = try container.mainContext.fetch(FetchDescriptor<LocalRevisionEntity>())
            .sorted { $0.revisionNumber < $1.revisionNumber }
            .map { try JSONDecoder().decode(CanonicalSnapshot.self, from: $0.snapshot) }
        XCTAssertEqual(snapshots[0].measurements.first { $0.parameterCode == "DO_MG_L" }?.value, 9)
        XCTAssertEqual(snapshots[1].measurements.first { $0.parameterCode == "DO_MG_L" }?.value, 9.1)
        XCTAssertTrue(try store.loadRecords(ownerUID: "collector-b").isEmpty)
    }

    /// Water Temperature is the only required measurement, for every test type, without exception —
    /// see docs/PHASE_11_SUPERVISOR_DECISIONS.md. This supersedes the prior session's four-measurement
    /// requirement for "In-situ / Field Instrument", "Continuous Sensor / Sonde", and "Mixed In-situ +
    /// Lab", and the hidden "one more result" minimum for every other test type.
    @MainActor
    func testRequiredMeasurementsIsTemperatureOnlyForEveryTestType() {
        for testType in TestType.allCases {
            let draft = ObservationDraft()
            draft.testType = testType
            XCTAssertEqual(draft.requiredMeasurements, [.temperature], "\(testType.contractValue) must require only Water Temperature")
            XCTAssertEqual(Set(draft.optionalMeasurements), Set(MeasurementKind.allCases.filter { $0 != .temperature }))
        }
    }

    /// A draft with only temperature filled must pass for every test type — including "In-situ / Field
    /// Instrument", which previously also required pH, Dissolved Oxygen, and Conductivity.
    @MainActor
    func testTemperatureOnlyDraftPassesCanonicalSnapshotForEveryTestType() throws {
        for testType in TestType.allCases {
            let draft = temperatureOnlyDraft(testType: testType)
            XCTAssertNoThrow(try draft.canonicalSnapshot(), "\(testType.contractValue) should pass with only Water Temperature filled")
        }
    }

    @MainActor
    func testBlankOptionalMeasurementsNeverBlockSubmission() throws {
        let draft = temperatureOnlyDraft(testType: .fieldInstrument)
        for kind in draft.optionalMeasurements where kind.productionSpec.support == .fullySupported {
            XCTAssertEqual(draft[valueFor: kind], "")
        }
        XCTAssertNoThrow(try draft.canonicalSnapshot())
    }

    @MainActor
    func testOutOfRangeOptionalMeasurementStillThrows() {
        let draft = temperatureOnlyDraft(testType: .fieldInstrument)
        draft[valueFor: .ph] = "15"
        XCTAssertThrowsError(try draft.canonicalSnapshot())
        draft[valueFor: .ph] = ""
        draft[valueFor: .dissolvedOxygen] = "-1"
        XCTAssertThrowsError(try draft.canonicalSnapshot())
    }

    /// A minimal valid draft with Water Temperature as the only measurement filled in — the shape every
    /// test type must now accept.
    @MainActor
    private func temperatureOnlyDraft(testType: TestType) -> ObservationDraft {
        let draft = ObservationDraft(ownerUID: "collector-a")
        draft.site = Site(id: "SITE-TEST-001", name: "Spring Creek at Houserville Road Bridge", county: "Centre County", watershed: "Spring Creek", latitude: 40.79, longitude: -77.86, cached: true, distance: "")
        draft.date = Date(timeIntervalSince1970: 1_754_684_200)
        draft.collector = "Maya Chen"
        draft.latitude = 40.7934; draft.longitude = -77.86; draft.accuracyMeters = 4.2; draft.gpsState = .good
        draft.testType = testType
        if testType == .other { draft.testTypeOther = "Custom protocol" }
        draft.method = testType.suggestedMethod
        draft.instrument = testType.suggestedInstrument.isEmpty ? "Field notebook" : testType.suggestedInstrument
        draft[valueFor: .temperature] = "20"
        return draft
    }

    @MainActor
    private func completeDraft(
        id: UUID = UUID(), eventID: UUID = UUID(), revisionID: UUID = UUID(), revisionNumber: Int = 1,
        ownerUID: String = "collector-a", createdAt: Date = .now
    ) -> ObservationDraft {
        let draft = ObservationDraft(id: id, eventID: eventID, revisionID: revisionID, revisionNumber: revisionNumber, ownerUID: ownerUID, createdAt: createdAt)
        draft.site = Site(id: "SITE-TEST-001", name: "Spring Creek at Houserville Road Bridge", county: "Centre County", watershed: "Spring Creek", latitude: 40.79, longitude: -77.86, cached: true, distance: "")
        draft.date = Date(timeIntervalSince1970: 1_754_684_200)
        draft.collector = "Maya Chen"
        draft.latitude = 40.7934; draft.longitude = -77.86; draft.accuracyMeters = 4.2; draft.gpsState = .good
        draft.testType = .fieldInstrument
        draft.method = "Calibrated multiparameter field meter"
        draft.instrument = "YSI ProDSS · Unit 4412"
        draft[valueFor: .temperature] = "20"
        draft[valueFor: .ph] = "7.2"
        draft[valueFor: .dissolvedOxygen] = "9"
        draft[valueFor: .conductivity] = "350"
        return draft
    }
}
