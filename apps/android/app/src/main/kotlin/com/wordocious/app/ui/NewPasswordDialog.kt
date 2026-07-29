package com.wordocious.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wordocious.app.data.SupabaseConfig
import com.wordocious.app.ui.theme.Nunito
import io.github.jan.supabase.auth.auth
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
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = onDone,
        title = { Text("Set a New Password", fontWeight = FontWeight.Black, fontFamily = Nunito) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = password, onValueChange = { password = it },
                    label = { Text("New password", fontSize = 13.sp) },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true, modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = confirm, onValueChange = { confirm = it },
                    label = { Text("Confirm password", fontSize = 13.sp) },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true, modifier = Modifier.fillMaxWidth(),
                )
                error?.let { Text(it, fontSize = 12.sp, color = Color(0xFFDC2626), fontWeight = FontWeight.Bold) }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    error = null
                    when {
                        password.length < 6 -> error = "Password must be at least 6 characters."
                        password != confirm -> error = "Passwords don't match."
                        else -> {
                            saving = true
                            scope.launch {
                                val ok = runCatching {
                                    SupabaseConfig.client.auth.updateUser { this.password = password }
                                }.isSuccess
                                saving = false
                                if (ok) onDone() else error = "Couldn't update password. Try again."
                            }
                        }
                    }
                },
                enabled = !saving,
            ) { Text(if (saving) "Saving…" else "Save", fontWeight = FontWeight.Black) }
        },
        dismissButton = { TextButton(onClick = onDone) { Text("Cancel", fontWeight = FontWeight.Black) } },
    )
}
