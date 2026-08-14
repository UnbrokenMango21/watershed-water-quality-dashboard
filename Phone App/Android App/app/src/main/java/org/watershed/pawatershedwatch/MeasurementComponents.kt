package org.watershed.pawatershedwatch

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowDropDown
import androidx.compose.material.icons.rounded.Science
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

/** One [FocusRequester] per row, so a keyboard "Next" and a jump from Review can both target a field. */
@Composable
fun rememberMeasurementFocusChain(kinds: List<MeasurementKind>): Map<MeasurementKind, FocusRequester> =
    remember(kinds) { kinds.associateWith { FocusRequester() } }

@Composable
fun MeasurementEntry(
    draft: ObservationDraft,
    kind: MeasurementKind,
    required: Boolean,
    enabled: Boolean = true,
    focusRequester: FocusRequester? = null,
    nextFocusRequester: FocusRequester? = null,
    onValueChange: (String) -> Unit,
    onUnitChange: (UnitSpec, Boolean) -> Boolean,
) {
    val value = draft.values[kind].orEmpty()
    val unit = draft.selectedUnit(kind)
    val error = measurementErrorMessage(kind, value, unit)
    val complete = value.toDoubleOrNull() != null && error == null
    var pendingUnit by remember { mutableStateOf<UnitSpec?>(null) }
    val focusManager = LocalFocusManager.current

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .semantics {
                contentDescription = buildString {
                    append(kind.title)
                    append(if (required) ", required" else ", optional")
                    if (!enabled) append(", unavailable in the current production data contract")
                    if (value.isNotBlank()) append(", $value ${unit.spokenName}, complete") else append(", not entered")
                }
            },
        shape = RoundedCornerShape(20.dp),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp,
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier.size(36.dp).background(MaterialTheme.colorScheme.secondaryContainer, CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Rounded.Science, contentDescription = null, tint = MaterialTheme.colorScheme.secondary, modifier = Modifier.size(20.dp))
                }
                Spacer(Modifier.width(10.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Text(kind.title, style = MaterialTheme.typography.titleMedium)
                    FieldLabel(
                        when { required -> "Required"; enabled -> "Optional"; else -> "Optional · unavailable" },
                        required = required,
                        style = MaterialTheme.typography.labelLarge.copy(color = MaterialTheme.colorScheme.onSurfaceVariant),
                    )
                }
                CompletionDot(complete, required)
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    value = value,
                    onValueChange = { candidate ->
                        if (candidate.isValidNumberDraft(kind.allowsNegative)) onValueChange(candidate)
                    },
                    modifier = Modifier.weight(1f).then(focusRequester?.let { Modifier.focusRequester(it) } ?: Modifier),
                    placeholder = { Text("0.0", color = MaterialTheme.colorScheme.outline) },
                    textStyle = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Medium),
                    singleLine = true,
                    enabled = enabled,
                    isError = error != null,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Decimal,
                        imeAction = if (nextFocusRequester == null) ImeAction.Done else ImeAction.Next,
                    ),
                    keyboardActions = KeyboardActions(
                        onDone = { focusManager.clearFocus() },
                        onNext = { nextFocusRequester?.requestFocus() },
                    ),
                    suffix = {
                        UnitPicker(kind, unit, enabled) { selected ->
                            if (!onUnitChange(selected, false)) pendingUnit = selected
                        }
                    },
                    shape = RoundedCornerShape(16.dp),
                )
                if (kind.allowsNegative) {
                    Surface(
                        modifier = Modifier.defaultMinSize(48.dp, 56.dp).semantics { contentDescription = "Toggle positive or negative" }.clickable {
                            val next = if (value.startsWith("-")) value.drop(1) else if (value.isBlank()) "-" else "-$value"
                            onValueChange(next)
                        },
                        shape = RoundedCornerShape(16.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant,
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text("±", style = MaterialTheme.typography.titleLarge)
                        }
                    }
                }
            }

            when {
                !enabled -> Text("Not enabled by the current production scientific contract.", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                error != null -> Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
                kind == MeasurementKind.Temperature && complete -> {
                    val other = if (unit == Units.Celsius) Units.Fahrenheit else Units.Celsius
                    val converted = unit.convert(value.toDouble(), other)
                    Text("Also ${String.format(java.util.Locale.US, "%.1f", converted)} ${other.inlineSymbol}", color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.labelLarge)
                }
            }
        }
    }

    pendingUnit?.let { target ->
        AlertDialog(
            onDismissRequest = { pendingUnit = null },
            title = { Text("Change measurement method?") },
            text = { Text("${unit.menuTitle} and ${target.menuTitle} are method-specific units and cannot be converted safely. Changing the unit will clear the current value.") },
            confirmButton = {
                TextButton(onClick = {
                    onUnitChange(target, true)
                    pendingUnit = null
                }) { Text("Clear and change") }
            },
            dismissButton = { TextButton(onClick = { pendingUnit = null }) { Text("Keep current") } },
        )
    }
}

@Composable
private fun UnitPicker(kind: MeasurementKind, selected: UnitSpec, enabled: Boolean, onSelect: (UnitSpec) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        Surface(
            modifier = Modifier
                .defaultMinSize(minWidth = 64.dp, minHeight = 48.dp)
                .clickable(enabled = enabled && kind.units.size > 1) { expanded = true }
                .semantics { contentDescription = "Unit: ${selected.spokenName}. Double tap to change." },
            shape = RoundedCornerShape(12.dp),
            color = MaterialTheme.colorScheme.primaryContainer,
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                UnitFraction(selected)
                if (enabled && kind.units.size > 1) Icon(Icons.Rounded.ArrowDropDown, contentDescription = null, modifier = Modifier.size(18.dp))
            }
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            kind.units.forEach { unit ->
                DropdownMenuItem(
                    text = {
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            UnitFraction(unit)
                            Text(unit.menuTitle, modifier = Modifier.weight(1f))
                        }
                    },
                    onClick = {
                        expanded = false
                        onSelect(unit)
                    },
                )
            }
        }
    }
}

@Composable
fun UnitFraction(unit: UnitSpec) {
    if (unit.denominator == null) {
        Text(unit.numerator, textAlign = TextAlign.Center, style = MaterialTheme.typography.labelLarge)
    } else {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(unit.numerator, textAlign = TextAlign.Center, style = MaterialTheme.typography.labelLarge)
            Box(Modifier.width(48.dp).height(1.dp).background(MaterialTheme.colorScheme.onPrimaryContainer))
            Text(unit.denominator, textAlign = TextAlign.Center, style = MaterialTheme.typography.labelLarge)
        }
    }
}

private fun String.isValidNumberDraft(allowsNegative: Boolean): Boolean {
    if (isEmpty()) return true
    if (!allowsNegative && startsWith("-")) return false
    if (count { it == '-' } > 1 || ('-' in this && !startsWith("-"))) return false
    if (count { it == '.' } > 1) return false
    return all { it.isDigit() || it == '.' || (allowsNegative && it == '-') }
}
