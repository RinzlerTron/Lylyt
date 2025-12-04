import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';

const { AudioCapture } = NativeModules;

export interface AudioConfig {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  bufferSize: number;
}

export interface AudioData {
  data: number[];
  timestamp: number;
  isVoice: boolean;
}

export interface AudioChunk {
  pcmData: Int16Array;
  sampleRate: number;
  channels: number;
  timestamp: number;
}

class AudioCaptureService {
  private isRecording = false;
  public eventEmitter: NativeEventEmitter | null = null;
  private audioCallback: ((data: AudioData) => void) | null = null;

  constructor() {
    if (Platform.OS === 'android' && AudioCapture) {
      this.eventEmitter = new NativeEventEmitter(AudioCapture);
      this.setupEventListeners();
    }
  }

  private setupEventListeners() {
    if (!this.eventEmitter) return;

    this.eventEmitter.addListener('onAudioData', (event) => {
      if (this.audioCallback) {
        const audioData: AudioData = {
          data: event.data,
          timestamp: event.timestamp,
          isVoice: event.isVoice || true, // Default to true if VAD not implemented yet
        };
        this.audioCallback(audioData);
      }
    });
  }

  async requestPermissions(): Promise<boolean> {
    try {
      const permission = Platform.OS === 'android'
        ? PERMISSIONS.ANDROID.RECORD_AUDIO
        : PERMISSIONS.IOS.MICROPHONE;

      const result = await request(permission);

      if (result === RESULTS.GRANTED) {
        console.log('Audio recording permission granted');
        return true;
      } else {
        console.log('Audio recording permission denied:', result);
        return false;
      }
    } catch (error) {
      console.error('Error requesting audio permissions:', error);
      return false;
    }
  }

  async requestAudioFocus(): Promise<boolean> {
    if (Platform.OS === 'android' && AudioCapture) {
      try {
        const result = await AudioCapture.requestAudioFocus();
        return result as boolean;
      } catch (error) {
        console.error('Failed to request audio focus:', error);
        return false;
      }
    }
    return true; // iOS doesn't need explicit audio focus
  }

  async abandonAudioFocus(): Promise<boolean> {
    if (Platform.OS === 'android' && AudioCapture) {
      try {
        const result = await AudioCapture.abandonAudioFocus();
        return result as boolean;
      } catch (error) {
        console.error('Failed to abandon audio focus:', error);
        return false;
      }
    }
    return true;
  }

  async setAudioMode(mode: 'normal' | 'ringtone' | 'in_call' | 'in_communication' = 'in_communication'): Promise<boolean> {
    if (Platform.OS === 'android' && AudioCapture) {
      try {
        await AudioCapture.setAudioMode(mode);
        return true;
      } catch (error) {
        console.error('Failed to set audio mode:', error);
        return false;
      }
    }
    return true;
  }

  async startRecording(
    config: Partial<AudioConfig> = {},
    callback: (data: AudioData) => void
  ): Promise<boolean> {
    try {
      if (this.isRecording) {
        console.warn('Audio recording already in progress');
        return false;
      }

      // Check permissions first
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Microphone permission not granted');
      }

      // Request audio focus and set communication mode
      const focusGranted = await this.requestAudioFocus();
      if (!focusGranted) {
        throw new Error('Could not obtain audio focus');
      }

      const modeSet = await this.setAudioMode('in_communication');
      if (!modeSet) {
        console.warn('Could not set audio mode, continuing anyway');
      }

      // Default audio configuration optimized for speech recognition
      const defaultConfig: AudioConfig = {
        sampleRate: 16000, // 16kHz for speech
        channels: 1, // Mono
        bitsPerSample: 16, // 16-bit PCM
        bufferSize: 1024, // Small buffer for low latency
        ...config,
      };

      this.audioCallback = callback;

      if (Platform.OS === 'android' && AudioCapture) {
        await AudioCapture.startRecording(defaultConfig);
      } else {
        // Fallback for iOS or when native module not available
        console.warn('Native audio capture not available on this platform');
        return false;
      }

      this.isRecording = true;
      console.log('Audio recording started with config:', defaultConfig);
      return true;
    } catch (error) {
      console.error('Failed to start audio recording:', error);
      this.audioCallback = null;
      return false;
    }
  }

  async stopRecording(): Promise<void> {
    try {
      if (!this.isRecording) {
        return;
      }

      if (Platform.OS === 'android' && AudioCapture) {
        await AudioCapture.stopRecording();
      }

      // Release audio focus and restore normal mode
      await this.abandonAudioFocus();
      await this.setAudioMode('normal');

      this.isRecording = false;
      this.audioCallback = null;
      console.log('Audio recording stopped');
    } catch (error) {
      console.error('Failed to stop audio recording:', error);
    }
  }

  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  // Utility method to convert raw audio data to Float32Array for model input
  static convertToFloat32Array(pcmData: number[], sampleRate: number = 16000): Float32Array {
    const floatArray = new Float32Array(pcmData.length);
    const maxInt16 = 32768.0;

    for (let i = 0; i < pcmData.length; i++) {
      // Convert from Int16 range (-32768 to 32767) to float (-1.0 to 1.0)
      floatArray[i] = pcmData[i] / maxInt16;
    }

    return floatArray;
  }

  // Utility method to normalize audio for model input
  static normalizeAudio(audioData: Float32Array): Float32Array {
    // Simple normalization - could be enhanced with more sophisticated preprocessing
    const normalized = new Float32Array(audioData.length);
    let maxAbs = 0;

    // Find maximum absolute value
    for (let i = 0; i < audioData.length; i++) {
      maxAbs = Math.max(maxAbs, Math.abs(audioData[i]));
    }

    // Normalize if max is above threshold
    if (maxAbs > 0.01) {
      for (let i = 0; i < audioData.length; i++) {
        normalized[i] = audioData[i] / maxAbs;
      }
    } else {
      // If audio is too quiet, copy as-is
      normalized.set(audioData);
    }

    return normalized;
  }

  // Cleanup method
  destroy() {
    this.stopRecording();
    if (this.eventEmitter) {
      this.eventEmitter.removeAllListeners('onAudioData');
      this.eventEmitter = null;
    }
    this.audioCallback = null;
  }
}

export default new AudioCaptureService();

