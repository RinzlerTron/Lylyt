import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Utility for accessibility announcements and screen reader support
 */
export class AccessibilityUtils {
  /**
   * Announce a message to screen readers
   */
  static async announce(message: string, priority: 'polite' | 'assertive' = 'polite'): Promise<void> {
    if (Platform.OS === 'ios') {
      // iOS supports priority parameter
      await AccessibilityInfo.announceForAccessibility(message);
    } else {
      // Android doesn't distinguish between polite and assertive
      await AccessibilityInfo.announceForAccessibility(message);
    }
  }

  /**
   * Announce recording state changes
   */
  static async announceRecordingState(isRecording: boolean): Promise<void> {
    const message = isRecording
      ? 'Recording started. Speech recognition is now active.'
      : 'Recording stopped. Conversation saved.';
    await this.announce(message, 'assertive');
  }

  /**
   * Announce language changes
   */
  static async announceLanguageChange(languageName: string): Promise<void> {
    const message = `Language changed to ${languageName}`;
    await this.announce(message, 'polite');
  }

  /**
   * Announce model loading states
   */
  static async announceModelState(isLoaded: boolean): Promise<void> {
    const message = isLoaded
      ? 'Speech recognition model loaded and ready'
      : 'Loading speech recognition model';
    await this.announce(message, 'polite');
  }

  /**
   * Announce new transcriptions for screen readers
   */
  static async announceTranscription(text: string, emotion?: string): Promise<void> {
    let message = `New caption: ${text}`;
    if (emotion) {
      message += ` (emotion: ${emotion})`;
    }
    await this.announce(message, 'assertive');
  }

  /**
   * Announce errors
   */
  static async announceError(errorMessage: string): Promise<void> {
    const message = `Error: ${errorMessage}`;
    await this.announce(message, 'assertive');
  }

  /**
   * Check if screen reader is enabled
   */
  static async isScreenReaderEnabled(): Promise<boolean> {
    return await AccessibilityInfo.isScreenReaderEnabled();
  }

  /**
   * Set accessibility focus to a component
   */
  static setAccessibilityFocus(ref: any): void {
    if (ref?.current) {
      AccessibilityInfo.setAccessibilityFocus(ref.current);
    }
  }
}
