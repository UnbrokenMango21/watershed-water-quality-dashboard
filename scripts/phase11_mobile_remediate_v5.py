#!/usr/bin/env python3
"""Phase 11 mobile remediation harness, exact-source revision 5."""
from pathlib import Path

source_path = Path(__file__).with_name("phase11_mobile_remediate.py")
source = source_path.read_text()

stale_action = 'replace(workflow, "                actionLabel = if (needsResult) \\\"1 more result needed below\\\" else null,\\n", "")\n'
if stale_action not in source:
    raise RuntimeError("stale actionLabel patch not found")
source = source.replace(stale_action, "")

footer_line = 'replace(workflow, "WorkflowFooter(4, \\\"Notes and Media\\\", canContinue)", "WorkflowFooter(4, \\\"Notes\\\", canContinue)")\n'
if footer_line not in source:
    raise RuntimeError("Android footer patch not found")
intro_old = '                    "${draft.completedRequiredCount} of ${required.size} required complete" +\n                        if (needsResult) " · 1 more result needed below" else " · tap any unit to change it",'
intro_new = '                    "${draft.completedRequiredCount} of ${required.size} required complete · tap any unit to change it",'
source = source.replace(footer_line, f"replace(workflow, {intro_old!r}, {intro_new!r})\n" + footer_line)

old_optional_patch = (
    'regex_replace(\n'
    '    workflow,\n'
    '    r"            SectionHeading\\(\\\"Optional Measurements\\\"\\).*?            optional\\.forEachIndexed",\n'
    '    "            SectionHeading(\\\"Optional Measurements\\\")\\n            optional.forEachIndexed",\n'
    ')\n'
)
if old_optional_patch not in source:
    raise RuntimeError("stale optional-section patch not found")
optional_old = '''            item {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    SectionHeading("Optional Measurements", "Always available when the field protocol calls for them")
                    if (needsResult) {
                        StatusPanel(
                            "One result is still required",
                            "At least one result below is required for ${draft.testType?.label ?: "this test type"}. Water temperature alone is not enough.",
                            Goldenrod,
                            Icons.Rounded.ErrorOutline,
                        )
                    }
                }
            }'''
optional_new = '''            item {
                SectionHeading("Optional Measurements", "Always available when the field protocol calls for them")
            }'''
source = source.replace(old_optional_patch, f"replace(workflow, {optional_old!r}, {optional_new!r})\n")

# Repair original malformed iOS-test tail.
tail_marker = "# iOS unit tests: golden fixture contains no attachment and optional pH may be blank."
head, sep, _ = source.partition(tail_marker)
if not sep:
    raise RuntimeError("iOS test marker missing")

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

program = head + tail_marker + "\n" + tail
compile(program, str(source_path), "exec")
exec(program, {"__file__": str(source_path), "__name__": "__main__"})
