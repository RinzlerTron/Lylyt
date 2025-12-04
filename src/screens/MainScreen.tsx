import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Vosk from 'react-native-vosk';
import AudioCaptureService, { AudioData } from '../services/AudioCaptureService';
import EmotionDetectionService, { Emotion } from '../services/EmotionDetectionService';
import SpeakerDiarizationService from '../services/SpeakerDiarizationService';
import { getPerformanceConfig, useDeviceConfig, useEmulatorConfig } from '../config/performanceConfig';
import VoiceModeScreen from './VoiceModeScreen';
import HapticFeedbackService from '../services/HapticFeedbackService';
import NoiseCancellationService from '../services/NoiseCancellationService';
import GenAIService, { DownloadProgress } from '../services/GenAIService';

const { width, height } = Dimensions.get('window');

interface TranscriptLine {
  text: string;
  emotion: Emotion;
  emoji: string;
  speakerId: number;
  speakerLabel: string;
  speakerColor: string;
}

interface ConversationSession {
  id: string;
  timestamp: Date;
  transcript: TranscriptLine[];
}

interface Language {
  code: string;
  name: string;
  flag: string;
  modelName: string;
}

const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', flag: '🇺🇸', modelName: 'model-en-us' },
  { code: 'es', name: 'Español', flag: '🇪🇸', modelName: 'model-es' },
  { code: 'cn', name: '中文', flag: '🇨🇳', modelName: 'model-cn' },
];

