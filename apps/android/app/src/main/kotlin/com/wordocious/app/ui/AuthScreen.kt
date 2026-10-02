package com.wordocious.app.ui

import com.wordocious.app.ui.theme.Nunito

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.width
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.AuthService
import com.wordocious.app.ui.theme.WTheme
import kotlinx.coroutines.launch

private val AUTH_PURPLE = Color(0xFF7C3AED)

/**
 * Auth screen — ported from web components/auth/login-screen.tsx and iOS AuthView.swift.
 * Source of truth: the web. Shows WORDOCIOUS wordmark, "Welcome Back!"/"Join the Fun!",
 * email + password fields (+ username for sign-up), toggle, error card.
 * Google and Apple sign-in deferred to the next pass (requires OAuth config).
 */
@Composable
fun AuthScreen(
    onAuthenticated: () -> Unit,
    /**
     * Non-null when shown as a DISMISSIBLE overlay from the guest header, which
     * is how iOS presents it (`.sheet(isPresented: $showAuth) { AuthView() }`).
     * Null = the root sign-in gate, which has nothing to go back to.
     */
    onDismiss: (() -> Unit)? = null,
    /** The mode it opens in: "signin" (default) or "signup" (FINISH_SPEC AO step 3). */
    initialMode: String = "signin",
) {
    // Pre-auth Privacy/Terms overlay (web parity: the footer links work).
    var infoRoute by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf<String?>(null) }
    infoRoute?.let { route ->
        InfoScreen(kind = route, onDone = { infoRoute = null })
        return
    }
    // Hardware back closes the overlay rather than leaving the app.
    if (onDismiss != null) androidx.activity.compose.BackHandler { onDismiss() }
    // "signin" | "signup" | "reset" — reset emails a recovery link that finishes
    // on the web reset page (wordocious.com/auth/reset), web/iOS parity.
    var mode by remember { mutableStateOf(if (initialMode == "signup") "signup" else "signin") }
    val isSignIn = mode == "signin"
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    // A masked field with no reveal makes a typo uncatchable, and a typo on
    // sign-up creates an account nobody can ever sign into.
    var showPassword by remember { mutableStateOf(false) }
    var username by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var resetSent by remember { mutableStateOf(false) }
    var signupSent by remember { mutableStateOf(false) }
    var working by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .pageBackground(PageTint.HOME)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Overlay mode gets a close affordance (iOS sheets get the system grabber).
        if (onDismiss != null) {
            Row(Modifier.fillMaxWidth()) {
                Spacer(Modifier.weight(1f))
                // The shared white close circle (HEADER_SPEC §4).
                HeaderBackButton(onDismiss, close = true)
            }
        }
        // WELCOME! heads sign-in (ART_SPEC §8) — the shared headline (N1 sizing).
        // G5: a cast pose over the lettering-only title (FINISH_SPEC N1 — the title has no cast now).
        CastPose(MascotId.W, "wave", 92.dp)
        PageHeadline(TitleArt.WELCOME, Modifier.padding(bottom = 12.dp))
        // Wordmark
        Text(
            "WORDOCIOUS",
            fontSize = 28.sp,
            fontWeight = FontWeight.Black,
            style = TextStyle(brush = WTheme.wordmarkGradient, fontFamily = Nunito),
        )
        Text(
            "Daily Word Games",
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = WTheme.textMuted,
            modifier = Modifier.padding(top = 4.dp, bottom = 28.dp),
        )

        // Card — iOS AuthView: 20pt radius, 18pt padding, 16pt stack spacing, and
        // a violet-300 stroke (NOT the neutral --color-border used elsewhere).
        // The purple edge is what makes the sign-in card feel on-brand.
        // FINISH_SPEC A1 / G5: the card is a lavender tinted card with the purple → pink bar.
        TintedCard(
            AUTH_PURPLE, Modifier.fillMaxWidth(),
            bar = Brush.horizontalGradient(listOf(Color(0xFF7C3AED), Color(0xFFEC4899))),
            line = accentLine(AUTH_PURPLE, 0.40f),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(18.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            // iOS's card is a VStack, which centers its children by default;
            // Compose's Column defaults to Start, so this heading sat
            // left-aligned against a centered wordmark and centered everything
            // else. Center it explicitly rather than centering the whole Column,
            // which would drag the field labels off their leading edge.
            Text(
                when (mode) { "signin" -> "WELCOME BACK!"; "signup" -> "JOIN THE FUN!"; else -> "RESET PASSWORD" },
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
                color = if (WTheme.isDark) WTheme.text else FinishInk.heading,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )

            if (mode == "reset") {
                Text(
                    "Enter your email and we'll send you a link to set a new password. Works for Google accounts too.",
                    fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                    textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth(),
                )
            }

            if (mode != "reset") {
                // TODO: Google / Apple OAuth buttons — deferred pending OAuth config
                GoogleSignInButton(onError = { error = it })

                // Divider
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    androidx.compose.foundation.layout.Box(
                        Modifier.weight(1f).height(1.5.dp).background(accentLine(AUTH_PURPLE))
                    )
                    Text("or", fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (WTheme.isDark) WTheme.textMuted else FinishInk.muted)
                    androidx.compose.foundation.layout.Box(
                        Modifier.weight(1f).height(1.5.dp).background(accentLine(AUTH_PURPLE))
                    )
                }
            }

            // Sign-up: username
            if (mode == "signup") {
                AuthField("Username", username, onValue = { username = it })
            }
            AuthField("Email", email, onValue = { email = it }, keyboardType = KeyboardType.Email)
            if (mode != "reset") {
                AuthField(
                    "Password", password, onValue = { password = it }, isPassword = true,
                    revealed = showPassword, onToggleReveal = { showPassword = !showPassword },
                )
            }
            if (mode == "signup") {
                AuthField(
                    "Confirm password", confirmPassword, onValue = { confirmPassword = it },
                    isPassword = true, revealed = showPassword,
                    onToggleReveal = { showPassword = !showPassword },
                    isError = confirmPassword.isNotEmpty() && confirmPassword != password,
                )
            }
            if (mode == "signin") {
                // A8: a small soft peach candy button (was a text link).
                CandyButton(
                    "Forgot password?", onClick = { mode = "reset"; error = null; resetSent = false },
                    color = CandyColor.PEACH, size = CandySize.SMALL,
                    modifier = Modifier.align(Alignment.End),
                )
            }

            // Reset-link confirmation (deliberately shown for any address — no
            // account probing, web/iOS parity) and the sign-up confirmation.
            // The sign-up case used to arrive as a plain string in the RED error
            // card, so a successful registration read as a failure.
            if (resetSent || signupSent) {
                Text(
                    if (signupSent) "Account created. Check your email for a confirmation link, then sign in."
                    else "Check your email — if an account exists for that address, a reset link is on its way.",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF047857),
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFECFDF5), RoundedCornerShape(12.dp))
                        .border(1.dp, Color(0xFFA7F3D0), RoundedCornerShape(12.dp))
                        .padding(12.dp),
                )
            }

            // Error
            if (error != null) {
                Text(
                    error!!,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    // Fixed, like iOS: the card fill below is a hardcoded #FEE2E2,
                    // and WTheme.lossText is #F87171 in Dark — 2.26:1, so a mistyped
                    // password produced an unreadable explanation.
                    color = Color(0xFFDC2626),
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFFEE2E2), RoundedCornerShape(12.dp))
                        .border(1.dp, Color(0xFFFECACA), RoundedCornerShape(12.dp))
                        .padding(12.dp),
                )
            }

            // Submit button (btn-3d: purple face + dark-purple shadow, like web CTA)
            val submit = {
                error = null
                when {
                    mode == "reset" && !email.contains("@") -> error = "Enter your email address."
                    mode == "reset" -> {
                        working = true
                        scope.launch {
                            AuthService.resetPassword(email.trim())
                            working = false; resetSent = true
                        }
                    }
                    email.isBlank() || password.isBlank() -> error = "Email and password are required"
                    password.length < 6 -> error = "Password must be at least 6 characters."
                    mode == "signup" && username.trim().length !in 3..20 -> error = "Username must be 3-20 characters."
                    mode == "signup" && password != confirmPassword -> error = "Passwords do not match"
                    else -> {
                        working = true
                        scope.launch {
                            if (isSignIn) {
                                val err = AuthService.signInWithEmail(email.trim(), password)
                                working = false
                                if (err != null) error = err else onAuthenticated()
                            } else {
                                when (val out = AuthService.signUpWithEmail(email.trim(), password, username.trim())) {
                                    // Confirmation is on, so this is the normal
                                    // path: the account exists, there's just no
                                    // session until the email link is tapped.
                                    is AuthService.SignUpOutcome.ConfirmEmail -> { working = false; signupSent = true }
                                    is AuthService.SignUpOutcome.SignedIn -> { working = false; onAuthenticated() }
                                    is AuthService.SignUpOutcome.Failed -> { working = false; error = out.message }
                                }
                            }
                        }
                    }
                }
            }
            // A8: the large purple candy CTA (a spinner leads the label while working).
            val submitLabel = when (mode) { "signin" -> "Sign In"; "signup" -> "Create Account"; else -> "Send Reset Link" }
            CandyButton(
                if (working) "Please wait\u2026" else submitLabel,
                onClick = { if (!working && !(mode == "reset" && resetSent)) submit() },
                color = CandyColor.PURPLE, size = CandySize.LARGE, fill = true,
                enabled = !working && !(mode == "reset" && resetSent),
                contentDescription = submitLabel,
                leading = if (working) {
                    { CircularProgressIndicator(color = Color.White, strokeWidth = 2.5.dp, modifier = Modifier.size(18.dp)) }
                } else null,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        Spacer(Modifier.height(16.dp))

        // Toggle sign in / sign up
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                when (mode) { "signin" -> "Don't have an account?"; "signup" -> "Already have an account?"; else -> "Remembered it?" },
                fontSize = 13.sp, color = if (WTheme.isDark) WTheme.textMuted else FinishInk.muted, fontWeight = FontWeight.Bold,
            )
            // A8: the mode switch is a small pink candy button (was a TextButton).
            CandyButton(
                if (isSignIn) "Sign Up" else "Sign In",
                onClick = {
                    mode = if (mode == "signin") "signup" else "signin"
                    error = null; resetSent = false
                },
                color = CandyColor.PINK, size = CandySize.SMALL,
            )
        }

        Spacer(Modifier.height(14.dp))
        // Apple 5.1.1(v) / Google Play: a signed-out visitor must be able to play
        // the single-player daily without registering. A8: a soft peach candy button.
        CandyButton(
            "Play without an account", onClick = { AuthService.enterGuest() },
            color = CandyColor.PEACH, size = CandySize.MEDIUM, icon = CandyIcon.PLAY,
        )

        Spacer(Modifier.height(24.dp))

        // Footer — functional legal links (App Review expects these to work),
        // opening the in-app Privacy/Terms pages like the web's <Link> footer.
        // Navigation links as tinted chips that squish (A1 / A9).
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("Privacy Policy" to "privacy", "Terms of Service" to "terms").forEach { (label, route) ->
                InfoLinkChip(label, AUTH_PURPLE) { infoRoute = route }
            }
        }
    }
}

