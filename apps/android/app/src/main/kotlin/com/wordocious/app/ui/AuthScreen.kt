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
import androidx.compose.material.icons.filled.Close
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
    var mode by remember { mutableStateOf("signin") }
    val isSignIn = mode == "signin"
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var resetSent by remember { mutableStateOf(false) }
    var working by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .appBackground()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Overlay mode gets a close affordance (iOS sheets get the system grabber).
        if (onDismiss != null) {
            Row(Modifier.fillMaxWidth()) {
                Spacer(Modifier.weight(1f))
                androidx.compose.foundation.layout.Box(
                    Modifier.size(30.dp)
                        .clip(androidx.compose.foundation.shape.CircleShape)
                        .background(WTheme.surfaceAlt)
                        .clickableNoRipple(onDismiss),
                    Alignment.Center,
                ) {
                    androidx.compose.material3.Icon(
                        androidx.compose.material.icons.Icons.Filled.Close, "Close",
                        tint = WTheme.textMuted, modifier = Modifier.size(14.dp),
                    )
                }
            }
        }
        // Wordmark
        Text(
            "WORDOCIOUS",
            fontSize = 28.sp,
            fontWeight = FontWeight.Black,
            style = TextStyle(brush = WTheme.wordmarkGradient, fontFamily = Nunito),
        )
        Text(
            "Epic Word Battles",
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = WTheme.textMuted,
            modifier = Modifier.padding(top = 4.dp, bottom = 28.dp),
        )

        // Card — iOS AuthView: 20pt radius, 18pt padding, 16pt stack spacing, and
        // a violet-300 stroke (NOT the neutral --color-border used elsewhere).
        // The purple edge is what makes the sign-in card feel on-brand.
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(WTheme.surface, RoundedCornerShape(20.dp))
                .border(1.5.dp, Color(0xFFC4B5FD), RoundedCornerShape(20.dp))
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                when (mode) { "signin" -> "Welcome Back!"; "signup" -> "Join the Fun!"; else -> "Reset Password" },
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
                color = WTheme.text,
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
                        Modifier.weight(1f).height(1.dp).background(WTheme.border)
                    )
                    Text("or", fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, color = WTheme.textMuted)
                    androidx.compose.foundation.layout.Box(
                        Modifier.weight(1f).height(1.dp).background(WTheme.border)
                    )
                }
            }

            // Sign-up: username
            if (mode == "signup") {
                AuthField("Username", username, onValue = { username = it })
            }
            AuthField("Email", email, onValue = { email = it }, keyboardType = KeyboardType.Email)
            if (mode != "reset") {
                AuthField("Password", password, onValue = { password = it }, isPassword = true)
            }
            if (mode == "signin") {
                Text(
                    "Forgot password?",
                    fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.primary,
                    modifier = Modifier
                        .align(Alignment.End)
                        .clickableNoRipple { mode = "reset"; error = null; resetSent = false },
                )
            }

            // Reset-link confirmation (deliberately shown for any address — no
            // account probing, web/iOS parity).
            if (resetSent) {
                Text(
                    "Check your email — if an account exists for that address, a reset link is on its way.",
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
                    else -> {
                        working = true
                        scope.launch {
                            val err = if (isSignIn) AuthService.signInWithEmail(email.trim(), password)
                            else AuthService.signUpWithEmail(email.trim(), password, username.trim())
                            working = false
                            if (err != null) error = err else onAuthenticated()
                        }
                    }
                }
            }
            Button3D(
                onClick = { if (!working && !(mode == "reset" && resetSent)) submit() },
                face = Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFF6D28D9))),
                shadow = Color(0xFF4C1D95),
                modifier = Modifier.fillMaxWidth(),
                enabled = !working && !(mode == "reset" && resetSent),
            ) {
                if (working) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.height(20.dp))
                } else {
                    Text(
                        when (mode) { "signin" -> "Sign In"; "signup" -> "Create Account"; else -> "Send Reset Link" },
                        color = Color.White, fontWeight = FontWeight.Black, fontSize = 15.sp,
                    )
                }
            }
        }

        Spacer(Modifier.height(16.dp))

        // Toggle sign in / sign up
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                when (mode) { "signin" -> "Don't have an account?"; "signup" -> "Already have an account?"; else -> "Remembered it?" },
                fontSize = 13.sp, color = WTheme.textMuted, fontWeight = FontWeight.Bold,
            )
            TextButton(onClick = {
                mode = if (mode == "signin") "signup" else "signin"
                error = null; resetSent = false
            }) {
                Text(
                    if (isSignIn) "Sign Up" else "Sign In",
                    fontSize = 13.sp, color = WTheme.primary, fontWeight = FontWeight.Black,
                )
            }
        }

        // Apple 5.1.1(v) / Google Play: a signed-out visitor must be able to play
        // the single-player daily without registering.
        TextButton(onClick = { AuthService.enterGuest() }) {
            Text(
                "Play without an account",
                fontSize = 13.sp, color = WTheme.textMuted, fontWeight = FontWeight.Black,
                textDecoration = androidx.compose.ui.text.style.TextDecoration.Underline,
            )
        }

        Spacer(Modifier.height(24.dp))

        // Footer — functional legal links (App Review expects these to work),
        // opening the in-app Privacy/Terms pages like the web's <Link> footer.
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("Privacy Policy" to "privacy", "Terms of Service" to "terms").forEach { (label, route) ->
                Text(
                    label, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                    modifier = Modifier.clickableNoRipple { infoRoute = route },
                )
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
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValue,
        label = { Text(label, fontSize = 13.sp) },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        visualTransformation = if (isPassword) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        shape = RoundedCornerShape(12.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = WTheme.primary,
            unfocusedBorderColor = WTheme.border,
            focusedLabelColor = WTheme.primary,
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
            .clip(RoundedCornerShape(12.dp))
            // iOS fills with Theme.background, not hard white — a hardcoded
            // white button with dark-grey text was unreadable in the dark theme.
            .background(WTheme.bg)
            .border(1.5.dp, WTheme.border, RoundedCornerShape(12.dp))
            .clickableNoRipple {
                if (!busy) {
                    busy = true
                    scope.launch {
                        val err = com.wordocious.app.data.AuthService.signInWithGoogle(context)
                        busy = false
                        if (err != null) onError(err)
                    }
                }
            }
            .padding(vertical = 12.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // The official four-colour mark at 20dp, matching iOS's Image("google").
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
