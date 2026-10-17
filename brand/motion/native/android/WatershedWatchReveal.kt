// Watershed Watch identity reveal for Jetpack Compose. Drop-in source; not yet wired into the app.
//
// It replays the web reveal exactly: the same original strokes, tracks and cubic-bezier curves, all
// read from WatershedWatchRevealGeometry.kt (generated from brand/motion/source/motion-spec.json).
//
// The Android 12+ system splash is separate and static (see brand/motion/NATIVE.md). Use this only after
// the first frame and only while real work is pending; remove it the moment that work finishes. With
// animations turned off in system settings, or play = false, it draws the settled mark.
package org.watershed.pawatershedwatch.brand

import android.provider.Settings
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.clearAndSetSemantics
import kotlin.math.min
import org.watershed.pawatershedwatch.brand.WatershedWatchRevealGeometry as G

enum class RevealLayout { Mark, Horizontal, Stacked }

private val strokeEasing = CubicBezierEasing(G.STROKE_EASING[0], G.STROKE_EASING[1], G.STROKE_EASING[2], G.STROKE_EASING[3])
private val settleEasing = CubicBezierEasing(G.SETTLE_EASING[0], G.SETTLE_EASING[1], G.SETTLE_EASING[2], G.SETTLE_EASING[3])

private fun fraction(timeMs: Float, track: G.Track): Float =
    ((timeMs - track.delayMs) / track.durationMs).coerceIn(0f, 1f)

private fun trackFor(part: String): G.Track = when (part) {
    "tributary-left" -> G.tributaryLeft
    "tributary-right" -> G.tributaryRight
    "tributary-middle" -> G.tributaryMiddle
    else -> G.river
}

/**
 * Draws the Watershed Watch mark or lockup. Decorative: give the surrounding screen its own label.
 * [frozenAtMs] renders a single frame, for previews and screenshot tests.
 */
@Composable
fun WatershedWatchReveal(
    modifier: Modifier = Modifier,
    layout: RevealLayout = RevealLayout.Mark,
    play: Boolean = true,
    dark: Boolean = isSystemInDarkTheme(),
    frozenAtMs: Int? = null,
) {
    val geometry = when (layout) {
        RevealLayout.Mark -> G.mark
        RevealLayout.Horizontal -> G.horizontal
        RevealLayout.Stacked -> G.stacked
    }
    val settledMs = if (layout == RevealLayout.Mark) G.SETTLED_MARK_MS else G.SETTLED_LOCKUP_MS
    val context = LocalContext.current
    val animationsOff = remember {
        Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    }
    val animate = play && !animationsOff && frozenAtMs == null
    val time = remember { Animatable(if (animate) 0f else settledMs.toFloat()) }
    LaunchedEffect(animate) {
        if (animate) time.animateTo(settledMs.toFloat(), tween(settledMs, easing = LinearEasing))
    }
    val strokePaths = remember { G.strokes.map { PathParser().parsePathString(it.d).toPath() } }
    val word = remember(layout) { geometry.wordmark.takeIf { it.isNotEmpty() }?.let { PathParser().parsePathString(it).toPath() } }
    val stream = Color(if (dark) G.DARK_STREAM else G.LIGHT_STREAM)
    val point = Color(if (dark) G.DARK_POINT else G.LIGHT_POINT)
    val ink = Color(if (dark) G.DARK_WORD else G.LIGHT_WORD)

    Canvas(modifier.aspectRatio(geometry.width / geometry.height).clearAndSetSemantics { }) {
        val t = frozenAtMs?.toFloat() ?: time.value
        val factor = size.width / geometry.width
        scale(factor, factor, pivot = Offset.Zero) {
            translate(geometry.markOffsetX, geometry.markOffsetY) {
                G.strokes.forEachIndexed { index, stroke ->
                    val linear = fraction(t, trackFor(stroke.part))
                    if (linear <= 0f) return@forEachIndexed
                    val measure = PathMeasure().apply { setPath(strokePaths[index], false) }
                    val segment = Path()
                    measure.getSegment(0f, measure.length * strokeEasing.transform(linear), segment, true)
                    drawPath(
                        segment,
                        stream,
                        alpha = strokeEasing.transform(min(1f, linear / G.STROKE_FADE_IN_FRACTION)),
                        style = Stroke(width = stroke.width, cap = StrokeCap.Round, join = StrokeJoin.Round),
                    )
                }
                val resolved = settleEasing.transform(fraction(t, G.monitoringPoint))
                if (resolved > 0f) {
                    drawCircle(
                        point,
                        radius = G.POINT_R * (G.POINT_FROM_SCALE + (1f - G.POINT_FROM_SCALE) * resolved),
                        center = Offset(G.POINT_CX, G.POINT_CY),
                        alpha = resolved,
                    )
                }
            }
            if (word != null) {
                val sweep = settleEasing.transform(fraction(t, G.wordmark))
                if (sweep > 0f) {
                    // Feathered left-to-right mask, as in the web reveal; the letters never move.
                    drawContext.canvas.saveLayer(Rect(0f, 0f, geometry.width, geometry.height), Paint())
                    drawPath(word, ink)
                    val x = geometry.sweepEndX - geometry.sweepTravel * (1f - sweep)
                    drawRect(
                        brush = Brush.horizontalGradient(
                            0f to Color.White,
                            (1f - geometry.sweepFeather) to Color.White,
                            1f to Color.Transparent,
                            startX = x,
                            endX = x + geometry.sweepWidth,
                        ),
                        topLeft = Offset(x, 0f),
                        size = Size(geometry.sweepWidth, geometry.height),
                        blendMode = BlendMode.DstIn,
                    )
                    drawContext.canvas.restore()
                }
            }
        }
    }
}
