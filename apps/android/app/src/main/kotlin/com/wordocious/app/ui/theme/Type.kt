package com.wordocious.app.ui.theme

import androidx.compose.material3.Typography

/**
 * Brand typography. The web/iOS brand face is Nunito (purple→pink wordmark uses
 * Black weight). The Nunito .ttf will be bundled under res/font and wired into a
 * FontFamily here during the audit-then-match UI pass (mirrors iOS UIAppFonts);
 * until then this falls back to the platform default so the module compiles and
 * renders. Kept as a single swap point so the whole app restyles at once.
 */
val WordociousTypography = Typography()
