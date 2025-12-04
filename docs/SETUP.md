# Setup Guide

## Requirements

- Node.js 18+
- Android Studio with SDK 29+
- Java JDK 11+
- ARM64 Android device or emulator

## Installation

```bash
git clone https://github.com/RinzlerTron/Lylyt.git
cd Lylyt
npm install
```

## Configuration

Set `ANDROID_HOME` environment variable to your Android SDK path, or create `android/local.properties` with your SDK location.

## Running

**Terminal 1:**
```bash
npm start
```

**Terminal 2:**
```bash
npx react-native run-android
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| SDK not found | Set ANDROID_HOME or update local.properties |
| Model not loaded | Check assets/ folder contains model directories |
| No transcription | Grant microphone permission |
| Build fails | Run `cd android && ./gradlew clean` |
