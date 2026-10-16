package org.watershed.pawatershedwatch

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Cancel
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.EditLocationAlt
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.HourglassTop
import androidx.compose.material.icons.rounded.LocationOff
import androidx.compose.material.icons.rounded.MyLocation
import androidx.compose.material.icons.rounded.Verified
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import java.util.Locale

private enum class FixState { Idle, Acquiring, Captured, Denied, Unavailable }

/**
 * Collector coordinate proposals: a NEW_SITE or a COORDINATE_CORRECTION for an approved site, from
 * the current GPS fix, with a required reason. The site catalog is never edited here; a reviewer
 * decides in the QC Console. Below the form, the collector's own proposals and their status.
 */
@Composable
fun SiteProposalsScreen(model: AppViewModel, onBack: () -> Unit) {
    val context = LocalContext.current
    val draftSiteId = model.draft?.siteId
    var kind by rememberSaveable { mutableStateOf(if (draftSiteId != null) ProposalKind.CoordinateCorrection else ProposalKind.NewSite) }
    var siteId by rememberSaveable { mutableStateOf(draftSiteId) }
    var latitude by rememberSaveable { mutableStateOf<Double?>(null) }
    var longitude by rememberSaveable { mutableStateOf<Double?>(null) }
    var accuracy by rememberSaveable { mutableStateOf<Double?>(null) }
    var fixState by rememberSaveable { mutableStateOf(FixState.Idle) }
    var siteName by rememberSaveable { mutableStateOf("") }
    var reason by rememberSaveable { mutableStateOf("") }
    val site = model.sites.firstOrNull { it.id == siteId }

    fun capture() {
        fixState = FixState.Acquiring
        captureCurrentLocation(context) { location ->
            if (location == null) {
                fixState = FixState.Unavailable
            } else {
                latitude = location.latitude
                longitude = location.longitude
                accuracy = if (location.hasAccuracy()) location.accuracy.toDouble() else null
                fixState = FixState.Captured
            }
        }
    }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { results ->
        if (results[Manifest.permission.ACCESS_COARSE_LOCATION] == true) capture() else fixState = FixState.Denied
    }
    fun requestFix() {
        val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (granted) capture() else permission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
    }

    LaunchedEffect(Unit) { model.clearProposalFeedback(); model.observeProposals() }
    DisposableEffect(Unit) { onDispose { model.stopProposals() } }

    Scaffold(topBar = { FieldTopBar("Site Coordinates", onBack) }) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).imePadding().padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            ScreenIntro("Site coordinates", "Propose a site or a fix", "A reviewer checks every proposal. Approved site coordinates change only after review.")
            FieldSurface {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    FieldLabel("Proposal type", required = true, style = MaterialTheme.typography.titleMedium)
                    Column(Modifier.selectableGroup()) {
                        ProposalKind.entries.forEach { option ->
                            Row(
                                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp)
                                    .selectable(selected = kind == option, role = Role.RadioButton, onClick = { kind = option; model.clearProposalFeedback() }),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                RadioButton(selected = kind == option, onClick = null)
                                Spacer(Modifier.width(8.dp))
                                Text(if (option == ProposalKind.NewSite) "Propose a new monitoring site" else "Correct an approved site's coordinates")
                            }
                        }
                    }
                    if (kind == ProposalKind.CoordinateCorrection) {
                        SitePicker(model.sites, site) { siteId = it.id }
                        site?.let { CoordinateValue("Current approved", Coordinates(it.latitude, it.longitude), null, approved = true) }
                    } else {
                        OutlinedTextField(
                            value = siteName,
                            onValueChange = { if (it.length <= 160) siteName = it },
                            modifier = Modifier.fillMaxWidth(),
                            label = { FieldLabel("Proposed site name", required = true) },
                            singleLine = true,
                            shape = RoundedCornerShape(16.dp),
                        )
                    }

                    FieldLabel("Current GPS position", required = true, style = MaterialTheme.typography.titleSmall)
                    val capturedLatitude = latitude
                    val capturedLongitude = longitude
                    when {
                        fixState == FixState.Acquiring -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                            Text("Looking for a current fix…")
                        }
                        fixState == FixState.Denied -> StatusPanel("Location denied", "Allow location access to propose coordinates.", MaterialTheme.colorScheme.error, Icons.Rounded.LocationOff)
                        fixState == FixState.Unavailable -> StatusPanel("No location fix", "Move to open sky and try again.", MaterialTheme.colorScheme.error, Icons.Rounded.LocationOff)
                        capturedLatitude != null && capturedLongitude != null ->
                            CoordinateValue("Proposed", Coordinates(capturedLatitude, capturedLongitude), accuracy, approved = false)
                        else -> Text("Stand at the monitoring site, then capture the position.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    OutlinedButton(onClick = ::requestFix, enabled = fixState != FixState.Acquiring, modifier = Modifier.heightIn(min = 48.dp)) {
                        Icon(Icons.Rounded.MyLocation, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text(if (latitude == null) "Use Current GPS" else "Recapture GPS")
                    }

                    OutlinedTextField(
                        value = reason,
                        onValueChange = { if (it.length <= 1000) reason = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { FieldLabel("Reason", required = true) },
                        placeholder = { Text("What is wrong with the current location, or why is a new site needed?") },
                        minLines = 3,
                        supportingText = { Text("${reason.length} / 1000 · at least 5 characters") },
                        shape = RoundedCornerShape(16.dp),
                    )
                    model.proposalError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    model.proposalConfirmation?.let { StatusPanel("Proposal sent", it, Fern, Icons.Rounded.CheckCircle) }
                    if (model.connection != ConnectionState.Online) {
                        Text("Proposals need a connection. Your entries stay on this screen.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    PrimaryAction(
                        if (model.submittingProposal) "Sending…" else "Send Proposal",
                        enabled = !model.submittingProposal,
                        icon = Icons.Rounded.EditLocationAlt,
                        onClick = {
                            model.submitProposal(kind, siteId, latitude, longitude, accuracy, reason, siteName) {
                                reason = ""
                                siteName = ""
                            }
                        },
                    )
                }
            }

            SectionHeading("My proposals", "Only you and reviewers can see these")
            when {
                model.proposalsLoading -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                    Text("Loading your proposals…")
                }
                model.proposalsError != null -> StatusPanel("Proposals unavailable", model.proposalsError.orEmpty(), MaterialTheme.colorScheme.error, Icons.Rounded.ErrorOutline)
                model.proposals.isEmpty() -> StatusPanel("No proposals yet", "Proposals you send appear here with their review status.", Water, Icons.Rounded.EditLocationAlt)
                else -> model.proposals.forEach { proposal -> ProposalRow(proposal, model.sites.firstOrNull { it.id == proposal.siteId }) }
            }
            Spacer(Modifier.height(48.dp))
        }
    }
}

