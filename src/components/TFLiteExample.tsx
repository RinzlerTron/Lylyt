import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import TensorFlowLiteService, {
  ModelInfo,
  InferenceResult,
} from '../services/TensorFlowLiteService';
import AudioCaptureService, {
  AudioData,
} from '../services/AudioCaptureService';
// import AudioPreprocessingService from '../services/AudioPreprocessingService';

const TFLiteExample: React.FC = () => {
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<InferenceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBuffer, setAudioBuffer] = useState<number[]>([]);
  const [transcription, setTranscription] = useState<string>('');

  const handleLoadModel = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const info = await TensorFlowLiteService.loadModelFromAssets(
        'models/audio_model_int8.tflite',
      );
      setModelInfo(info);
    } catch (err: any) {
      setError(err.message || 'Failed to load model');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunInference = async () => {
    if (!modelInfo) {
      setError('Model not loaded');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const inputSize = modelInfo.inputShape.reduce((a, b) => a * b, 1);
      const testInput = new Array(inputSize).fill(0).map(() => Math.random());
      const result = await TensorFlowLiteService.runInference(testInput);
      setLastResult(result);
    } catch (err: any) {
      setError(err.message || 'Inference failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = async () => {
    setIsLoading(true);
    try {
      await TensorFlowLiteService.close();
      setModelInfo(null);
      setLastResult(null);
      setTranscription('');
    } catch (err: any) {
      setError(err.message || 'Failed to close model');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartRecording = async () => {
    if (!modelInfo) {
      setError('Model not loaded');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const success = await AudioCaptureService.startRecording({}, handleAudioData);
      if (success) {
        setIsRecording(true);
        setAudioBuffer([]);
        setTranscription('Listening...');
      } else {
        setError('Failed to start recording');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start recording');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopRecording = async () => {
    setIsLoading(true);
    try {
      await AudioCaptureService.stopRecording();
      setIsRecording(false);

      // Process final audio buffer if we have enough data
      if (audioBuffer.length > 1000) {
        await processAudioForTranscription(audioBuffer);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to stop recording');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAudioData = (data: AudioData) => {
    // Accumulate audio data
    setAudioBuffer(prev => {
      const newBuffer = [...prev, ...data.data];

      // Process when we have enough data (roughly 1 second at 16kHz)
      if (newBuffer.length >= 16000 && !isLoading) {
        processAudioForTranscription(newBuffer);
        return []; // Clear buffer after processing
      }

      return newBuffer;
    });
  };

  const processAudioForTranscription = async (audioData: number[]) => {
    if (!modelInfo) return;

    try {
      // Process audio through preprocessing pipeline
      // const { melSpec, flatArray, inputShape } = AudioPreprocessingService.processAudioChunk(audioData);
      const flatArray = new Float32Array(audioData);
      const inputShape = [1, audioData.length];

      console.log(`Audio processed: ${melSpec.shape[0]} time frames, ${melSpec.shape[1]} mel bins`);

      // Prepare input for model (ensure it matches expected shape)
      const inputSize = modelInfo.inputShape.reduce((a, b) => a * b, 1);
      const modelInput = new Array(inputSize).fill(0);

      // Fill with processed audio data (truncated/padded as needed)
      for (let i = 0; i < Math.min(flatArray.length, inputSize); i++) {
        modelInput[i] = flatArray[i];
      }

      const result = await TensorFlowLiteService.runInference(modelInput);
      setLastResult(result);

      // Show processing results
      const processingInfo = `Mel Spectrogram: ${melSpec.shape[0]}×${melSpec.shape[1]}, Inference: ${result.inferenceTimeMs}ms`;
      setTranscription(processingInfo);

    } catch (err: any) {
      setError(err.message || 'Transcription failed');
      console.error('Transcription error:', err);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      AudioCaptureService.stopRecording();
    };
  }, []);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Lylyt Audio Pipeline Test</Text>

      {error && <Text style={styles.error}>Error: {error}</Text>}

      {modelInfo ? (
        <View style={styles.infoContainer}>
          <Text style={styles.label}>Model Loaded:</Text>
          <Text style={styles.text}>Path: {modelInfo.modelPath}</Text>
          <Text style={styles.text}>
            Input Shape: [{modelInfo.inputShape.join(', ')}]
          </Text>
          <Text style={styles.text}>
            Output Shape: [{modelInfo.outputShape.join(', ')}]
          </Text>
        </View>
      ) : (
        <Text style={styles.text}>No model loaded</Text>
      )}

      {transcription ? (
        <View style={styles.transcriptionContainer}>
          <Text style={styles.label}>Transcription:</Text>
          <Text style={[styles.text, styles.transcriptionText]}>{transcription}</Text>
        </View>
      ) : null}

      {lastResult && (
        <View style={styles.resultContainer}>
          <Text style={styles.label}>Last Inference:</Text>
          <Text style={styles.text}>
            Time: {lastResult.inferenceTimeMs}ms
          </Text>
          <Text style={styles.text}>
            Output size: {lastResult.output.length} values
          </Text>
        </View>
      )}

      {isRecording && (
        <View style={styles.recordingIndicator}>
          <Text style={styles.recordingText}>🔴 RECORDING</Text>
          <Text style={styles.recordingSubtext}>Buffer: {audioBuffer.length} samples</Text>
        </View>
      )}

      <View style={styles.buttonContainer}>
        <Button
          title="Load Model"
          onPress={handleLoadModel}
          disabled={isLoading || !!modelInfo}
        />
        <View style={styles.spacer} />
        <Button
          title={isRecording ? "Stop Recording" : "Start Recording"}
          onPress={isRecording ? handleStopRecording : handleStartRecording}
          disabled={isLoading || !modelInfo}
          color={isRecording ? "#ff4444" : "#4CAF50"}
        />
        <View style={styles.spacer} />
        <Button
          title="Close Model"
          onPress={handleClose}
          disabled={isLoading || !modelInfo}
        />
      </View>

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  error: {
    color: 'red',
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#ffebee',
    borderRadius: 5,
  },
  infoContainer: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#e3f2fd',
    borderRadius: 5,
  },
  resultContainer: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f1f8e9',
    borderRadius: 5,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  text: {
    fontSize: 14,
    marginBottom: 5,
  },
  buttonContainer: {
    marginTop: 20,
  },
  spacer: {
    height: 10,
  },
  loadingContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  transcriptionContainer: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#e8f5e8',
    borderRadius: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  transcriptionText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  recordingIndicator: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#ffebee',
    borderRadius: 5,
    alignItems: 'center',
  },
  recordingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d32f2f',
  },
  recordingSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
});

export default TFLiteExample;

