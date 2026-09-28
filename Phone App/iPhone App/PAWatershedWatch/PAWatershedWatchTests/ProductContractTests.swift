import CoreLocation
import UIKit
import FirebaseFirestore
import SwiftData
import XCTest
@testable import PAWatershedWatch

/// Behavior the 1.0 collector experience promises: catalog decoding, selectable sites, active
/// measurements only, honest method labels, and review issues that match the submission gate.
@MainActor
final class ProductContractTests: XCTestCase {
    // MARK: Site catalog

    func testSiteCatalogDecodesSchemaFieldsAndLegacyDisplayFallback() throws {
        let schema = try XCTUnwrap(SiteCatalogDecoder.site(documentID: "site-a", data: [
            "site_id": "site-a", "site_code": "SPC-01", "site_name_display": "Spring Creek at Fisherman's Paradise",
            "county": "Centre", "watershed_name": "Spring Creek", "latitude": 40.8, "longitude": -77.8,
            "site_tolerance_m": 30, "active": true,
        ]))
        XCTAssertEqual(schema.county, "Centre")
        XCTAssertEqual(schema.watershed, "Spring Creek")
        XCTAssertEqual(schema.code, "SPC-01")
        XCTAssertEqual(schema.toleranceMeters, 30)
        XCTAssertEqual(schema.subtitle, "Centre, Spring Creek")

        let legacy = try XCTUnwrap(SiteCatalogDecoder.site(documentID: "site-b", data: [
            "site_id": "site-b", "site_name_display": "Legacy", "county_display": "Huntingdon County",
            "watershed_display": "Juniata", "location": GeoPoint(latitude: 40.6, longitude: -78.1), "active": true,
        ]))
        XCTAssertEqual(legacy.county, "Huntingdon County")
        XCTAssertEqual(legacy.watershed, "Juniata")
        XCTAssertEqual(legacy.latitude, 40.6)
        XCTAssertNil(legacy.toleranceMeters)
    }

    func testSiteCatalogNeverOffersInactiveOrMalformedSites() {
        let base: [String: Any] = ["site_id": "s", "site_name_display": "Site", "latitude": 40.8, "longitude": -77.8, "active": true]
        XCTAssertNotNil(SiteCatalogDecoder.site(documentID: "s", data: base))
        var inactive = base; inactive["active"] = false
        XCTAssertNil(SiteCatalogDecoder.site(documentID: "s", data: inactive))
        var missingActive = base; missingActive.removeValue(forKey: "active")
        XCTAssertNil(SiteCatalogDecoder.site(documentID: "s", data: missingActive))
        XCTAssertNil(SiteCatalogDecoder.site(documentID: "other-id", data: base))
        var nullIsland = base; nullIsland["latitude"] = 0.0; nullIsland["longitude"] = 0.0
        XCTAssertNil(SiteCatalogDecoder.site(documentID: "s", data: nullIsland))
        var blankName = base; blankName["site_name_display"] = "  "
        XCTAssertNil(SiteCatalogDecoder.site(documentID: "s", data: blankName))
    }

    func testSiteSearchCoversNameCodeCountyAndWatershed() {
        let site = Site(id: "a", name: "Penns Creek at Coburn", code: "PC-02", county: "Centre", watershed: "Penns Creek", latitude: 40.89, longitude: -77.51)
        for query in ["coburn", "PC-02", "centre", "penns", "  "] { XCTAssertTrue(site.matches(query), query) }
        XCTAssertFalse(site.matches("Lehigh"))
    }

    func testSiteDistanceIsGeographic() {
        let site = Site(id: "a", name: "A", county: "", watershed: "", latitude: 40.0, longitude: -77.0)
        XCTAssertEqual(site.distance(latitude: 40.0, longitude: -77.0), 0, accuracy: 0.5)
        // One hundredth of a degree of latitude is about 1.11 km.
        XCTAssertEqual(site.distance(latitude: 40.01, longitude: -77.0), 1_110, accuracy: 15)
    }

