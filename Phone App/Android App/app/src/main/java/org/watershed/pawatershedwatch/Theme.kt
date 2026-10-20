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

val Hemlock = BrandTokens.primary
val Water = BrandTokens.water
private val GoldenrodTextLight = BrandTokens.goldText
val Goldenrod: Color
    @Composable get() = if (isSystemInDarkTheme()) BrandTokens.goldTextDark else GoldenrodTextLight
val Fern = BrandTokens.fern
val Limestone = BrandTokens.canvas
val Ink = BrandTokens.ink
val Mist = BrandTokens.primarySoft

private val LightColors = lightColorScheme(
    primary = BrandTokens.primary,
    onPrimary = BrandTokens.onPrimary,
    primaryContainer = BrandTokens.primarySoft,
    onPrimaryContainer = BrandTokens.ink,
    secondary = BrandTokens.water,
    onSecondary = BrandTokens.onPrimary,
    secondaryContainer = BrandTokens.surfaceRaised,
    onSecondaryContainer = BrandTokens.ink,
    tertiary = BrandTokens.goldText,
    background = BrandTokens.canvas,
    onBackground = BrandTokens.ink,
    surface = BrandTokens.surface,
    onSurface = BrandTokens.ink,
    surfaceVariant = BrandTokens.surfaceRaised,
    onSurfaceVariant = BrandTokens.inkMuted,
    outline = BrandTokens.lineInput,
    error = BrandTokens.alert,
)

private val DarkColors = darkColorScheme(
    primary = BrandTokens.primaryDark,
    onPrimary = BrandTokens.onPrimaryDark,
    primaryContainer = BrandTokens.primarySoftDark,
    onPrimaryContainer = BrandTokens.inkDark,
    secondary = BrandTokens.waterDark,
    onSecondary = BrandTokens.onPrimaryDark,
    secondaryContainer = BrandTokens.surfaceRaisedDark,
    onSecondaryContainer = BrandTokens.inkDark,
    tertiary = BrandTokens.goldTextDark,
    background = BrandTokens.canvasDark,
    onBackground = BrandTokens.inkDark,
    surface = BrandTokens.surfaceDark,
    onSurface = BrandTokens.inkDark,
    surfaceVariant = BrandTokens.surfaceRaisedDark,
    onSurfaceVariant = BrandTokens.inkMutedDark,
    outline = BrandTokens.lineInputDark,
    error = BrandTokens.alertDark,
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