@Composable
private fun AuthField(
    label: String,
    value: String,
    onValue: (String) -> Unit,
    keyboardType: KeyboardType = KeyboardType.Text,
    isPassword: Boolean = false,
    /** Password fields get an eye toggle; null keeps the field plain. */
    revealed: Boolean = false,
    onToggleReveal: (() -> Unit)? = null,
    isError: Boolean = false,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValue,
        label = { Text(label, fontSize = 13.sp) },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        isError = isError,
        // Password fields MUST declare KeyboardType.Password — the visual
        // transformation alone only draws dots. Without the keyboard type,
        // Gboard treats the field as plain text, LEARNS the password into its
        // personal dictionary, and suggests it back on the first letter
        // (tester-reported). Forced here so no call site can forget, and kept
        // while revealed — the eye toggle changes rendering, not the keyboard.
        keyboardOptions = KeyboardOptions(
            keyboardType = if (isPassword) KeyboardType.Password else keyboardType,
        ),
        visualTransformation = if (isPassword && !revealed) PasswordVisualTransformation()
            else androidx.compose.ui.text.input.VisualTransformation.None,
        trailingIcon = if (isPassword && onToggleReveal != null) {
            {
                androidx.compose.foundation.layout.Box(
                    Modifier.size(40.dp).squishClickable(if (revealed) "Hide password" else "Show password", icon = true, onClick = onToggleReveal),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        if (revealed) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                        contentDescription = null,
                        tint = if (WTheme.isDark) WTheme.textMuted else FinishInk.label,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }
        } else null,
        shape = RoundedCornerShape(14.dp),
        // FINISH_SPEC A1 / G5: tinted inputs — the purple wash with its line, never a white field.
        colors = OutlinedTextFieldDefaults.colors(
            focusedContainerColor = accentWash(AUTH_PURPLE, 0.10f),
            unfocusedContainerColor = accentWash(AUTH_PURPLE, 0.10f),
            errorContainerColor = accentWash(Color(0xFFDC2626), 0.08f),
            focusedBorderColor = AUTH_PURPLE,
            unfocusedBorderColor = accentLine(AUTH_PURPLE),
            focusedLabelColor = AUTH_PURPLE,
            unfocusedLabelColor = if (WTheme.isDark) WTheme.textMuted else FinishInk.label,
            focusedTextColor = if (WTheme.isDark) WTheme.text else FinishInk.heading,
            unfocusedTextColor = if (WTheme.isDark) WTheme.text else FinishInk.heading,
            cursorColor = AUTH_PURPLE,
        ),
    )
}

