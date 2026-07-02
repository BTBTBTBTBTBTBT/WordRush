import java.util.Properties

plugins {
    id("com.android.application") version "8.6.1"
    kotlin("android") version "2.0.20"
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.20"
    kotlin("plugin.serialization") version "2.0.20"
}

android {
    namespace = "com.wordocious.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.wordocious.app"
        minSdk = 26          // Android 8.0 — matches the modern install base; web/iOS parity not affected
        targetSdk = 35       // Play requires new apps target API 35 (Android 15) as of 2025-08

        versionCode = 24
        versionName = "1.0"
        vectorDrawables { useSupportLibrary = true }
    }

    // Release signing — reads apps/android/key.properties (gitignored; keystore
    // lives at ~/.android-keys/wordocious-upload.jks — BACK IT UP). When the
    // file is absent (CI, fresh clones) release builds stay unsigned.
    val keystoreProps = Properties().apply {
        val f = rootProject.file("key.properties")
        if (f.exists()) f.inputStream().use { p -> load(p) }
    }
    signingConfigs {
        if (!keystoreProps.isEmpty) {
            create("release") {
                storeFile = file(keystoreProps["storeFile"] as String)
                storePassword = keystoreProps["storePassword"] as String
                keyAlias = keystoreProps["keyAlias"] as String
                keyPassword = keystoreProps["keyPassword"] as String
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (!keystoreProps.isEmpty) signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    buildFeatures { compose = true }

    packaging {
        resources { excludes += "/META-INF/{AL2.0,LGPL2.1}" }
    }
}

dependencies {
    implementation(project(":core"))

    // Supabase Kotlin client (same project as iOS — eniiqqsxpmuyrspvepiw)
    val supabaseBom = platform("io.github.jan-tennert.supabase:bom:3.0.2")
    implementation(supabaseBom)
    implementation("io.github.jan-tennert.supabase:postgrest-kt")
    implementation("io.github.jan-tennert.supabase:auth-kt")
    implementation("io.github.jan-tennert.supabase:storage-kt")
    implementation("io.ktor:ktor-client-android:3.0.2")  // HTTP engine for Supabase on Android

    // kotlinx-serialization for the :app data models
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

    // Google Play Billing (Pro subscriptions + day pass) — coroutine extensions
    implementation("com.android.billingclient:billing-ktx:7.1.1")
    // Play in-app review (win-moment rating ask)
    implementation("com.google.android.play:review-ktx:2.0.2")

    // Socket.IO client for realtime VS (same server.wordocious.com socket.io
    // server the web + iOS connect to). Pulls org.json + OkHttp transitively.
    implementation("io.socket:socket.io-client:2.1.0")

    val composeBom = platform("androidx.compose:compose-bom:2024.09.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.work:work-runtime-ktx:2.9.1")  // daily-reminder scheduling
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.6")
    implementation("androidx.lifecycle:lifecycle-process:2.8.6") // ProcessLifecycleOwner — pause game timer on background
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.6")
    implementation("androidx.activity:activity-compose:1.9.2")

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    // Avatar image loading (profile + leaderboard avatars from avatar_url).
    implementation("io.coil-kt:coil-compose:2.7.0")

    // AdMob (Google Mobile Ads + UMP consent) — game-start interstitial for free users
    implementation("com.google.android.gms:play-services-ads:23.5.0")
    implementation("com.google.android.ump:user-messaging-platform:3.1.0")

    // Google sign-in (Credential Manager -> Supabase signInWithIdToken)
    implementation("androidx.credentials:credentials:1.3.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.3.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")

    debugImplementation("androidx.compose.ui:ui-tooling")

    testImplementation("junit:junit:4.13.2")
}
