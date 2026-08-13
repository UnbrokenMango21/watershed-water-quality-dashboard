package org.watershed.pawatershedwatch

import android.Manifest
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.media.MediaRecorder
import android.os.Build
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.rounded.AddAPhoto
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.CameraAlt
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.Image
import androidx.compose.material.icons.rounded.LocationOff
import androidx.compose.material.icons.rounded.LocationOn
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material.icons.rounded.MyLocation
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Science
import androidx.compose.material.icons.rounded.StopCircle
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.File
import java.util.Locale

@Composable
fun VisitDetailsScreen(model: AppViewModel, onBack: () -> Unit, onNext: () -> Unit) {
    val draft = model.draft ?: return
    val context = LocalContext.current
    val focus = LocalFocusManager.current
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { results ->
        val coarse = results[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        val fine = results[Manifest.permission.ACCESS_FINE_LOCATION] == true
        if (coarse) {
            model.setGpsState(GpsState.Acquiring)
            captureCurrentLocation(context) { location ->
                if (location == null) model.setGpsState(GpsState.Unavailable)
                else model.setLocation(location.latitude, location.longitude, location.accuracy, approximateOnly = !fine)
            }
        } else model.setGpsState(GpsState.Denied)
    }

    fun requestLocation() {
        val coarse = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val fine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!coarse) {
            permissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
        } else {
            model.setGpsState(GpsState.Acquiring)
            captureCurrentLocation(context) { location ->
                if (location == null) model.setGpsState(GpsState.Unavailable)
                else model.setLocation(location.latitude, location.longitude, location.accuracy, approximateOnly = !fine)
            }
        }
    }

    LaunchedEffect(Unit) { requestLocation() }
    val canContinue = draft.collector.isNotBlank() && draft.latitude != null && draft.longitude != null && draft.accuracyMeters != null

    Scaffold(
        topBar = { FieldTopBar("Visit Details", onBack) },
        bottomBar = { WorkflowFooter(2, "Test and Method", canContinue) { focus.clearFocus(); model.setStep(3); onNext() } },
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).imePadding().padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            ScreenIntro("Step 2", "When and where?", "Location is captured automatically. Check its quality before moving on.")
            GpsPanel(draft, ::requestLocation, onSettings = { openAppSettings(context) })
            SectionHeading("Collection time")
            DateTimeControls(draft.collectedAt) { epoch -> model.updateDraft { it.copy(collectedAt = epoch) } }
            OutlinedTextField(
                value = draft.collector,
                onValueChange = { value -> model.updateDraft { it.copy(collector = value) } },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Collector") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { focus.clearFocus() }),
                shape = RoundedCornerShape(16.dp),
            )
            Spacer(Modifier.height(120.dp))
        }
    }
}

@Composable
private fun GpsPanel(draft: ObservationDraft, onReacquire: () -> Unit, onSettings: () -> Unit) {
    val color = when (draft.gpsState) {
        GpsState.Good -> Fern
        GpsState.Acquiring, GpsState.Approximate, GpsState.Poor -> Goldenrod
        GpsState.Denied, GpsState.Unavailable -> MaterialTheme.colorScheme.error
    }
    FieldSurface {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(42.dp).background(color.copy(alpha = .12f), CircleShape), contentAlignment = Alignment.Center) {
                    Icon(if (draft.gpsState == GpsState.Denied) Icons.Rounded.LocationOff else Icons.Rounded.LocationOn, contentDescription = null, tint = color)
                }
                Spacer(Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(draft.gpsState.label, color = color, style = MaterialTheme.typography.titleMedium)
                    Text(
                        when (draft.gpsState) {
                            GpsState.Acquiring -> "Looking for a current fix…"
                            GpsState.Good -> "±${draft.accuracyMeters?.toInt()} m · precise"
                            GpsState.Poor -> "±${draft.accuracyMeters?.toInt()} m · reacquire if possible"
                            GpsState.Approximate -> "Approximate location only · precise access improves the record"
                            GpsState.Denied -> "Allow location to attach a sampling position"
                            GpsState.Unavailable -> "No location fix is available. Move to open sky and try again."
                        },
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (draft.latitude != null && draft.longitude != null) {
                Text(String.format(Locale.US, "%.5f, %.5f", draft.latitude, draft.longitude), style = MaterialTheme.typography.titleMedium)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onReacquire, modifier = Modifier.height(48.dp)) {
                    Icon(Icons.Rounded.MyLocation, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text(if (draft.gpsState == GpsState.Acquiring) "Reacquiring" else "Reacquire GPS")
                }
                if (draft.gpsState == GpsState.Denied) TextButton(onClick = onSettings) { Text("Settings") }
            }
        }
    }
}

