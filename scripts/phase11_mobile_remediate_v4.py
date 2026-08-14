#!/usr/bin/env python3
"""Phase 11 mobile remediation harness aligned to the audited Android/iOS source."""
from pathlib import Path

source_path = Path(__file__).with_name("phase11_mobile_remediate.py")
source = source_path.read_text()

# 1) Android: the extra-result hint is inline in ScreenIntro, not an actionLabel.
stale = 'replace(workflow, "                actionLabel = if (needsResult) \\\"1 more result needed below\\\" else null,\\n", "")\n'
if stale not in source:
    raise RuntimeError("Expected stale Android actionLabel remediation line was not found")
source = source.replace(stale, "")
footer_call = 'replace(workflow, "WorkflowFooter(4, \\\"Notes and Media\\\", canContinue)", "WorkflowFooter(4, \\\"Notes\\\", canContinue)")\n'
if footer_call not in source:
    raise RuntimeError("Expected Android footer remediation line was not found")
intro_fix = '''replace(\n    workflow,\n    """                    "${draft.completedRequiredCount} of ${required.size} required complete" +\n                        if (needsResult) " · 1 more result needed below" else " · tap any unit to change it",""",\n    """                    "${draft.completedRequiredCount} of ${required.size} required complete · tap any unit to change it",""",\n)\n'''
source = source.replace(footer_call, intro_fix + footer_call)

# 2) Android: optional measurements use a LazyColumn `item { Column { ... } }` +
# `items(...)`, not the older SectionHeading/forEachIndexed shape.
old_optional_patch = '''regex_replace(\n    workflow,\n    r"            SectionHeading\\(\\\"Optional Measurements\\\"\\).*?            optional\\.forEachIndexed",\n    "            SectionHeading(\\\"Optional Measurements\\\")\\n            optional.forEachIndexed",\n)\n'''
if old_optional_patch not in source:
    raise RuntimeError("Expected stale Android optional-section remediation block was not found")
new_optional_patch = '''regex_replace(\n    workflow,\n    r'''            item \\{\\n                Column\\(verticalArrangement = Arrangement\\.spacedBy\\(12\\.dp\\)\\) \\{\\n                    SectionHeading\\(\\"Optional Measurements\\", \\"Always available when the field protocol calls for them\\"\\)\\n                    if \\(needsResult\\) \\{.*?\\n                    \\}\\n                \\}\\n            \\}''',\n    '''            item {\n                SectionHeading("Optional Measurements", "Always available when the field protocol calls for them")\n            }''',\n)\n'''
source = source.replace(old_optional_patch, new_optional_patch)

# 3) Repair the malformed generated iOS-test tail from the original harness.
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
