// Plugin versions live here so :app and :baselineprofile share one AGP / Kotlin
// classloader — the Baseline Profile plugin wires the two modules together
// (founder, 2026-09-29). Modules apply these without versions.
plugins {
    id("com.android.application") version "8.6.1" apply false
    id("com.android.test") version "8.6.1" apply false
    kotlin("android") version "2.0.20" apply false
    kotlin("jvm") version "2.0.20" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.20" apply false
    kotlin("plugin.serialization") version "2.0.20" apply false
    id("com.google.gms.google-services") version "4.4.2" apply false
    id("androidx.baselineprofile") version "1.3.3" apply false
}
