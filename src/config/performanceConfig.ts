/**
 * Performance Configuration
 * Adjust these settings based on device capabilities
 */

export interface PerformanceConfig {
  // Feature toggles
  enableEmotionDetection: boolean;
  enableSpeakerDiarization: boolean;
  useAdvancedEmotionDetection: boolean;  // Full accuracy vs fast mode
  useAdvancedSpeakerDetection: boolean;  // Full accuracy vs fast mode
  
  // Throttling (ms)
  analysisThrottleMs: number;
  partialThrottleMs: number;
  
  // Buffer sizes (samples)
  maxAudioBuffer: number;
  analysisSampleSize: number;
  
  // Memory limits
  maxSpeakerEmbeddings: number;
  maxSavedSessions: number;
  
  // Performance monitoring
  enablePerformanceMonitoring: boolean;
  enableFrameRateMonitoring: boolean;
}

// Default configuration for emulator (fast mode)
export const EMULATOR_CONFIG: PerformanceConfig = {
  enableEmotionDetection: true,
  enableSpeakerDiarization: true,
  useAdvancedEmotionDetection: false,  // Use fast mode
  useAdvancedSpeakerDetection: false,  // Use fast mode
  
  analysisThrottleMs: 500,
  partialThrottleMs: 100,
  
  maxAudioBuffer: 8000,
  analysisSampleSize: 4000,
  
  maxSpeakerEmbeddings: 5,
  maxSavedSessions: 3,
  
  enablePerformanceMonitoring: __DEV__,
  enableFrameRateMonitoring: false,
};

// Configuration for real devices (full accuracy)
export const DEVICE_CONFIG: PerformanceConfig = {
  enableEmotionDetection: true,
  enableSpeakerDiarization: true,
  useAdvancedEmotionDetection: true,   // Use full accurate mode!
  useAdvancedSpeakerDetection: true,   // Use full accurate mode!
  
  analysisThrottleMs: 300,  // More frequent (real device can handle it)
  partialThrottleMs: 50,    // Faster updates
  
  maxAudioBuffer: 12000,    // Larger buffer for better analysis
  analysisSampleSize: 8000, // More samples = better accuracy
  
  maxSpeakerEmbeddings: 10, // Keep more history
  maxSavedSessions: 5,      // Save more sessions
  
  enablePerformanceMonitoring: __DEV__,
  enableFrameRateMonitoring: __DEV__,
};

// Low-end device configuration (balanced)
export const LOW_END_CONFIG: PerformanceConfig = {
  enableEmotionDetection: true,
  enableSpeakerDiarization: false,  // Disable speaker ID on low-end
  useAdvancedEmotionDetection: false,
  useAdvancedSpeakerDetection: false,
  
  analysisThrottleMs: 1000,
  partialThrottleMs: 200,
  
  maxAudioBuffer: 4000,
  analysisSampleSize: 2000,
  
  maxSpeakerEmbeddings: 3,
  maxSavedSessions: 1,
  
  enablePerformanceMonitoring: false,
  enableFrameRateMonitoring: false,
};

// High-performance device configuration (maximum quality)
export const HIGH_END_CONFIG: PerformanceConfig = {
  enableEmotionDetection: true,
  enableSpeakerDiarization: true,
  useAdvancedEmotionDetection: true,
  useAdvancedSpeakerDetection: true,
  
  analysisThrottleMs: 200,   // Very frequent
  partialThrottleMs: 30,     // Almost real-time
  
  maxAudioBuffer: 16000,     // Full second
  analysisSampleSize: 12000, // Large samples
  
  maxSpeakerEmbeddings: 15,
  maxSavedSessions: 10,
  
  enablePerformanceMonitoring: __DEV__,
  enableFrameRateMonitoring: __DEV__,
};

// Auto-detect best configuration
let currentConfig: PerformanceConfig = DEVICE_CONFIG;

export const getPerformanceConfig = (): PerformanceConfig => {
  return currentConfig;
};

export const setPerformanceConfig = (config: PerformanceConfig): void => {
  currentConfig = config;
  console.log('📊 Performance config updated:', {
    mode: config.useAdvancedEmotionDetection ? 'ACCURATE' : 'FAST',
    throttle: config.analysisThrottleMs + 'ms',
  });
};

// Convenience functions
export const useEmulatorConfig = () => setPerformanceConfig(EMULATOR_CONFIG);
export const useDeviceConfig = () => setPerformanceConfig(DEVICE_CONFIG);
export const useLowEndConfig = () => setPerformanceConfig(LOW_END_CONFIG);
export const useHighEndConfig = () => setPerformanceConfig(HIGH_END_CONFIG);

