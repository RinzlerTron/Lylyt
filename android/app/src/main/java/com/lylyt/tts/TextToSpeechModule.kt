package com.lylyt.tts

import android.speech.tts.TextToSpeech
import com.facebook.react.bridge.*
import java.util.*

class TextToSpeechModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var tts: TextToSpeech? = null
    private var isInitialized = false

    override fun getName(): String {
        return "TextToSpeech"
    }

    init {
        // Initialize TTS
        tts = TextToSpeech(reactContext) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.language = Locale.US
                isInitialized = true
                println("✅ TTS initialized successfully")
            } else {
                println("❌ TTS initialization failed")
            }
        }
    }

    @ReactMethod
    fun speak(text: String, promise: Promise) {
        if (!isInitialized || tts == null) {
            promise.reject("TTS_NOT_READY", "Text-to-Speech not initialized")
            return
        }

        try {
            val result = tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, null)
            if (result == TextToSpeech.SUCCESS) {
                promise.resolve(true)
            } else {
                promise.reject("TTS_ERROR", "Failed to speak text")
            }
        } catch (e: Exception) {
            promise.reject("TTS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            tts?.stop()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("TTS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun setRate(rate: Float, promise: Promise) {
        try {
            tts?.setSpeechRate(rate)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("TTS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun setPitch(pitch: Float, promise: Promise) {
        try {
            tts?.setPitch(pitch)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("TTS_ERROR", e.message)
        }
    }

    override fun onCatalystInstanceDestroy() {
        tts?.shutdown()
        tts = null
        isInitialized = false
    }
}

