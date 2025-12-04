# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# ===========================
# React Native Core
# ===========================
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
}

# Keep native methods
-keepclassmembers class * {
    native <methods>;
}

# ===========================
# TensorFlow Lite Optimization
# ===========================
-keep class org.tensorflow.** { *; }
-keep interface org.tensorflow.** { *; }
-keepclassmembers class org.tensorflow.** { *; }
-dontwarn org.tensorflow.lite.gpu.**

# Keep TFLite delegates for ARM optimization
-keep class org.tensorflow.lite.gpu.** { *; }
-keep class org.tensorflow.lite.nnapi.** { *; }

# ===========================
# llama.rn / llama.cpp
# ===========================
-keep class com.rnllama.** { *; }
-keepclassmembers class com.rnllama.** { *; }

# ===========================
# JNA (used by llama.rn)
# ===========================
-dontwarn java.awt.**
-dontwarn com.sun.jna.**
-keep class com.sun.jna.** { *; }

# ===========================
# Vosk Speech Recognition
# ===========================
-keep class org.vosk.** { *; }
-keep interface org.vosk.** { *; }
-keepclassmembers class org.vosk.** { *; }

# ===========================
# Audio Capture Module
# ===========================
-keep class com.lylyt.audio.** { *; }
-keepclassmembers class com.lylyt.audio.** { *; }

# ===========================
# Custom Native Modules
# ===========================
-keep class com.lylyt.tflite.** { *; }
-keep class com.captivate.tts.** { *; }

# ===========================
# React Native Bridge
# ===========================
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.uimanager.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# ===========================
# Hermes Engine
# ===========================
-keep class com.facebook.hermes.** { *; }

# ===========================
# Optimization Flags
# ===========================
# Enable aggressive optimization
-optimizationpasses 5
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-verbose

# Remove logging in release builds
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}

# ===========================
# General Android
# ===========================
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# Keep source file names and line numbers for better crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
