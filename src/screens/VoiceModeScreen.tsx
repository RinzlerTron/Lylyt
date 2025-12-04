/**
 * Voice Mode Screen
 * Type text and have the phone speak it aloud
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import TextToSpeechService from '../services/TextToSpeechService';

interface QuickPhrase {
  id: string;
  text: string;
  emoji: string;
}

const DEFAULT_PHRASES: QuickPhrase[] = [
  { id: '1', text: 'Hello!', emoji: '👋' },
  { id: '2', text: 'Thank you', emoji: '🙏' },
  { id: '3', text: 'Yes', emoji: '✅' },
  { id: '4', text: 'No', emoji: '❌' },
  { id: '5', text: 'Can you repeat that?', emoji: '🔄' },
  { id: '6', text: 'One moment please', emoji: '⏳' },
];

interface VoiceModeScreenProps {
  onBack: () => void;
}

const VoiceModeScreen: React.FC<VoiceModeScreenProps> = ({ onBack }) => {
  const [text, setText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speed, setSpeed] = useState(0.5);
  const [pitch, setPitch] = useState(1.0);
  const [showSettings, setShowSettings] = useState(false);

  const handleSpeak = useCallback(async (textToSpeak?: string) => {
    const speakText = textToSpeak || text;

    if (!speakText || speakText.trim().length === 0) {
      Alert.alert('Enter Text', 'Type something to speak');
      return;
    }

    try {
      setIsSpeaking(true);
      await TextToSpeechService.speak(speakText, { rate: speed, pitch });

      // Clear input after speaking custom text
      if (!textToSpeak) {
        setText('');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Could not speak text');
    } finally {
      setIsSpeaking(false);
    }
  }, [text, speed, pitch]);

  const handleStop = useCallback(async () => {
    await TextToSpeechService.stop();
    setIsSpeaking(false);
  }, []);

  const getSpeedLabel = () => {
    if (speed < 0.3) return 'Slow';
    if (speed < 0.6) return 'Normal';
    return 'Fast';
  };

  const getPitchLabel = () => {
    if (pitch < 0.8) return 'Low';
    if (pitch < 1.2) return 'Normal';
    return 'High';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Lylyt</Text>
        </View>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setShowSettings(!showSettings)}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Mode Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={styles.tab}
          onPress={onBack}
        >
          <Text style={styles.tabText}>🎤 Transcribe</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, styles.tabActive]}
          disabled
        >
          <Text style={[styles.tabText, styles.tabTextActive]}>🔊 Speak</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Voice Settings */}
        {showSettings && (
          <View style={styles.settingsSection}>
            <Text style={styles.sectionTitle}>Voice Settings</Text>
            
            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>Speed: {getSpeedLabel()}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0.1}
                maximumValue={0.9}
                value={speed}
                onValueChange={setSpeed}
                minimumTrackTintColor="#6750A4"
                maximumTrackTintColor="#E6E1E5"
                thumbTintColor="#6750A4"
              />
            </View>

            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>Pitch: {getPitchLabel()}</Text>
              <Slider
                style={styles.slider}
                minimumValue={0.5}
                maximumValue={1.5}
                value={pitch}
                onValueChange={setPitch}
                minimumTrackTintColor="#6750A4"
                maximumTrackTintColor="#E6E1E5"
                thumbTintColor="#6750A4"
              />
            </View>
          </View>
        )}

        {/* Text Input */}
        <View style={styles.inputSection}>
          <TextInput
            style={styles.textInput}
            multiline
            placeholder="Type what you want to say..."
            placeholderTextColor="#9CA3AF"
            value={text}
            onChangeText={setText}
          />

          {/* Speak Button */}
          <View style={styles.actionButtons}>
            {isSpeaking ? (
              <TouchableOpacity
                style={[styles.speakButton, styles.stopButton]}
                onPress={handleStop}
              >
                <Text style={styles.speakButtonText}>⏹️ Stop</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.speakButton, !text && styles.speakButtonDisabled]}
                onPress={() => handleSpeak()}
                disabled={!text}
              >
                <Text style={styles.speakButtonText}>🔊 Speak</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Quick Phrases */}
        <View style={styles.phrasesSection}>
          <Text style={styles.sectionTitle}>Quick Phrases</Text>
          <View style={styles.phrasesGrid}>
            {DEFAULT_PHRASES.map((phrase) => (
              <TouchableOpacity
                key={phrase.id}
                style={styles.phraseButton}
                onPress={() => handleSpeak(phrase.text)}
              >
                <Text style={styles.phraseEmoji}>{phrase.emoji}</Text>
                <Text style={styles.phraseButtonText}>{phrase.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
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
  settingsButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3EDF7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: {
    fontSize: 24,
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
  content: {
    flex: 1,
    padding: 20,
  },
  settingsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  sliderRow: {
    marginBottom: 16,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#49454F',
    marginBottom: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  inputSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  textInput: {
    backgroundColor: '#F3EDF7',
    borderRadius: 16,
    padding: 16,
    fontSize: 18,
    color: '#1C1B1F',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  actionButtons: {
    marginTop: 16,
  },
  speakButton: {
    backgroundColor: '#6750A4',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakButtonDisabled: {
    backgroundColor: '#E6E1E5',
  },
  stopButton: {
    backgroundColor: '#DC2626',
  },
  speakButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  phrasesSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1B1F',
    marginBottom: 16,
  },
  phrasesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  phraseButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F3EDF7',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phraseEmoji: {
    fontSize: 18,
  },
  phraseButtonText: {
    color: '#1C1B1F',
    fontSize: 15,
    fontWeight: '500',
  },
});

export default VoiceModeScreen;

