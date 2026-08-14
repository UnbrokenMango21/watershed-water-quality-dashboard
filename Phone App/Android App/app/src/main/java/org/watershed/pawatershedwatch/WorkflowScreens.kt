package org.watershed.pawatershedwatch

import android.Manifest
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
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
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.LocationOff
import androidx.compose.material.icons.rounded.LocationOn
import androidx.compose.material.icons.rounded.MyLocation
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Science
import androidx.compose.material3.AlertDialog
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
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
                label = { FieldLabel("Collector", required = true) },
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
                FieldLabel("Test type", required = true, style = MaterialTheme.typography.titleLarge)
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
                        label = { FieldLabel("Describe test type", required = true) },
                        singleLine = false,
                        maxLines = 3,
                        shape = RoundedCornerShape(16.dp),
                    )
                }
                OutlinedTextField(
                    value = draft.method,
                    onValueChange = { value -> model.updateDraft { it.copy(method = value) } },
                    modifier = Modifier.fillMaxWidth(),
                    label = { FieldLabel("Collection / measurement method", required = true) },
                    minLines = 2,
                    shape = RoundedCornerShape(16.dp),
                )
                OutlinedTextField(
                    value = draft.instrument,
                    onValueChange = { value -> model.updateDraft { it.copy(instrument = value) } },
                    modifier = Modifier.fillMaxWidth(),
                    label = { FieldLabel(if (type == TestType.PennStateLab || type == TestType.ExternalLab) "Laboratory" else "Instrument or kit", required = true) },
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
    val optional = draft.optionalMeasurements
    val invalid = draft.values.any { (kind, value) -> measurementError(kind, value, draft.selectedUnit(kind)) != null }
    val canContinue = draft.requiredComplete && !invalid
    val ordered = remember(required, optional) { required + optional }
    val focusChain = rememberMeasurementFocusChain(ordered)
    val listState = rememberLazyListState()

    fun supported(kind: MeasurementKind) = ProductionMeasurementCatalog.spec(kind).support == ProductionSupport.FULLY_SUPPORTED
    fun nextFocus(kind: MeasurementKind): FocusRequester? =
        ordered.drop(ordered.indexOf(kind) + 1).firstOrNull(::supported)?.let(focusChain::get)

    val headerCount = if (required.isEmpty()) 3 else 2
    fun itemIndex(kind: MeasurementKind): Int? = when {
        required.contains(kind) -> headerCount + required.indexOf(kind)
        optional.contains(kind) -> headerCount + required.size + 1 + optional.indexOf(kind)
        else -> null
    }

    val focusTarget = model.measurementFocusTarget
    LaunchedEffect(focusTarget) {
        val kind = focusTarget ?: return@LaunchedEffect
        itemIndex(kind)?.let { index -> runCatching { listState.scrollToItem(index) } }
        withFrameNanos { }
        runCatching { focusChain[kind]?.requestFocus() }
        model.clearMeasurementFocus()
    }

    Scaffold(
        topBar = { FieldTopBar("Measurements", onBack) },
        bottomBar = { WorkflowFooter(4, "Notes", canContinue) { model.setStep(5); onNext() } },
    ) { padding ->
        LazyColumn(
            state = listState,
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
                    focusRequester = focusChain[kind],
                    nextFocusRequester = nextFocus(kind),
                    onValueChange = { model.setMeasurement(kind, it) },
                    onUnitChange = { unit, clear -> model.changeUnit(kind, unit, clear) },
                )
            }
            item { SectionHeading("Optional Measurements", "Always available when the field protocol calls for them") }
            items(optional, key = { "optional-${it.name}" }) { kind ->
                MeasurementEntry(
                    draft,
                    kind,
                    required = false,
                    enabled = supported(kind),
                    focusRequester = focusChain[kind],
                    nextFocusRequester = nextFocus(kind),
                    onValueChange = { model.setMeasurement(kind, it) },
                    onUnitChange = { unit, clear -> model.changeUnit(kind, unit, clear) },
                )
            }
            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

@Composable
fun NotesScreen(model: AppViewModel, onBack: () -> Unit, onNext: () -> Unit) {
    val draft = model.draft ?: return
    Scaffold(
        topBar = { FieldTopBar("Notes", onBack) },
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
            Spacer(Modifier.height(120.dp))
        }
    }
}

@Composable
fun ReviewScreen(model: AppViewModel, onBack: () -> Unit, onFix: (ReviewIssue) -> Unit, onSubmitted: (String) -> Unit) {
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
            if (issues.isNotEmpty()) ReviewIssuePanel(issues, onFix)
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
            ReviewSection("Notes") {
                KeyValueRow("Field notes", draft.notes.ifBlank { "None" })
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

/** Every blocking issue is tappable, so the fix is one step away instead of a scavenger hunt. */
@Composable
fun ReviewIssuePanel(issues: List<ReviewIssue>, onFix: (ReviewIssue) -> Unit) {
    Surface(color = MaterialTheme.colorScheme.error.copy(alpha = .1f), shape = RoundedCornerShape(18.dp)) {
        Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Rounded.ErrorOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                Text("Check required information", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.titleMedium)
            }
            issues.forEach { issue ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(issue.message, modifier = Modifier.weight(1f), color = MaterialTheme.colorScheme.onSurfaceVariant)
                    TextButton(
                        onClick = { onFix(issue) },
                        modifier = Modifier.semantics { contentDescription = "Fix: ${issue.message}" },
                    ) { Text("Fix") }
                }
            }
        }
    }
}

@Composable
private fun ReviewSection(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeading(title)
        FieldSurface { Column { content() } }
    }
}
