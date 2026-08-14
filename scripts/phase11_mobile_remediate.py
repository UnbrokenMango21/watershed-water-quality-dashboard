#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def p(path: str) -> Path:
    return ROOT / path


def read(path: str) -> str:
    return p(path).read_text()


def write(path: str, text: str) -> None:
    p(path).write_text(text)


def replace(path: str, old: str, new: str, expected: int = 1) -> None:
    text = read(path)
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f"{path}: expected {expected} occurrences, found {count}: {old[:120]!r}")
    write(path, text.replace(old, new))


def regex_replace(path: str, pattern: str, new: str, expected: int = 1) -> None:
    text = read(path)
    result, count = re.subn(pattern, new, text, count=expected, flags=re.S)
    if count != expected:
        raise RuntimeError(f"{path}: expected {expected} regex replacements, found {count}: {pattern[:120]!r}")
    write(path, result)


def remove_lines(path: str, lines: list[str]) -> None:
    text = read(path)
    for line in lines:
        if line not in text:
            raise RuntimeError(f"{path}: import/config line missing: {line!r}")
        text = text.replace(line, "")
    write(path, text)


ANDROID = "Phone App/Android App"
IOS = "Phone App/iPhone App/PAWatershedWatch"

# ---------------------------------------------------------------------------
# Shared golden contract: no media in first production release.
# ---------------------------------------------------------------------------
golden_path = "tests/mobile-contract-fixtures/mobile_golden.json"
golden = json.loads(read(golden_path))
first = golden["serializationCases"][0]
first["name"] = first["name"].replace("_with_photo", "")
first["input"]["attachments"] = []
first["expected"]["attachments"] = []
write(golden_path, json.dumps(golden, indent=2, ensure_ascii=False) + "\n")

# ---------------------------------------------------------------------------
# Android: first-release measurement policy + media removal.
# ---------------------------------------------------------------------------
model = f"{ANDROID}/app/src/main/java/org/watershed/pawatershedwatch/Model.kt"
regex_replace(
    model,
    r"    val requiredMeasurements: List<MeasurementKind>\n        get\(\) = when \(testType\) \{.*?    val profileMinimumComplete: Boolean\n        get\(\) = when \{.*?        \}\n",
    """    /** First production release policy: Water Temperature is the only required science measurement. */\n    val requiredMeasurements: List<MeasurementKind>\n        get() = listOf(MeasurementKind.Temperature)\n\n    val optionalMeasurements: List<MeasurementKind>\n        get() = MeasurementKind.entries.filterNot(requiredMeasurements::contains)\n\n    fun selectedUnit(kind: MeasurementKind): UnitSpec =\n        unitIds[kind]?.let(Units::byId) ?: kind.units.first()\n\n    fun isComplete(kind: MeasurementKind): Boolean = values[kind]?.toDoubleOrNull() != null\n\n    val completedRequiredCount: Int get() = requiredMeasurements.count(::isComplete)\n    val requiredComplete: Boolean get() = completedRequiredCount == requiredMeasurements.size\n\n    /** Retained as a compatibility property for older view/state code; no hidden extra result is required. */\n    val requiresAdditionalResult: Boolean get() = false\n    val hasAdditionalResult: Boolean\n        get() = values.any { (kind, value) -> kind != MeasurementKind.Temperature && value.toDoubleOrNull() != null }\n    val profileMinimumComplete: Boolean get() = testType != null && requiredComplete\n""",
)

prod = f"{ANDROID}/app/src/main/java/org/watershed/pawatershedwatch/ProductionDomain.kt"
replace(prod, "    require(profileMinimumComplete) { \"Measurements do not meet the production validation profile\" }", "    require(requiredComplete) { \"Water Temperature is required for production submission\" }")
regex_replace(
    prod,
    r"    attachments\.forEach \{ attachment ->\n        require\(attachment\.ownerUid == ownerUid.*?\n    \}\n",
    "",
)
replace(
    prod,
    "        attachments, appVersion, isCorrection,",
    "        emptyList(), appVersion, isCorrection,",
)

