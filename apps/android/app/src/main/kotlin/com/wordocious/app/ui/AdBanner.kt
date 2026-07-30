package com.wordocious.app.ui

import android.content.res.Configuration
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.wordocious.app.data.AdsManager
import com.wordocious.app.data.AuthService
import com.wordocious.app.ui.theme.WTheme

/**
 * Bottom banner for free users — Android port of iOS `AdBannerContainer`
 * (AdBannerView.swift), mounted once in MainScreen's bottomBar directly above
 * the nav so it appears on every tab and hides with the nav on game screens.
 *
 * Renders nothing for Pro users or when ads are off, exactly like iOS and the
 * web AdBanner. Uses an anchored ADAPTIVE banner (not a fixed 320x50) so it
 * fills the device width with no side bars — same reasoning as iOS.
 */
@Composable
fun AdBannerContainer() {
    val profile by AuthService.profile.collectAsState()
    // `profile` is read (not just AdsManager.active) so the banner recomposes
    // away the moment a purchase flips the row to Pro, rather than lingering
    // until the next unrelated recomposition.
    @Suppress("UNUSED_EXPRESSION") profile

    if (!AdsManager.active || !AdsManager.initialized) return

    val context = LocalContext.current
    val configuration: Configuration = LocalConfiguration.current
    val widthDp = configuration.screenWidthDp

    Column(Modifier.fillMaxWidth().background(WTheme.surface)) {
        // iOS draws a 1pt hairline along the TOP edge of the banner slot.
        Box(Modifier.fillMaxWidth().height(1.dp).background(WTheme.border))
        AndroidView(
            modifier = Modifier.fillMaxWidth().height(50.dp),
            factory = { ctx ->
                AdView(ctx).apply {
                    setAdSize(AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(context, widthDp))
                    adUnitId = AdsManager.BANNER_UNIT
                    // Transparent, not the SDK default: a creative that fills
                    // narrower than the adaptive slot shows the app surface in
                    // the gaps instead of black bars (matches iOS).
                    setBackgroundColor(Color.Transparent.value.toInt())
                    runCatching { loadAd(AdRequest.Builder().build()) }
                }
            },
        )
    }
}
