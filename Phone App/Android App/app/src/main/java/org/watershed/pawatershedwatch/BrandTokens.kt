package org.watershed.pawatershedwatch

import androidx.compose.ui.graphics.Color

// Canonical brand palette for Compose, from config/brand_tokens.json.
// tests/brand/android-parity.test.mjs prevents drift from iOS, QC, and the dashboard.
internal object BrandTokens {
    val paletteHemlock = Color(0xFF0D5C4B)
    val paletteDeepWater = Color(0xFF167A8B)
    val paletteGoldenrod = Color(0xFFA76100)
    val paletteGoldenrodText = Color(0xFF955600)
    val paletteFern = Color(0xFF2E7D52)
    val paletteAlert = Color(0xFFA3342B)
    val paletteLimestone50 = Color(0xFFF6F3EC)
    val paletteLimestone100 = Color(0xFFEDE8DD)
    val paletteLimestone300 = Color(0xFFD6CEBF)
    val paletteInk = Color(0xFF1C2522)
    val paletteInkMuted = Color(0xFF4C5854)
    val paletteNight = Color(0xFF0F1A17)
    val paletteNight2 = Color(0xFF17261F)
    val paletteOnDark = Color(0xFFECE8DF)
    val paletteOnDarkMuted = Color(0xFFA9B3AE)
    val paletteHemlock300 = Color(0xFF6CC3AA)
    val paletteDeepWater300 = Color(0xFF6CC2D1)
    val paletteGoldenrod300 = Color(0xFFE6A941)
    val paletteFern300 = Color(0xFF7CC79A)
    val paletteAlert300 = Color(0xFFF08A7E)
    val paletteIconStroke = Color(0xFFF4EFE6)

    val canvas = Color(0xFFF6F3EC)
    val canvasDark = Color(0xFF0F1A17)
    val surface = Color(0xFFFBFAF6)
    val surfaceDark = Color(0xFF17261F)
    val surfaceHeader = Color(0xFFF2EEE5)
    val surfaceHeaderDark = Color(0xFF1B2C25)
    val surfaceRaised = Color(0xFFEDE8DD)
    val surfaceRaisedDark = Color(0xFF22352D)
    val surfaceField = Color(0xFFFFFFFF)
    val surfaceFieldDark = Color(0xFF132019)
    val line = Color(0xFFD6CEBF)
    val lineDark = Color(0xFF2F443B)
    val lineSoft = Color(0xFFE3DCCF)
    val lineSoftDark = Color(0xFF243830)
    val lineStrong = Color(0xFF9AA39F)
    val lineStrongDark = Color(0xFF5B6762)
    val lineInput = Color(0xFF7E8984)
    val lineInputDark = Color(0xFF76827D)
    val ink = Color(0xFF1C2522)
    val inkDark = Color(0xFFECE8DF)
    val inkMuted = Color(0xFF4C5854)
    val inkMutedDark = Color(0xFFA9B3AE)
    val primary = Color(0xFF0D5C4B)
    val primaryDark = Color(0xFF6CC3AA)
    val onPrimary = Color(0xFFF6F3EC)
    val onPrimaryDark = Color(0xFF0F1A17)
    val primarySoft = Color(0xFFE2EDE6)
    val primarySoftDark = Color(0xFF173A31)
    val water = Color(0xFF167A8B)
    val waterDark = Color(0xFF6CC2D1)
    val goldGraphic = Color(0xFFA76100)
    val goldGraphicDark = Color(0xFFE6A941)
    val goldText = Color(0xFF955600)
    val goldTextDark = Color(0xFFE6A941)
    val fern = Color(0xFF2E7D52)
    val fernDark = Color(0xFF7CC79A)
    val alert = Color(0xFFA3342B)
    val alertDark = Color(0xFFF08A7E)

    val statusNeutralBg = Color.Transparent
    val statusNeutralBgDark = Color.Transparent
    val statusNeutralBorder = Color(0xFF9AA39F)
    val statusNeutralBorderDark = Color(0xFF5B6762)
    val statusNeutralMark = Color(0xFF4C5854)
    val statusNeutralMarkDark = Color(0xFFA9B3AE)
    val statusNeutralText = Color(0xFF1C2522)
    val statusNeutralTextDark = Color(0xFFECE8DF)
    val statusSubmittedBg = Color(0xFFDDEDF0)
    val statusSubmittedBgDark = Color(0xFF15333A)
    val statusSubmittedBorder = Color(0xFFDDEDF0)
    val statusSubmittedBorderDark = Color(0xFF15333A)
    val statusSubmittedMark = Color(0xFF167A8B)
    val statusSubmittedMarkDark = Color(0xFF6CC2D1)
    val statusSubmittedText = Color(0xFF1C2522)
    val statusSubmittedTextDark = Color(0xFFECE8DF)
    val statusReviewBg = Color(0xFFF5EAD9)
    val statusReviewBgDark = Color(0xFF3A2E17)
    val statusReviewBorder = Color(0xFFF5EAD9)
    val statusReviewBorderDark = Color(0xFF3A2E17)
    val statusReviewMark = Color(0xFF955600)
    val statusReviewMarkDark = Color(0xFFE6A941)
    val statusReviewText = Color(0xFF1C2522)
    val statusReviewTextDark = Color(0xFFECE8DF)
    val statusAttentionBg = Color(0xFFF6E3E1)
    val statusAttentionBgDark = Color(0xFF3D1F1C)
    val statusAttentionBorder = Color(0xFFF6E3E1)
    val statusAttentionBorderDark = Color(0xFF3D1F1C)
    val statusAttentionMark = Color(0xFFA3342B)
    val statusAttentionMarkDark = Color(0xFFF08A7E)
    val statusAttentionText = Color(0xFF1C2522)
    val statusAttentionTextDark = Color(0xFFECE8DF)
    val statusApprovedBg = Color(0xFFE0EFE5)
    val statusApprovedBgDark = Color(0xFF1A3526)
    val statusApprovedBorder = Color(0xFFE0EFE5)
    val statusApprovedBorderDark = Color(0xFF1A3526)
    val statusApprovedMark = Color(0xFF2E7D52)
    val statusApprovedMarkDark = Color(0xFF7CC79A)
    val statusApprovedText = Color(0xFF1C2522)
    val statusApprovedTextDark = Color(0xFFECE8DF)
    val statusPublishedBg = Color(0xFF0D5C4B)
    val statusPublishedBgDark = Color(0xFF6CC3AA)
    val statusPublishedBorder = Color(0xFF0D5C4B)
    val statusPublishedBorderDark = Color(0xFF6CC3AA)
    val statusPublishedMark = Color(0xFFE6A941)
    val statusPublishedMarkDark = Color(0xFF0F1A17)
    val statusPublishedText = Color(0xFFF6F3EC)
    val statusPublishedTextDark = Color(0xFF0F1A17)

    // Presentation mapping only; never used to authorize workflow transitions.
    val workflowTone: Map<String, String> = mapOf(
        "draft" to "neutral",
        "submitted" to "submitted",
        "validating" to "submitted",
        "resubmitted" to "submitted",
        "pending_review" to "review",
        "needs_correction" to "attention",
        "rejected" to "attention",
        "publish_failed" to "attention",
        "approved" to "approved",
        "publishing" to "approved",
        "published" to "published",
    )
}