workflow = f"{ANDROID}/app/src/main/java/org/watershed/pawatershedwatch/WorkflowScreens.kt"
remove_lines(workflow, [
    "import android.media.MediaRecorder\n",
    "import android.os.Build\n",
    "import androidx.activity.result.PickVisualMediaRequest\n",
    "import androidx.compose.material.icons.rounded.AddAPhoto\n",
    "import androidx.compose.material.icons.rounded.CameraAlt\n",
    "import androidx.compose.material.icons.rounded.Image\n",
    "import androidx.compose.material.icons.rounded.Mic\n",
    "import androidx.compose.material.icons.rounded.StopCircle\n",
    "import androidx.compose.runtime.DisposableEffect\n",
    "import androidx.core.content.FileProvider\n",
    "import java.io.File\n",
])
replace(workflow, "    val canContinue = draft.requiredComplete && draft.profileMinimumComplete && !invalid\n    val needsResult = draft.requiresAdditionalResult && !draft.hasAdditionalResult", "    val canContinue = draft.requiredComplete && !invalid")
replace(workflow, "                actionLabel = if (needsResult) \"1 more result needed below\" else null,\n", "")
replace(workflow, "WorkflowFooter(4, \"Notes and Media\", canContinue)", "WorkflowFooter(4, \"Notes\", canContinue)")
regex_replace(
    workflow,
    r"            SectionHeading\(\"Optional Measurements\"\).*?            optional\.forEachIndexed",
    "            SectionHeading(\"Optional Measurements\")\n            optional.forEachIndexed",
)
notes_only_android = r'''@Composable
fun NotesMediaScreen(model: AppViewModel, onBack: () -> Unit, onNext: () -> Unit) {
    val draft = model.draft ?: return
    Scaffold(
        topBar = { FieldTopBar("Notes", onBack) },
        bottomBar = {
            WorkflowFooter(5, "Review Observation") {
                model.setStep(6)
                onNext()
            }
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            ScreenIntro(
                eyebrow = "STEP 5 OF 6",
                title = "Add field context",
                body = "Field notes are optional and stay with the immutable observation revision. Photo and audio capture are deferred until a later production phase.",
            )
            Surface(shape = RoundedCornerShape(20.dp), tonalElevation = 1.dp) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    FieldLabel("Field Notes", required = false)
                    OutlinedTextField(
                        value = draft.notes,
                        onValueChange = { value -> model.updateDraft { it.copy(notes = value) } },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 5,
                        maxLines = 10,
                        placeholder = { Text("Describe conditions, sample context, or anything unusual") },
                    )
                    Text(
                        "Photos and audio notes are not part of the first production release.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

'''
regex_replace(workflow, r"@Composable\nfun NotesMediaScreen\(.*?\n@Composable\nfun ReviewScreen", notes_only_android + "@Composable\nfun ReviewScreen")

view_model = f"{ANDROID}/app/src/main/java/org/watershed/pawatershedwatch/AppViewModel.kt"
remove_lines(view_model, ["import android.net.Uri\n", "import java.io.File\n"])
replace(view_model, "    private val attachments: AttachmentRepository = graph.local\n", "")
regex_replace(view_model, r"    fun addAttachment\(value: ObservationAttachment\) \{.*?    fun reviewIssues\(\): List<ReviewIssue> \{", "    fun reviewIssues(): List<ReviewIssue> {")
replace(
    view_model,
    """            if (!current.profileMinimumComplete && current.requiredComplete) {\n                issue(\"Enter at least one measured result for this test type\", WorkflowStep.Measurements)\n            }\n""",
    "",
)
regex_replace(
    view_model,
    r"        viewModelScope\.launch \{\n            runCatching \{ withContext\(Dispatchers\.IO\) \{ copyCorrectionAttachments\(record\.attachments, base\) \} \}.*?            preparingCorrection = false\n        \}\n",
    """        draft = base\n        persistDraft(base)\n        preparingCorrection = false\n        onReady(true)\n""",
)
regex_replace(view_model, r"    private fun prepareAttachment\(draft: ObservationDraft, contentType: String, kind: AttachmentKind\): ObservationAttachment \{.*?    private fun Throwable\.authMessage", "    private fun Throwable.authMessage")
regex_replace(view_model, r"\n    private companion object \{\n        const val MAX_ATTACHMENT_BYTES.*?\n    \}\n\}\n\nprivate fun java\.io\.InputStream\.copyBoundedTo.*", "\n}\n")

