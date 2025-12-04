# Technical Documentation

## ARM Optimization

Lylyt targets **ARM64-v8a** and uses NNAPI to run inference on the NPU.

### Build Configuration

```gradle
// android/app/build.gradle
ndk {
    abiFilters "arm64-v8a"
}
```

### NNAPI Delegation

```kotlin
// TensorFlowLiteModule.kt
val options = Interpreter.Options()
options.setUseNNAPI(true)  // Routes inference to ARM NPU
options.setNumThreads(4)   // CPU fallback
```

### Inference Stack

```
React Native UI
    ↓ Bridge
Kotlin Native Modules
    ↓ TFLite Interpreter
Android NNAPI
    ↓ Delegate
ARM NPU / Mali GPU
```

---

## Services Architecture

| Service | Purpose | Method |
|---------|---------|--------|
| VoskService | Speech-to-text | Offline Vosk models (EN/ES/CN) |
| SpeakerDiarizationService | Identify speakers | Voice embedding clustering |
| EmotionDetectionService | Detect emotion | Acoustic feature analysis |
| TextToSpeechService | Text to audio | Android TTS API |
| GenAIService | AI summarization | Gemma 2B INT4 on-device |
| HapticFeedbackService | Vibration alerts | Android Vibration API |
| NoiseCancellationService | Filter noise | Spectral subtraction |

---

## Performance Optimizations

### Throttling

```typescript
const ANALYSIS_THROTTLE_MS = 500;  // Max 2 analyses per second
const PARTIAL_THROTTLE_MS = 100;   // Max 10 UI updates per second
```

### Buffer Management

| Buffer | Size | Purpose |
|--------|------|---------|
| Audio buffer | 8,000 samples | Recording input |
| Analysis sample | 4,000 samples | Feature extraction |
| Emotion sample | 2,000 samples | Emotion detection |
| Speaker sample | 1,500 samples | Speaker ID |

### Fast Feature Extraction

Speaker identification uses 6 features (down from 16):
- Pitch
- Zero crossing rate
- Energy
- Spectral centroid
- Shimmer
- Energy variance

Emotion detection uses 4 features (down from 7):
- Energy
- Zero crossing rate
- Pitch mean
- Pitch variance

---

## Performance Benchmarks

| Component | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Emotion Detection | 50ms | 5ms | 10x |
| Speaker Diarization | 200ms | 10ms | 20x |
| Combined per result | 250ms | 15ms | 17x |

---

## Native Modules

Located in `android/app/src/main/java/com/lylyt/`:

| Module | File | Purpose |
|--------|------|---------|
| TensorFlowLiteModule | `tflite/TensorFlowLiteModule.kt` | Model loading, inference |
| AudioCaptureModule | `audio/AudioCaptureModule.kt` | 16kHz PCM capture |
| TextToSpeechModule | `tts/TextToSpeechModule.kt` | TTS with rate/pitch control |

---

## Model Specifications

### Vosk Speech Recognition
- Languages: English, Spanish, Chinese
- Size: ~50MB per language
- Latency: <300ms

### Gemma 2B (Summarization)
- Quantization: INT4
- Size: ~1.2GB
- Download: On-demand from GitHub Releases
- Inference: NNAPI delegated
