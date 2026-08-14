package org.watershed.pawatershedwatch

import android.content.Context
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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.automirrored.rounded.Logout
import androidx.compose.material.icons.rounded.ArrowDropDown
import androidx.compose.material.icons.rounded.Cached
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.LocationOn
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.WaterDrop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp

@Composable
fun SignInScreen(model: AppViewModel) {
    val focus = LocalFocusManager.current
    val passwordFocus = remember { FocusRequester() }
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .statusBarsPadding()
            .verticalScroll(rememberScrollState())
            .imePadding()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        BrandMark()
        Spacer(Modifier.height(24.dp))
        Text("PA Watershed Watch", style = MaterialTheme.typography.displaySmall)
        Text(
            "Field observations for Pennsylvania watersheds",
            modifier = Modifier.padding(top = 8.dp, bottom = 32.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyLarge,
        )
        OutlinedTextField(
            value = model.email,
            onValueChange = { model.email = it },
            label = { Text("Email") },
            leadingIcon = { Icon(Icons.Rounded.Person, contentDescription = null) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
            keyboardActions = KeyboardActions(onNext = { passwordFocus.requestFocus() }),
            shape = RoundedCornerShape(16.dp),
        )
        Spacer(Modifier.height(14.dp))
        OutlinedTextField(
            value = model.password,
            onValueChange = { model.password = it },
            label = { Text("Password") },
            leadingIcon = { Icon(Icons.Rounded.Lock, contentDescription = null) },
            modifier = Modifier.fillMaxWidth().focusRequester(passwordFocus),
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { focus.clearFocus(); model.signIn() }),
            shape = RoundedCornerShape(16.dp),
        )
        model.authError?.let {
            StatusPanel("Authentication error", it, MaterialTheme.colorScheme.error, Icons.Rounded.ErrorOutline)
            Spacer(Modifier.height(14.dp))
        }
        Spacer(Modifier.height(22.dp))
        PrimaryAction("Sign In", onClick = { focus.clearFocus(); model.signIn() })
        Text(
            "Your unfinished field work remains on this device until it can sync.",
            modifier = Modifier.padding(top = 18.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

@Composable
fun HomeScreen(
    model: AppViewModel,
    onStart: () -> Unit,
    onResume: () -> Unit,
    onRecord: (String) -> Unit,
) {
    val attention = model.records.filter { it.sync == SyncState.Failed || it.sync == SyncState.Waiting || it.workflow == WorkflowState.NeedsCorrection }
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        Row(modifier = Modifier.padding(top = 22.dp), verticalAlignment = Alignment.CenterVertically) {
            BrandMark(modifier = Modifier.size(42.dp))
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text("PA Watershed Watch", style = MaterialTheme.typography.titleLarge)
                Text(
                    when (model.connection) {
                        ConnectionState.Online -> "Ready for field work"
                        ConnectionState.Offline -> "Offline · cached field data"
                        ConnectionState.ServerUnavailable -> "Archive unavailable · local work continues"
                    },
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        Surface(
            modifier = Modifier.fillMaxWidth().clickable(onClick = onStart),
            shape = RoundedCornerShape(28.dp),
            color = MaterialTheme.colorScheme.primary,
        ) {
            Column(modifier = Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Box(Modifier.size(46.dp).background(Color.White.copy(alpha = .15f), CircleShape), contentAlignment = Alignment.Center) {
                    Icon(Icons.Rounded.WaterDrop, contentDescription = null, tint = Color.White)
                }
                Text("Start New Observation", color = Color.White, style = MaterialTheme.typography.headlineMedium)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Begin with a sampling site", color = Color.White.copy(alpha = .84f), modifier = Modifier.weight(1f))
                    Icon(Icons.AutoMirrored.Rounded.ArrowForward, contentDescription = null, tint = Color.White)
                }
            }
        }

        model.draft?.let { draft ->
            FieldSurface {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Unfinished observation", color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.labelLarge)
                    Text(model.selectedSite()?.name ?: "Site not chosen", style = MaterialTheme.typography.titleLarge)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Saved locally · Step ${draft.currentStep} of 6", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
                        TextButton(onClick = onResume) { Text("Resume") }
                    }
                }
            }
        }

        if (attention.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                SectionHeading("Needs attention", trailing = "${attention.size}")
                attention.take(2).forEach { record -> ObservationHomeRow(record) { onRecord(record.id) } }
            }
        }

        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            SectionHeading("Recent submissions")
            model.records.take(2).forEach { record -> ObservationHomeRow(record) { onRecord(record.id) } }
        }
    }
}

