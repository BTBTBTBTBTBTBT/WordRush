package com.wordocious.app.widget

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Home-screen widgets inflate through RemoteViews, which only allows a fixed set of view classes.
 * A plain <View> spacer made every Wordocious widget show "Can't load widget" / "Couldn't add
 * widget" (Doug, 10-06). Every widget layout may only use the allowed tags.
 */
class WidgetLayoutTagsTest {
    private val allowed = setOf(
        "FrameLayout", "LinearLayout", "RelativeLayout", "GridLayout",
        "TextView", "ImageView", "ImageButton", "Button", "ProgressBar", "Chronometer", "AnalogClock",
        "ViewFlipper", "AdapterViewFlipper", "ListView", "GridView", "StackView",
        "CheckBox", "Switch", "RadioButton", "RadioGroup", "include", "merge",
    )

    @Test fun widgetLayoutsUseOnlyRemoteViewsTags() {
        val dir = listOf(File("src/main/res/layout"), File("app/src/main/res/layout")).first { it.isDirectory }
        val files = dir.listFiles { f -> f.name.startsWith("widget_") && f.name.endsWith(".xml") }!!.toList()
        assertTrue("no widget layouts found", files.isNotEmpty())
        val tag = Regex("<([A-Za-z][A-Za-z0-9_.]*)[\\s/>]")
        for (f in files) {
            for (m in tag.findAll(f.readText())) {
                val name = m.groupValues[1]
                if (name == "xml" || name.contains("?")) continue
                assertTrue("${f.name}: <$name> isn't allowed in a widget (RemoteViews)", name in allowed)
            }
        }
    }
}