firebase = f"{ANDROID}/app/src/main/java/org/watershed/pawatershedwatch/FirebaseData.kt"
remove_lines(firebase, [
    "import android.net.Uri\n",
    "import com.google.firebase.storage.FirebaseStorage\n",
    "import com.google.firebase.storage.StorageException\n",
    "import com.google.firebase.storage.StorageMetadata\n",
    "import java.io.File\n",
    "import kotlin.coroutines.cancellation.CancellationException\n",
])
replace(
    firebase,
    "        application, FirebaseAuth.getInstance(), FirebaseFirestore.getInstance(), FirebaseStorage.getInstance(), database.dao(), local,",
    "        application, FirebaseAuth.getInstance(), FirebaseFirestore.getInstance(), database.dao(), local,",
)
replace(firebase, "    private val storage: FirebaseStorage,\n", "")
replace(
    firebase,
    """        val snapshot = revision.snapshot(\n            dao.measurements(ownerUid, revision.revisionId),\n            dao.attachments(ownerUid, revision.revisionId).map(LocalAttachmentEntity::asDomain),\n        )""",
    """        // First production release deliberately excludes media from the cloud contract.\n        val snapshot = revision.snapshot(\n            dao.measurements(ownerUid, revision.revisionId),\n            emptyList(),\n        )""",
)
regex_replace(
    firebase,
    r"            // One unreachable photo must not stop its siblings from uploading\..*?            attachmentFailures\.firstOrNull\(\)\?\.let \{ throw it \}\n",
    "",
)
regex_replace(firebase, r"            for \(attachment in snapshot\.attachments\) \{\n                require\(revisionRef\.collection\(\"attachments\"\).*?\n            \}\n", "")
regex_replace(firebase, r"    private suspend fun uploadIfNeeded\(.*?\n    companion object \{", "    companion object {")
replace(firebase, "        private const val MAX_ATTACHMENT_BYTES = 50L * 1024 * 1024\n", "")

build_gradle = f"{ANDROID}/app/build.gradle.kts"
replace(build_gradle, "    implementation(\"com.google.firebase:firebase-storage\")\n", "")

manifest = f"{ANDROID}/app/src/main/AndroidManifest.xml"
remove_lines(manifest, [
    "    <uses-permission android:name=\"android.permission.CAMERA\" />\n",
    "    <uses-permission android:name=\"android.permission.RECORD_AUDIO\" />\n",
    "    <uses-feature android:name=\"android.hardware.camera.any\" android:required=\"false\" />\n",
    "    <uses-feature android:name=\"android.hardware.microphone\" android:required=\"false\" />\n",
])
regex_replace(manifest, r"        <provider\n            android:name=\"androidx\.core\.content\.FileProvider\".*?        </provider>\n", "")
file_paths = p(f"{ANDROID}/app/src/main/res/xml/file_paths.xml")
if file_paths.exists():
    file_paths.unlink()

