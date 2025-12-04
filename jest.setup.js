// jest.setup.js
import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

// Mock react-native first (before other imports)
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Platform = {
    OS: 'ios',
    Version: 13,
    select: jest.fn((obj) => obj.ios || obj.default),
  };
  RN.NativeModules = {
    AudioCapture: {
      startRecording: jest.fn(),
      stopRecording: jest.fn(),
    },
    TensorFlowLite: {
      loadModelFromAssets: jest.fn().mockResolvedValue({}),
      loadModel: jest.fn().mockResolvedValue({}),
      runInference: jest.fn().mockResolvedValue({ output: [], inferenceTimeMs: 100 }),
      getModelInfo: jest.fn().mockResolvedValue({}),
      close: jest.fn().mockResolvedValue(true),
    },
  };
  RN.NativeEventEmitter = jest.fn(() => ({
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeAllListeners: jest.fn(),
  }));
  return RN;
});

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  SafeAreaView: ({ children, style }) => <div style={style}>{children}</div>,
  useSafeAreaInsets: jest.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

// Mock react-native-permissions
jest.mock('react-native-permissions', () => ({
  request: jest.fn().mockResolvedValue('granted'),
  check: jest.fn().mockResolvedValue('granted'),
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    BLOCKED: 'blocked',
    UNAVAILABLE: 'unavailable',
  },
  PERMISSIONS: {
    ANDROID: {
      RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
    },
    IOS: {
      MICROPHONE: 'ios.permission.MICROPHONE',
    },
  },
}));

// Mock react-native-fs
jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/mock/path',
  MainBundlePath: '/mock/bundle',
  CachesDirectoryPath: '/mock/cache',
  ExternalDirectoryPath: '/mock/external',
  ExternalStorageDirectoryPath: '/mock/external-storage',
  TemporaryDirectoryPath: '/mock/temp',
  LibraryDirectoryPath: '/mock/library',
  PicturesDirectoryPath: '/mock/pictures',
}));

// Global test setup
global.console = {
  ...console,
  // Uncomment to ignore console logs in tests
  // log: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};
