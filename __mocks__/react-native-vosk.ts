// Mock for react-native-vosk
import type { VoskEventSubscription } from '../src/types/vosk';

const mockVosk = {
  loadModel: jest.fn().mockResolvedValue(undefined),
  unload: jest.fn(),
  start: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn(),
  addListener: jest.fn(),
  removeListeners: jest.fn(),
  onResult: jest.fn().mockReturnValue({
    remove: jest.fn(),
  } as VoskEventSubscription),
  onPartialResult: jest.fn().mockReturnValue({
    remove: jest.fn(),
  } as VoskEventSubscription),
  onFinalResult: jest.fn().mockReturnValue({
    remove: jest.fn(),
  } as VoskEventSubscription),
  onError: jest.fn().mockReturnValue({
    remove: jest.fn(),
  } as VoskEventSubscription),
  onTimeout: jest.fn().mockReturnValue({
    remove: jest.fn(),
  } as VoskEventSubscription),
};

export default mockVosk;
