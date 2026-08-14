package org.watershed.pawatershedwatch

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.CloudDone
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.History
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Sync
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import java.util.Locale

private enum class RecentFilter(val label: String) { All("All"), Attention("Needs attention"), OnDevice("On device") }

@Composable
fun RecentScreen(model: AppViewModel, onRecord: (String) -> Unit) {
    var search by remember { mutableStateOf("") }
    var filter by remember { mutableStateOf(RecentFilter.All) }
    val visible = model.records.filter { record ->
        val filterMatch = when (filter) {
            RecentFilter.All -> true
            RecentFilter.Attention -> record.workflow == WorkflowState.NeedsCorrection || record.sync == SyncState.Failed
            RecentFilter.OnDevice -> record.sync != SyncState.Synced
        }
        val searchMatch = search.isBlank() || record.site.name.contains(search, true) || record.site.county.contains(search, true)
        filterMatch && searchMatch
    }
    Column(
        modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp).padding(top = 20.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        ScreenIntro("Field archive", "Recent Observations", "Workflow status and sync confirmation are shown separately.")
        OutlinedTextField(
            value = search,
            onValueChange = { search = it },
            modifier = Modifier.fillMaxWidth(),
            leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
            label = { Text("Search site or county") },
            singleLine = true,
            shape = RoundedCornerShape(16.dp),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            RecentFilter.entries.forEach { option ->
                FilterChip(selected = filter == option, onClick = { filter = option }, label = { Text(option.label) })
            }
        }
        if (visible.isEmpty()) {
            StatusPanel("No observations", if (filter == RecentFilter.All) "Start a field observation from Home." else "No records match this filter.", Water, Icons.Rounded.Search)
        } else {
            Column(modifier = Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                visible.forEach { record -> RecordRow(record) { onRecord(record.id) } }
                Spacer(Modifier.height(80.dp))
            }
        }
    }
}

@Composable
private fun RecordRow(record: ObservationRecord, onClick: () -> Unit) {
    Surface(modifier = Modifier.fillMaxWidth().clickable(onClick = onClick), shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.surface) {
        Row(modifier = Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
            Box(Modifier.size(42.dp).background(MaterialTheme.colorScheme.secondaryContainer, CircleShape), contentAlignment = Alignment.Center) {
                Text(record.revision.toString(), color = MaterialTheme.colorScheme.secondary, fontWeight = FontWeight.Bold)
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                Text(record.site.name, style = MaterialTheme.typography.titleMedium)
                Text("${formatDateTime(record.collectedAt)} · ${record.testType.label}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    WorkflowPill(record.workflow)
                    SyncPill(record.sync)
                }
            }
        }
    }
}

