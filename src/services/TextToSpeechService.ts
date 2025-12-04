/**
 * Text-to-Speech Service
 * SIMPLE: Type text → Phone speaks it out loud
 * For mute users to communicate
 */

import Tts from 'react-native-tts';

interface TTSOptions {
  rate?: number;    // Speech rate (0.01 - 0.99)
  pitch?: number;   // Speech pitch (0.5 - 2.0)
}

class TextToSpeechService {
  constructor() {
    // Initialize Tts
    Tts.getInitStatus().then(() => {
      console.log('TTS Initialized');
      Tts.setDefaultRate(0.5);
      Tts.setDefaultPitch(1.0);
    }, (err) => {
      if (err.code === 'no_engine') {
        Tts.requestInstallEngine();
      }
    });
  }

  /**
   * Speak text OUT LOUD
   */
  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('No text to speak');
      }

      // Set rate and pitch if provided
      if (options.rate !== undefined) {
        await Tts.setDefaultRate(options.rate);
      }
      if (options.pitch !== undefined) {
        await Tts.setDefaultPitch(options.pitch);
      }

      // Speak the text
      Tts.speak(text);
      console.log(`🔊 Speaking: "${text}"`);
    } catch (error) {
      console.error('Failed to speak:', error);
      throw error;
    }
  }

  /**
   * Stop speaking
   */
  async stop(): Promise<void> {
    try {
      await Tts.stop();
    } catch (error) {
      console.error('Failed to stop speech:', error);
    }
  }
}

export default new TextToSpeechService();

