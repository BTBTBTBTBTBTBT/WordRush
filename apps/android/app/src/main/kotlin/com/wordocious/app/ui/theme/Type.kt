package com.wordocious.app.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import com.wordocious.app.R

/**
 * Nunito — the Wordocious brand typeface (matches web next/font Nunito + iOS
 * UIAppFonts). Bundled as a single variable TTF; each weight is requested via
 * the `wght` variation axis. This is the single most important aesthetic token:
 * the whole app reads as "Wordocious" because of this rounded, heavy face.
 */
@OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
private fun nunito(weight: Int) = Font(
    resId = R.font.nunito,
    weight = FontWeight(weight),
    variationSettings = FontVariation.Settings(FontVariation.weight(weight)),
)

val Nunito = FontFamily(
    nunito(400), // regular
    nunito(500), // medium
    nunito(600), // semibold
    nunito(700), // bold
    nunito(800), // extrabold
    nunito(900), // black
)

/** Typography with Nunito applied to every text role. */
val WordociousTypography: Typography = Typography().run {
    Typography(
        displayLarge = displayLarge.copy(fontFamily = Nunito),
        displayMedium = displayMedium.copy(fontFamily = Nunito),
        displaySmall = displaySmall.copy(fontFamily = Nunito),
        headlineLarge = headlineLarge.copy(fontFamily = Nunito),
        headlineMedium = headlineMedium.copy(fontFamily = Nunito),
        headlineSmall = headlineSmall.copy(fontFamily = Nunito),
        titleLarge = titleLarge.copy(fontFamily = Nunito),
        titleMedium = titleMedium.copy(fontFamily = Nunito),
        titleSmall = titleSmall.copy(fontFamily = Nunito),
        bodyLarge = bodyLarge.copy(fontFamily = Nunito),
        bodyMedium = bodyMedium.copy(fontFamily = Nunito),
        bodySmall = bodySmall.copy(fontFamily = Nunito),
        labelLarge = labelLarge.copy(fontFamily = Nunito),
        labelMedium = labelMedium.copy(fontFamily = Nunito),
        labelSmall = labelSmall.copy(fontFamily = Nunito),
    )
}
