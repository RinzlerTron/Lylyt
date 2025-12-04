import type { CodegenTypes } from 'react-native';

export interface VoskOptions {
  /**
   * Set of phrases the recognizer will seek on which is the closest one from
   * the record, add `"[unk]"` to the set to recognize phrases strictly.
   */
  grammar?: string[];
  /**
   * Timeout in milliseconds to listen.
   */
  timeout?: number;
}

export interface VoskSpec {
  loadModel: (path: string) => Promise<void>;
  unload: () => void;

  start: (options?: VoskOptions) => Promise<void>;
  stop: () => void;

  addListener: (eventType: string) => void;
  removeListeners: (count: number) => void;

  readonly onResult: CodegenTypes.EventEmitter<string>;
  readonly onPartialResult: CodegenTypes.EventEmitter<string>;
  readonly onFinalResult: CodegenTypes.EventEmitter<string>;
  readonly onError: CodegenTypes.EventEmitter<string>;
  readonly onTimeout: CodegenTypes.EventEmitter<void>;
}

export interface VoskEventSubscription {
  remove: () => void;
}

export interface VoskModule extends VoskSpec {}