# Android tests follow the locked release policy and no longer exercise attachments.
model_test = f"{ANDROID}/app/src/test/java/org/watershed/pawatershedwatch/ModelTest.kt"
remove_lines(model_test, ["import org.junit.Assert.assertFalse\n"])
regex_replace(
    model_test,
    r"    @Test\n    fun labProfileNeedsOneResultBeyondTemperature\(\) \{.*?\n    \}\n",
    """    @Test\n    fun firstProductionPolicyRequiresOnlyWaterTemperature() {\n        TestType.entries.forEach { type ->\n            val draft = ObservationDraft(\n                testType = type,\n                values = mapOf(MeasurementKind.Temperature to \"18\"),\n            )\n            assertEquals(listOf(MeasurementKind.Temperature), draft.requiredMeasurements)\n            assertTrue(draft.requiredComplete)\n            assertTrue(draft.profileMinimumComplete)\n            assertTrue(!draft.requiresAdditionalResult)\n        }\n    }\n""",
)

prod_test = f"{ANDROID}/app/src/test/java/org/watershed/pawatershedwatch/ProductionDomainTest.kt"
# Remove first golden-test attachment construction and compare release-empty attachments.
regex_replace(prod_test, r"            notes = input\.getString\(\"fieldNotes\"\),\n            attachments = listOf\(.*?\n            \),\n", "            notes = input.getString(\"fieldNotes\"),\n")
replace(prod_test, "        val path = expected.getJSONArray(\"attachments\").getJSONObject(0).getString(\"storage_path\")\n", "")
replace(
    prod_test,
    "        assertEquals(expected.getJSONArray(\"attachments\").toValue(), snapshot.attachments.map { FirestoreObservationMapper.attachment(snapshot, it, path).normalized() })",
    "        assertEquals(expected.getJSONArray(\"attachments\").toValue(), snapshot.attachments.map { it })",
)
replace(prod_test, "import org.junit.Assert.assertEquals\n", "import org.junit.Assert.assertEquals\nimport org.junit.Assert.assertFalse\n")
replace(
    prod_test,
    """        draft[valueFor: .ph] = \"\"""" if False else "__NOOP__",
    "__NOOP__",
    expected=0,
)
# Kotlin blank-pH behavior: optional blank is omitted instead of failing.
replace(
    prod_test,
    """        assertThrows(IllegalArgumentException::class.java) {\n            valid.copy(values = valid.values + (MeasurementKind.Ph to \"\")).toCanonicalSnapshot(\"owner-a\", \"1.0.0\")\n        }\n        val snapshot = valid.copy(""",
    """        val withoutPh = valid.copy(values = valid.values + (MeasurementKind.Ph to \"\")).toCanonicalSnapshot(\"owner-a\", \"1.0.0\")\n        assertFalse(withoutPh.measurements.any { it.parameterCode == \"PH\" })\n        val snapshot = valid.copy(""",
)
regex_replace(
    prod_test,
    r"    @Test\n    fun labProfileBlocksTemperatureOnlySubmissionsAndAcceptsOneResult\(\) \{.*?\n    \}\n",
    """    @Test\n    fun labProfileAcceptsTemperatureOnlyInFirstProductionRelease() {\n        val labDraft = ObservationDraft(\n            ownerUid = \"owner-a\", siteId = \"SITE-1\", collector = \"Collector\", latitude = 40.0, longitude = -77.0,\n            accuracyMeters = 5.0, gpsState = GpsState.Good, testType = TestType.PennStateLab,\n            method = \"Grab sample\", instrument = \"Penn State Agricultural Analytical Services Laboratory\",\n            values = mapOf(MeasurementKind.Temperature to \"18\"),\n        )\n        val snapshot = labDraft.toCanonicalSnapshot(\"owner-a\", \"1.0.0\")\n        assertTrue(snapshot.measurements.isEmpty())\n        assertEquals(18.0, snapshot.tempC, 0.0)\n    }\n""",
)

