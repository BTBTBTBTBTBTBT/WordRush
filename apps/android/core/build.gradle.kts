// Pure-Kotlin/JVM engine module — NO Android dependencies, so it builds and
// tests with just a JDK (no Android SDK needed). This is the hand-ported
// Wordocious engine (mirrors apps/ios/Sources/Core + packages/core), validated
// against the SAME JSON fixtures the Swift port uses (apps/ios/Tests/Fixtures,
// copied into src/test/resources/fixtures). Word lists live in
// src/main/resources/data (same files the fixtures were generated from).
plugins {
    kotlin("jvm") version "2.0.20"
    kotlin("plugin.serialization") version "2.0.20"
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

    testImplementation("junit:junit:4.13.2")
    testImplementation("com.google.code.gson:gson:2.11.0")
}
