package com.wordocious.app.ui

import com.wordocious.core.Profanity

// FINISH_SPEC AO — the first-run welcome + guided profile setup, as a pure state
// machine (no Android, no Compose) so every path is unit-tested (OnboardingFlowTest).
//
//   1 WELCOME ──Let's go!──▶ 2 TOUR (4 cards) ──▶ 3 PROFILE ──Create my account──▶ SIGN_UP
//      │                                          │  └─Play as guest─────────────▶ 5 ALL_SET
//      └─I already have an account─▶ SIGN_IN ─signed in─▶ Home (done)
//   SIGN_UP ─signed in─▶ USERNAME ─▶ 4 MASCOT ─saved / Do it later─▶ 5 ALL_SET ─▶ Classic / Home
//
// Skip (top-right on 2–4): the tour's Skip skips the tour only (the profile step is
// how a new player gets in at all); Skip on 3–4 ends the setup (a player with no
// account yet goes in as a guest). How to Play → "Take the tour" replays 1–2 only.

/** The screens of the flow. SIGN_IN / SIGN_UP host the existing AuthScreen. */
enum class OnboardingStep {
    WELCOME, SIGN_IN, TOUR, PROFILE, SIGN_UP, USERNAME, MASCOT, ALL_SET;

    /** The 0-based section for the step dots (1 Welcome · 2 Tour · 3 Profile · 4 Mascot · 5 All set). */
    val section: Int get() = when (this) {
        WELCOME, SIGN_IN -> 0
        TOUR -> 1
        PROFILE, SIGN_UP, USERNAME -> 2
        MASCOT -> 3
        ALL_SET -> 4
    }

    /** Skip (top-right) shows on steps 2–4. */
    val hasSkip: Boolean get() = section in 1..3
}

/** What the player did (or what the host observed: a sign-in, a guest entry). */
sealed interface OnboardingEvent {
    data object LetsGo : OnboardingEvent
    data object HaveAccount : OnboardingEvent
    data object TourDone : OnboardingEvent
    data object Skip : OnboardingEvent
    data object Back : OnboardingEvent
    data object CreateAccount : OnboardingEvent
    data object Guest : OnboardingEvent
    /** A session arrived and its profile row loaded. */
    data class Authenticated(val needsUsername: Boolean, val hasMascot: Boolean) : OnboardingEvent
    data object UsernameSaved : OnboardingEvent
    data object MascotSaved : OnboardingEvent
    data object MascotLater : OnboardingEvent
    data object Play : OnboardingEvent
    data object Explore : OnboardingEvent
}

/** Where the flow goes next. */
sealed interface OnboardingMove {
    data class Go(val step: OnboardingStep) : OnboardingMove
    /**
     * The flow is over. [playClassic] opens today's Classic; [asGuest] = the player has
     * no account yet, so they go in as a guest (Skip on the profile step).
     */
    data class Finish(val playClassic: Boolean = false, val asGuest: Boolean = false) : OnboardingMove
    data object Stay : OnboardingMove
}

/** [signedIn] = a real account (not a guest); [replay] = How to Play's "Take the tour". */
data class OnboardingContext(val signedIn: Boolean, val guest: Boolean, val replay: Boolean = false)

object OnboardingFlow {
    /** Where a replay / a fresh first run starts. */
    val START = OnboardingStep.WELCOME

