# Lylyt

<div align="center">

![ARM](https://img.shields.io/badge/ARM-0091BD?style=for-the-badge&logo=arm&logoColor=white)
![Android](https://img.shields.io/badge/Android-3DDC84?style=for-the-badge&logo=android&logoColor=white)
![TensorFlow Lite](https://img.shields.io/badge/TFLite-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)

</div>

*Light + Local + Listen*

**On-device speech-to-text for accessible communication**

Built for the **ARM AI Developer Challenge 2025**

---

## What It Does

Lylyt is a real-time captioning app that runs entirely on-device. No cloud, no accounts, no data collection. Everything happens on the ARM processor in your pocket.

**For deaf/hard-of-hearing users:** Live captions of conversations with speaker identification and emotion context

**For mute/non-verbal users:** Type a message and have your phone speak it out loud

**For judges:** A demonstration of what's possible when AI runs locally on ARM hardware

**Example scenario:**

Two people having a conversation. Lylyt shows:
```
[Speaker 1 - blue] "Did you see the game last night?" 😊
[Speaker 2 - green] "No, I missed it. What happened?" 
[Speaker 1 - blue] "We lost in overtime." 😢
```

That's not just transcription. That's context—who said it, how they said it—delivered in real-time without touching a server.

---

## Key Features

| Feature | What It Does | How It Works |
|---------|--------------|--------------|
| **Speech-to-Text** | Live transcription in EN/ES/CN | Vosk on-device models |
| **Speaker Diarization** | Identifies up to 8 speakers | Voice embedding clustering |
| **Emotion Detection** | Shows how something was said | Acoustic feature analysis |
| **Text-to-Speech** | Type → phone speaks | Android TTS API |
| **AI Summarization** | Condense long conversations | Gemma 2B INT4 on-device |
| **Haptic Feedback** | Feel when someone speaks | For deaf users |

All features work offline. No internet required.

---

## How It Uses ARM

Lylyt targets **ARM64-v8a** exclusively and leverages the Android Neural Networks API (NNAPI) to offload inference to the NPU.

```
React Native UI
    ↓
Kotlin Native Modules
    ↓
TensorFlow Lite + NNAPI Delegate
    ↓
ARM NPU / Mali GPU
```

**Performance on ARM:**
- Speech recognition: <300ms latency
- Speaker identification: <20ms
- Emotion detection: <20ms
- INT4 quantized models for efficient inference

See `docs/TECHNICAL.md` for implementation details.

---

## How It Maps to ARM AI Challenge Criteria

### Technological Implementation
- NNAPI delegation for ARM NPU acceleration
- INT4/INT8 quantized models
- Real-time audio processing pipeline
- Multi-language model switching without restart

### User Experience
- One-tap recording, no configuration needed
- Color-coded speakers for visual clarity
- Works in airplane mode
- Bidirectional communication (hear → read, type → speak)

### Potential Impact
- Privacy-first architecture for sensitive conversations
- Accessibility tool for 466 million people worldwide with disabling hearing loss (WHO)
- No recurring cloud costs—runs forever on the device

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/RinzlerTron/Lylyt.git
cd Lylyt
npm install

# Run on ARM64 Android device
npm start
npm run android
```

**Requirements:** Node 18+, Android SDK 29+, ARM64 device or emulator

---

## Project Structure

```
src/
├── screens/          # MainScreen, VoiceModeScreen
├── services/         # Vosk, Emotion, Speaker, TTS, GenAI
├── components/       # Reusable UI components
└── utils/            # Performance monitoring, accessibility

android/
└── app/src/main/java/com/lylyt/
    ├── tflite/       # TensorFlow Lite native module
    ├── audio/        # Audio capture native module
    └── tts/          # Text-to-speech native module
```

---

## Documentation

- **[TECHNICAL.md](docs/TECHNICAL.md)** — Architecture, ARM optimizations, performance benchmarks
- **[SETUP.md](docs/SETUP.md)** — Development environment setup

---

## Built With

React Native • Kotlin • TensorFlow Lite • Vosk • NNAPI

---

## License

MIT