    @MainActor
    func testRemovedCatalogSitesStopBeingSelectableButKeepHistoricalNames() throws {
        let container = try MobileModelContainer.make(inMemory: true)
        let store = LocalMobileStore(context: container.mainContext)
        let kept = Site(id: "site-keep", name: "Kept Site", county: "Centre", watershed: "Spring Creek", latitude: 40.79, longitude: -77.86)
        let retired = Site(id: "site-test-001", name: "TEST fixture", code: "TEST-001", county: "Centre", watershed: "Spring Creek", latitude: 40.8, longitude: -77.8)
        try store.replaceSites([kept, retired])

        let draft = ObservationDraft(ownerUID: "collector-a")
        draft.site = retired
        draft.date = Date(timeIntervalSince1970: 1_754_684_200)
        draft.collector = "Maya Chen"
        draft.latitude = 40.8; draft.longitude = -77.8; draft.accuracyMeters = 5
        draft.testType = .fieldInstrument; draft.method = "Direct reading"; draft.instrument = "Meter"
        draft[valueFor: .temperature] = "18"
        try store.persist(try draft.canonicalSnapshot(), workflow: .submitted, sync: .waiting, note: "Submitted")

        try store.replaceSites([kept])
        XCTAssertEqual(try store.cachedSites().map(\.id), ["site-keep"])
        XCTAssertEqual(try store.loadRecords(ownerUID: "collector-a").first?.site.name, "TEST fixture")

        try store.replaceSites([kept, retired])
        XCTAssertEqual(Set(try store.cachedSites().map(\.id)), ["site-keep", "site-test-001"])
    }

    // MARK: Measurements and method

    @MainActor
    func testOnlyContractEnabledMeasurementsAreOffered() {
        let draft = ObservationDraft()
        let offered = draft.requiredMeasurements + draft.optionalMeasurements
        XCTAssertTrue(offered.allSatisfy { $0.productionSpec.support == .fullySupported })
        XCTAssertFalse(offered.contains(.turbidity))
        XCTAssertFalse(offered.contains(.salinity))
        XCTAssertEqual(draft.requiredMeasurements, [.temperature])

        // An older draft that already holds a gated value keeps the row so the value can be cleared.
        draft[valueFor: .turbidity] = "4"
        XCTAssertTrue(draft.optionalMeasurements.contains(.turbidity))
        XCTAssertTrue(draft.blockingIssues.contains { $0.measurement == .turbidity })
    }

    func testMethodChoicesKeepStoredContractValues() {
        XCTAssertEqual(TestType.offeredForNewObservations, [.fieldInstrument, .fieldKit, .pennStateLab, .externalLab, .other])
        let stored = TestType.allCases.map(\.contractValue)
        XCTAssertEqual(stored, [
            "In-situ / Field Instrument", "Penn State Lab", "External Lab", "Field Kit / Colorimetric",
            "Continuous Sensor / Sonde", "Mixed In-situ + Lab", "Other",
        ])
        for type in TestType.allCases { XCTAssertEqual(TestType.contract(type.contractValue), type) }
    }

    @MainActor
    func testChoosingAMethodNeverInventsDetails() {
        let draft = ObservationDraft()
        for type in TestType.allCases {
            draft.testType = type
            XCTAssertEqual(draft.method, "")
            XCTAssertEqual(draft.instrument, "")
        }
    }

    // MARK: Review

    @MainActor
    func testReviewListsEveryBlockingIssueAndMatchesTheSubmitGate() throws {
        let draft = ObservationDraft(ownerUID: "collector-a")
        XCTAssertThrowsError(try draft.canonicalSnapshot())
        let ids = Set(draft.blockingIssues.map(\.id))
        XCTAssertTrue(ids.isSuperset(of: ["site", "gps", "collector", "testType", "required-temperature"]))

        let ready = readyDraft()
        XCTAssertTrue(ready.blockingIssues.isEmpty)
        XCTAssertNoThrow(try ready.canonicalSnapshot())

        ready.method = "  "
        XCTAssertEqual(ready.blockingIssues.map(\.id), ["method"])
        XCTAssertThrowsError(try ready.canonicalSnapshot())
    }