    fun next(step: OnboardingStep, event: OnboardingEvent, ctx: OnboardingContext): OnboardingMove {
        val e = event
        return when (step) {
            OnboardingStep.WELCOME -> when (e) {
                OnboardingEvent.LetsGo -> go(OnboardingStep.TOUR)
                OnboardingEvent.HaveAccount ->
                    if (ctx.replay || ctx.signedIn) OnboardingMove.Finish() else go(OnboardingStep.SIGN_IN)
                OnboardingEvent.Back, OnboardingEvent.Skip -> OnboardingMove.Finish()
                else -> OnboardingMove.Stay
            }
            // "I already have an account": signed in = straight to Home, flow done (a
            // brand-new account made here — Google — still picks its username first).
            OnboardingStep.SIGN_IN -> when (e) {
                is OnboardingEvent.Authenticated ->
                    if (e.needsUsername) go(OnboardingStep.USERNAME) else OnboardingMove.Finish()
                OnboardingEvent.Guest -> go(OnboardingStep.ALL_SET)
                OnboardingEvent.Back -> go(OnboardingStep.WELCOME)
                OnboardingEvent.Skip -> OnboardingMove.Finish(asGuest = !ctx.signedIn && !ctx.guest)
                else -> OnboardingMove.Stay
            }
            OnboardingStep.TOUR -> when (e) {
                OnboardingEvent.TourDone, OnboardingEvent.Skip ->
                    if (ctx.replay) OnboardingMove.Finish() else go(afterTour(ctx))
                OnboardingEvent.Back -> go(OnboardingStep.WELCOME)
                else -> OnboardingMove.Stay
            }
            OnboardingStep.PROFILE -> when (e) {
                OnboardingEvent.CreateAccount -> go(OnboardingStep.SIGN_UP)
                OnboardingEvent.Guest -> go(OnboardingStep.ALL_SET)
                is OnboardingEvent.Authenticated -> go(afterAuth(e.needsUsername, e.hasMascot))
                OnboardingEvent.Skip -> OnboardingMove.Finish(asGuest = !ctx.signedIn && !ctx.guest)
                OnboardingEvent.Back -> go(OnboardingStep.TOUR)
                else -> OnboardingMove.Stay
            }
            OnboardingStep.SIGN_UP -> when (e) {
                is OnboardingEvent.Authenticated -> go(afterAuth(e.needsUsername, e.hasMascot))
                OnboardingEvent.Guest -> go(OnboardingStep.ALL_SET)
                OnboardingEvent.Back -> go(OnboardingStep.PROFILE)
                OnboardingEvent.Skip -> OnboardingMove.Finish(asGuest = !ctx.signedIn && !ctx.guest)
                else -> OnboardingMove.Stay
            }
            OnboardingStep.USERNAME -> when (e) {
                OnboardingEvent.UsernameSaved -> go(OnboardingStep.MASCOT)
                OnboardingEvent.Skip -> OnboardingMove.Finish()
                // The account exists now: there is no going back to sign-up.
                else -> OnboardingMove.Stay
            }
            OnboardingStep.MASCOT -> when (e) {
                OnboardingEvent.MascotSaved, OnboardingEvent.MascotLater -> go(OnboardingStep.ALL_SET)
                OnboardingEvent.Skip -> OnboardingMove.Finish()
                OnboardingEvent.Back -> go(OnboardingStep.USERNAME)
                else -> OnboardingMove.Stay
            }
            OnboardingStep.ALL_SET -> when (e) {
                OnboardingEvent.Play -> OnboardingMove.Finish(playClassic = true)
                OnboardingEvent.Explore, OnboardingEvent.Back, OnboardingEvent.Skip -> OnboardingMove.Finish()
                else -> OnboardingMove.Stay
            }
        }
    }

    /** After the tour: make a profile (no account yet), pick a name (signed in), or the finale (guest). */
    fun afterTour(ctx: OnboardingContext): OnboardingStep = when {
        ctx.signedIn -> OnboardingStep.USERNAME
        ctx.guest -> OnboardingStep.ALL_SET
        else -> OnboardingStep.PROFILE
    }

    /** After a sign-up / sign-in inside step 3: the username (new account), the mascot, or the finale. */
    fun afterAuth(needsUsername: Boolean, hasMascot: Boolean): OnboardingStep = when {
        needsUsername -> OnboardingStep.USERNAME
        !hasMascot -> OnboardingStep.MASCOT
        else -> OnboardingStep.ALL_SET
    }

