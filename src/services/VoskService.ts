import * as Vosk from 'react-native-vosk';
import type { VoskEventSubscription } from '../types/vosk';

export interface VoskResult {
  text: string;
  partial: boolean;
}

class VoskService {
  private recognitionCallback: ((result: VoskResult) => void) | null = null;
  private isInitialized = false;
  private resultListener: VoskEventSubscription | null = null;
  private partialListener: VoskEventSubscription | null = null;

  async loadModel(modelName: string): Promise<boolean> {
    try {
      await Vosk.loadModel(modelName);
      this.isInitialized = true;
      console.log('Vosk model loaded successfully');
      return true;
    } catch (error) {
      console.error('Failed to load Vosk model:', error);
      return false;
    }
  }

  async startRecognition(callback: (result: VoskResult) => void): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        console.error('Vosk not initialized. Call loadModel first.');
        return false;
      }

      this.recognitionCallback = callback;

      // Set up event listeners before starting
      this.resultListener = Vosk.onResult((text: string) => {
        if (this.recognitionCallback) {
          this.recognitionCallback({
            text,
            partial: false,
          });
        }
      });

      this.partialListener = Vosk.onPartialResult((text: string) => {
        if (this.recognitionCallback) {
          this.recognitionCallback({
            text,
            partial: true,
          });
        }
      });

      // Start recognition
      await Vosk.start();
      console.log('Vosk recognition started');
      return true;
    } catch (error) {
      console.error('Failed to start recognition:', error);
      return false;
    }
  }

  async stopRecognition(): Promise<void> {
    try {
      if (this.isInitialized) {
        Vosk.stop();
        
        // Remove listeners
        if (this.resultListener) {
          this.resultListener.remove();
          this.resultListener = null;
        }
        if (this.partialListener) {
          this.partialListener.remove();
          this.partialListener = null;
        }
        
        this.recognitionCallback = null;
        console.log('Vosk recognition stopped');
      }
    } catch (error) {
      console.error('Failed to stop recognition:', error);
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.stopRecognition();
      if (this.isInitialized) {
        Vosk.unload();
      }
      this.isInitialized = false;
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}

export default new VoskService();

