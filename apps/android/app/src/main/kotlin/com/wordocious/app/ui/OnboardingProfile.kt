package com.wordocious.app.ui

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.data.Profile
import com.wordocious.app.data.SupabaseConfig
import com.wordocious.app.ui.game.shakeOnReject
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

// FINISH_SPEC AO step 3 — MAKE YOUR PROFILE. The intro (Create my account / Play as
// guest), then the existing AuthScreen in sign-up mode (hosted by Onboarding.kt), then
// the USERNAME pick: a candy-styled tinted field with a live availability check (green
// check / "taken" shake) and suggestion chips. The username save is the account Welcome
// card's own write (username + has_onboarded), so that card never shows on top.

private val GREEN = Color(0xFF16A34A)
private val RED = Color(0xFFDC2626)

/** The account side of the profile step (Supabase). */
internal object OnboardingAccount {
    @Serializable
    private data class IdRow(val id: String)

    /**
     * Whether [name] is already someone else's username (case-insensitive, like the
     * unique index). Null = couldn't tell (offline): the save's own check decides.
     */
    suspend fun taken(name: String, ownId: String?): Boolean? = runCatching {
        SupabaseConfig.client.postgrest["profiles"]
            .select(Columns.raw("id")) {
                filter {
                    ilike("username", OnboardingNames.exactIlike(name))
                    if (ownId != null) neq("id", ownId)
                }
                limit(1)
            }
            .decodeList<IdRow>()
            .isNotEmpty()
    }.getOrNull()

    /** The account Welcome card's write: the username + has_onboarded. Null = saved, else a user-facing error. */
    suspend fun saveUsername(uid: String, name: String): String? {
        val r = runCatching {
            SupabaseConfig.client.postgrest["profiles"].update({
                set("username", name); set("has_onboarded", true)
            }) { filter { eq("id", uid) } }
        }
        if (r.isSuccess) return null
        val msg = r.exceptionOrNull()?.message ?: ""
        // enforce_username_policy_trg raises an already user-facing message.
        val policy = listOf(
            "That username is not available. Please choose another.",
            "Username must be 3-20 characters",
            "Username may use letters, numbers, spaces, and . _ - only",
            "Username needs at least one letter or number",
        ).firstOrNull { msg.contains(it) }
        return when {
            msg.contains("23505") || msg.contains("duplicate", true) -> TAKEN
            policy != null -> policy
            else -> "Something went wrong. Try again."
        }
    }

    const val TAKEN = "taken"

    /** Skipped before the username was saved: mark the account onboarded (fire and forget). */
    fun markOnboarded(uid: String) {
        CoroutineScope(Dispatchers.IO).launch {
            runCatching {
                SupabaseConfig.client.postgrest["profiles"].update({ set("has_onboarded", true) }) { filter { eq("id", uid) } }
            }
            AuthService.refreshProfile()
        }
    }
}

// ── 3a The profile intro ─────────────────────────────────────────────────────────

/** AO step 3, first screen: make an account, or play as a guest (guests skip 3–4). */
@Composable
internal fun ProfileStep() {
    OnboardingFrame(
        onSkip = { Onboarding.dispatch(OnboardingEvent.Skip) },
        dots = stepDots(OnboardingStep.PROFILE),
    ) {
        OnboardBody {
            // A7: O1 cheering hosts this one (W coaches the mascot step).
            CastPose(MascotId.O1, "cheer", 150.dp)
            Spacer(Modifier.height(16.dp))
            OnboardLettering("Make your profile")
            Spacer(Modifier.height(10.dp))
            OnboardLine("Save your streaks, climb the leaderboards, and race your friends.")
            Spacer(Modifier.height(28.dp))
            CandyButton(
                "Create my account", onClick = { Onboarding.dispatch(OnboardingEvent.CreateAccount) },
                color = CandyColor.PURPLE, size = CandySize.LARGE, trailing = "›", fill = true,
                modifier = ONBOARD_CTA,
            )
            Spacer(Modifier.height(12.dp))
            // The flow moves on to ALL SET once the guest session is in (Onboarding's auth watch).
            CastButton(
                "Play as guest", onClick = { AuthService.enterGuest() },
                color = CastColor.SLATE, size = CastSize.M,
                contentDescription = "Play as guest, without an account",
            )
        }
    }
}