@Composable
private fun DateTimeControls(epoch: Long, onChange: (Long) -> Unit) {
    val context = LocalContext.current
    val eastern = remember(epoch) { EasternTime.display(epoch) }
    val dateText = remember(epoch) {
        java.text.DateFormat.getDateInstance(java.text.DateFormat.MEDIUM).apply {
            timeZone = java.util.TimeZone.getTimeZone(EasternTime.zone)
        }.format(java.util.Date(epoch))
    }
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        OutlinedButton(
            modifier = Modifier.weight(1f).height(56.dp),
            onClick = {
                DatePickerDialog(context, { _, year, month, day ->
                    onChange(EasternTime.replaceDate(epoch, year, month + 1, day))
                }, eastern.year, eastern.monthValue - 1, eastern.dayOfMonth).show()
            },
        ) {
            Icon(Icons.Rounded.CalendarMonth, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text(dateText)
        }
        OutlinedButton(
            modifier = Modifier.weight(1f).height(56.dp),
            onClick = {
                TimePickerDialog(context, { _, hour, minute ->
                    onChange(EasternTime.replaceTime(epoch, hour, minute))
                }, eastern.hour, eastern.minute, false).show()
            },
        ) {
            Icon(Icons.Rounded.Schedule, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text(eastern.format(java.time.format.DateTimeFormatter.ofPattern("h:mm a", Locale.US)))
        }
    }
}

@Composable
fun TestMethodScreen(model: AppViewModel, onBack: () -> Unit, onNext: () -> Unit) {
    val draft = model.draft ?: return
    val focus = LocalFocusManager.current
    val canContinue = draft.testType != null && draft.method.isNotBlank() && draft.instrument.isNotBlank() &&
        (draft.testType != TestType.Other || draft.testTypeOther.isNotBlank())
    Scaffold(
        topBar = { FieldTopBar("Test and Method", onBack) },
        bottomBar = { WorkflowFooter(3, "Enter Measurements", canContinue) { focus.clearFocus(); model.setStep(4); onNext() } },
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).imePadding().padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            ScreenIntro("Step 3", "How are you testing?", "This choice shapes which measurements are required next.")
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                TestType.entries.forEach { type ->
                    Surface(
                        modifier = Modifier.fillMaxWidth().clickable { model.selectTestType(type) },
                        shape = RoundedCornerShape(16.dp),
                        color = if (draft.testType == type) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
                    ) {
                        Row(modifier = Modifier.padding(horizontal = 10.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(selected = draft.testType == type, onClick = { model.selectTestType(type) })
                            Text(type.label, modifier = Modifier.weight(1f), style = MaterialTheme.typography.titleMedium)
                        }
                    }
                }
            }
            draft.testType?.let { type ->
                if (type == TestType.Other) {
                    OutlinedTextField(
                        value = draft.testTypeOther,
                        onValueChange = { value -> model.updateDraft { it.copy(testTypeOther = value) } },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text("Describe test type · Required") },
                        singleLine = false,
                        maxLines = 3,
                        shape = RoundedCornerShape(16.dp),
                    )
                }
                OutlinedTextField(
                    value = draft.method,
                    onValueChange = { value -> model.updateDraft { it.copy(method = value) } },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Collection / measurement method") },
                    minLines = 2,
                    shape = RoundedCornerShape(16.dp),
                )
                OutlinedTextField(
                    value = draft.instrument,
                    onValueChange = { value -> model.updateDraft { it.copy(instrument = value) } },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text(if (type == TestType.PennStateLab || type == TestType.ExternalLab) "Laboratory" else "Instrument or kit") },
                    minLines = 1,
                    maxLines = 3,
                    shape = RoundedCornerShape(16.dp),
                )
                if (type in listOf(TestType.PennStateLab, TestType.ExternalLab, TestType.Mixed)) {
                    FieldSurface {
                        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text("Lab results pending", style = MaterialTheme.typography.titleMedium)
                                    Text("Record requested analyses now; add results in a later revision.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                Switch(
                                    checked = draft.labResultsPending,
                                    onCheckedChange = { pending -> model.updateDraft { it.copy(labResultsPending = pending) } },
                                )
                            }
                            if (draft.labResultsPending) {
                                Text("Requested analyses", color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.labelLarge)
                                listOf(MeasurementKind.Chloride, MeasurementKind.Nitrate, MeasurementKind.Phosphate, MeasurementKind.Sulfate).forEach { kind ->
                                    Row(
                                        modifier = Modifier.fillMaxWidth().clickable {
                                            model.updateDraft {
                                                val next = if (kind in it.requestedAnalytes) it.requestedAnalytes - kind else it.requestedAnalytes + kind
                                                it.copy(requestedAnalytes = next)
                                            }
                                        },
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) {
                                        Checkbox(checked = kind in draft.requestedAnalytes, onCheckedChange = null)
                                        Text(kind.title)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Spacer(Modifier.height(120.dp))
        }
    }
}

@Composable
fun MeasurementsScreen(model: AppViewModel, onBack: () -> Unit, onNext: () -> Unit) {
    val draft = model.draft ?: return
    val required = draft.requiredMeasurements
    val invalid = draft.values.any { (kind, value) -> measurementError(kind, value) != null }
    val canContinue = draft.requiredComplete && !invalid
    Scaffold(
        topBar = { FieldTopBar("Measurements", onBack) },
        bottomBar = { WorkflowFooter(4, "Notes and Media", canContinue) { model.setStep(5); onNext() } },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).imePadding(),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                ScreenIntro(
                    "Step 4",
                    "Enter readings",
                    "${draft.completedRequiredCount} of ${required.size} required complete · tap any unit to change it",
                )
            }
            item { SectionHeading("Required Measurements", "Complete these for ${draft.testType?.label ?: "this test"}") }
            if (required.isEmpty()) {
                item {
                    StatusPanel("No readings required yet", "Requested lab analyses are pending. Optional field observations can still be added below.", Water, Icons.Rounded.Science)
                }
            }
            items(required, key = { "required-${it.name}" }) { kind ->
                MeasurementEntry(
                    draft,
                    kind,
                    required = true,
                    onValueChange = { model.setMeasurement(kind, it) },
                    onUnitChange = { unit, clear -> model.changeUnit(kind, unit, clear) },
                )
            }
            item { SectionHeading("Optional Measurements", "Always available when the field protocol calls for them") }
            items(draft.optionalMeasurements, key = { "optional-${it.name}" }) { kind ->
                val supported = ProductionMeasurementCatalog.spec(kind).support == ProductionSupport.FULLY_SUPPORTED
                MeasurementEntry(
                    draft,
                    kind,
                    required = false,
                    enabled = supported,
                    onValueChange = { model.setMeasurement(kind, it) },
                    onUnitChange = { unit, clear -> model.changeUnit(kind, unit, clear) },
                )
            }
            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

@Composable
fun NotesMediaScreen(model: AppViewModel, onBack: () -> Unit, onNext: () -> Unit) {
    val draft = model.draft ?: return
    val context = LocalContext.current
    var permissionMessage by remember { mutableStateOf<String?>(null) }
    var pendingCamera by remember { mutableStateOf<ObservationAttachment?>(null) }
    var pendingAudio by remember { mutableStateOf<ObservationAttachment?>(null) }
    var recorder by remember { mutableStateOf<MediaRecorder?>(null) }
    val photoPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(5)) { uris ->
        if (uris.isNotEmpty()) model.importPhotos(uris)
    }
    val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { captured ->
        val attachment = pendingCamera
        pendingCamera = null
        if (captured && attachment != null) model.completePreparedAttachment(attachment)
        else model.discardPreparedAttachment(attachment)
    }
    val launchCamera = {
        model.prepareCameraPhoto()?.let { attachment ->
            pendingCamera = attachment
            camera.launch(FileProvider.getUriForFile(context, "${context.packageName}.files", File(attachment.localPath)))
        }
    }
    val cameraPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) launchCamera() else permissionMessage = "Allow camera access in Settings to take a field photo. You can still choose existing photos without this permission."
    }
    val startRecording = {
        val attachment = model.prepareAudioNote()
        if (attachment != null) {
            try {
                @Suppress("DEPRECATION")
                val active = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) MediaRecorder(context) else MediaRecorder()
                active.setAudioSource(MediaRecorder.AudioSource.MIC)
                active.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                active.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                active.setAudioSamplingRate(44_100)
                active.setAudioEncodingBitRate(128_000)
                active.setOutputFile(attachment.localPath)
                active.prepare()
                active.start()
                pendingAudio = attachment
                recorder = active
            } catch (_: Exception) {
                model.discardPreparedAttachment(attachment)
                permissionMessage = "The audio note could not start. Check microphone access and available storage."
            }
        }
    }
    val micPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) startRecording() else permissionMessage = "Allow microphone access in Settings to record an audio field note."
    }
    val stopRecording = {
        val active = recorder
        val attachment = pendingAudio
        recorder = null
        pendingAudio = null
        try {
            active?.stop()
            active?.release()
            if (attachment != null) model.completePreparedAttachment(attachment)
        } catch (_: Exception) {
            active?.release()
            model.discardPreparedAttachment(attachment)
            permissionMessage = "The audio note was too short or could not be saved. Please record it again."
        }
    }
    DisposableEffect(Unit) {
        onDispose {
            recorder?.release()
            model.discardPreparedAttachment(pendingCamera)
            model.discardPreparedAttachment(pendingAudio)
        }
    }
    Scaffold(
        topBar = { FieldTopBar("Notes and Media", onBack) },
        bottomBar = { WorkflowFooter(5, "Review Observation") { model.setStep(6); onNext() } },
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).imePadding().padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            ScreenIntro("Step 5", "Add field context", "Record what a measurement alone cannot explain.")
            OutlinedTextField(
                value = draft.notes,
                onValueChange = { value -> model.updateDraft { it.copy(notes = value) } },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Field notes") },
                placeholder = { Text("Weather, flow conditions, sample appearance, access notes…") },
                minLines = 5,
                shape = RoundedCornerShape(16.dp),
            )
            SectionHeading("Photos", if (draft.photoCount == 0) "Optional" else "${draft.photoCount} attached")
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedButton(
                    onClick = { photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                    modifier = Modifier.weight(1f).height(56.dp),
                ) {
                    Icon(Icons.Rounded.Image, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Choose Photos")
                }
                OutlinedButton(
                    onClick = {
                        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) launchCamera()
                        else cameraPermission.launch(Manifest.permission.CAMERA)
                    },
                    modifier = Modifier.weight(1f).height(56.dp),
                ) {
                    Icon(Icons.Rounded.CameraAlt, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Take Photo")
                }
            }
            if (draft.photoCount > 0) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    repeat(draft.photoCount.coerceAtMost(4)) {
                        Box(Modifier.size(66.dp).background(MaterialTheme.colorScheme.secondaryContainer, RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
                            Icon(Icons.Rounded.Image, contentDescription = "Field photo ${it + 1}", tint = MaterialTheme.colorScheme.secondary)
                        }
                    }
                }
            }
            SectionHeading("Audio note", "Optional · one recording")
            when {
                recorder != null -> Button(onClick = stopRecording, modifier = Modifier.fillMaxWidth().height(56.dp)) {
                    Icon(Icons.Rounded.StopCircle, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Stop and Save Recording")
                }
                draft.hasAudio -> StatusPanel("Audio note saved", "The recording is stored with this local draft.", Fern, Icons.Rounded.Mic)
                else -> OutlinedButton(
                    onClick = {
                        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) startRecording()
                        else micPermission.launch(Manifest.permission.RECORD_AUDIO)
                    },
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                ) {
                    Icon(Icons.Rounded.Mic, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Record Audio Note")
                }
            }
            Spacer(Modifier.height(120.dp))
        }
    }
    permissionMessage?.let { message ->
        AlertDialog(
            onDismissRequest = { permissionMessage = null },
            title = { Text("Permission needed") },
            text = { Text(message) },
            confirmButton = { TextButton(onClick = { permissionMessage = null; openAppSettings(context) }) { Text("Open Settings") } },
            dismissButton = { TextButton(onClick = { permissionMessage = null }) { Text("Not Now") } },
        )
    }
}

