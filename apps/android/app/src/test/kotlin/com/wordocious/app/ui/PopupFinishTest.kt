package com.wordocious.app.ui

import com.wordocious.core.BannerTier
import org.junit.Assert.assertEquals
import org.junit.Test

/** FINISH_SPEC G4: which scene art the Home banner shows for each row tier. */
class PopupFinishTest {
    @Test fun noTierNoArt() {
        assertEquals(BannerTier.NONE, bannerArtTier(BannerTier.NONE, BannerTier.NONE, unlimited = false))
    }

    @Test fun unlimitedNeverShowsArt() {
        assertEquals(BannerTier.NONE, bannerArtTier(BannerTier.FLAWLESS, BannerTier.FLAWLESS, unlimited = true))
        assertEquals(BannerTier.NONE, bannerArtTier(BannerTier.SWEEP, BannerTier.NONE, unlimited = true))
    }

    @Test fun wordociousRowLeads() {
        assertEquals(BannerTier.SWEEP, bannerArtTier(BannerTier.SWEEP, BannerTier.NONE, unlimited = false))
        assertEquals(BannerTier.FLAWLESS, bannerArtTier(BannerTier.FLAWLESS, BannerTier.NONE, unlimited = false))
        assertEquals(BannerTier.FLAWLESS, bannerArtTier(BannerTier.FLAWLESS, BannerTier.SWEEP, unlimited = false))
        // A swept Wordocious row keeps the Sweep scene even when Puzzles went flawless.
        assertEquals(BannerTier.SWEEP, bannerArtTier(BannerTier.SWEEP, BannerTier.FLAWLESS, unlimited = false))
    }

    @Test fun puzzlesAloneFlipsTheBanner() {
        assertEquals(BannerTier.SWEEP, bannerArtTier(BannerTier.NONE, BannerTier.SWEEP, unlimited = false))
        assertEquals(BannerTier.FLAWLESS, bannerArtTier(BannerTier.NONE, BannerTier.FLAWLESS, unlimited = false))
    }
}
