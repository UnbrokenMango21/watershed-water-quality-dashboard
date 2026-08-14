#!/usr/bin/env python3
"""Phase 11 mobile remediation harness, repaired against the exact audited source."""
from pathlib import Path

source_path = Path(__file__).with_name("phase11_mobile_remediate.py")
source = source_path.read_text()

# The Android source expresses the extra-result hint inline in ScreenIntro rather than
# with a named actionLabel argument. Remove the stale generated replacement and insert
# the exact source replacement before the footer rename.
stale = 'replace(workflow, "                actionLabel = if (needsResult) \\\"1 more result needed below\\\" else null,\\n", "")\n'
if stale not in source:
    raise RuntimeError("Expected stale Android actionLabel remediation line was not found")
source = source.replace(stale, "")
footer_call = 'replace(workflow, "WorkflowFooter(4, \\\"Notes and Media\\\", canContinue)", "WorkflowFooter(4, \\\"Notes\\\", canContinue)")\n'
if footer_call not in source:
    raise RuntimeError("Expected Android footer remediation line was not found")
intro_fix = '''replace(\n    workflow,\n    """                    "${draft.completedRequiredCount} of ${required.size} required complete" +\n                        if (needsResult) " · 1 more result needed below" else " · tap any unit to change it",""",\n    """                    "${draft.completedRequiredCount} of ${required.size} required complete · tap any unit to change it",""",\n)\n'''
source = source.replace(footer_call, intro_fix + footer_call)

# Repair the malformed generated iOS test tail in memory.
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
exec(program, {"__file__": str(source_path), "__name__": "__main__"})
