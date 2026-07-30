package com.wordocious.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.wordocious.app.data.SupabaseConfig
import com.wordocious.app.ui.theme.Nunito
import com.wordocious.app.ui.theme.WTheme
import io.github.jan.supabase.auth.auth
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// Native completion of the password-reset flow (iOS NewPasswordSheet parity):
// the recovery app-link established a session; this dialog sets the new
// password and the user stays signed in — no web hop, no re-typing.
@Composable
fun NewPasswordDialog(onDone: () -> Unit) {
    var password by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }
    var done by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Dialog(onDismissRequest = onDone) {
        Column(
            Modifier.widthIn(max = 360.dp).fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(WTheme.surface)
                .border(1.5.dp, WTheme.border, RoundedCornerShape(20.dp))
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                "WORDOCIOUS", fontSize = 26.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp,
                style = TextStyle(brush = Brush.horizontalGradient(listOf(WTheme.wordmarkStart, WTheme.wordmarkEnd)), fontFamily = Nunito),
            )
            Text("Set a New Password", fontSize = 18.sp, fontWeight = FontWeight.Black, color = WTheme.text)

            if (done) {
                // iOS holds this confirmation for 1.5s before dismissing the sheet.
                Text(
                    "Password updated — you're signed in!",
                    fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF047857),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFFECFDF5))
                        .border(1.dp, Color(0xFFA7F3D0), RoundedCornerShape(12.dp))
                        .padding(12.dp),
                )
            } else {
                PasswordField("New Password", password) { password = it }
                PasswordField("Confirm Password", confirm) { confirm = it }
                error?.let {
                    Text(
                        it, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFFDC2626),
                        modifier = Modifier.fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFFFEE2E2))
                            .border(1.dp, Color(0xFFFECACA), RoundedCornerShape(12.dp))
                            .padding(12.dp),
                    )
                }
                Button3D(
                    onClick = {
                        error = null
                        when {
                            password.length < 6 -> error = "Password must be at least 6 characters."
                            password != confirm -> error = "Passwords don't match."
                            else -> {
                                saving = true
                                scope.launch {
                                    val res = runCatching {
                                        SupabaseConfig.client.auth.updateUser { this.password = password }
                                    }
                                    saving = false
                                    if (res.isSuccess) {
                                        done = true
                                        delay(1500)
                                        onDone()
                                    } else {
                                        // Supabase's own message is actionable ("New password
                                        // should be different from the old password") — iOS
                                        // shows it verbatim, so don't swallow it.
                                        error = res.exceptionOrNull()?.message?.takeIf { m -> m.isNotBlank() }
                                            ?: "Couldn't update password. Try again."
                                    }
                                }
                            }
                        }
                    },
                    face = Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFF6D28D9))),
                    shadow = Color(0xFF4C1D95),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    enabled = !saving,
                ) {
                    Text(
                        if (saving) "Saving…" else "Save New Password",
                        fontSize = 15.sp, fontWeight = FontWeight.Black, color = Color.White,
                    )
                }
                Text(
                    "Close", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = WTheme.textMuted,
                    modifier = Modifier.clickableNoRipple { if (!saving) onDone() }.padding(4.dp),
                )
            }
        }
    }
}

/** Branded password field — iOS: WTheme.bg fill, 10-radius, 1.5 border, bold 15. */
@Composable
private fun PasswordField(label: String, value: String, onValue: (String) -> Unit) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.Black, color = WTheme.textMuted)
        BasicTextField(
            value = value,
            onValueChange = onValue,
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            textStyle = TextStyle(fontFamily = Nunito, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = WTheme.text),
            cursorBrush = SolidColor(WTheme.primary),
            modifier = Modifier.fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(WTheme.bg)
                .border(1.5.dp, WTheme.border, RoundedCornerShape(10.dp))
                .padding(horizontal = 12.dp, vertical = 11.dp),
        )
    }
}