# ---------------------------------------------------------------------------
# iOS: first-release measurement policy + complete runtime media removal.
# ---------------------------------------------------------------------------
ios_model = f"{IOS}/PAWatershedWatch/Model.swift"
regex_replace(
    ios_model,
    r"    var requiredMeasurements: \[MeasurementKind\] \{\n        switch testType \{.*?    var measurementProgressText: String \{.*?    \}\n",
    """    /// First production release policy: Water Temperature is the only required science measurement.\n    var requiredMeasurements: [MeasurementKind] { [.temperature] }\n\n    var optionalMeasurements: [MeasurementKind] {\n        MeasurementKind.allCases.filter { !requiredMeasurements.contains($0) }\n    }\n\n    var completedRequiredCount: Int {\n        requiredMeasurements.count { Double(values[$0] ?? \"\") != nil }\n    }\n\n    var firstIncompleteRequirement: MeasurementKind? {\n        requiredMeasurements.first { Double(values[$0] ?? \"\") == nil }\n    }\n\n    /// Compatibility property: no hidden additional measurement is required in Phase 11.\n    var requiresAdditionalResult: Bool { false }\n\n    var hasAdditionalResult: Bool {\n        values.contains { $0.key != .temperature && Double($0.value) != nil }\n    }\n\n    var productionProfileComplete: Bool {\n        testType != nil && completedRequiredCount == requiredMeasurements.count\n    }\n\n    var measurementProgressText: String {\n        \"\\(completedRequiredCount)/\\(requiredMeasurements.count)\"\n    }\n""",
)
regex_replace(
    ios_model,
    r"        do \{ correction\.attachments = try copyAttachments\(record\.attachments, to: correction\) \}\n        catch \{ workflowError = \"Attached files could not be prepared for the correction revision\.\"; return \}\n",
    "        correction.attachments = []\n",
)
regex_replace(ios_model, r"    func addAttachment\(data: Data, contentType: String, kind: AttachmentKind\) \{.*?    private func applySession", "    private func applySession")
regex_replace(ios_model, r"    private func copyAttachments\(_ attachments: \[AttachmentRecord\], to draft: ObservationDraft\) throws -> \[AttachmentRecord\] \{.*?    private func reloadRecords", "    private func reloadRecords")
replace(
    ios_model,
    """                    let acknowledged = try await remote.sync(snapshot) { [weak self] attachmentID, state, path, error in\n                        try? self?.store.updateAttachment(ownerUID: ownerUID, attachmentID: attachmentID, state: state, remotePath: path, error: error)\n                    }""",
    "                    let acknowledged = try await remote.sync(snapshot)",
)
regex_replace(ios_model, r"                \} catch let media as AttachmentSyncFailure \{.*?                    workflowError = media\.localizedDescription\n", "")

ios_data = f"{IOS}/PAWatershedWatch/ProductionData.swift"
remove_lines(ios_data, ["import AVFoundation\n", "@preconcurrency import FirebaseStorage\n"])
regex_replace(
    ios_data,
    r"        for attachment in attachments \{\n            guard attachment\.ownerUID == ownerUID.*?\n        \}\n",
    "",
)
replace(ios_data, "            tempC: tempC, tempF: tempF, measurements: canonical, attachments: attachments,", "            tempC: tempC, tempF: tempF, measurements: canonical, attachments: [],")
regex_replace(ios_data, r"\n/// The scientific record reached the archive but some media did not\..*?\n\}\n\n@MainActor protocol RemoteMobileRepository", "\n@MainActor protocol RemoteMobileRepository")
replace(ios_data, "    private let storage = Storage.storage()\n", "")
replace(ios_data, "        var failedAttachments = 0\n", "")
regex_replace(
    ios_data,
    r"            // Media is best effort and each attachment is isolated\..*?            \}\n            try await revision\.updateData",
    "            try await revision.updateData",
)
replace(ios_data, "        guard failedAttachments == 0 else { throw AttachmentSyncFailure(workflow: workflow, count: failedAttachments) }\n", "")
regex_replace(ios_data, r"\n    /// Uploads one attachment and writes its metadata document\..*?\n    func listen\(", "\n    func listen(")
regex_replace(ios_data, r"\n    private func storagePath\(_ attachment: AttachmentRecord, snapshot: CanonicalSnapshot\) -> String \{.*?\n    private static let acknowledged", "\n    private static let acknowledged")
regex_replace(ios_data, r"\n@MainActor final class AudioNoteRecorder \{.*", "\n")