/** "Continue with Google" — web/iOS parity (white card button, G mark, bold label). */
@Composable
private fun GoogleSignInButton(onError: (String) -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    var busy by androidx.compose.runtime.remember { androidx.compose.runtime.mutableStateOf(false) }
    Row(
        modifier = Modifier.fillMaxWidth()
            // A9: the squish; the button keeps Google's required look (light fill, the G mark).
            .squishClickable(if (busy) "Signing in" else "Continue with Google") {
                if (!busy) {
                    busy = true
                    scope.launch {
                        val err = com.wordocious.app.data.AuthService.signInWithGoogle(context)
                        busy = false
                        if (err != null) onError(err)
                    }
                }
            }
            .clip(RoundedCornerShape(12.dp))
            // iOS fills with Theme.background, not hard white — a hardcoded
            // white button with dark-gray text was unreadable in the dark theme.
            .background(WTheme.bg)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(12.dp))
            .padding(vertical = 12.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // The official four-color mark at 20dp, matching iOS's Image("google").
        androidx.compose.foundation.Image(
            painter = androidx.compose.ui.res.painterResource(com.wordocious.app.R.drawable.ic_google),
            contentDescription = null,
            modifier = Modifier.size(20.dp),
        )
        Spacer(Modifier.width(12.dp))
        Text(
            if (busy) "Signing in…" else "Continue with Google",
            fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.text,
        )
    }
}
