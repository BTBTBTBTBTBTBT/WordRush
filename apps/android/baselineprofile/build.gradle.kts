// Baseline Profile generator (founder, 2026-09-29). Drives the release-like app
// through the hot paths (cold start → Home → Classic → type → back → Leaderboard
// → scroll → Stats) and writes the profile the :app release build ships, so ART
// AOT-compiles those paths at install instead of interpreting them on first use.
// Generate on a connected API 33+ device/emulator:
//   ./gradlew :app:generateBaselineProfile
plugins {
    id("com.android.test")
    kotlin("android")
    id("androidx.baselineprofile")
}

android {
    namespace = "com.wordocious.baselineprofile"
    compileSdk = 36

    defaultConfig {
        minSdk = 28
        targetSdk = 36
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }

    targetProjectPath = ":app"
}

baselineProfile {
    // The connected emulator/device, not a Gradle-managed one.
    useConnectedDevices = true
}

dependencies {
    implementation("androidx.test.ext:junit:1.2.1")
    implementation("androidx.test.uiautomator:uiautomator:2.3.0")
    implementation("androidx.benchmark:benchmark-macro-junit4:1.3.3")
}
