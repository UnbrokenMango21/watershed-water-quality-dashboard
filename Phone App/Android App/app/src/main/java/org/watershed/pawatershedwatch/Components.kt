package org.watershed.pawatershedwatch

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.CloudDone
import androidx.compose.material.icons.rounded.CloudOff
import androidx.compose.material.icons.rounded.Error
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Sync
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun BrandMark(modifier: Modifier = Modifier, color: Color = MaterialTheme.colorScheme.primary) {
    Canvas(modifier = modifier.size(52.dp).semantics { contentDescription = "PA Watershed Watch" }) {
        val stroke = 4.dp.toPx()
        drawCircle(color, radius = size.minDimension * .12f, center = Offset(size.width * .25f, size.height * .27f))
        drawCircle(color, radius = size.minDimension * .08f, center = Offset(size.width * .55f, size.height * .18f))
        drawCircle(color, radius = size.minDimension * .15f, center = Offset(size.width * .69f, size.height * .39f))
        drawCircle(color, radius = size.minDimension * .18f, center = Offset(size.width * .39f, size.height * .52f))
        drawLine(color, Offset(size.width * .1f, size.height * .78f), Offset(size.width * .9f, size.height * .78f), stroke, StrokeCap.Round)
        drawLine(color, Offset(size.width * .2f, size.height * .9f), Offset(size.width * .8f, size.height * .9f), stroke, StrokeCap.Round)
    }
}

@Composable
fun FieldTopBar(title: String, onBack: (() -> Unit)? = null, trailing: (@Composable () -> Unit)? = null) {
    Row(
        modifier = Modifier.fillMaxWidth().height(64.dp).padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (onBack != null) {
            IconButton(onClick = onBack, modifier = Modifier.size(48.dp)) {
                Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Back")
            }
        } else {
            Spacer(Modifier.width(12.dp))
        }
        Text(
            title,
            modifier = Modifier.weight(1f),
            style = MaterialTheme.typography.titleLarge,
            maxLines = 2,
        )
        trailing?.invoke()
    }
}

@Composable
fun ScreenIntro(eyebrow: String, title: String, supporting: String? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            eyebrow.uppercase(),
            color = MaterialTheme.colorScheme.secondary,
            style = MaterialTheme.typography.labelLarge,
            letterSpacing = 1.1.sp,
        )
        Text(title, style = MaterialTheme.typography.headlineMedium)
        supporting?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge) }
    }
}

@Composable
fun SectionHeading(title: String, supporting: String? = null, trailing: String? = null) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge)
            supporting?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
        trailing?.let { Text(it, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge) }
    }
}

@Composable
fun PrimaryAction(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: ImageVector = Icons.AutoMirrored.Rounded.ArrowForward,
) {
    Button(
        onClick = onClick,
        modifier = modifier.fillMaxWidth().height(58.dp),
        enabled = enabled,
        shape = RoundedCornerShape(18.dp),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 20.dp),
    ) {
        Text(title, modifier = Modifier.weight(1f), textAlign = TextAlign.Start, style = MaterialTheme.typography.titleMedium)
        Icon(icon, contentDescription = null)
    }
}

@Composable
fun WorkflowFooter(step: Int, title: String, enabled: Boolean = true, onNext: () -> Unit) {
    Surface(shadowElevation = 10.dp, tonalElevation = 2.dp) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Rounded.CheckCircle, contentDescription = null, tint = Fern, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text("Saved locally", color = Fern, style = MaterialTheme.typography.labelLarge)
                Spacer(Modifier.weight(1f))
                Text("Step $step of 6", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge)
            }
            Box(Modifier.fillMaxWidth().height(4.dp).clip(CircleShape).background(MaterialTheme.colorScheme.surfaceVariant)) {
                Box(Modifier.fillMaxWidth(step / 6f).height(4.dp).background(MaterialTheme.colorScheme.primary))
            }
            PrimaryAction(title, onNext, enabled = enabled)
        }
    }
}

@Composable
fun SyncPill(state: SyncState) {
    val color = when (state) {
        SyncState.SavedLocally -> Water
        SyncState.Waiting -> Goldenrod
        SyncState.Syncing -> Water
        SyncState.Synced -> Fern
        SyncState.Failed -> MaterialTheme.colorScheme.error
    }
    val icon = when (state) {
        SyncState.SavedLocally -> Icons.Rounded.CloudOff
        SyncState.Waiting -> Icons.Rounded.Schedule
        SyncState.Syncing -> Icons.Rounded.Sync
        SyncState.Synced -> Icons.Rounded.CloudDone
        SyncState.Failed -> Icons.Rounded.Error
    }
    Row(
        modifier = Modifier.clip(CircleShape).background(color.copy(alpha = .11f)).padding(horizontal = 10.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(16.dp))
        Text(state.label, color = color, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
fun WorkflowPill(state: WorkflowState) {
    val color = when (state) {
        WorkflowState.Draft -> Water
        WorkflowState.Submitted, WorkflowState.Resubmitted -> Fern
        WorkflowState.NeedsCorrection -> Goldenrod
    }
    Row(
        modifier = Modifier.clip(CircleShape).background(color.copy(alpha = .11f)).padding(horizontal = 10.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (state != WorkflowState.NeedsCorrection) Icon(Icons.Rounded.Check, contentDescription = null, tint = color, modifier = Modifier.size(16.dp))
        Text(state.label, color = color, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
fun StatusPanel(title: String, body: String, color: Color, icon: ImageVector) {
    Surface(color = color.copy(alpha = .1f), shape = RoundedCornerShape(18.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Icon(icon, contentDescription = null, tint = color)
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(title, color = color, style = MaterialTheme.typography.titleMedium)
                Text(body, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
fun KeyValueRow(label: String, value: String) {
    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelLarge)
        Text(value, style = MaterialTheme.typography.bodyLarge)
    }
    HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = .18f))
}

@Composable
fun FieldSurface(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp,
    ) {
        Box(modifier = Modifier.padding(18.dp)) { content() }
    }
}

@Composable
fun CompletionDot(complete: Boolean, required: Boolean) {
    val color = if (complete) Fern else MaterialTheme.colorScheme.outline
    Box(
        modifier = Modifier
            .size(26.dp)
            .clip(CircleShape)
            .then(if (complete) Modifier.background(color) else Modifier.border(2.dp, color, CircleShape)),
        contentAlignment = Alignment.Center,
    ) {
        if (complete) Icon(Icons.Rounded.Check, contentDescription = "Complete", tint = Color.White, modifier = Modifier.size(18.dp))
        else if (required) Text("!", color = color, fontWeight = FontWeight.Bold)
    }
}
