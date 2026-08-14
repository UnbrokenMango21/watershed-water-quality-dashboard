#!/usr/bin/env python3
"""Executes the Phase 11 mobile remediation with the iOS-test tail repaired.

The first runner exposed a syntax error in the generated harness before any repository
changes were committed. This wrapper keeps the already-reviewed remediation body and
replaces only the malformed harness tail in memory.
"""
from pathlib import Path

source_path = Path(__file__).with_name("phase11_mobile_remediate.py")
source = source_path.read_text()
marker = "# iOS unit tests: golden fixture contains no attachment and optional pH may be blank."
head, separator, _ = source.partition(marker)
if not separator:
    raise RuntimeError("Expected iOS test remediation marker was not found")

tail = r'''# iOS unit tests: golden fixture contains no attachment and optional pH may be blank.
ios_test = f"{IOS}/PAWatershedWatchTests/ModelTests.swift"
regex_replace(ios_test, r"        let attachmentID = try XCTUnwrap\(UUID\(uuidString: \"55555555-5555-4555-8555-555555555555\"\)\)\n        draft\.attachments = \[AttachmentRecord\(.*?\n        \)\]\n", "")
regex_replace(
    ios_test,
    r"        let path = \"users/collector-a/submissions/11111111-1111-4111-8111-111111111111/revisions/33333333-3333-4333-8333-333333333333/55555555-5555-4555-8555-555555555555\.jpg\"\n        XCTAssertEqual\(\n            try Self\.jsonData\(snapshot\.attachments\.map \{ FirebaseMapper\.attachment\(\$0, in: snapshot, storagePath: path\) \}\),\n            try Self\.jsonData\(try XCTUnwrap\(expected\[\"attachments\"\]\)\)\n        \)",
    """        XCTAssertTrue(snapshot.attachments.isEmpty)
        XCTAssertEqual(
            try Self.jsonData(snapshot.attachments),
            try Self.jsonData(try XCTUnwrap(expected[\"attachments\"]))
        )""",
)
replace(
    ios_test,
    '        draft[valueFor: .ph] = ""\n        XCTAssertThrowsError(try draft.canonicalSnapshot())\n        draft[valueFor: .ph] = "0"',
    '        draft[valueFor: .ph] = ""\n        let withoutPH = try draft.canonicalSnapshot()\n        XCTAssertFalse(withoutPH.measurements.contains { $0.parameterCode == "PH" })\n        draft[valueFor: .ph] = "0"',
)
marker = "    @MainActor\n    func testEasternTimezoneAndDSTGoldenCases() throws {"
policy_test = """    @MainActor
    func testFirstProductionPolicyRequiresOnlyWaterTemperature() throws {
        for type in TestType.allCases {
            let draft = completeDraft()
            draft.testType = type
            draft[valueFor: .ph] = ""
            draft[valueFor: .dissolvedOxygen] = ""
            draft[valueFor: .conductivity] = ""
            XCTAssertEqual(draft.requiredMeasurements, [.temperature])
            XCTAssertTrue(draft.productionProfileComplete)
            XCTAssertNoThrow(try draft.canonicalSnapshot())
        }
    }

"""
replace(ios_test, marker, policy_test + marker)

print('Phase 11 mobile remediation applied successfully.')
'''

program = head + marker + "\n" + tail
compile(program, str(source_path), "exec")
namespace = {"__file__": str(source_path), "__name__": "__main__"}
exec(program, namespace)
