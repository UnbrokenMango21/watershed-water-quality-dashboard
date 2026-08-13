package org.watershed.pawatershedwatch

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val Hemlock = Color(0xFF0D5C4B)
val Water = Color(0xFF167A8B)
val Goldenrod = Color(0xFFA76100)
val Fern = Color(0xFF2E7D52)
val Limestone = Color(0xFFF3F1E9)
val Ink = Color(0xFF17211E)
val Mist = Color(0xFFE3ECE8)

private val LightColors = lightColorScheme(
    primary = Hemlock,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD2EBE2),
    onPrimaryContainer = Color(0xFF063B31),
    secondary = Water,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFD4EEF1),
    onSecondaryContainer = Color(0xFF07434B),
    tertiary = Goldenrod,
    background = Limestone,
    onBackground = Ink,
    surface = Color(0xFFFFFDF8),
    onSurface = Ink,
    surfaceVariant = Color(0xFFE7E9E5),
    onSurfaceVariant = Color(0xFF46504C),
    outline = Color(0xFF747C78),
    error = Color(0xFF9A3B31),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF8FD5C0),
    onPrimary = Color(0xFF00382D),
    primaryContainer = Color(0xFF0C5647),
    onPrimaryContainer = Color(0xFFC5F0E2),
    secondary = Color(0xFF7DCBD6),
    onSecondary = Color(0xFF00363D),
    background = Color(0xFF111714),
    onBackground = Color(0xFFE4E9E5),
    surface = Color(0xFF171E1B),
    onSurface = Color(0xFFE4E9E5),
    surfaceVariant = Color(0xFF28312D),
    onSurfaceVariant = Color(0xFFC1CAC5),
    outline = Color(0xFF89938E),
)

private val FieldTypography = androidx.compose.material3.Typography(
    displaySmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 34.sp,
        lineHeight = 38.sp,
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 27.sp,
        lineHeight = 32.sp,
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 22.sp,
        lineHeight = 28.sp,
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 17.sp,
        lineHeight = 23.sp,
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontSize = 17.sp,
        lineHeight = 24.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontSize = 15.sp,
        lineHeight = 21.sp,
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 15.sp,
        lineHeight = 20.sp,
    ),
)

@Composable
fun PAWatershedTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        typography = FieldTypography,
        content = content,
    )
}