    /// Review's checklist and the submit gate must agree for every draft, so Review never says "Ready to
    /// submit" for a draft that submitDraft() would reject, and never blocks one it would accept.
    @MainActor
    func testReviewChecklistAgreesWithSubmitGate() {
        let mutations: [(String, (ObservationDraft) -> Void)] = [
            ("ready", { _ in }),
            ("no owner", { $0.ownerUID = "" }),
            ("latitude out of range", { $0.latitude = 91 }),
            ("longitude out of range", { $0.longitude = -181 }),
            ("negative accuracy", { $0.accuracyMeters = -1 }),
            ("null island", { $0.latitude = 0; $0.longitude = 0 }),
            ("blank collector", { $0.collector = " " }),
            ("no test type", { $0.testType = nil }),
            ("other without description", { $0.testType = .other }),
            ("blank instrument", { $0.instrument = "" }),
            ("temperature out of range", { $0[valueFor: .temperature] = "80" }),
            ("gated value", { $0[valueFor: .turbidity] = "3" }),
            ("correction without note", { $0.isCorrection = true }),
            ("foreign attachment", { draft in
                draft.attachments = [AttachmentRecord(
                    id: UUID(), ownerUID: "someone-else", submissionID: draft.id, revisionID: draft.revisionID,
                    localURL: URL(fileURLWithPath: "/tmp/x.jpg"), contentType: "image/jpeg", sizeBytes: 10,
                    kind: .sitePhoto, caption: nil, createdAt: .now, transferState: .localOnly
                )]
            }),
        ]
        for (name, mutate) in mutations {
            let draft = readyDraft()
            mutate(draft)
            // submitDraft() = canonicalSnapshot() plus the correction-note rule (also enforced by the store).
            let noteOK = !draft.isCorrection || !draft.revisionNote.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            let gateAccepts = (try? draft.canonicalSnapshot()) != nil && noteOK
            XCTAssertEqual(draft.blockingIssues.isEmpty, gateAccepts, name)
        }
    }

    func testDerivedValidationSummaryCountsEverySeverity() {
        let flags = [
            ValidationFlag(id: "a", severity: "ERROR", ruleCode: "A", message: "a"),
            ValidationFlag(id: "b", severity: "WARNING", ruleCode: "B", message: "b"),
            ValidationFlag(id: "c", severity: "PLAUSIBILITY_WARNING", ruleCode: "C", message: "c"),
            ValidationFlag(id: "d", severity: "INFO", ruleCode: "D", message: "d"),
        ]
        let summary = ValidationSummary.derived(from: flags)
        XCTAssertEqual([summary.errorCount, summary.warningCount, summary.infoCount], [1, 2, 1])
    }

    @MainActor
    func testReviewWarningsNeverBlockSubmission() throws {
        let draft = readyDraft()
        draft.accuracyMeters = 48
        draft.site = Site(id: "s", name: "S", county: "", watershed: "", latitude: 40.80, longitude: -77.86, toleranceMeters: 30)
        draft.latitude = 40.81; draft.longitude = -77.86
        XCTAssertEqual(Set(draft.reviewWarnings.map(\.id)), ["accuracy", "distance"])
        XCTAssertTrue(draft.blockingIssues.isEmpty)
        XCTAssertNoThrow(try draft.canonicalSnapshot())
    }

    @MainActor
    func testLegacyDraftWithRetiredLabFieldsStillRestores() throws {
        let container = try MobileModelContainer.make(inMemory: true)
        let store = LocalMobileStore(context: container.mainContext)
        let draft = readyDraft()
        try store.save(draft)
        let entity = try XCTUnwrap(container.mainContext.fetch(FetchDescriptor<LocalDraftEntity>()).first)
        var json = try XCTUnwrap(JSONSerialization.jsonObject(with: entity.payload) as? [String: Any])
        json["labResultsPending"] = true
        json["requestedAnalytes"] = ["chloride", "nitrate"]
        entity.payload = try JSONSerialization.data(withJSONObject: json)
        try container.mainContext.save()
        let restored = try XCTUnwrap(store.loadDraft(ownerUID: "collector-a", sites: [draft.site!]))
        XCTAssertEqual(restored.id, draft.id)
        XCTAssertEqual(restored.values, draft.values)
    }