@Composable
private fun SitePicker(sites: List<Site>, selected: Site?, onSelect: (Site) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        OutlinedButton(
            onClick = { expanded = true },
            enabled = sites.isNotEmpty(),
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
        ) { Text("Site: ${selected?.name ?: if (sites.isEmpty()) "No approved sites cached" else "Choose…"}") }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            sites.forEach { site -> DropdownMenuItem(text = { Text(site.name) }, onClick = { onSelect(site); expanded = false }) }
        }
    }
}

/** "Proposed" and "Current approved" are told apart by label, icon and shape, not color alone. */
@Composable
private fun CoordinateValue(label: String, value: Coordinates, accuracy: Double?, approved: Boolean) {
    val color = if (approved) Fern else MaterialTheme.colorScheme.primary
    val accuracyText = if (approved) "" else accuracy?.let { String.format(Locale.US, " · ±%.0f m", it) } ?: " · accuracy unknown"
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (approved) Modifier.border(1.dp, color.copy(alpha = .6f), RoundedCornerShape(12.dp)) else Modifier.background(color.copy(alpha = .1f), RoundedCornerShape(12.dp)))
            .padding(12.dp)
            .semantics(mergeDescendants = true) { contentDescription = "$label coordinates ${value.display}$accuracyText" },
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(if (approved) Icons.Rounded.Verified else Icons.Rounded.EditLocationAlt, contentDescription = null, tint = color)
        Column {
            Text(label, color = color, style = MaterialTheme.typography.labelLarge)
            Text("${value.display}$accuracyText", style = MaterialTheme.typography.bodyLarge)
        }
    }
}

@Composable
private fun ProposalRow(proposal: CoordinateProposal, site: Site?) {
    val (icon, color) = proposalStatusStyle(proposal.status)
    Surface(shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.surface, tonalElevation = 1.dp, modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(proposal.kind.label, color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.labelLarge)
                    Text(proposal.proposedSiteName ?: site?.name ?: proposal.siteId.orEmpty(), style = MaterialTheme.typography.titleMedium)
                }
                Row(
                    modifier = Modifier.background(color.copy(alpha = .12f), CircleShape).padding(horizontal = 10.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(16.dp))
                    Text(proposal.status.label, color = color, style = MaterialTheme.typography.labelLarge)
                }
            }
            CoordinateValue("Proposed", proposal.proposed, proposal.gpsAccuracyM, approved = false)
            val current = site?.let { Coordinates(it.latitude, it.longitude) } ?: proposal.original
            if (current != null) CoordinateValue("Current approved", current, null, approved = true)
            else Text("Current approved: none (new site)", color = MaterialTheme.colorScheme.onSurfaceVariant)
            KeyValueRow("Reason", proposal.reason)
            proposal.createdAt?.let { KeyValueRow("Sent", formatDateTime(it)) }
            proposal.decisionReason?.let { KeyValueRow("Reviewer decision${proposal.decidedAt?.let { at -> " · ${formatDateTime(at)}" }.orEmpty()}", it) }
        }
    }
}

@Composable
private fun proposalStatusStyle(status: ProposalStatus): Pair<ImageVector, Color> = when (status) {
    ProposalStatus.Pending -> Icons.Rounded.HourglassTop to Goldenrod
    ProposalStatus.Approved -> Icons.Rounded.CheckCircle to Fern
    ProposalStatus.Rejected -> Icons.Rounded.Cancel to MaterialTheme.colorScheme.error
}