ios_views = f"{IOS}/PAWatershedWatch/WorkflowViews.swift"
remove_lines(ios_views, ["import AVFoundation\n", "import PhotosUI\n", "import UniformTypeIdentifiers\n"])
regex_replace(ios_views, r"\nenum FieldPermissionRequester \{.*?\n\}\n\nstruct SelectSiteView", "\nstruct SelectSiteView")
replace(ios_views, "                    focused: $focusedMeasurement,\n                    showsAdditionalResultNote: draft.requiresAdditionalResult\n", "                    focused: $focusedMeasurement\n")
replace(ios_views, "FlowFooter(step: 4, total: 6, actionTitle: \"Notes and Media\")", "FlowFooter(step: 4, total: 6, actionTitle: \"Notes\")")
replace(
    ios_views,
    """    private var measurementsAreValid: Bool {\n        let labSelectionValid = !draft.includesLab || !draft.labResultsPending || !draft.requestedAnalytes.isEmpty\n        return labSelectionValid && draft.measurementProblems.isEmpty && draft.productionProfileComplete\n    }""",
    """    private var measurementsAreValid: Bool {\n        draft.measurementProblems.isEmpty && draft.productionProfileComplete\n    }""",
)
replace(
    ios_views,
    """        } else if draft.includesLab && draft.labResultsPending && draft.requestedAnalytes.isEmpty {\n            NoticeBanner(title: \"Analysis Required\", message: \"Select at least one analysis.\", systemImage: \"exclamationmark.circle.fill\", color: .red)\n""",
    "",
)
replace(
    ios_views,
    """        } else if !draft.productionProfileComplete {\n            NoticeBanner(title: \"Measured Result Required\", message: \"Enter at least one measurement result below (in addition to temperature) — required for this test type.\", systemImage: \"exclamationmark.circle.fill\", color: .red)\n""",
    "",
)
replace(ios_views, "    var showsAdditionalResultNote = false\n", "")
regex_replace(ios_views, r"            if showsAdditionalResultNote \{.*?            \}\n            if kinds\.isEmpty", "            if kinds.isEmpty")
notes_only_ios = r'''struct NotesMediaView: View {
    let model: AppModel

    var body: some View {
        if let draft = model.draft {
            NotesMediaContent(model: model, draft: draft)
        } else {
            MissingDraftView()
        }
    }
}

struct NotesMediaContent: View {
    let model: AppModel
    let draft: ObservationDraft

    var body: some View {
        @Bindable var draft = draft
        ScrollView {
            VStack(alignment: .leading, spacing: FieldTheme.l) {
                VStack(alignment: .leading, spacing: 12) {
                    FieldSectionHeader(title: "Field Notes")
                    TextField("Describe conditions, sample context, or anything unusual", text: $draft.notes, axis: .vertical)
                        .font(.body)
                        .lineLimit(6...10)
                        .padding(8)
                        .background(Color(uiColor: .secondarySystemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusS, style: .continuous))
                    Text("Photos and audio notes are deferred until a later production phase.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(FieldTheme.m)
                .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: FieldTheme.radiusM, style: .continuous))
            }
            .padding(.horizontal, FieldTheme.m)
            .padding(.bottom, FieldTheme.l)
        }
        .fieldScreen()
        .scrollDismissesKeyboard(.interactively)
        .navigationTitle("Notes")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            FlowFooter(step: 5, total: 6, actionTitle: "Review Observation") {
                model.advance(to: .review, step: 6)
            }
        }
    }
}

'''
regex_replace(ios_views, r"struct NotesMediaView: View \{.*?\nstruct MissingDraftView", notes_only_ios + "struct MissingDraftView")

