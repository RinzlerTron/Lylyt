/**
 * Haptic Feedback Service
 * Provides vibration feedback when speech is detected
 * For deaf users to "feel" when someone is speaking
 */

import { Vibration, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HAPTIC_SETTINGS_KEY = 'captivate_haptic_enabled';

class HapticFeedbackService {
  private enabled: boolean = true; // Default enabled
  private lastVibrationTime: number = 0;
  private readonly VIBRATION_THROTTLE_MS = 200; // Prevent too frequent vibrations

  constructor() {
    this.loadSettings();
  }

  /**
   * Load haptic settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(HAPTIC_SETTINGS_KEY);
      if (stored !== null) {
        this.enabled = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load haptic settings:', error);
    }
  }

  /**
   * Enable or disable haptic feedback
   */
  async setEnabled(enabled: boolean): Promise<void> {
    this.enabled = enabled;
    try {
      await AsyncStorage.setItem(HAPTIC_SETTINGS_KEY, JSON.stringify(enabled));
    } catch (error) {
      console.warn('Failed to save haptic settings:', error);
    }
  }

  /**
   * Check if haptic feedback is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Trigger haptic feedback when speech is detected
   */
  triggerSpeechDetected(): void {
    if (!this.enabled) {
      return;
    }

    const now = Date.now();
    if (now - this.lastVibrationTime < this.VIBRATION_THROTTLE_MS) {
      return; // Throttle vibrations
    }

    this.lastVibrationTime = now;

    if (Platform.OS === 'android') {
      // Android: Short vibration pattern
      Vibration.vibrate(50); // 50ms vibration
    } else if (Platform.OS === 'ios') {
      // iOS: Use haptic feedback (if available)
      Vibration.vibrate(50);
    }
  }

  /**
   * Trigger haptic feedback for different events
   */
  triggerEvent(type: 'speech' | 'start' | 'stop' | 'error'): void {
    if (!this.enabled) {
      return;
    }

    const now = Date.now();
    if (now - this.lastVibrationTime < this.VIBRATION_THROTTLE_MS) {
      return;
    }

    this.lastVibrationTime = now;

    switch (type) {
      case 'speech':
        Vibration.vibrate(50); // Short pulse
        break;
      case 'start':
        Vibration.vibrate([0, 100, 50, 100]); // Double pulse
        break;
      case 'stop':
        Vibration.vibrate(100); // Longer pulse
        break;
      case 'error':
        Vibration.vibrate([0, 50, 50, 50, 50, 200]); // Error pattern
        break;
    }
  }
}

export default new HapticFeedbackService();







