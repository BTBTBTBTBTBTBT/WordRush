# Unity LevelPlay: its AAR ships consumer rules (-keep com.ironsource.**,
# com.unity3d.mediation.**, com.unity3d.ironsourceads.**, OMID, adapters,
# @JavascriptInterface) that R8 applies automatically, so nothing to add here.

# Keep kotlinx-serialization generated serializers for the engine types.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class com.wordocious.core.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
-keep class com.wordocious.core.**$$serializer { *; }