@Composable
private fun ObservationHomeRow(record: ObservationRecord, onClick: () -> Unit) {
    Surface(modifier = Modifier.fillMaxWidth().clickable(onClick = onClick), shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.surface) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Text(record.site.name, style = MaterialTheme.typography.titleMedium)
            Text(formatDateTime(record.collectedAt), color = MaterialTheme.colorScheme.onSurfaceVariant)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                WorkflowPill(record.workflow)
                SyncPill(record.sync)
            }
        }
    }
}

@Composable
fun SelectSiteScreen(model: AppViewModel, onBack: () -> Unit, onNext: () -> Unit) {
    var search by remember { mutableStateOf("") }
    val visible = model.sites.filter { site ->
        (model.connection != ConnectionState.Offline || site.cached) &&
            (search.isBlank() || site.name.contains(search, true) || site.county.contains(search, true) || site.watershed.contains(search, true))
    }
    Scaffold(
        topBar = { FieldTopBar("Select Site", onBack) },
        bottomBar = {
            model.draft?.siteId?.let {
                WorkflowFooter(1, "Visit Details", onNext = { model.setStep(2); onNext() })
            }
        },
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            FieldLabel("Choose one sampling site", required = true, style = MaterialTheme.typography.titleMedium)
            if (model.connection == ConnectionState.Offline) {
                StatusPanel("Cached sites", "You can keep working. Site details were saved on this phone.", Goldenrod, Icons.Rounded.Cached)
            }
            OutlinedTextField(
                value = search,
                onValueChange = { search = it },
                modifier = Modifier.fillMaxWidth(),
                leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
                label = { Text("Search sites, counties, watersheds") },
                singleLine = true,
                shape = RoundedCornerShape(16.dp),
            )
            when {
                model.sitesLoading && visible.isEmpty() -> Box(Modifier.fillMaxWidth().padding(48.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
                visible.isEmpty() -> StatusPanel("No sites found", "Try another name or reconnect to load uncached sites.", Water, Icons.Rounded.Search)
                else -> Column(modifier = Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    visible.forEach { site ->
                        SiteRow(site, selected = model.draft?.siteId == site.id) { model.selectSite(site) }
                    }
                    Spacer(Modifier.height(128.dp))
                }
            }
        }
    }
}

@Composable
private fun SiteRow(site: Site, selected: Boolean, onClick: () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(18.dp),
        color = if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
    ) {
        Row(modifier = Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
            Box(Modifier.size(38.dp).background(MaterialTheme.colorScheme.secondaryContainer, CircleShape), contentAlignment = Alignment.Center) {
                Icon(Icons.Rounded.LocationOn, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(site.name, style = MaterialTheme.typography.titleMedium)
                Text("${site.county} · ${site.distance}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(site.watershed, color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.labelLarge)
                if (site.cached) Text("Available offline", color = Fern, style = MaterialTheme.typography.labelLarge)
            }
            if (selected) Icon(Icons.Rounded.Check, contentDescription = "Selected", tint = MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
fun AccountScreen(model: AppViewModel) {
    val context = LocalContext.current
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp).padding(bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        ScreenIntro("Account", model.signedInName, "PA Watershed Watch field account")
        FieldSurface {
            Column {
                KeyValueRow("Signed in as", model.signedInEmail)
                KeyValueRow("Local field work", "${model.records.count { it.sync != SyncState.Synced }} waiting on this phone")
                TextButton(onClick = model::signOut) {
                    Icon(Icons.AutoMirrored.Rounded.Logout, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Sign Out")
                }
            }
        }
        SectionHeading("Connection", "Workflow state stays separate from sync state")
        StatusPanel(
            model.connection.label,
            if (model.connection == ConnectionState.Online) "New submissions can sync when the archive is available."
            else "Cached sites and unfinished field work remain available on this phone.",
            if (model.connection == ConnectionState.Online) Fern else Goldenrod,
            if (model.connection == ConnectionState.Online) Icons.Rounded.Check else Icons.Rounded.CloudOff,
        )
        SectionHeading("Device access")
        FieldSurface {
            Column {
                KeyValueRow("Location", "Requested when capturing a sampling position")
                TextButton(onClick = { openAppSettings(context) }) {
                    Icon(Icons.Rounded.Settings, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Open App Settings")
                }
            }
        }
        Text("PA Watershed Watch · Native field application", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