    /**
     * Where an interrupted first run picks up (the app was closed mid-flow, e.g. to tap
     * the sign-up confirmation email). [stored] = the step saved when it was left.
     */
    fun resume(stored: String?, signedIn: Boolean, guest: Boolean): OnboardingStep {
        val s = stored?.let { name -> OnboardingStep.entries.firstOrNull { it.name == name } } ?: return START
        return when (s) {
            OnboardingStep.WELCOME, OnboardingStep.SIGN_IN -> OnboardingStep.WELCOME
            OnboardingStep.TOUR -> OnboardingStep.TOUR
            OnboardingStep.PROFILE, OnboardingStep.SIGN_UP -> when {
                signedIn -> OnboardingStep.USERNAME
                guest -> OnboardingStep.ALL_SET
                else -> OnboardingStep.PROFILE
            }
            OnboardingStep.USERNAME, OnboardingStep.MASCOT -> when {
                signedIn -> s
                guest -> OnboardingStep.ALL_SET
                else -> OnboardingStep.PROFILE
            }
            OnboardingStep.ALL_SET -> OnboardingStep.ALL_SET
        }
    }

    /** Steps where a session arriving moves the flow on (the hosted auth screens + the profile intro). */
    fun watchesAuth(step: OnboardingStep): Boolean =
        step == OnboardingStep.SIGN_IN || step == OnboardingStep.PROFILE || step == OnboardingStep.SIGN_UP

    private fun go(step: OnboardingStep) = OnboardingMove.Go(step)
}

/** AO step 3: the username rules, suggestions and the availability query's pattern. */
object OnboardingNames {
    /**
     * The first-run username rules (the account Welcome card's): 3–20 letters, numbers
     * and underscores, then the shared content screen (core Profanity mirrors the DB
     * trigger, which stays the authority). Null = fine.
     */
    fun problem(name: String): String? {
        val t = name.trim()
        if (t.length < 3) return "At least 3 characters"
        if (t.length > 20) return "20 characters max"
        if (!t.matches(Regex("^[A-Za-z0-9_]+$"))) return "Letters, numbers, and underscores only"
        return Profanity.usernameError(t)
    }

    /**
     * A PostgREST `ilike` pattern that matches [name] exactly, case-insensitively
     * (usernames are unique on lower(username)): `_` and `%` are LIKE wildcards, so
     * they — and the escape itself — are escaped.
     */
    fun exactIlike(name: String): String =
        name.trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

    private val TAILS = listOf("Wiz", "Ace", "Star", "Fox", "Owl", "Jet", "Pop", "Zip")
    private val FUN = listOf(
        "WordWizard", "PuzzlePal", "VowelHero", "LetterLark", "QuickQuill", "ClueCrafter",
        "TileTamer", "GuessGuru", "RiddleRook", "SpellSprite",
    )

    /**
     * Three distinct name ideas as chips: the player's own [base] with a number, with a
     * fun tail, and a playful word-game name. Deterministic for a [seed]; every idea
     * passes [problem] and differs from [base] (case-insensitively).
     */
    fun suggestions(base: String?, seed: Int): List<String> {
        val r = java.util.Random(seed.toLong())
        val clean = base.orEmpty().filter { it.isLetterOrDigit() && it.code < 128 || it == '_' }
            .trim('_').take(14)
        val root = if (clean.length >= 3 && problem(clean) == null) clean else "Player"
        fun num() = 10 + r.nextInt(90)
        val ideas = mutableListOf<String>()
        fun add(s: String) {
            if (problem(s) == null && !s.equals(base?.trim(), ignoreCase = true) &&
                ideas.none { it.equals(s, ignoreCase = true) }
            ) ideas += s
        }
        add("$root${num()}")
        add("${root}_${TAILS[r.nextInt(TAILS.size)]}")
        add("${FUN[r.nextInt(FUN.size)]}${num()}")
        var guard = 0
        while (ideas.size < 3 && guard++ < 20) add("${FUN[r.nextInt(FUN.size)]}${num()}")
        return ideas.take(3)
    }
}
