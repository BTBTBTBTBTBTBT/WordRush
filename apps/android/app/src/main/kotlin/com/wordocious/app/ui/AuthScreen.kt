package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
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
fun AuthScreen(onAuthenticated: () -> Unit) {
    var isSignIn by remember { mutableStateOf(true) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var working by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(WTheme.bg)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Wordmark
        Text(
            "WORDOCIOUS",
            fontSize = 28.sp,
            fontWeight = FontWeight.Black,
            style = TextStyle(brush = WTheme.wordmarkGradient),
        )
        Text(
            "Epic Word Battles",
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = WTheme.textMuted,
            modifier = Modifier.padding(top = 4.dp, bottom = 28.dp),
        )

        // Card
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(WTheme.surface, RoundedCornerShape(16.dp))
                .border(1.5.dp, WTheme.border, RoundedCornerShape(16.dp))
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                if (isSignIn) "Welcome Back!" else "Join the Fun!",
                fontSize = 18.sp,
                fontWeight = FontWeight.Black,
                color = WTheme.text,
            )

            // TODO: Google / Apple OAuth buttons — deferred pending OAuth config
            SocialPlaceholder()

            // Divider
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                androidx.compose.foundation.layout.Box(
                    Modifier.weight(1f).height(1.dp).background(WTheme.border)
                )
                Text("or", fontSize = 11.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
                androidx.compose.foundation.layout.Box(
                    Modifier.weight(1f).height(1.dp).background(WTheme.border)
                )
            }

            // Sign-up: username
            if (!isSignIn) {
                AuthField("Username", username, onValue = { username = it })
            }
            AuthField("Email", email, onValue = { email = it }, keyboardType = KeyboardType.Email)
            AuthField("Password", password, onValue = { password = it }, isPassword = true)

            // Error
            if (error != null) {
                Text(
                    error!!,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = WTheme.lossText,
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFFFEE2E2), RoundedCornerShape(10.dp))
                        .border(1.dp, Color(0xFFFECACA), RoundedCornerShape(10.dp))
                        .padding(10.dp),
                )
            }

            // Submit button (btn-3d: purple face + dark-purple shadow, like web CTA)
            val submit = {
                error = null
                when {
                    email.isBlank() || password.isBlank() -> error = "Email and password are required"
                    !isSignIn && username.isBlank() -> error = "Username is required"
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
                onClick = { if (!working) submit() },
                face = Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFF6D28D9))),
                shadow = Color(0xFF4C1D95),
                modifier = Modifier.fillMaxWidth(),
                enabled = !working,
            ) {
                if (working) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.height(20.dp))
                } else {
                    Text(
                        if (isSignIn) "Sign In" else "Create Account",
                        color = Color.White, fontWeight = FontWeight.Black, fontSize = 15.sp,
                    )
                }
            }
        }

        Spacer(Modifier.height(16.dp))

        // Toggle sign in / sign up
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                if (isSignIn) "Don't have an account?" else "Already have an account?",
                fontSize = 13.sp, color = WTheme.textMuted, fontWeight = FontWeight.Bold,
            )
            TextButton(onClick = { isSignIn = !isSignIn; error = null }) {
                Text(
                    if (isSignIn) "Sign Up" else "Sign In",
                    fontSize = 13.sp, color = WTheme.primary, fontWeight = FontWeight.Black,
                )
            }
        }

        Spacer(Modifier.height(32.dp))

        // Footer
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            listOf("Privacy Policy", "Terms of Service").forEach {
                Text(it, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted)
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

@Composable
private fun SocialPlaceholder() {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            "Google sign-in coming soon",
            fontSize = 11.sp, color = WTheme.textMuted,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth()
                .background(WTheme.surfaceAlt, RoundedCornerShape(10.dp))
                .padding(12.dp),
        )
    }
}
