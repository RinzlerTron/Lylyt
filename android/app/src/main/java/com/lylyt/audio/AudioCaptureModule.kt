package com.lylyt.audio

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.concurrent.atomic.AtomicBoolean

class AudioCaptureModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var audioRecord: AudioRecord? = null
    private var recordingThread: Thread? = null
    private val isRecording = AtomicBoolean(false)
    private var audioConfig: ReadableMap? = null
    private val reactContext: ReactApplicationContext = reactContext
    private var listenerCount = 0
    private var audioManager: AudioManager? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private val audioFocusChangeListener = AudioManager.OnAudioFocusChangeListener { focusChange ->
        when (focusChange) {
            AudioManager.AUDIOFOCUS_LOSS -> {
                // Permanent loss of audio focus
                sendEvent("onAudioFocusLost", null)
                stopRecordingSilently()
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> {
                // Temporary loss of audio focus
                sendEvent("onAudioFocusLostTransient", null)
            }
            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                // Temporary loss but can duck (lower volume)
                sendEvent("onAudioFocusLostTransientCanDuck", null)
            }
            AudioManager.AUDIOFOCUS_GAIN -> {
                // Regained audio focus
                sendEvent("onAudioFocusGained", null)
            }
        }
    }

    override fun getName(): String {
        return "AudioCapture"
    }

    init {
        audioManager = reactContext.getSystemService(android.content.Context.AUDIO_SERVICE) as AudioManager
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    private fun stopRecordingSilently() {
        try {
            if (!isRecording.get()) {
                return
            }

            isRecording.set(false)

            // Stop recording thread
            recordingThread?.join(1000) // Wait up to 1 second
            recordingThread = null

            // Stop and release AudioRecord
            audioRecord?.stop()
            audioRecord?.release()
            audioRecord = null

            // Release audio focus and restore audio mode
            val audioManager = this.audioManager
            if (audioManager != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
                    audioManager.abandonAudioFocusRequest(audioFocusRequest!!)
                    audioFocusRequest = null
                } else {
                    @Suppress("DEPRECATION")
                    audioManager.abandonAudioFocus(audioFocusChangeListener)
                }

                // Restore normal audio mode
                audioManager.mode = AudioManager.MODE_NORMAL
            }
        } catch (e: Exception) {
            android.util.Log.e("AudioCapture", "Failed to stop recording silently: ${e.message}", e)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        listenerCount += 1
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        listenerCount -= count
    }

    @ReactMethod
    fun requestAudioFocus(promise: Promise) {
        try {
            val audioManager = this.audioManager ?: run {
                promise.reject("AUDIO_MANAGER_NULL", "AudioManager not available")
                return
            }

            val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // Android 8.0+ (API 26+)
                val audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()

                audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(audioAttributes)
                    .setOnAudioFocusChangeListener(audioFocusChangeListener)
                    .build()

                audioManager.requestAudioFocus(audioFocusRequest!!)
            } else {
                // Legacy API for older Android versions
                @Suppress("DEPRECATION")
                audioManager.requestAudioFocus(
                    audioFocusChangeListener,
                    AudioManager.STREAM_VOICE_CALL,
                    AudioManager.AUDIOFOCUS_GAIN
                )
            }

            val success = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
            promise.resolve(success)
        } catch (e: Exception) {
            promise.reject("AUDIO_FOCUS_ERROR", "Failed to request audio focus: ${e.message}", e)
        }
    }

    @ReactMethod
    fun abandonAudioFocus(promise: Promise) {
        try {
            val audioManager = this.audioManager ?: run {
                promise.reject("AUDIO_MANAGER_NULL", "AudioManager not available")
                return
            }

            val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
                audioManager.abandonAudioFocusRequest(audioFocusRequest!!)
            } else {
                @Suppress("DEPRECATION")
                audioManager.abandonAudioFocus(audioFocusChangeListener)
            }

            promise.resolve(result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED)
        } catch (e: Exception) {
            promise.reject("AUDIO_FOCUS_ERROR", "Failed to abandon audio focus: ${e.message}", e)
        }
    }

    @ReactMethod
    fun setAudioMode(mode: String, promise: Promise) {
        try {
            val audioManager = this.audioManager ?: run {
                promise.reject("AUDIO_MANAGER_NULL", "AudioManager not available")
                return
            }

            val audioMode = when (mode) {
                "normal" -> AudioManager.MODE_NORMAL
                "ringtone" -> AudioManager.MODE_RINGTONE
                "in_call" -> AudioManager.MODE_IN_CALL
                "in_communication" -> AudioManager.MODE_IN_COMMUNICATION
                else -> AudioManager.MODE_NORMAL
            }

            audioManager.mode = audioMode
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("AUDIO_MODE_ERROR", "Failed to set audio mode: ${e.message}", e)
        }
    }

    @ReactMethod
    fun startRecording(config: ReadableMap, promise: Promise) {
        try {
            if (isRecording.get()) {
                promise.reject("ALREADY_RECORDING", "Audio recording already in progress")
                return
            }

            // Check permissions
            if (reactApplicationContext.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_DENIED", "Microphone permission not granted")
                return
            }

            // Request audio focus before starting recording
            val audioManager = this.audioManager
            if (audioManager != null) {
                val focusResult = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val audioAttributes = AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()

                    audioFocusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                        .setAudioAttributes(audioAttributes)
                        .setOnAudioFocusChangeListener(audioFocusChangeListener)
                        .build()

                    audioManager.requestAudioFocus(audioFocusRequest!!)
                } else {
                    @Suppress("DEPRECATION")
                    audioManager.requestAudioFocus(
                        audioFocusChangeListener,
                        AudioManager.STREAM_VOICE_CALL,
                        AudioManager.AUDIOFOCUS_GAIN
                    )
                }

                if (focusResult != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                    promise.reject("AUDIO_FOCUS_DENIED", "Could not obtain audio focus")
                    return
                }

                // Set audio mode for communication
                audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
            }

            audioConfig = config

            val sampleRate = config.getInt("sampleRate")
            val channels = config.getInt("channels")
            val bufferSize = config.getInt("bufferSize")

            // Calculate buffer size for AudioRecord
            val channelConfig = if (channels == 1) AudioFormat.CHANNEL_IN_MONO else AudioFormat.CHANNEL_IN_STEREO
            val audioFormat = AudioFormat.ENCODING_PCM_16BIT
            val minBufferSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)

            // Use larger buffer for stability
            val recordBufferSize = Math.max(minBufferSize, bufferSize * 2)

            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                sampleRate,
                channelConfig,
                audioFormat,
                recordBufferSize
            )

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                promise.reject("INIT_FAILED", "Failed to initialize AudioRecord")
                return
            }

            audioRecord?.startRecording()
            isRecording.set(true)

            // Start recording thread
            recordingThread = Thread(AudioRecordingRunnable()).apply {
                name = "AudioCaptureThread"
                start()
            }

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("START_FAILED", "Failed to start recording: ${e.message}", e)
        }
    }

    @ReactMethod
    fun stopRecording(promise: Promise) {
        try {
            if (!isRecording.get()) {
                promise.resolve(true)
                return
            }

            isRecording.set(false)

            // Stop recording thread
            recordingThread?.join(1000) // Wait up to 1 second
            recordingThread = null

            // Stop and release AudioRecord
            audioRecord?.stop()
            audioRecord?.release()
            audioRecord = null

            // Release audio focus and restore audio mode
            val audioManager = this.audioManager
            if (audioManager != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
                    audioManager.abandonAudioFocusRequest(audioFocusRequest!!)
                    audioFocusRequest = null
                } else {
                    @Suppress("DEPRECATION")
                    audioManager.abandonAudioFocus(audioFocusChangeListener)
                }

                // Restore normal audio mode
                audioManager.mode = AudioManager.MODE_NORMAL
            }

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_FAILED", "Failed to stop recording: ${e.message}", e)
        }
    }

    private inner class AudioRecordingRunnable : Runnable {
        override fun run() {
            val audioRecord = this@AudioCaptureModule.audioRecord ?: return
            val config = audioConfig ?: return

            val bufferSize = config.getInt("bufferSize")
            val buffer = ShortArray(bufferSize)
            val sampleRate = config.getInt("sampleRate")

            android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_AUDIO)

            while (isRecording.get()) {
                try {
                    val readSize = audioRecord.read(buffer, 0, bufferSize)

                    if (readSize > 0) {
                        // Convert short array to WritableArray
                        val audioDataArray = Arguments.createArray()
                        for (i in 0 until readSize) {
                            audioDataArray.pushInt(buffer[i].toInt())
                        }

                        // Send audio data to React Native
                        val params = Arguments.createMap().apply {
                            putArray("data", audioDataArray)
                            putDouble("timestamp", System.currentTimeMillis().toDouble())
                            putInt("sampleRate", sampleRate)
                            putInt("channels", config.getInt("channels"))
                        }

                        reactContext
                            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                            .emit("onAudioData", params)
                    }
                } catch (e: Exception) {
                    // Log error but continue recording
                    android.util.Log.e("AudioCapture", "Error reading audio data", e)
                    break
                }
            }
        }
    }

    // Cleanup when module is destroyed
    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        stopRecording(PromiseImpl(null, null))
    }
}