@Composable
fun ReviewScreen(model: AppViewModel, onBack: () -> Unit, onSubmitted: (String) -> Unit) {
    val draft = model.draft ?: return
    val site = model.selectedSite()
    val issues = model.reviewIssues()
    var confirm by remember { mutableStateOf(false) }
    Scaffold(
        topBar = { FieldTopBar("Review", onBack) },
        bottomBar = {
            Surface(shadowElevation = 10.dp) {
                Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Rounded.Check, contentDescription = null, tint = Fern)
                        Spacer(Modifier.width(8.dp))
                        Text("Saved locally · Step 6 of 6", color = Fern, modifier = Modifier.weight(1f))
                    }
                    PrimaryAction("Submit Observation", onClick = { confirm = true }, enabled = issues.isEmpty())
                }
            }
        },
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            ScreenIntro("Step 6", "Ready to submit?", "Only entered measurements are included. A submitted scientific record can only change through a new revision.")
            if (issues.isNotEmpty()) StatusPanel("Check required information", issues.joinToString("\n") { "• $it" }, MaterialTheme.colorScheme.error, Icons.Rounded.ErrorOutline)
            ReviewSection("Site and visit") {
                KeyValueRow("Sampling site", site?.name ?: "Not selected")
                KeyValueRow("Collected", formatDateTime(draft.collectedAt))
                KeyValueRow("Position", if (draft.latitude == null) "Not captured" else String.format(Locale.US, "%.5f, %.5f · ±%d m", draft.latitude, draft.longitude, draft.accuracyMeters?.toInt()))
                KeyValueRow("Collector", draft.collector)
            }
            ReviewSection("Test and method") {
                KeyValueRow("Test type", draft.testType?.label ?: "Not selected")
                KeyValueRow("Method", draft.method)
                if (draft.instrument.isNotBlank()) KeyValueRow("Instrument or lab", draft.instrument)
            }
            ReviewSection("Measurements") {
                MeasurementKind.entries.forEach { kind ->
                    draft.values[kind]?.takeIf(String::isNotBlank)?.let { raw ->
                        KeyValueRow(kind.title, displayMeasurement(MeasurementValue(kind, raw, draft.selectedUnit(kind).id)))
                    }
                }
                if (draft.values.values.none { it.isNotBlank() }) Text("No measurements entered", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            ReviewSection("Notes and media") {
                KeyValueRow("Field notes", draft.notes.ifBlank { "None" })
                KeyValueRow("Photos", draft.photoCount.toString())
                KeyValueRow("Audio note", if (draft.hasAudio) "Attached" else "None")
            }
            Spacer(Modifier.height(120.dp))
        }
    }

    if (confirm) {
        AlertDialog(
            onDismissRequest = { confirm = false },
            title = { Text("Submit this observation?") },
            text = {
                Text(
                    if (model.connection == ConnectionState.Online) "It will be locked as Revision 1 and sent to the archive."
                    else "It will be locked as Revision 1 and saved on this phone. The archive will not be confirmed until sync succeeds."
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    confirm = false
                    model.submit { id -> id?.let(onSubmitted) }
                }) { Text("Submit") }
            },
            dismissButton = { TextButton(onClick = { confirm = false }) { Text("Keep Reviewing") } },
        )
    }
}

@Composable
private fun ReviewSection(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeading(title)
        FieldSurface { Column { content() } }
    }
}
