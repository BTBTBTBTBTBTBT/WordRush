package com.wordocious.app.data

import android.app.Activity
import android.app.Application
import android.os.Build
import android.os.Bundle
import android.os.Looper
import android.view.HapticFeedbackConstants
import android.view.View
import java.lang.ref.WeakReference

/**
 * FINISH_SPEC U — the haptics service. Every haptic goes through
 * View.performHapticFeedback (no VIBRATE permission; it also respects the system
 * "touch feedback" setting), API-guarded per constant. Callers pass their
 * LocalView when they have one; ViewModels and other non-UI callers fall back to
 * the resumed activity's decor view (tracked by [install], called at App start).
 *
 * Gated by the Settings "Haptics" switch ([PREF], default ON). Reduce Motion does
 * not turn haptics off.
 */
object Haptics {
    const val PREF = "pref-haptics"

    val enabled: Boolean get() = SettingsPref.get(PREF, true)

    @Volatile private var current: WeakReference<View>? = null
    @Volatile private var installed = false

    /** Track the resumed activity's decor view for callers without a view (App.onCreate). */
    fun install(app: Application) {
        if (installed) return
        installed = true
        app.registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
            override fun onActivityResumed(activity: Activity) {
                current = WeakReference(activity.window?.decorView ?: return)
            }
            override fun onActivityPaused(activity: Activity) {
                if (current?.get() === activity.window?.decorView) current = null
            }
            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) = Unit
            override fun onActivityStarted(activity: Activity) = Unit
            override fun onActivityStopped(activity: Activity) = Unit
            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit
            override fun onActivityDestroyed(activity: Activity) = Unit
        })
    }

    /** The platform constant for [h] on this device's API level. */
    fun constant(h: Haptic, sdk: Int = Build.VERSION.SDK_INT): Int = when (h) {
        Haptic.LIGHT -> HapticFeedbackConstants.KEYBOARD_TAP
        Haptic.SELECTION ->
            if (sdk >= 27) HapticFeedbackConstants.TEXT_HANDLE_MOVE else HapticFeedbackConstants.CLOCK_TICK
        Haptic.SOFT ->
            if (sdk >= 34) HapticFeedbackConstants.SEGMENT_TICK else HapticFeedbackConstants.CLOCK_TICK
        Haptic.WARNING ->
            if (sdk >= 30) HapticFeedbackConstants.REJECT else HapticFeedbackConstants.LONG_PRESS
        Haptic.SUCCESS, Haptic.SUCCESS_HEAVY ->
            if (sdk >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.CONTEXT_CLICK
        Haptic.MEDIUM -> HapticFeedbackConstants.CONTEXT_CLICK
        Haptic.HEAVY -> HapticFeedbackConstants.LONG_PRESS
    }

    /** Play [h] on [view] (or the resumed activity). No-op when Haptics is off. */
    fun perform(h: Haptic, view: View? = null) {
        if (!enabled) return
        val v = view ?: current?.get() ?: return
        val run = Runnable {
            runCatching {
                v.performHapticFeedback(constant(h))
                // success + heavy: the confirm, then a heavy thump right behind it.
                if (h == Haptic.SUCCESS_HEAVY) {
                    v.postDelayed({ runCatching { v.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS) } }, 110)
                }
            }
        }
        if (Looper.myLooper() == Looper.getMainLooper()) run.run() else v.post(run)
    }

    fun light(view: View? = null) = perform(Haptic.LIGHT, view)
    fun selection(view: View? = null) = perform(Haptic.SELECTION, view)
    fun warning(view: View? = null) = perform(Haptic.WARNING, view)
    fun soft(view: View? = null) = perform(Haptic.SOFT, view)
    fun success(view: View? = null) = perform(Haptic.SUCCESS, view)
    fun successHeavy(view: View? = null) = perform(Haptic.SUCCESS_HEAVY, view)
    fun medium(view: View? = null) = perform(Haptic.MEDIUM, view)
    fun heavy(view: View? = null) = perform(Haptic.HEAVY, view)
}
