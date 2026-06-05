# Keep kotlinx-serialization generated serializers for the engine types.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class com.wordocious.core.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
-keep class com.wordocious.core.**$$serializer { *; }