@Composable
fun ObservationDetailScreen(model: AppViewModel, recordId: String, onBack: () -> Unit, onCorrection: () -> Unit) {
    val record = model.record(recordId) ?: return
    Scaffold(
        topBar = { FieldTopBar("Observation Detail", onBack) },
        bottomBar = {
            if (record.workflow == WorkflowState.NeedsCorrection) {
                Surface(shadowElevation = 10.dp) {
                    Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                        PrimaryAction("Create Correction Revision", onClick = {
                            model.startCorrection(record.id) { ready -> if (ready) onCorrection() }
                        })
                        Row(modifier = Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Rounded.Lock, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Revision ${record.revision} remains unchanged", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        },
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            Text(record.site.name, style = MaterialTheme.typography.headlineMedium)
            Text("Revision ${record.revision} · ${formatDateTime(record.collectedAt)}", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                WorkflowPill(record.workflow)
                SyncPill(record.sync)
            }
            record.correctionReason?.takeIf { record.workflow == WorkflowState.NeedsCorrection }?.let {
                StatusPanel("Correction requested", it, Goldenrod, Icons.Rounded.ErrorOutline)
            }
            if (record.workflow == WorkflowState.Validating) {
                StatusPanel("Validation in progress", "The archive confirmed this revision. Automated scientific checks are running.", Water, Icons.Rounded.Schedule)
            }
            record.validation?.let { validation ->
                DetailSection("Validation") {
                    KeyValueRow("Errors", validation.errorCount.toString())
                    KeyValueRow("Warnings", validation.warningCount.toString())
                    KeyValueRow("Information", validation.infoCount.toString())
                    validation.overallQualityScore?.let { KeyValueRow("Data confidence score", String.format(Locale.US, "%.0f / 100", it)) }
                    record.validationFlags.forEach { flag ->
                        Column(Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                            Text(flag.severity.replace('_', ' '), color = if (flag.severity == "ERROR") MaterialTheme.colorScheme.error else Goldenrod, style = MaterialTheme.typography.labelLarge)
                            Text(flag.message)
                        }
                    }
                }
            }
            if (record.sync == SyncState.Failed || record.sync == SyncState.Waiting) {
                StatusPanel(
                    if (record.sync == SyncState.Failed) "Sync failed" else "Waiting to sync",
                    "This record remains safely on this phone. Retry when the archive is available.",
                    if (record.sync == SyncState.Failed) MaterialTheme.colorScheme.error else Goldenrod,
                    Icons.Rounded.CloudOff,
                )
                PrimaryAction("Retry Sync", onClick = { model.retrySync(record.id) }, icon = Icons.Rounded.Refresh)
            }
            DetailSection("Measurements") {
                record.measurements.forEach { value -> KeyValueRow(value.kind.title, displayMeasurement(value)) }
            }
            DetailSection("Test and method") {
                KeyValueRow("Test type", record.testType.label)
                KeyValueRow("Method", record.method)
                if (record.instrument.isNotBlank()) KeyValueRow("Instrument or lab", record.instrument)
                if (record.testType in setOf(TestType.PennStateLab, TestType.ExternalLab, TestType.Mixed)) {
                    KeyValueRow("Lab results", if (record.labResultsPending) "Pending" else "Entered")
                    if (record.requestedAnalytes.isNotEmpty()) KeyValueRow("Requested analyses", record.requestedAnalytes.joinToString { it.title })
                }
            }
            DetailSection("Visit") {
                val position = if (record.latitude != null && record.longitude != null) {
                    String.format(Locale.US, "%.5f, %.5f%s", record.latitude, record.longitude, record.accuracyMeters?.let { " · ±${it.toInt()} m" }.orEmpty())
                } else "Not captured"
                KeyValueRow("Position", position)
                KeyValueRow("Collected", formatDateTime(record.collectedAt))
                KeyValueRow("Collector", record.collector)
            }
            DetailSection("Notes") {
                KeyValueRow("Notes", record.notes.ifBlank { "None" })
            }
            DetailSection("Revision history") {
                record.revisions.asReversed().forEach { revision ->
                    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top) {
                        Icon(if (revision.number == record.revision) Icons.Rounded.CheckCircle else Icons.Rounded.History, contentDescription = null, tint = if (revision.number == record.revision) Fern else MaterialTheme.colorScheme.outline)
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Revision ${revision.number}${if (revision.number == record.revision) " · Current" else ""}", style = MaterialTheme.typography.titleMedium)
                            Text("${revision.state.label} · ${formatDateTime(revision.createdAt)}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(revision.note, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
            Spacer(Modifier.height(120.dp))
        }
    }
}

@Composable
private fun DetailSection(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeading(title)
        FieldSurface { Column { content() } }
    }
}

@Composable
fun CorrectionRevisionScreen(model: AppViewModel, recordId: String, onBack: () -> Unit, onResubmitted: (String) -> Unit) {
    val draft = model.draft ?: return
    val source = model.record(recordId) ?: return
    var confirm by remember { mutableStateOf(false) }
    val canSubmit = model.reviewIssues().isEmpty()
    val correctionKinds = remember(source.measurements) { source.measurements.map(MeasurementValue::kind) }
    val correctionFocus = rememberMeasurementFocusChain(correctionKinds)
    Scaffold(
        topBar = { FieldTopBar("Correction Revision", onBack) },
        bottomBar = {
            Surface(shadowElevation = 10.dp) {
                Column(modifier = Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    PrimaryAction("Resubmit Revision ${source.revision + 1}", enabled = canSubmit, onClick = { confirm = true })
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Rounded.Lock, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Revision ${source.revision} retained", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        },
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).imePadding().padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(18.dp),
        ) {
            ScreenIntro("Revision ${source.revision + 1}", "Correct the scientific record", "This creates a new revision based on Revision ${source.revision}; the submitted source is never overwritten.")
            draft.correctionReason?.let { StatusPanel("Reviewer request", it, Goldenrod, Icons.Rounded.ErrorOutline) }
            DetailSection("Original value retained") {
                source.measurements.firstOrNull { it.kind == MeasurementKind.DissolvedOxygen }?.let {
                    KeyValueRow("Revision ${source.revision} · Dissolved Oxygen", displayMeasurement(it))
                }
            }
            SectionHeading("Corrected measurements", "Edit only what the source check confirms")
            source.measurements.forEachIndexed { index, original ->
                MeasurementEntry(
                    draft = draft,
                    kind = original.kind,
                    required = original.kind in draft.requiredMeasurements,
                    focusRequester = correctionFocus[original.kind],
                    nextFocusRequester = correctionKinds.getOrNull(index + 1)?.let(correctionFocus::get),
                    onValueChange = { model.setMeasurement(original.kind, it) },
                    onUnitChange = { unit, clear -> model.changeUnit(original.kind, unit, clear) },
                )
            }
            OutlinedTextField(
                value = draft.revisionNote,
                onValueChange = { value -> model.updateDraft { it.copy(revisionNote = value) } },
                modifier = Modifier.fillMaxWidth(),
                label = { FieldLabel("Source-check note", required = true) },
                placeholder = { Text("What changed, and what source did you verify?") },
                minLines = 4,
                isError = draft.revisionNote.isBlank(),
                supportingText = { if (draft.revisionNote.isBlank()) Text("Explain the correction before resubmitting.") },
                shape = RoundedCornerShape(16.dp),
            )
            Spacer(Modifier.height(120.dp))
        }
    }
    if (confirm) {
        AlertDialog(
            onDismissRequest = { confirm = false },
            title = { Text("Resubmit Revision ${source.revision + 1}?") },
            text = { Text("Revision ${source.revision} remains in the record history. The new revision will have its own workflow and sync status.") },
            confirmButton = {
                TextButton(onClick = {
                    confirm = false
                    model.resubmitCorrection { id -> id?.let(onResubmitted) }
                }) { Text("Resubmit") }
            },
            dismissButton = { TextButton(onClick = { confirm = false }) { Text("Keep Editing") } },
        )
    }
}

@Composable
fun SubmissionStatusScreen(model: AppViewModel, recordId: String, onHome: () -> Unit, onDetail: () -> Unit) {
    val record = model.record(recordId) ?: return
    val (title, body) = when (record.sync) {
        SyncState.Synced -> "In the Archive" to "The archive confirmed this revision."
        SyncState.Syncing -> "Sending to the Archive" to "The record is locked on this phone while confirmation is pending."
        SyncState.Waiting, SyncState.SavedLocally -> "Saved on This Phone" to "Waiting for a connection. The archive has not confirmed receipt."
        SyncState.Failed -> "Sync Didn't Finish" to "The record remains safe on this phone. The archive has not confirmed receipt."
    }
    val icon = when (record.sync) {
        SyncState.Synced -> Icons.Rounded.CloudDone
        SyncState.Syncing -> Icons.Rounded.Sync
        SyncState.Waiting, SyncState.SavedLocally -> Icons.Rounded.Schedule
        SyncState.Failed -> Icons.Rounded.CloudOff
    }
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Box(Modifier.size(88.dp).background(MaterialTheme.colorScheme.primaryContainer, CircleShape), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(44.dp))
        }
        Text(title, style = MaterialTheme.typography.headlineMedium)
        Text(body, color = MaterialTheme.colorScheme.onSurfaceVariant)
        FieldSurface {
            Column {
                KeyValueRow("Sampling site", record.site.name)
                KeyValueRow("Record state", record.workflow.label)
                KeyValueRow("Revision", record.revision.toString())
                KeyValueRow("Saved on device", "Confirmed")
                KeyValueRow("Archive", if (record.sync == SyncState.Synced) "Confirmed" else "Not confirmed")
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            WorkflowPill(record.workflow)
            SyncPill(record.sync)
        }
        if (record.sync == SyncState.Failed || record.sync == SyncState.Waiting) {
            PrimaryAction("Retry Sync", onClick = { model.retrySync(record.id) }, icon = Icons.Rounded.Refresh)
        }
        PrimaryAction("View Observation", onClick = onDetail)
        TextButton(onClick = onHome) { Text("Return Home") }
    }
}
