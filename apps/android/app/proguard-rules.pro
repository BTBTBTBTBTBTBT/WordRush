# R8 for release (founder, 2026-09-29). Shrinks and optimizes, but does NOT
# rename: Sentry stack traces stay readable with no mapping-file upload (there
# is no Sentry gradle plugin / auth token here).
-dontobfuscate
-keepattributes SourceFile,LineNumberTable,*Annotation*,InnerClasses,Signature,EnclosingMethod

# Libraries that ship their own consumer rules (applied automatically, nothing
# to add here): Unity LevelPlay / ironSource (com.ironsource.**,
# com.unity3d.mediation.**, com.unity3d.ironsourceads.**, OMID, adapters,
# @JavascriptInterface), Play Billing, Firebase common/components/messaging,
# androidx.credentials + googleid, Sentry, kotlinx-coroutines, WorkManager,
# and kotlinx-serialization (META-INF/com.android.tools/r8/*.pro keeps every
# @Serializable class's Companion + serializer(), which covers the app's own
# models in com.wordocious.app.** and com.wordocious.core.**).

# kotlinx-serialization: belt and braces for the engine + app models (the
# library rules above already cover the general case).
-dontnote kotlinx.serialization.**
-keepclassmembers class com.wordocious.core.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
-keep class com.wordocious.core.**$$serializer { *; }
-keepclassmembers @kotlinx.serialization.Serializable class com.wordocious.app.** {
    *** Companion;
    *** INSTANCE;
    kotlinx.serialization.KSerializer serializer(...);
}
-keep class com.wordocious.app.**$$serializer { *; }

# Socket.IO / Engine.IO (realtime VS) ship no rules; the client is small and
# uses org.json (framework) + OkHttp 3.12, whose optional TLS providers are
# absent on Android.
-keep class io.socket.** { *; }
-dontwarn io.socket.**
-dontwarn okhttp3.internal.platform.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# Supabase-kt / Ktor (Android engine set explicitly, so no ServiceLoader
# lookup): serialized models are covered by the kotlinx rules; silence optional
# JVM-only references.
-dontwarn io.ktor.**
-dontwarn org.slf4j.**
-dontwarn java.lang.management.**