    // MARK: Symbols

    /// A missing SF Symbol renders as empty space, silently removing the non-color cue from a status.
    func testEverySymbolTheAppUsesExists() {
        let enumSymbols = WorkflowState.allCases.map(\.icon) + [SyncState.savedLocally, .waiting, .syncing, .synced, .failed].map(\.icon)
            + GPSState.allCases.map(\.icon) + TestType.allCases.map(\.icon) + MeasurementKind.allCases.map(\.symbol)
        let viewSymbols = [
            "arrow.clockwise", "arrow.right", "arrow.right.circle.fill", "calendar", "checkmark", "checkmark.circle",
            "checkmark.circle.fill", "checkmark.seal", "checkmark.seal.fill", "chevron.down", "chevron.right", "circle",
            "circle.dotted.circle", "clock.arrow.circlepath", "doc.badge.plus", "doc.questionmark", "drop.circle", "drop.fill",
            "envelope.badge", "exclamationmark.bubble.fill", "gear", "exclamationmark.circle", "exclamationmark.circle.fill",
            "exclamationmark.icloud", "exclamationmark.icloud.fill", "exclamationmark.triangle.fill",
            "gauge.with.dots.needle.33percent", "hammer.fill", "house.fill", "internaldrive.fill", "location", "location.fill",
            "location.slash.fill", "location.viewfinder", "lock.fill", "magnifyingglass", "map", "map.fill", "mappin.and.ellipse",
            "mappin.circle", "mappin.slash", "minus.circle", "network", "note.text", "paperplane.fill", "pencil", "person.crop.circle",
            "person.crop.circle.badge.checkmark", "person.crop.circle.badge.plus", "person.crop.circle.fill", "person.fill",
            "person.text.rectangle", "plus", "scope", "testtube.2", "tray", "wifi", "wifi.slash", "xmark.circle.fill",
            "xmark.octagon.fill",
        ]
        for name in Set(enumSymbols + viewSymbols) {
            XCTAssertNotNil(UIImage(systemName: name), "SF Symbol '\(name)' does not exist on this OS")
        }
    }

    // MARK: Brand

    /// Status tones are generated from config/brand_tokens.json; every state needs an explicit entry so
    /// a new state can never fall back silently to the neutral draft appearance.
    func testEveryWorkflowStateHasAGeneratedBrandTone() {
        for state in WorkflowState.allCases {
            XCTAssertNotNil(BrandTokens.workflowTone[state.rawValue], "No brand tone for \(state.rawValue)")
        }
        XCTAssertEqual(WorkflowState.draft.tone, .neutral)
        XCTAssertEqual(WorkflowState.pendingReview.tone, .review)
        XCTAssertEqual(WorkflowState.needsCorrection.tone, .attention)
        XCTAssertEqual(WorkflowState.approved.tone, .approved)
        XCTAssertEqual(WorkflowState.published.tone, .published)
    }

    // MARK: Identity

    func testIdentityNameMatchesTheServerRule() {
        XCTAssertEqual(IdentityName.normalized("  Maya   Chen "), "Maya Chen")
        XCTAssertNil(IdentityName.problem("Maya Chen"))
        XCTAssertNotNil(IdentityName.problem(" M "))
        XCTAssertNotNil(IdentityName.problem(String(repeating: "x", count: 81)))
        XCTAssertNotNil(IdentityName.problem("Maya\u{0007}Chen"))
    }

    @MainActor
    private func readyDraft() -> ObservationDraft {
        let draft = ObservationDraft(ownerUID: "collector-a")
        draft.site = Site(id: "site-a", name: "Spring Creek", county: "Centre", watershed: "Spring Creek", latitude: 40.7934, longitude: -77.86, toleranceMeters: 30)
        draft.date = Date(timeIntervalSince1970: 1_754_684_200)
        draft.collector = "Maya Chen"
        draft.latitude = 40.7934; draft.longitude = -77.86; draft.accuracyMeters = 4
        draft.testType = .fieldInstrument
        draft.method = "Direct reading"
        draft.instrument = "Multiparameter meter"
        draft[valueFor: .temperature] = "18.5"
        return draft
    }
}