const MainScreen: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(LANGUAGES[0]);
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState<TranscriptLine[]>([]);
  const [partialText, setPartialText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);
  const [activeTab, setActiveTab] = useState<'transcribe' | 'speak'>('transcribe');
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [noiseCancellationEnabled, setNoiseCancellationEnabled] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiModelExists, setAiModelExists] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);



  const resultListenerRef = useRef<any>(null);
  const partialListenerRef = useRef<any>(null);

  // Check if AI model exists on mount
  useEffect(() => {
    const checkModel = async () => {
      const exists = await GenAIService.checkModelExists();
      setAiModelExists(exists);
      if (exists) {
        const sizeMB = await GenAIService.getModelSizeMB();
        console.log(`AI Model found: ${sizeMB}MB`);
      }
    };
    checkModel();
  }, []);

  const handleDownloadModel = useCallback(async () => {
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadError(null);
    
    try {
      const success = await GenAIService.downloadModel((progress: DownloadProgress) => {
        setDownloadProgress(progress.percent);
      });
      
      if (success) {
        setAiModelExists(true);
        setShowAIPanel(false);
        Alert.alert('✅ Download Complete', 'AI model is ready! You can now use AI Summary.');
      }
    } catch (error: any) {
      setDownloadError(error.message || 'Download failed. Check your internet connection.');
    } finally {
      setIsDownloading(false);
    }
  }, []);

  const handleSummarize = useCallback(async () => {
    // Combine current and past transcripts
    const allText = [
      ...currentTranscript.map(t => t.text),
      ...sessions.flatMap(s => s.transcript.map(t => t.text))
    ].join('. ');

    if (!allText || allText.trim().length < 20) {
      Alert.alert('Nothing to summarize', 'Record some conversation first.');
      return;
    }

    // Check if model exists
    const modelExists = await GenAIService.checkModelExists();
    if (!modelExists) {
      setShowAIPanel(true);
      return;
    }

    setIsSummarizing(true);
    try {
      const summary = await GenAIService.summarizeConversation(allText);
      if (summary === 'MODEL_NOT_FOUND') {
        setAiModelExists(false);
        setShowAIPanel(true);
      } else {
        Alert.alert('✨ AI Summary', summary, [{ text: 'Close' }]);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to generate summary');
    } finally {
      setIsSummarizing(false);
    }
  }, [currentTranscript, sessions]);
  const scrollViewRef = useRef<ScrollView>(null);
  const audioBufferRef = useRef<number[]>([]);
  const processingRef = useRef<boolean>(false);
  const lastProcessTimeRef = useRef<number>(0);
  const partialUpdateTimeRef = useRef<number>(0);

  // Get performance config (auto-detects device vs emulator)
  const config = getPerformanceConfig();
  const ANALYSIS_THROTTLE_MS = config.analysisThrottleMs;
  const PARTIAL_THROTTLE_MS = config.partialThrottleMs;
  const MAX_BUFFER_SIZE = config.maxAudioBuffer;
  const ANALYSIS_SAMPLE_SIZE = config.analysisSampleSize;

  const handleAudioData = useCallback((data: AudioData) => {
    let processedData = data.data;
    
    // Apply noise cancellation if enabled
    if (noiseCancellationEnabled && NoiseCancellationService.isReady()) {
      processedData = NoiseCancellationService.applyNoiseCancellation(data.data);
    }
    
    // Efficiently manage audio buffer using config size
    if (audioBufferRef.current.length > MAX_BUFFER_SIZE) {
      // Replace entire buffer instead of concatenating
      audioBufferRef.current = processedData.slice(-MAX_BUFFER_SIZE);
    } else {
      // Only append if buffer is small
      audioBufferRef.current = audioBufferRef.current.concat(processedData).slice(-MAX_BUFFER_SIZE);
    }
    
    // Trigger haptic feedback when speech is detected
    if (data.isVoice && hapticEnabled) {
      HapticFeedbackService.triggerSpeechDetected();
    }
  }, [MAX_BUFFER_SIZE, noiseCancellationEnabled, hapticEnabled]);

  const initializeApp = useCallback(async () => {
    try {
      setError(null);
      await Vosk.loadModel(currentLanguage.modelName);
      setModelLoaded(true);
      console.log(`Model loaded: ${currentLanguage.name}`);
    } catch (err: any) {
      setError(`Failed to load model: ${err.message}`);
      console.warn('Model load error:', err);
    }
  }, [currentLanguage.modelName]);

  const switchLanguage = useCallback(async (language: Language) => {
    if (isRecording) {
      Alert.alert('Stop First', 'Please stop listening before changing language');
      return;
    }

    if (language.code === currentLanguage.code) {
      setShowLanguageSelector(false);
      return;
    }

    try {
      setError(null);
      setShowLanguageSelector(false);
      setModelLoaded(false);
      audioBufferRef.current = [];

      // Unload current model first
      try {
        await Vosk.unload();
      } catch (unloadErr) {
        // Ignore unload errors - model might not be loaded
        console.log('Unload warning (ignored):', unloadErr);
      }

      // Small delay to ensure cleanup
      await new Promise(resolve => setTimeout(resolve, 300));

      setCurrentLanguage(language);
      await Vosk.loadModel(language.modelName);
      setModelLoaded(true);
      console.log(`Switched to ${language.name}`);
    } catch (err: any) {
      console.warn('Language switch warning:', err);
      // Try to recover by reloading previous language
      try {
        await Vosk.loadModel(currentLanguage.modelName);
        setModelLoaded(true);
        setError(null);
      } catch (recoveryErr) {
        setError(`Failed to load ${language.name}. Please restart.`);
        console.warn('Recovery failed:', recoveryErr);
      }
    }
  }, [isRecording, currentLanguage]);

  const clearAllSessions = useCallback(() => {
    Alert.alert(
      'Clear History',
      'Delete all conversations?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear', style: 'destructive', onPress: () => {
            setSessions([]);
            setCurrentTranscript([]);
            audioBufferRef.current = [];
            SpeakerDiarizationService.resetSpeakers();
          }
        }
      ]
    );
  }, []);

  const startListening = useCallback(async () => {
    if (!modelLoaded) {
      Alert.alert('Error', 'Speech recognition not ready');
      return;
    }

    try {
      setError(null);
      setPartialText('');

      // Reset processing state
      processingRef.current = false;
      lastProcessTimeRef.current = 0;
      partialUpdateTimeRef.current = 0;

      if (resultListenerRef.current) {
        resultListenerRef.current.remove();
      }
      if (partialListenerRef.current) {
        partialListenerRef.current.remove();
      }

      // Set up noise profile for noise cancellation (first 1 second of recording)
      if (noiseCancellationEnabled) {
        setTimeout(() => {
          if (audioBufferRef.current.length > 16000) { // 1 second at 16kHz
            const noiseSamples = audioBufferRef.current.slice(0, 16000);
            NoiseCancellationService.setNoiseProfile(noiseSamples);
          }
        }, 1000);
      }

      // Set up result listeners with OPTIMIZED emotion detection and speaker identification
      resultListenerRef.current = Vosk.onResult((text: string) => {
        console.log('Result:', text);
        if (text && text.trim().length > 0) {
          // Trigger haptic feedback on speech detection
          if (hapticEnabled) {
            HapticFeedbackService.triggerEvent('speech');
          }
          // Throttle audio analysis to prevent UI freezing
          const now = Date.now();
          const timeSinceLastProcess = now - lastProcessTimeRef.current;

          // Use InteractionManager to run after animations complete
          // Use requestAnimationFrame for smooth UI
          requestAnimationFrame(() => {
            if (processingRef.current) {
              console.log('Skipping analysis - already processing');
              // Add without analysis if busy
              setCurrentTranscript(prev => [...prev, {
                text: text,
                emotion: 'neutral',
                emoji: '',
                speakerId: 1,
                speakerLabel: 'Speaker 1',
                speakerColor: '#6750A4',
              }]);
              return;
            }

            // Throttle: skip if processed too recently
            if (timeSinceLastProcess < ANALYSIS_THROTTLE_MS) {
              console.log('Throttling analysis');
              setCurrentTranscript(prev => [...prev, {
                text: text,
                emotion: 'neutral',
                emoji: '',
                speakerId: 1,
                speakerLabel: 'Speaker 1',
                speakerColor: '#6750A4',
              }]);
              return;
            }

            processingRef.current = true;
            lastProcessTimeRef.current = now;

            try {
              // Apply noise cancellation if enabled
              let audioSample = audioBufferRef.current.length > ANALYSIS_SAMPLE_SIZE
                ? audioBufferRef.current.slice(-ANALYSIS_SAMPLE_SIZE)
                : audioBufferRef.current;
              
              if (noiseCancellationEnabled && NoiseCancellationService.isReady()) {
                audioSample = NoiseCancellationService.applyNoiseCancellation(audioSample);
              }

              // Use advanced detection on real devices, fast mode on emulator
              const emotionResult = EmotionDetectionService.analyzeAudioForEmotion(
                audioSample,
                config.useAdvancedEmotionDetection
              );
              const speakerResult = SpeakerDiarizationService.identifySpeaker(
                audioSample,
                config.useAdvancedSpeakerDetection
              );

              const transcriptLine: TranscriptLine = {
                text: text,
                emotion: emotionResult.emotion,
                emoji: emotionResult.emoji,
                speakerId: speakerResult.speakerId,
                speakerLabel: speakerResult.label,
                speakerColor: speakerResult.color,
              };

              setCurrentTranscript(prev => [...prev, transcriptLine]);

              // Clear buffer after processing
              audioBufferRef.current = [];
            } catch (err) {
              console.error('Audio analysis error:', err);
              // Fallback: add text without analysis
              setCurrentTranscript(prev => [...prev, {
                text: text,
                emotion: 'neutral',
                emoji: '',
                speakerId: 1,
                speakerLabel: 'Speaker 1',
                speakerColor: '#6750A4',
              }]);
            } finally {
              processingRef.current = false;
            }
          });

          setPartialText('');
        }
      });

      partialListenerRef.current = Vosk.onPartialResult((text: string) => {
        // Throttle partial updates to reduce re-renders
        const now = Date.now();
        if (now - partialUpdateTimeRef.current > PARTIAL_THROTTLE_MS) {
          console.log('Partial:', text);
          setPartialText(text);
          partialUpdateTimeRef.current = now;
        }
      });

      // Start audio capture for emotion analysis
      await AudioCaptureService.startRecording({}, handleAudioData);

      // Start Vosk recognition
      await Vosk.start();
      setIsRecording(true);
      if (hapticEnabled) {
        HapticFeedbackService.triggerEvent('start');
      }
      console.log('Listening started with optimized processing');
    } catch (err: any) {
      setError(`Start failed: ${err.message}`);
      console.error('Start error:', err);
    }
  }, [modelLoaded, handleAudioData]);

  const stopListening = useCallback(async () => {
    try {
      await AudioCaptureService.stopRecording();
      Vosk.stop();
      setIsRecording(false);
      setPartialText('');
      if (hapticEnabled) {
        HapticFeedbackService.triggerEvent('stop');
      }
      // Reset noise profile for next session
      if (noiseCancellationEnabled) {
        NoiseCancellationService.resetNoiseProfile();
      }
      audioBufferRef.current = [];

      // Save session if there's content
      if (currentTranscript.length > 0) {
        const newSession: ConversationSession = {
          id: Date.now().toString(),
          timestamp: new Date(),
          transcript: [...currentTranscript],
        };

        setSessions(prev => [newSession, ...prev].slice(0, config.maxSavedSessions));
        setCurrentTranscript([]);
      }

      if (resultListenerRef.current) {
        resultListenerRef.current.remove();
        resultListenerRef.current = null;
      }
      if (partialListenerRef.current) {
        partialListenerRef.current.remove();
        partialListenerRef.current = null;
      }

      console.log('Listening stopped, session saved');
    } catch (err: any) {
      setError(`Stop failed: ${err.message}`);
      console.error('Stop error:', err);
      audioBufferRef.current = [];
    }
  }, [currentTranscript]);

  const cleanup = useCallback(() => {
    try {
      AudioCaptureService.stopRecording();
      if (resultListenerRef.current) {
        resultListenerRef.current.remove();
        resultListenerRef.current = null;
      }
      if (partialListenerRef.current) {
        partialListenerRef.current.remove();
        partialListenerRef.current = null;
      }
      audioBufferRef.current = [];

      if (modelLoaded) {
        Vosk.unload();
      }
    } catch (err: any) {
      console.error('Cleanup error:', err);
    }
  }, [modelLoaded]);

  const toggleListening = useCallback(() => {
    if (isRecording) {
      stopListening();
    } else {
      startListening();
    }
  }, [isRecording, stopListening, startListening]);

  useEffect(() => {
    // Detect if running on emulator or real device
    const setupPerformanceConfig = async () => {
      // Simple heuristic: if device name contains "emulator" or "sdk", it's an emulator
      let isEmulator = false;
      try {
        if (Platform.OS === 'android' && Platform.constants) {
          const model = Platform.constants.Model || '';
          isEmulator = model.toLowerCase().includes('sdk') || 
                       model.toLowerCase().includes('emulator');
        }
      } catch (error) {
        // Platform.constants might not be available yet, default to false
        console.warn('Could not detect emulator status:', error);
        isEmulator = false;
      }

      if (isEmulator) {
        console.log('🎮 Detected EMULATOR - Using FAST mode');
        useEmulatorConfig();
      } else {
        console.log('📱 Detected REAL DEVICE - Using ACCURATE mode');
        useDeviceConfig();
      }

      const currentConfig = getPerformanceConfig();
      console.log('📊 Performance Config:', {
        emotionMode: currentConfig.useAdvancedEmotionDetection ? 'ACCURATE (7 features)' : 'FAST (4 features)',
        speakerMode: currentConfig.useAdvancedSpeakerDetection ? 'ACCURATE (16 features)' : 'FAST (6 features)',
        throttle: currentConfig.analysisThrottleMs + 'ms',
        buffer: currentConfig.maxAudioBuffer + ' samples',
      });
    };

    setupPerformanceConfig();
    initializeApp();
    
    // Load haptic settings
    const loadHapticSettings = async () => {
      const enabled = HapticFeedbackService.isEnabled();
      setHapticEnabled(enabled);
    };
    loadHapticSettings();

    return () => {
      cleanup();
    };
  }, [initializeApp, cleanup]);

  // Optimized auto-scroll with requestAnimationFrame
  const handleContentSizeChange = useCallback(() => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  // If in Voice Mode, show that screen
  if (activeTab === 'speak') {
    return <VoiceModeScreen onBack={() => setActiveTab('transcribe')} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Lylyt</Text>
        </View>

        <View style={styles.headerRight}>
          {/* Language Selector */}
          <TouchableOpacity
            style={styles.languageSelector}
            onPress={() => setShowLanguageSelector(!showLanguageSelector)}
            disabled={isRecording}
            accessibilityLabel={`Current language: ${currentLanguage.name}. Tap to change.`}
          >
            <Text style={styles.languageText}>
              {currentLanguage.flag}
            </Text>
          </TouchableOpacity>

          {/* Clear Button */}
          {(sessions.length > 0 || currentTranscript.length > 0) && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearAllSessions}
              accessibilityLabel="Clear all conversations"
            >
              <Text style={styles.clearButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Mode Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'transcribe' && styles.tabActive]}
          onPress={() => setActiveTab('transcribe')}
          disabled={isRecording}
        >
          <Text style={[styles.tabText, activeTab === 'transcribe' && styles.tabTextActive]}>
            🎤 Transcribe
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'speak' && styles.tabActive]}
          onPress={() => setActiveTab('speak')}
          disabled={isRecording}
        >
          <Text style={[styles.tabText, activeTab === 'speak' && styles.tabTextActive]}>
            🔊 Speak
          </Text>
        </TouchableOpacity>
      </View>

      {/* Language Dropdown */}
      {showLanguageSelector && (
        <View style={styles.languageDropdown}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageOption,
                currentLanguage.code === lang.code && styles.languageOptionActive,
              ]}
              onPress={() => switchLanguage(lang)}
              accessible={true}
              accessibilityLabel={`Select ${lang.name} language`}
              accessibilityRole="button"
            >
              <Text style={[
                styles.languageOptionText,
                currentLanguage.code === lang.code && styles.languageOptionTextActive
              ]}>
                {lang.flag} {lang.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Main Content */}
      <View style={styles.content}>
        {/* Active Indicator */}
        {isRecording && (
          <View style={styles.activeBanner}>
            <View style={styles.pulseAnimation} />
            <Text style={styles.activeBannerText}>Listening...</Text>
          </View>
        )}

        {/* Transcription Display */}
        <View style={styles.transcriptionContainer}>
          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : sessions.length === 0 && currentTranscript.length === 0 && !isRecording ? (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderEmoji}>💬</Text>
              <Text style={styles.placeholderTitle}>Ready to listen</Text>
              <Text style={styles.placeholderText}>
                Tap the microphone to start
              </Text>
            </View>
          ) : (
            <ScrollView
              ref={scrollViewRef}
              style={styles.transcriptionScroll}
              onContentSizeChange={handleContentSizeChange}
            >
              {/* Past Sessions */}
              {sessions.map((session) => (
                <View key={session.id} style={styles.sessionContainer}>
                  <View style={styles.sessionHeader}>
                    <Text style={styles.sessionTime}>
                      {session.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <View style={styles.sessionBadge}>
                      <Text style={styles.sessionBadgeText}>SAVED</Text>
                    </View>
                  </View>
                  {session.transcript.map((line, index) => (
                    <View key={index} style={[styles.transcriptLine, { borderLeftColor: line.speakerColor }]}>
                      <View style={styles.transcriptHeader}>
                        <Text style={[styles.speakerLabel, { color: line.speakerColor }]}>
                          {line.speakerLabel}
                        </Text>
                        {line.emoji && (
                          <Text style={styles.emotionEmojiSmall}>{line.emoji}</Text>
                        )}
                      </View>
                      <Text style={styles.transcriptText}>{line.text}</Text>
                    </View>
                  ))}
                </View>
              ))}

              {/* Current Session */}
              {(currentTranscript.length > 0 || (partialText && isRecording)) && (
                <View style={styles.currentSessionContainer}>
                  {isRecording && (
                    <View style={styles.sessionHeader}>
                      <Text style={styles.sessionTime}>NOW</Text>
                      <View style={[styles.sessionBadge, styles.sessionBadgeLive]}>
                        <Text style={styles.sessionBadgeText}>LIVE</Text>
                      </View>
                    </View>
                  )}
                  {currentTranscript.map((line, index) => (
                    <View key={index} style={[styles.transcriptLine, { borderLeftColor: line.speakerColor }]}>
                      <View style={styles.transcriptHeader}>
                        <Text style={[styles.speakerLabel, { color: line.speakerColor }]}>
                          {line.speakerLabel}
                        </Text>
                        {line.emoji && (
                          <Text style={styles.emotionEmojiSmall}>{line.emoji}</Text>
                        )}
                      </View>
                      <Text style={styles.transcriptText}>{line.text}</Text>
                    </View>
                  ))}
                  {partialText && isRecording && (
                    <Text style={styles.partialText}>{partialText}...</Text>
                  )}
                </View>
              )}
            </ScrollView>
          )}
        </View>

        {/* Control Button */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[
              styles.micButton,
              isRecording && styles.micButtonActive,
              (!modelLoaded || error) && styles.micButtonDisabled,
            ]}
            onPress={toggleListening}
            disabled={!modelLoaded || !!error}
            accessible={true}
            accessibilityLabel={isRecording ? 'Stop listening' : 'Start listening'}
            accessibilityRole="button"
            activeOpacity={0.85}
          >
            {isRecording ? (
              <View style={styles.stopIcon} />
            ) : (
              <Text style={styles.micIcon}>🎤</Text>
            )}
          </TouchableOpacity>
          {!isRecording && modelLoaded && !error && (
            <Text style={styles.tapToSpeak}>Tap to start</Text>
          )}
          {isRecording && (
            <Text style={styles.tapToSpeak}>Tap to stop</Text>
          )}
        </View>
      </View>

      {/* AI Summary Footer */}
      {(currentTranscript.length > 0 || sessions.length > 0) && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.summaryButton, isSummarizing && styles.summaryButtonDisabled]}
            onPress={handleSummarize}
            disabled={isSummarizing}
          >
            <Text style={styles.summaryButtonText}>
              {isSummarizing ? '✨ Summarizing...' : '✨ AI Summary'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* AI Model Download Panel */}
      {showAIPanel && (
        <View style={styles.aiPanel}>
          <View style={styles.aiPanelContent}>
            <TouchableOpacity 
              style={styles.aiPanelClose}
              onPress={() => setShowAIPanel(false)}
            >
              <Text style={styles.aiPanelCloseText}>✕</Text>
            </TouchableOpacity>
            
            <Text style={styles.aiPanelTitle}>🤖 AI Summarization</Text>
            
            {aiModelExists ? (
              <>
                <Text style={styles.aiPanelText}>
                  ✅ Model ready! Tap "AI Summary" to summarize your conversation.
                </Text>
                <TouchableOpacity
                  style={styles.downloadButton}
                  onPress={() => setShowAIPanel(false)}
                >
                  <Text style={styles.downloadButtonText}>Got it!</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.aiPanelText}>
                  Download the AI model (~{GenAIService.getExpectedSizeMB()}MB) to enable conversation summaries.
                </Text>
                
                {downloadError && (
                  <Text style={styles.downloadError}>{downloadError}</Text>
                )}
                
                {isDownloading ? (
                  <View style={styles.downloadProgressContainer}>
                    <View style={styles.downloadProgressBar}>
                      <View style={[styles.downloadProgressFill, { width: `${downloadProgress}%` }]} />
                    </View>
                    <Text style={styles.downloadProgressText}>Downloading... {downloadProgress}%</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.downloadButton}
                    onPress={handleDownloadModel}
                  >
                    <Text style={styles.downloadButtonText}>⬇️ Download Model</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FEF7FF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#6750A4',
    letterSpacing: -0.5,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 12,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#F3EDF7',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#6750A4',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#49454F',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  languageSelector: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3EDF7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageText: {
    fontSize: 24,
  },
  clearButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFDAD6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 20,
    color: '#BA1A1A',
    fontWeight: '600',
  },
  languageDropdown: {
    position: 'absolute',
    top: 90,
    right: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    minWidth: 140,
    zIndex: 1000,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    overflow: 'hidden',
  },
  languageOption: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  languageOptionActive: {
    backgroundColor: '#F3EDF7',
  },
  languageOptionText: {
    color: '#1C1B1F',
    fontSize: 16,
    fontWeight: '500',
  },
  languageOptionTextActive: {
    color: '#6750A4',
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D0BCFF',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 16,
    alignSelf: 'center',
    gap: 8,
  },
  pulseAnimation: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6750A4',
  },
  activeBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#381E72',
  },
  transcriptionContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderEmoji: {
    fontSize: 72,
    marginBottom: 20,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 32,
  },
  transcriptionScroll: {
    flex: 1,
  },
  sessionContainer: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sessionTime: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sessionBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sessionBadgeLive: {
    backgroundColor: '#DBEAFE',
  },
  sessionBadgeText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  currentSessionContainer: {
    marginBottom: 8,
  },
  transcriptLine: {
    flexDirection: 'column',
    alignItems: 'stretch',
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F7F2FA',
    borderRadius: 20,
    borderLeftWidth: 4,
  },
  transcriptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  speakerLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emotionEmoji: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 0,
  },
  emotionEmojiSmall: {
    fontSize: 18,
  },
  transcriptText: {
    flex: 1,
    fontSize: 18,
    color: '#1F2937',
    lineHeight: 28,
    fontWeight: '500',
  },
  partialText: {
    fontSize: 18,
    color: '#9CA3AF',
    fontStyle: 'italic',
    lineHeight: 28,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#D1D5DB',
  },
  controls: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  micButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#6750A4',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#6750A4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  micButtonActive: {
    backgroundColor: '#DC2626',
    shadowColor: '#DC2626',
  },
  micButtonDisabled: {
    backgroundColor: '#E6E1E5',
    shadowColor: '#000',
    shadowOpacity: 0.1,
  },
  micIcon: {
    fontSize: 36,
  },
  stopIcon: {
    width: 24,
    height: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
  tapToSpeak: {
    marginTop: 12,
    color: '#49454F',
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  summaryButton: {
    backgroundColor: '#6750A4',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  summaryButtonDisabled: {
    backgroundColor: '#E6E1E5',
  },
  summaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  aiPanel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  aiPanelContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingTop: 40,
  },
  aiPanelClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3EDF7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiPanelCloseText: {
    fontSize: 18,
    color: '#49454F',
  },
  aiPanelTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1B1F',
    marginBottom: 12,
  },
  aiPanelText: {
    fontSize: 15,
    color: '#49454F',
    lineHeight: 22,
    marginBottom: 20,
  },
  downloadError: {
    fontSize: 14,
    color: '#DC2626',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
  },
  downloadButton: {
    backgroundColor: '#6750A4',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  downloadProgressContainer: {
    marginTop: 8,
  },
  downloadProgressBar: {
    height: 8,
    backgroundColor: '#E6E1E5',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  downloadProgressFill: {
    height: '100%',
    backgroundColor: '#6750A4',
    borderRadius: 4,
  },
  downloadProgressText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#49454F',
  },
});

export default MainScreen;