# Remove iOS Firebase Storage product/dependency and camera/microphone permission strings.
pbx = f"{IOS}/PAWatershedWatch.xcodeproj/project.pbxproj"
remove_lines(pbx, [
    "\t\tAA0000000000000000000024 /* FirebaseStorage in Frameworks */ = {isa = PBXBuildFile; productRef = AA0000000000000000000014 /* FirebaseStorage */; };\n",
    "\t\t\t\tAA0000000000000000000024 /* FirebaseStorage in Frameworks */,\n",
    "\t\t\t\tAA0000000000000000000014 /* FirebaseStorage */,\n",
    "\t\tAA0000000000000000000014 /* FirebaseStorage */ = {isa = XCSwiftPackageProductDependency; package = AA0000000000000000000010 /* XCRemoteSwiftPackageReference \"firebase-ios-sdk\" */; productName = FirebaseStorage; };\n",
])
replace(pbx, "\t\t\t\tINFOPLIST_KEY_NSCameraUsageDescription = \"Attach photographs of sampling sites and field conditions to an observation.\";\n", "", expected=2)
replace(pbx, "\t\t\t\tINFOPLIST_KEY_NSMicrophoneUsageDescription = \"Record optional audio notes while collecting a field observation.\";\n", "", expected=2)

# iOS unit tests: golden fixture contains no attachment and optional pH may be blank.
ios_test = f"{IOS}/PAWatershedWatchTests/ModelTests.swift"
regex_replace(ios_test, r"        let attachmentID = try XCTUnwrap\(UUID\(uuidString: \"55555555-5555-4555-8555-555555555555\"\)\)\n        draft\.attachments = \[AttachmentRecord\(.*?\n        \)\]\n", "")
regex_replace(
    ios_test,
    r"        let path = \"users/collector-a/submissions/11111111-1111-4111-8111-111111111111/revisions/33333333-3333-4333-8333-333333333333/55555555-5555-4555-8555-555555555555\.jpg\"\n        XCTAssertEqual\(\n            try Self\.jsonData\(snapshot\.attachments\.map \{ FirebaseMapper\.attachment\(\$0, in: snapshot, storagePath: path\) \}\),\n            try Self\.jsonData\(try XCTUnwrap\(expected\[\"attachments\"\]\)\)\n        \)",
    """        XCTAssertTrue(snapshot.attachments.isEmpty)\n        XCTAssertEqual(\n            try Self.jsonData(snapshot.attachments),\n            try Self.jsonData(try XCTUnwrap(expected[\"attachments\"]))\n        )""",
)
replace(
    ios_test,
    """        draft[valueFor: .ph] = \"\"\n        XCTAssertThrowsError(try draft.canonicalSnapshot())\n        draft[valueFor: .ph] = \"0\""" ,
    """        draft[valueFor: .ph] = \"\"\n        let withoutPH = try draft.canonicalSnapshot()\n        XCTAssertFalse(withoutPH.measurements.contains { $0.parameterCode == \"PH\" })\n        draft[valueFor: .ph] = \"0\""" ,
)
# Add explicit first-release requirement test before timezone test.
marker = "    @MainActor\n    func testEasternTimezoneAndDSTGoldenCases() throws {"
policy_test = """    @MainActor\n    func testFirstProductionPolicyRequiresOnlyWaterTemperature() throws {\n        for type in TestType.allCases {\n            let draft = completeDraft()\n            draft.testType = type\n            draft[valueFor: .ph] = \"\"\n            draft[valueFor: .dissolvedOxygen] = \"\"\n            draft[valueFor: .conductivity] = \"\"\n            XCTAssertEqual(draft.requiredMeasurements, [.temperature])\n            XCTAssertTrue(draft.productionProfileComplete)\n            XCTAssertNoThrow(try draft.canonicalSnapshot())\n        }\n    }\n\n"""
replace(ios_test, marker, policy_test + marker)

print('Phase 11 mobile remediation applied successfully.')
