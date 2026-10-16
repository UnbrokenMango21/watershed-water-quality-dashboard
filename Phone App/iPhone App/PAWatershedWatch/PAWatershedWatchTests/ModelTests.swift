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
        XCTAssertEqual(try XCTUnwrap(snapshot.tempC), 20, accuracy: 0.0000001)
        XCTAssertEqual(try XCTUnwrap(snapshot.tempF), 68, accuracy: 0.0000001)
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
        XCTAssertEqual(submission["mobile_app_version"] as? String, snapshot.appVersion)
        XCTAssertEqual(revision["mobile_app_version"] as? String, snapshot.appVersion)

        let fixture = try Self.goldenFixture()
        let fixtureCase = try XCTUnwrap((fixture["serializationCases"] as? [[String: Any]])?.first)
        let expected = try XCTUnwrap(fixtureCase["expected"] as? [String: Any])
        let expectedSubmission = Self.normalizingExpectedMobileAppVersion(
            try XCTUnwrap(expected["submission"] as? [String: Any]),
            with: snapshot.appVersion
        )
        let expectedRevision = Self.normalizingExpectedMobileAppVersion(
            try XCTUnwrap(expected["revision"] as? [String: Any]),
            with: snapshot.appVersion
        )
        XCTAssertEqual(
            try Self.jsonData(Self.droppingServerTimestampSentinel(submission)),
            try Self.jsonData(Self.droppingServerTimestampSentinel(expectedSubmission))
        )
        XCTAssertEqual(
            try Self.jsonData(Self.droppingServerTimestampSentinel(revision)),
            try Self.jsonData(Self.droppingServerTimestampSentinel(expectedRevision))
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

    @MainActor
    func testCorrectionResubmitAcknowledgementAllowsParentRevisionMismatchOnlyWhileCorrectionIsRequested() throws {
        let revision1 = "11111111-1111-4111-8111-111111111111"
        let revision2 = "22222222-2222-4222-8222-222222222222"

        XCTAssertNil(try FirebaseMobileService.acknowledgedWorkflow(
            status: "NEEDS_CORRECTION",
            remoteRevisionID: revision1,
            snapshotRevisionID: revision2,
            isCorrection: true
        ), "A new correction revision must be allowed to append while the server still points at the retained parent revision")

        XCTAssertEqual(try FirebaseMobileService.acknowledgedWorkflow(
            status: "PENDING_REVIEW",
            remoteRevisionID: revision2,
            snapshotRevisionID: revision2,
            isCorrection: true
        ), .pendingReview, "A retry after revision 2 reaches the server must remain idempotent")

        XCTAssertThrowsError(try FirebaseMobileService.acknowledgedWorkflow(
            status: "PENDING_REVIEW",
            remoteRevisionID: revision1,
            snapshotRevisionID: revision2,
            isCorrection: true
        ), "A mismatched revision outside the correction-request state must still be rejected")

        XCTAssertThrowsError(try FirebaseMobileService.acknowledgedWorkflow(
            status: "NEEDS_CORRECTION",
            remoteRevisionID: revision1,
            snapshotRevisionID: revision2,
            isCorrection: false
        ), "A non-correction write must never inherit the correction mismatch exception")
    }

    @MainActor
    func testRemoteListenerDoesNotMaskPendingCorrectionSyncState() throws {
        XCTAssertEqual(LocalMobileStore.reconciledSyncState(incoming: .synced, existing: .failed, pendingQueueState: "RETRYABLE_FAILURE"), .failed)
        XCTAssertEqual(LocalMobileStore.reconciledSyncState(incoming: .synced, existing: .waiting, pendingQueueState: "WAITING"), .waiting)
        XCTAssertEqual(LocalMobileStore.reconciledSyncState(incoming: .synced, existing: .syncing, pendingQueueState: "SYNCING"), .syncing)
        XCTAssertEqual(LocalMobileStore.reconciledSyncState(incoming: .synced, existing: .failed, pendingQueueState: "CONFIRMED"), .synced)
    }

    @MainActor
    func testCorrectionSequenceUsesServerRevisionNumberAsAuthority() throws {
        XCTAssertNoThrow(try FirebaseMobileService.validateCorrectionSequence(remoteRevisionNumber: 1, snapshotRevisionNumber: 2))
        XCTAssertThrowsError(try FirebaseMobileService.validateCorrectionSequence(remoteRevisionNumber: 1, snapshotRevisionNumber: 3))
        XCTAssertThrowsError(try FirebaseMobileService.validateCorrectionSequence(remoteRevisionNumber: nil, snapshotRevisionNumber: 2))
    }

    func testSharedGoldenFixtureRemainsAvailableToBothNativeSuites() throws {
        let json = try Self.goldenFixture()
        XCTAssertEqual(json["fixtureVersion"] as? String, "1.1.0")
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

    /// The golden fixture is shared with Android, whose release version can differ from iOS.
    /// Keep the field covered explicitly above, then normalize only the expected version value
    /// so every other contract field remains byte-for-byte identical.
    private static func normalizingExpectedMobileAppVersion(_ dictionary: [String: Any], with appVersion: String) -> [String: Any] {
        var copy = dictionary
        copy["mobile_app_version"] = appVersion
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

    /// Supervisor protocol v0.2 keeps every numerical field optional for every method category.
    @MainActor
    func testNumericalMeasurementsAreOptionalForEveryTestType() {
        for testType in TestType.allCases {
            let draft = ObservationDraft()
            draft.testType = testType
            XCTAssertEqual(draft.requiredMeasurements, [], "\(testType.contractValue) must keep numerical measurements optional")
            // Optional = every other parameter the production contract enables; planned parameters are hidden.
            XCTAssertEqual(Set(draft.optionalMeasurements), Set(MeasurementKind.allCases.filter { $0.productionSpec.support == .fullySupported }))
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
        draft.values = [:]
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
    func testVisualOnlyDraftPreservesNullNumericsAndRequiresHonestVisualResponses() throws {
        let draft = temperatureOnlyDraft(testType: .fieldInstrument)
        draft.values = [:]
        draft.method = ""; draft.instrument = ""
        let snapshot = try draft.canonicalSnapshot()
        XCTAssertNil(snapshot.temperatureEnteredValue); XCTAssertNil(snapshot.tempC); XCTAssertNil(snapshot.tempF)
        XCTAssertTrue(snapshot.measurements.isEmpty)
        XCTAssertEqual(snapshot.method, "In-situ / Field Instrument")
        XCTAssertTrue(FirebaseMapper.revision(snapshot, status: "DRAFT")["temp_c"] is NSNull)
        draft.waterColor = ""
        XCTAssertThrowsError(try draft.canonicalSnapshot())
        draft.waterColor = "Unknown"
        XCTAssertNoThrow(try draft.canonicalSnapshot())
    }

    @MainActor
    func testFieldAndLabDraftPersistsSameIdentityAndNeverSubmitsPendingWork() throws {
        let container = try MobileModelContainer.make(inMemory: true)
        let store = LocalMobileStore(context: container.mainContext)
        let draft = temperatureOnlyDraft(testType: .pennStateLab)
        draft.values = [:]; draft.collectionStage = .labPending; draft.labResultsPending = true; draft.fieldCollectedAt = .now
        try store.replaceSites([try XCTUnwrap(draft.site)])
        try store.save(draft)
        let restored = try XCTUnwrap(store.loadDraft(ownerUID: draft.ownerUID, sites: try store.cachedSites()))
        XCTAssertEqual(restored.id, draft.id); XCTAssertEqual(restored.revisionID, draft.revisionID)
        XCTAssertEqual(restored.collectionStage, .labPending); XCTAssertTrue(restored.labResultsPending)
        XCTAssertThrowsError(try restored.canonicalSnapshot())
        XCTAssertEqual(try restored.canonicalSnapshot(forDraft: true).collectionStage, "LAB_PENDING")
        restored[valueFor: .nitrate] = "1.2"; restored.labResultsPending = false; restored.collectionStage = .labCompleted; restored.labCompletedAt = .now
        // A lab value without its analysis method and time cannot be submitted, and a cloud draft omits it
        // (it stays on the phone) instead of failing the whole synchronization.
        XCTAssertThrowsError(try restored.canonicalSnapshot())
        XCTAssertTrue(try restored.canonicalSnapshot(forDraft: true).measurements.isEmpty)
        let sampled = restored.date
        restored.analysisDetails[.nitrate] = AnalysisProvenance(stage: "LAB", method: "Ion chromatography", instrument: "", analyzedAt: sampled.addingTimeInterval(-60))
        XCTAssertThrowsError(try restored.canonicalSnapshot(), "analysis cannot precede sampling")
        restored.analysisDetails[.nitrate] = AnalysisProvenance(stage: "LAB", method: "Ion chromatography", instrument: "", analyzedAt: sampled.addingTimeInterval(86_400), fieldExceptionReason: "left over from an edit")
        let final = try restored.canonicalSnapshot()
        XCTAssertEqual(final.submissionID, draft.id); XCTAssertEqual(final.revisionID, draft.revisionID)
        XCTAssertNil(final.tempC); XCTAssertEqual(final.measurements.first?.parameterCode, "NITRATE_MG_L")
        let lab = FirebaseMapper.measurement(try XCTUnwrap(final.measurements.first), in: final)
        XCTAssertEqual(lab["analysis_stage"] as? String, "LAB")
        XCTAssertEqual(lab["method_name"] as? String, "Ion chromatography")
        XCTAssertTrue(lab["instrument_name"] is NSNull)
        XCTAssertTrue(lab["field_exception_reason"] is NSNull, "laboratory results never carry a field exception")
        XCTAssertEqual((lab["analyzed_at"] as? Timestamp)?.dateValue(), sampled.addingTimeInterval(86_400))
        XCTAssertEqual((lab["entered_at"] as? Timestamp)?.dateValue(), sampled, "entered_at stays the sampling time on both platforms")
        // Field analysis of a laboratory parameter is an explicit, documented exception.
        restored.analysisDetails[.nitrate] = AnalysisProvenance(stage: "FIELD", method: "Colorimetric field kit", instrument: "", analyzedAt: sampled)
        XCTAssertThrowsError(try restored.canonicalSnapshot())
        restored.analysisDetails[.nitrate]?.fieldExceptionReason = "  Program-approved field kit protocol. "
        let field = FirebaseMapper.measurement(try XCTUnwrap(try restored.canonicalSnapshot().measurements.first), in: final)
        XCTAssertEqual(field["field_exception_reason"] as? String, "Program-approved field kit protocol.")
    }

    @MainActor
    func testWaterDepthConvertsLengthAndRejectsNegativeDepth() throws {
        let draft = temperatureOnlyDraft(testType: .fieldInstrument)
        draft.values = [:]; draft[valueFor: .waterDepth] = "30"; draft.selectedUnits[.waterDepth] = .centimeters
        let depth = try XCTUnwrap(draft.canonicalSnapshot().measurements.first)
        XCTAssertEqual(depth.parameterCode, "WATER_DEPTH_M"); XCTAssertEqual(depth.value, 0.3, accuracy: 1e-12)
        XCTAssertEqual(depth.enteredValue, 30); XCTAssertEqual(depth.enteredUnitID, "cm")
        draft[valueFor: .waterDepth] = "-1"
        XCTAssertThrowsError(try draft.canonicalSnapshot())
    }

    /// A submission queued offline by an installed 0.1.0 build must replay under the 0.1.0 contract after
    /// the app upgrades: its snapshot has no schema version, collection stage, visual observations or
    /// analysis provenance, and the rules would deny it forever as 0.2.0.
    @MainActor
    func testPreUpgradeQueuedSnapshotReplaysUnderTheLegacyContract() throws {
        let draft = completeDraft()
        draft[valueFor: .nitrate] = "1.2"
        draft.analysisDetails[.nitrate] = AnalysisProvenance(stage: "LAB", method: "Ion chromatography", instrument: "IC-2", analyzedAt: draft.date.addingTimeInterval(60))
        let legacy = try Self.preUpgradeSnapshot(from: try draft.canonicalSnapshot())
        XCTAssertNil(legacy.schemaVersion); XCTAssertNil(legacy.collectionStage)
        XCTAssertEqual(legacy.resolvedSchemaVersion, "0.1.0")

        // The queued snapshot survives the on-device store unchanged and still resolves to 0.1.0.
        let container = try MobileModelContainer.make(inMemory: true)
        let store = LocalMobileStore(context: container.mainContext)
        try store.persist(legacy, workflow: .submitted, sync: .waiting, note: "Submitted before the upgrade")
        let replayed = try XCTUnwrap(store.snapshot(ownerUID: legacy.ownerUID, submissionID: legacy.submissionID))
        XCTAssertEqual(replayed.resolvedSchemaVersion, "0.1.0")

        XCTAssertEqual(FirebaseMapper.submission(replayed, status: "DRAFT")["schema_version"] as? String, "0.1.0")
        let revision = FirebaseMapper.revision(replayed, status: "DRAFT")
        XCTAssertEqual(revision["schema_version"] as? String, "0.1.0")
        XCTAssertNil(revision["collection_stage"], "a 0.1.0 revision predates the collection stage")
        XCTAssertEqual(revision["instrument_name"] as? String, "YSI ProDSS · Unit 4412")
        XCTAssertEqual(revision["temp_entered_unit"] as? String, "C")
        XCTAssertEqual(revision["temp_c"] as? Double, 20)
        let measurements = replayed.measurements.map { FirebaseMapper.measurement($0, in: replayed) }
        XCTAssertEqual(Set(measurements.compactMap { $0["parameter_code"] as? String }), ["PH", "DO_MG_L", "CONDUCTIVITY_US_CM", "NITRATE_MG_L"])
        for measurement in measurements {
            for key in ["analysis_stage", "analyzed_at", "field_exception_reason"] {
                XCTAssertNil(measurement[key], "0.1.0 measurements must not carry \(key)")
            }
            XCTAssertEqual(measurement["instrument_name"] as? String, "YSI ProDSS · Unit 4412", "0.1.0 keeps the instrument as recorded")
            XCTAssertEqual(measurement["method_name"] as? String, "Calibrated multiparameter field meter")
        }

        // The correction the reviewer requests is a new revision under the current contract.
        try store.updateRemoteState(ownerUID: legacy.ownerUID, submissionID: legacy.submissionID, workflow: .needsCorrection, sync: .synced, correctionReason: "Verify DO", validation: nil, flags: [])
        let correction = completeDraft(id: legacy.submissionID, eventID: legacy.eventID, revisionID: UUID(), revisionNumber: 2, ownerUID: legacy.ownerUID)
        correction.isCorrection = true; correction.baseRevision = 1; correction.revisionNote = "Checked the meter export."
        let corrected = try correction.canonicalSnapshot()
        XCTAssertEqual(corrected.schemaVersion, "0.2.0")
        try store.persist(corrected, workflow: .resubmitted, sync: .waiting, note: correction.revisionNote)
        let queuedCorrection = try XCTUnwrap(store.snapshot(ownerUID: legacy.ownerUID, submissionID: legacy.submissionID))
        XCTAssertEqual(FirebaseMapper.revision(queuedCorrection, status: "DRAFT")["schema_version"] as? String, "0.2.0")
        XCTAssertEqual(FirebaseMapper.measurement(try XCTUnwrap(queuedCorrection.measurements.first), in: queuedCorrection)["analysis_stage"] as? String, "FIELD")
    }

    /// New snapshots record the current contract, and a 0.2 snapshot persisted before the schema field
    /// existed (it always carries a collection stage) still maps to 0.2.0.
    @MainActor
    func testNewSnapshotsRecordAndReplayTheCurrentContract() throws {
        let snapshot = try completeDraft().canonicalSnapshot()
        XCTAssertEqual(snapshot.schemaVersion, "0.2.0")
        let decoded = try JSONDecoder().decode(CanonicalSnapshot.self, from: try JSONEncoder().encode(snapshot))
        XCTAssertEqual(decoded.schemaVersion, "0.2.0")
        XCTAssertEqual(FirebaseMapper.submission(decoded, status: "DRAFT")["schema_version"] as? String, "0.2.0")
        XCTAssertEqual(FirebaseMapper.revision(decoded, status: "DRAFT")["collection_stage"] as? String, "READY_FOR_REVIEW")
        XCTAssertEqual(FirebaseMapper.measurement(try XCTUnwrap(decoded.measurements.first), in: decoded)["analysis_stage"] as? String, "FIELD")

        var object = try XCTUnwrap(JSONSerialization.jsonObject(with: try JSONEncoder().encode(snapshot)) as? [String: Any])
        object.removeValue(forKey: "schemaVersion")
        let earlierBuild = try JSONDecoder().decode(CanonicalSnapshot.self, from: try JSONSerialization.data(withJSONObject: object))
        XCTAssertNil(earlierBuild.schemaVersion)
        XCTAssertEqual(earlierBuild.resolvedSchemaVersion, "0.2.0")
        XCTAssertEqual(FirebaseMapper.revision(earlierBuild, status: "DRAFT")["schema_version"] as? String, "0.2.0")
    }

    /// A laboratory instrument is trimmed like its method; whitespace alone records no instrument, and
    /// a lab result never borrows the field instrument.
    @MainActor
    func testLabInstrumentIsTrimmedAndBlankBecomesNull() throws {
        let draft = completeDraft()
        draft[valueFor: .nitrate] = "1.2"
        draft.analysisDetails[.nitrate] = AnalysisProvenance(stage: "LAB", method: "Ion chromatography", instrument: "  IC-2 \n", analyzedAt: draft.date.addingTimeInterval(60))
        var snapshot = try draft.canonicalSnapshot()
        var nitrate = try XCTUnwrap(snapshot.measurements.first { $0.parameterCode == "NITRATE_MG_L" })
        XCTAssertEqual(nitrate.analysisInstrument, "IC-2")
        XCTAssertEqual(FirebaseMapper.measurement(nitrate, in: snapshot)["instrument_name"] as? String, "IC-2")
        draft.analysisDetails[.nitrate]?.instrument = "   "
        snapshot = try draft.canonicalSnapshot()
        nitrate = try XCTUnwrap(snapshot.measurements.first { $0.parameterCode == "NITRATE_MG_L" })
        XCTAssertNil(nitrate.analysisInstrument)
        XCTAssertTrue(FirebaseMapper.measurement(nitrate, in: snapshot)["instrument_name"] is NSNull)
    }

    /// A non-laboratory reading records analysis stage and time only when the method category establishes
    /// them: field categories were analysed in the field at sampling; laboratory, mixed and other categories
    /// record null rather than an assumed stage or time.
    @MainActor
    func testNonLaboratoryProvenanceFollowsTheMethodCategory() throws {
        let fieldCategories: Set<TestType> = [.fieldInstrument, .fieldKit, .sonde]
        for testType in TestType.allCases {
            let draft = temperatureOnlyDraft(testType: testType)
            draft[valueFor: .ph] = "7.2"
            let snapshot = try draft.canonicalSnapshot()
            let ph = try XCTUnwrap(snapshot.measurements.first { $0.parameterCode == "PH" })
            let fields = FirebaseMapper.measurement(ph, in: snapshot)
            XCTAssertTrue(fields["field_exception_reason"] is NSNull, "\(testType): pH never carries a field exception")
            XCTAssertEqual((fields["entered_at"] as? Timestamp)?.dateValue(), draft.date, "\(testType): entered_at stays the sampling time")
            if fieldCategories.contains(testType) {
                XCTAssertEqual(ph.analysisStage, "FIELD", "\(testType)")
                XCTAssertEqual(ph.analyzedAt, draft.date, "\(testType)")
                XCTAssertEqual(fields["analysis_stage"] as? String, "FIELD", "\(testType)")
                XCTAssertEqual((fields["analyzed_at"] as? Timestamp)?.dateValue(), draft.date, "\(testType): analysed at sampling")
            } else {
                XCTAssertNil(ph.analysisStage, "\(testType)")
                XCTAssertNil(ph.analyzedAt, "\(testType)")
                XCTAssertTrue(fields["analysis_stage"] is NSNull, "\(testType): never assume field analysis")
                XCTAssertTrue(fields["analyzed_at"] is NSNull, "\(testType): never assume an analysis time")
            }
            // The stored snapshot replays the same provenance after a round trip through the device store.
            let replayed = try JSONDecoder().decode(CanonicalSnapshot.self, from: try JSONEncoder().encode(snapshot))
            XCTAssertEqual(try XCTUnwrap(replayed.measurements.first { $0.parameterCode == "PH" }), ph)
        }
    }

    @MainActor
    func testPennStateLabPHRecordsNullProvenanceAndFieldKitPHRecordsSampling() throws {
        let lab = temperatureOnlyDraft(testType: .pennStateLab)
        lab[valueFor: .ph] = "7.2"
        let labSnapshot = try lab.canonicalSnapshot()
        let labPH = FirebaseMapper.measurement(try XCTUnwrap(labSnapshot.measurements.first), in: labSnapshot)
        XCTAssertEqual(labPH["parameter_code"] as? String, "PH")
        XCTAssertTrue(labPH["analysis_stage"] is NSNull)
        XCTAssertTrue(labPH["analyzed_at"] is NSNull)
        XCTAssertTrue(labPH["field_exception_reason"] is NSNull)

        let kit = temperatureOnlyDraft(testType: .fieldKit)
        kit[valueFor: .ph] = "7.2"
        let kitSnapshot = try kit.canonicalSnapshot()
        let kitPH = FirebaseMapper.measurement(try XCTUnwrap(kitSnapshot.measurements.first), in: kitSnapshot)
        XCTAssertEqual(kitPH["analysis_stage"] as? String, "FIELD")
        XCTAssertEqual((kitPH["analyzed_at"] as? Timestamp)?.dateValue(), kit.date)
        XCTAssertTrue(kitPH["field_exception_reason"] is NSNull)
    }

    /// Laboratory parameters always carry exactly what the collector entered, whatever the method category.
    @MainActor
    func testLaboratoryProvenanceIsIndependentOfTheMethodCategory() throws {
        for testType in TestType.allCases {
            let draft = temperatureOnlyDraft(testType: testType)
            draft[valueFor: .nitrate] = "1.2"
            draft[valueFor: .chloride] = "30"
            let analyzed = draft.date.addingTimeInterval(3_600)
            draft.analysisDetails[.nitrate] = AnalysisProvenance(stage: "LAB", method: "Ion chromatography", instrument: "IC-2", analyzedAt: analyzed)
            draft.analysisDetails[.chloride] = AnalysisProvenance(stage: "FIELD", method: "Titration kit", instrument: "", analyzedAt: draft.date, fieldExceptionReason: "Program-approved field kit protocol.")
            let snapshot = try draft.canonicalSnapshot()
            let nitrate = FirebaseMapper.measurement(try XCTUnwrap(snapshot.measurements.first { $0.parameterCode == "NITRATE_MG_L" }), in: snapshot)
            XCTAssertEqual(nitrate["analysis_stage"] as? String, "LAB", "\(testType)")
            XCTAssertEqual(nitrate["method_name"] as? String, "Ion chromatography", "\(testType)")
            XCTAssertEqual(nitrate["instrument_name"] as? String, "IC-2", "\(testType)")
            XCTAssertEqual((nitrate["analyzed_at"] as? Timestamp)?.dateValue(), analyzed, "\(testType)")
            XCTAssertTrue(nitrate["field_exception_reason"] is NSNull, "\(testType)")
            let chloride = FirebaseMapper.measurement(try XCTUnwrap(snapshot.measurements.first { $0.parameterCode == "CHLORIDE_MG_L" }), in: snapshot)
            XCTAssertEqual(chloride["analysis_stage"] as? String, "FIELD", "\(testType)")
            XCTAssertEqual((chloride["analyzed_at"] as? Timestamp)?.dateValue(), draft.date, "\(testType)")
            XCTAssertEqual(chloride["field_exception_reason"] as? String, "Program-approved field kit protocol.", "\(testType)")
        }
    }

    /// A correction (revision N+1) starts from the laboratory analysis details the collector recorded in
    /// revision N, still editable, and revision N is unchanged.
    @MainActor
    func testCorrectionKeepsLaboratoryAnalysisDetails() throws {
        let container = try MobileModelContainer.make(inMemory: true)
        let store = LocalMobileStore(context: container.mainContext)
        let original = temperatureOnlyDraft(testType: .pennStateLab)
        original[valueFor: .ph] = "7.2"
        original[valueFor: .nitrate] = "1.2"
        original[valueFor: .chloride] = "30"
        let nitrateAnalysis = AnalysisProvenance(stage: "LAB", method: "Ion chromatography", instrument: "IC-2", analyzedAt: original.date.addingTimeInterval(86_400))
        let chlorideAnalysis = AnalysisProvenance(stage: "FIELD", method: "Titration kit", instrument: "", analyzedAt: original.date.addingTimeInterval(600), fieldExceptionReason: "Program-approved field kit protocol.")
        original.analysisDetails = [.nitrate: nitrateAnalysis, .chloride: chlorideAnalysis]
        try store.persist(try original.canonicalSnapshot(), workflow: .submitted, sync: .waiting, note: "Original submission")
        try store.updateRemoteState(ownerUID: original.ownerUID, submissionID: original.id, workflow: .needsCorrection, sync: .synced, correctionReason: "Verify nitrate", validation: nil, flags: [])

        let record = try XCTUnwrap(store.loadRecords(ownerUID: original.ownerUID).first)
        XCTAssertEqual(record.measurements.first { $0.kind == .nitrate }?.analysis, nitrateAnalysis)
        XCTAssertEqual(record.measurements.first { $0.kind == .chloride }?.analysis, chlorideAnalysis)
        XCTAssertNil(record.measurements.first { $0.kind == .ph }?.analysis, "a field parameter's provenance follows from the test type")

        let correction = AppModel.correctionDraft(from: record)
        XCTAssertEqual(correction.id, original.id); XCTAssertEqual(correction.revisionNumber, 2); XCTAssertTrue(correction.isCorrection)
        XCTAssertNotEqual(correction.revisionID, original.revisionID)
        XCTAssertEqual(correction.analysisDetails, [.nitrate: nitrateAnalysis, .chloride: chlorideAnalysis])
        XCTAssertEqual(correction.values[.nitrate], "1.2")

        // The carried details submit unchanged; editing one changes only the new revision.
        correction.revisionNote = "Rechecked the laboratory sheet."
        correction[valueFor: .nitrate] = "1.3"
        let corrected = try correction.canonicalSnapshot()
        let nitrate = FirebaseMapper.measurement(try XCTUnwrap(corrected.measurements.first { $0.parameterCode == "NITRATE_MG_L" }), in: corrected)
        XCTAssertEqual(nitrate["analysis_stage"] as? String, "LAB")
        XCTAssertEqual(nitrate["method_name"] as? String, "Ion chromatography")
        XCTAssertEqual(nitrate["instrument_name"] as? String, "IC-2")
        XCTAssertEqual((nitrate["analyzed_at"] as? Timestamp)?.dateValue(), nitrateAnalysis.analyzedAt)
        let chloride = FirebaseMapper.measurement(try XCTUnwrap(corrected.measurements.first { $0.parameterCode == "CHLORIDE_MG_L" }), in: corrected)
        XCTAssertEqual(chloride["analysis_stage"] as? String, "FIELD")
        XCTAssertEqual(chloride["field_exception_reason"] as? String, "Program-approved field kit protocol.")
        correction.analysisDetails[.nitrate]?.method = "Colorimetric autoanalyzer"
        XCTAssertEqual(try correction.canonicalSnapshot().measurements.first { $0.parameterCode == "NITRATE_MG_L" }?.analysisMethod, "Colorimetric autoanalyzer")
        try store.persist(corrected, workflow: .resubmitted, sync: .waiting, note: correction.revisionNote)
        let stored = try container.mainContext.fetch(FetchDescriptor<LocalRevisionEntity>())
            .sorted { $0.revisionNumber < $1.revisionNumber }
            .map { try JSONDecoder().decode(CanonicalSnapshot.self, from: $0.snapshot) }
        XCTAssertEqual(stored.count, 2)
        XCTAssertEqual(stored[0].measurements.first { $0.parameterCode == "NITRATE_MG_L" }?.value, 1.2, "revision N is immutable")
        XCTAssertEqual(stored[1].measurements.first { $0.parameterCode == "NITRATE_MG_L" }?.value, 1.3)
    }

    /// Once a revision is persisted for submission, the cloud draft sync must leave it to the submission
    /// sync; a correction draft (a new revision) still synchronizes.
    @MainActor
    func testFieldDraftCloudSyncStopsOnceItsRevisionIsQueuedForSubmission() throws {
        let container = try MobileModelContainer.make(inMemory: true)
        let store = LocalMobileStore(context: container.mainContext)
        let draft = completeDraft()
        XCTAssertFalse(AppModel.fieldDraftNeedsCloudSync(draft, persisted: nil), "nothing to sync before field collection is saved")
        draft.fieldCollectedAt = .now
        XCTAssertTrue(AppModel.fieldDraftNeedsCloudSync(draft, persisted: try store.snapshot(ownerUID: draft.ownerUID, submissionID: draft.id)))
        try store.persist(try draft.canonicalSnapshot(), workflow: .submitted, sync: .waiting, note: "Submitted")
        XCTAssertFalse(AppModel.fieldDraftNeedsCloudSync(draft, persisted: try store.snapshot(ownerUID: draft.ownerUID, submissionID: draft.id)))

        let correction = completeDraft(id: draft.id, eventID: draft.eventID, revisionID: UUID(), revisionNumber: 2, ownerUID: draft.ownerUID)
        correction.isCorrection = true; correction.fieldCollectedAt = .now
        XCTAssertTrue(AppModel.fieldDraftNeedsCloudSync(correction, persisted: try store.snapshot(ownerUID: draft.ownerUID, submissionID: draft.id)))
    }

    /// The draft sync and the pending-submission sync share one serial queue, so they never overlap.
    @MainActor
    func testSerialWorkQueueRunsWorkOneAtATimeInOrder() async {
        final class Log { var events: [String] = [] }
        let log = Log()
        let queue = SerialWorkQueue()
        queue.enqueue {
            log.events.append("submission-start")
            await Task.yield()
            try? await Task.sleep(nanoseconds: 20_000_000)
            log.events.append("submission-end")
        }
        let last = queue.enqueue {
            log.events.append("draft-start")
            log.events.append("draft-end")
        }
        await last.value
        XCTAssertEqual(log.events, ["submission-start", "submission-end", "draft-start", "draft-end"])
    }

    /// Re-creates what a 0.1.0 build persisted: no schema version, collection stage, visual observations
    /// or measurement analysis provenance.
    @MainActor
    private static func preUpgradeSnapshot(from current: CanonicalSnapshot) throws -> CanonicalSnapshot {
        var object = try XCTUnwrap(JSONSerialization.jsonObject(with: try JSONEncoder().encode(current)) as? [String: Any])
        for key in ["schemaVersion", "collectionStage", "weatherCondition", "waterColor", "flowCondition"] { object.removeValue(forKey: key) }
        object["measurements"] = try XCTUnwrap(object["measurements"] as? [[String: Any]]).map { measurement in
            measurement.filter { !["analysisStage", "analysisMethod", "analysisInstrument", "analyzedAt", "fieldExceptionReason"].contains($0.key) }
        }
        return try JSONDecoder().decode(CanonicalSnapshot.self, from: try JSONSerialization.data(withJSONObject: object))
    }

    @MainActor
    private func temperatureOnlyDraft(testType: TestType) -> ObservationDraft {
        let draft = ObservationDraft(ownerUID: "collector-a")
        draft.site = Site(id: "SITE-TEST-001", name: "Spring Creek at Houserville Road Bridge", county: "Centre County", watershed: "Spring Creek", latitude: 40.79, longitude: -77.86)
        draft.date = Date(timeIntervalSince1970: 1_754_684_200)
        draft.collector = "Maya Chen"
        draft.weatherCondition = "Unknown"; draft.waterColor = "Unknown"; draft.flowCondition = "Unknown"
        draft.latitude = 40.7934; draft.longitude = -77.86; draft.accuracyMeters = 4.2; draft.gpsState = .good
        draft.testType = testType
        if testType == .other { draft.testTypeOther = "Custom protocol" }
        // Test fixture values entered explicitly; the app never pre-fills method details.
        draft.method = "Fixture method"
        draft.instrument = "Fixture instrument or laboratory"
        draft[valueFor: .temperature] = "20"
        return draft
    }

    @MainActor
    private func completeDraft(
        id: UUID = UUID(), eventID: UUID = UUID(), revisionID: UUID = UUID(), revisionNumber: Int = 1,
        ownerUID: String = "collector-a", createdAt: Date = .now
    ) -> ObservationDraft {
        let draft = ObservationDraft(id: id, eventID: eventID, revisionID: revisionID, revisionNumber: revisionNumber, ownerUID: ownerUID, createdAt: createdAt)
        draft.site = Site(id: "SITE-TEST-001", name: "Spring Creek at Houserville Road Bridge", county: "Centre County", watershed: "Spring Creek", latitude: 40.79, longitude: -77.86)
        draft.date = Date(timeIntervalSince1970: 1_754_684_200)
        draft.collector = "Maya Chen"
        draft.weatherCondition = "Unknown"; draft.waterColor = "Unknown"; draft.flowCondition = "Unknown"
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