// ── 3b The username ──────────────────────────────────────────────────────────────

private enum class NameStatus { IDLE, CHECKING, OK, TAKEN, INVALID, UNKNOWN }

/** AO step 3, after sign-up: pick a USERNAME with a live availability check and chips. */
@Composable
internal fun UsernameStep(profile: Profile?) {
    val scope = rememberCoroutineScope()
    val focus = LocalFocusManager.current
    val own = profile?.username.orEmpty()
    var name by remember { mutableStateOf(own) }
    var status by remember { mutableStateOf(NameStatus.IDLE) }
    var problem by remember { mutableStateOf<String?>(null) }
    var shake by remember { mutableIntStateOf(0) }
    var saving by remember { mutableStateOf(false) }
    var roll by remember { mutableIntStateOf(0) }
    // The username the signup made (or the generated one) once the row loads.
    LaunchedEffect(profile?.id) { if (name.isEmpty() && own.isNotEmpty()) name = own }

    // Live availability: validate instantly, ask the server after a short pause.
    LaunchedEffect(name, profile?.id) {
        val t = name.trim()
        problem = null
        if (t.isEmpty()) { status = NameStatus.IDLE; return@LaunchedEffect }
        OnboardingNames.problem(t)?.let { problem = it; status = NameStatus.INVALID; return@LaunchedEffect }
        if (t.equals(own, ignoreCase = true)) { status = NameStatus.OK; return@LaunchedEffect }
        status = NameStatus.CHECKING
        delay(450)
        status = when (OnboardingAccount.taken(t, profile?.id)) {
            true -> { shake++; NameStatus.TAKEN }
            false -> NameStatus.OK
            null -> NameStatus.UNKNOWN
        }
    }
    val ideas = remember(own, roll, profile?.id) {
        OnboardingNames.suggestions(own.ifEmpty { name }, (profile?.id?.hashCode() ?: 7) + roll * 7919)
    }
    val canSave = !saving && profile != null && (status == NameStatus.OK || status == NameStatus.UNKNOWN)
    fun save() {
        val uid = profile?.id ?: return
        val t = name.trim()
        if (!canSave) { if (status == NameStatus.TAKEN || status == NameStatus.INVALID) shake++; return }
        saving = true
        focus.clearFocus()
        scope.launch {
            when (val err = OnboardingAccount.saveUsername(uid, t)) {
                null -> {
                    Onboarding.usernameHandled()
                    AuthService.refreshProfile()
                    saving = false
                    Onboarding.dispatch(OnboardingEvent.UsernameSaved)
                }
                OnboardingAccount.TAKEN -> { saving = false; status = NameStatus.TAKEN; shake++; roll++ }
                else -> { saving = false; problem = err; status = NameStatus.INVALID; shake++ }
            }
        }
    }

    OnboardingFrame(
        onSkip = { Onboarding.dispatch(OnboardingEvent.Skip) },
        dots = stepDots(OnboardingStep.USERNAME),
    ) {
        OnboardBody {
            // A7: D with his notes — a different host from the profile intro's O1.
            CastPose(MascotId.D, "notes", 120.dp)
            Spacer(Modifier.height(12.dp))
            OnboardLettering("Pick a username")
            Spacer(Modifier.height(8.dp))
            OnboardLine("It's how you show up on leaderboards and to friends.")
            Spacer(Modifier.height(20.dp))
            NameField(
                name, onValue = { name = it.take(24) }, status = status, shakeKey = shake,
                onDone = { save() },
            )
            Spacer(Modifier.height(6.dp))
            val (line, color) = when (status) {
                NameStatus.OK -> (if (name.trim().equals(own, true)) "That one's yours." else "Nice, it's available!") to GREEN
                NameStatus.TAKEN -> "Taken. Try one of these:" to RED
                NameStatus.INVALID -> (problem ?: "Try another") to RED
                NameStatus.CHECKING -> "Checking…" to onboardMuted()
                NameStatus.UNKNOWN -> "Couldn't check right now. We'll check when you save." to onboardMuted()
                NameStatus.IDLE -> "3-20 characters. Letters, numbers, and underscores." to onboardMuted()
            }
            Text(
                line, fontFamily = Nunito, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, color = color,
                textAlign = TextAlign.Center,
                modifier = Modifier.widthIn(max = 360.dp).fillMaxWidth().semantics { liveRegion = LiveRegionMode.Polite },
            )
            Spacer(Modifier.height(12.dp))
            // Suggestions as tinted chips that squish.
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), modifier = Modifier.fillMaxWidth()) {
                ideas.forEach { idea ->
                    Box(
                        Modifier
                            .squishClickable("Use the name $idea") { name = idea }
                            .tintedPill(ONBOARD_ACCENT, 50.dp)
                            .padding(horizontal = 12.dp, vertical = 7.dp),
                    ) {
                        Text(
                            idea, fontFamily = Nunito, fontSize = 12.sp, fontWeight = FontWeight.Black, maxLines = 1,
                            color = if (WTheme.isDark) WTheme.text else FinishInk.heading,
                        )
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
            CandyButton(
                if (saving) "Saving…" else "That's me!",
                onClick = { save() },
                color = CandyColor.PURPLE, size = CandySize.LARGE, trailing = if (saving) null else "›", fill = true,
                enabled = canSave,
                contentDescription = "Save the username ${name.trim()}",
                leading = if (saving) {
                    { CircularProgressIndicator(color = Color.White, strokeWidth = 2.5.dp, modifier = Modifier.size(18.dp)) }
                } else null,
                modifier = ONBOARD_CTA,
            )
        }
    }
}

/** The candy-styled tinted field: a thick purple-washed pill, the status at its end. */
@Composable
private fun NameField(
    value: String,
    onValue: (String) -> Unit,
    status: NameStatus,
    shakeKey: Int,
    onDone: () -> Unit,
) {
    val shape = RoundedCornerShape(50)
    val edge = when (status) {
        NameStatus.OK -> GREEN
        NameStatus.TAKEN, NameStatus.INVALID -> RED
        else -> accentLine(ONBOARD_ACCENT, 0.45f)
    }
    BasicTextField(
        value = value, onValueChange = onValue, singleLine = true,
        textStyle = TextStyle(
            fontFamily = Nunito, fontSize = 20.sp, fontWeight = FontWeight.Black,
            color = if (WTheme.isDark) WTheme.text else FinishInk.heading,
        ),
        cursorBrush = SolidColor(ONBOARD_ACCENT),
        keyboardOptions = KeyboardOptions(
            capitalization = KeyboardCapitalization.None, autoCorrectEnabled = false, imeAction = ImeAction.Done,
        ),
        keyboardActions = KeyboardActions(onDone = { onDone() }),
        decorationBox = { inner ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "@", fontFamily = Nunito, fontSize = 20.sp, fontWeight = FontWeight.Black,
                    color = accentLine(ONBOARD_ACCENT, 0.9f), modifier = Modifier.clearAndSetSemantics { },
                )
                Spacer(Modifier.width(6.dp))
                Box(Modifier.weight(1f)) {
                    if (value.isEmpty()) {
                        Text("username", fontFamily = Nunito, fontSize = 20.sp, fontWeight = FontWeight.Black, color = onboardMuted())
                    }
                    inner()
                }
                Box(Modifier.size(28.dp), contentAlignment = Alignment.Center) {
                    when (status) {
                        NameStatus.CHECKING -> CircularProgressIndicator(color = ONBOARD_ACCENT, strokeWidth = 2.5.dp, modifier = Modifier.size(18.dp))
                        NameStatus.OK -> Icon3D(Icon3DName.BADGE_CHECK, 26.dp)
                        else -> Unit
                    }
                }
            }
        },
        modifier = Modifier
            .widthIn(max = 360.dp).fillMaxWidth()
            .shakeOnReject(shakeKey)
            .clip(shape)
            .tintedPill(ONBOARD_ACCENT, 50.dp)
            .border(2.dp, edge, shape)
            .padding(horizontal = 18.dp, vertical = 14.dp),
    )
}

@Composable
internal fun onboardMuted(): Color = if (WTheme.isDark) WTheme.textMuted else FinishInk.muted
