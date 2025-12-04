export type Emotion = 'neutral' | 'happy' | 'sad' | 'angry' | 'urgent';

export interface EmotionResult {
  emotion: Emotion;
  confidence: number;
  emoji: string;
}

export interface AudioFeatures {
  pitch: number;
  energy: number;
  tempo: number;
  spectralCentroid: number;
  zeroCrossingRate: number;
  rms: number;
  pitchVariance: number;
}

export interface EmotionThresholds {
  energy: { min: number; max: number };
  pitch: { min: number; max: number };
  tempo: { min: number; max: number };
  spectralCentroid: { min: number; max: number };
  zeroCrossingRate: { min: number; max: number };
}

export interface EmotionModel {
  weights: Record<string, number>;
  bias: number;
  thresholds: EmotionThresholds;
}

class EmotionDetectionService {
  private debugMode: boolean = __DEV__; // Enable debug logging in development

  // Emotion models based on research into acoustic correlates of emotion
  private emotionModels: Record<Emotion, EmotionModel> = {
    angry: {
      weights: {
        energy: 0.4,
        pitch: 0.3,
        tempo: 0.2,
        spectralCentroid: 0.1,
        zeroCrossingRate: 0.0
      },
      bias: 0.1,
      thresholds: {
        energy: { min: 0.6, max: 1.0 },
        pitch: { min: 0.015, max: 0.05 },
        tempo: { min: 0.5, max: 1.0 },
        spectralCentroid: { min: 0.4, max: 0.8 },
        zeroCrossingRate: { min: 0.01, max: 0.03 }
      }
    },
    urgent: {
      weights: {
        energy: 0.5,
        pitch: 0.2,
        tempo: 0.3,
        spectralCentroid: 0.0,
        zeroCrossingRate: 0.0
      },
      bias: 0.15,
      thresholds: {
        energy: { min: 0.5, max: 1.0 },
        pitch: { min: 0.01, max: 0.03 },
        tempo: { min: 0.6, max: 1.0 },
        spectralCentroid: { min: 0.3, max: 0.7 },
        zeroCrossingRate: { min: 0.008, max: 0.025 }
      }
    },
    sad: {
      weights: {
        energy: 0.3,
        pitch: 0.4,
        tempo: 0.3,
        spectralCentroid: 0.0,
        zeroCrossingRate: 0.0
      },
      bias: 0.05,
      thresholds: {
        energy: { min: 0.0, max: 0.3 },
        pitch: { min: 0.0, max: 0.008 },
        tempo: { min: 0.0, max: 0.3 },
        spectralCentroid: { min: 0.1, max: 0.4 },
        zeroCrossingRate: { min: 0.005, max: 0.015 }
      }
    },
    happy: {
      weights: {
        energy: 0.25,
        pitch: 0.35,
        tempo: 0.2,
        spectralCentroid: 0.15,
        zeroCrossingRate: 0.05
      },
      bias: 0.08,
      thresholds: {
        energy: { min: 0.4, max: 0.7 },
        pitch: { min: 0.01, max: 0.025 },
        tempo: { min: 0.3, max: 0.6 },
        spectralCentroid: { min: 0.3, max: 0.6 },
        zeroCrossingRate: { min: 0.008, max: 0.02 }
      }
    },
    neutral: {
      weights: {
        energy: 0.2,
        pitch: 0.2,
        tempo: 0.2,
        spectralCentroid: 0.2,
        zeroCrossingRate: 0.2
      },
      bias: 0.0,
      thresholds: {
        energy: { min: 0.3, max: 0.6 },
        pitch: { min: 0.008, max: 0.015 },
        tempo: { min: 0.3, max: 0.5 },
        spectralCentroid: { min: 0.2, max: 0.5 },
        zeroCrossingRate: { min: 0.008, max: 0.018 }
      }
    }
  };

  // Calibration data for normalization
  private calibrationData = {
    energy: { mean: 2500, std: 1000 },
    pitch: { mean: 0.012, std: 0.008 },
    tempo: { mean: 0.4, std: 0.2 },
    spectralCentroid: { mean: 0.35, std: 0.15 },
    zeroCrossingRate: { mean: 0.012, std: 0.006 }
  };

  analyzeAudioForEmotion(audioData: number[], useAdvanced: boolean = false): EmotionResult {
    if (useAdvanced) {
      const features = this.extractAudioFeatures(audioData);
      return this.classifyEmotion(features);
    } else {
      const features = this.extractAudioFeaturesOptimized(audioData);
      return this.classifyEmotionFast(features);
    }
  }

  private extractAudioFeaturesOptimized(audioData: number[]): AudioFeatures {
    if (audioData.length === 0) {
      return {
        pitch: 0.012,
        energy: 0,
        tempo: 0.4,
        spectralCentroid: 0.35,
        zeroCrossingRate: 0.012,
        rms: 0,
        pitchVariance: 0
      };
    }

    // Sample first 2000 points
    const sample = audioData.length > 2000 ? audioData.slice(0, 2000) : audioData;

    const energy = this.calculateEnergyFast(sample);
    const rms = Math.sqrt(energy);
    const zeroCrossingRate = this.calculateZeroCrossingRate(sample);
    const pitch = zeroCrossingRate;

    return {
      pitch,
      energy,
      tempo: 0.4, // Use default to skip expensive calculation
      spectralCentroid: 0.35, // Use default to skip expensive calculation
      zeroCrossingRate,
      rms,
      pitchVariance: 0, // Skip variance calculation
    };
  }

  private calculateEnergyFast(audioData: number[]): number {
    let sum = 0;
    const len = Math.min(audioData.length, 1000); // Process max 1000 samples
    for (let i = 0; i < len; i++) {
      const val = audioData[i];
      sum += val * val; // Calculate as RMS directly
    }
    return sum / len;
  }

  private extractAudioFeatures(audioData: number[]): AudioFeatures {
    if (audioData.length === 0) {
      return {
        pitch: 0.012,
        energy: 0,
        tempo: 0.4,
        spectralCentroid: 0.35,
        zeroCrossingRate: 0.012,
        rms: 0,
        pitchVariance: 0
      };
    }

    // Calculate basic features
    const energy = this.calculateEnergy(audioData);
    const rms = this.calculateRMS(audioData);
    const zeroCrossingRate = this.calculateZeroCrossingRate(audioData);

    // Calculate pitch features
    const pitch = this.estimatePitch(audioData);
    const pitchVariance = this.calculatePitchVariance(audioData);

    // Calculate tempo (speech rate)
    const tempo = this.calculateTempo(audioData);

    // Calculate spectral centroid
    const spectralCentroid = this.calculateSpectralCentroid(audioData);

    return {
      pitch,
      energy,
      tempo,
      spectralCentroid,
      zeroCrossingRate,
      rms,
      pitchVariance
    };
  }

  private calculateEnergy(audioData: number[]): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += Math.abs(audioData[i]);
    }
    return sum / audioData.length;
  }

  private calculateRMS(audioData: number[]): number {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  private calculateZeroCrossingRate(audioData: number[]): number {
    let crossings = 0;
    for (let i = 1; i < audioData.length; i++) {
      if ((audioData[i] >= 0 && audioData[i - 1] < 0) ||
        (audioData[i] < 0 && audioData[i - 1] >= 0)) {
        crossings++;
      }
    }
    return crossings / audioData.length;
  }

  private calculatePitchVariance(audioData: number[]): number {
    // Calculate pitch over short windows and measure variance
    const windowSize = 800; // ~50ms at 16kHz
    const pitches: number[] = [];

    for (let i = 0; i < audioData.length - windowSize; i += windowSize) {
      const window = audioData.slice(i, i + windowSize);
      const pitch = this.estimatePitch(window);
      pitches.push(pitch);
    }

    if (pitches.length === 0) return 0;

    const mean = pitches.reduce((a, b) => a + b, 0) / pitches.length;
    const variance = pitches.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / pitches.length;

    return variance;
  }

  private calculateSpectralCentroid(audioData: number[]): number {
    // Simplified spectral centroid calculation
    // In a real implementation, this would use FFT
    // For now, use autocorrelation-based estimation
    const windowSize = Math.min(1024, audioData.length);
    const window = audioData.slice(0, windowSize);

    let centroid = 0;
    let totalMagnitude = 0;

    // Simplified frequency analysis using autocorrelation
    for (let lag = 1; lag < Math.min(windowSize / 2, 100); lag++) {
      let correlation = 0;
      for (let i = 0; i < windowSize - lag; i++) {
        correlation += window[i] * window[i + lag];
      }

      const magnitude = Math.abs(correlation);
      centroid += lag * magnitude;
      totalMagnitude += magnitude;
    }

    return totalMagnitude > 0 ? centroid / totalMagnitude / 100 : 0.35;
  }

  private estimatePitch(audioData: number[]): number {
    // Zero-crossing rate as rough pitch estimator
    let crossings = 0;
    for (let i = 1; i < audioData.length; i++) {
      if ((audioData[i] >= 0 && audioData[i - 1] < 0) ||
        (audioData[i] < 0 && audioData[i - 1] >= 0)) {
        crossings++;
      }
    }
    // Normalize to 0-1 range
    return crossings / audioData.length;
  }

  private calculateTempo(audioData: number[]): number {
    // Calculate rate of energy change (speech tempo)
    const windowSize = 400; // ~25ms at 16kHz
    const energyChanges: number[] = [];

    for (let i = 0; i < audioData.length - windowSize; i += windowSize) {
      const window = audioData.slice(i, i + windowSize);
      const energy = this.calculateEnergy(window);
      energyChanges.push(energy);
    }

    // Calculate variance in energy (indicates tempo)
    if (energyChanges.length === 0) return 0.5;

    const mean = energyChanges.reduce((a, b) => a + b, 0) / energyChanges.length;
    const variance = energyChanges.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / energyChanges.length;

    // Normalize to 0-1 range
    return Math.min(1, variance / 10000);
  }

  private classifyEmotionFast(features: AudioFeatures): EmotionResult {
    const { energy, zeroCrossingRate, rms } = features;

    // Normalize energy (emulator audio tends to be noisier)
    const normalizedEnergy = Math.min(energy / 5000, 1.0); // Adjust normalization

    // Debug logging (only in development)
    if (this.debugMode && Math.random() < 0.1) { // Log 10% of the time to avoid spam
      console.log('Emotion Detection:', {
        rawEnergy: energy.toFixed(2),
        normalizedEnergy: normalizedEnergy.toFixed(2),
        zeroCrossingRate: zeroCrossingRate.toFixed(4),
        rms: rms.toFixed(2),
      });
    }

    // Simple threshold-based classification (very fast)
    let emotion: Emotion = 'neutral';
    let confidence = 0.6;

    // More balanced thresholds
    // Very high energy + high ZCR = angry
    if (normalizedEnergy > 0.85 && zeroCrossingRate > 0.025) {
      emotion = 'angry';
      confidence = 0.7;
    }
    // High energy + moderate/high ZCR = happy
    else if (normalizedEnergy > 0.6 && zeroCrossingRate > 0.018) {
      emotion = 'happy';
      confidence = 0.65;
    }
    // Very high energy with lower ZCR = urgent
    else if (normalizedEnergy > 0.9 && zeroCrossingRate < 0.02) {
      emotion = 'urgent';
      confidence = 0.75;
    }
    // Low energy = sad
    else if (normalizedEnergy < 0.25) {
      emotion = 'sad';
      confidence = 0.6;
    }
    // Default to neutral for moderate speech
    else {
      emotion = 'neutral';
      confidence = 0.7;
    }

    if (this.debugMode && Math.random() < 0.1) {
      console.log(`  -> Detected: ${emotion} (confidence: ${confidence})`);
    }

    return {
      emotion,
      confidence,
      emoji: this.getEmotionEmoji(emotion)
    };
  }

  private classifyEmotion(features: AudioFeatures): EmotionResult {
    // Normalize features using calibration data
    const normalizedFeatures = this.normalizeFeatures(features);

    // Calculate confidence scores for each emotion
    const scores: Record<Emotion, number> = {
      angry: 0,
      urgent: 0,
      sad: 0,
      happy: 0,
      neutral: 0
    };

    for (const emotion of Object.keys(this.emotionModels) as Emotion[]) {
      scores[emotion] = this.calculateEmotionScore(emotion, normalizedFeatures);
    }

    // Find the emotion with the highest score
    let bestEmotion: Emotion = 'neutral';
    let bestScore = 0;

    for (const emotion of Object.keys(scores) as Emotion[]) {
      if (scores[emotion] > bestScore) {
        bestScore = scores[emotion];
        bestEmotion = emotion;
      }
    }

    // Calculate confidence based on score difference from second best
    const sortedScores = Object.entries(scores)
      .sort(([, a], [, b]) => b - a);

    const confidence = sortedScores.length > 1
      ? Math.min(0.95, bestScore - sortedScores[1][1])
      : bestScore;

    return {
      emotion: bestEmotion,
      confidence: Math.max(0.1, confidence), // Minimum confidence of 10%
      emoji: this.getEmotionEmoji(bestEmotion)
    };
  }

  private normalizeFeatures(features: AudioFeatures): Record<string, number> {
    const normalized: Record<string, number> = {};

    for (const [key, value] of Object.entries(features)) {
      if (key in this.calibrationData) {
        const cal = this.calibrationData[key as keyof typeof this.calibrationData];
        // Z-score normalization
        normalized[key] = (value - cal.mean) / cal.std;
        // Clamp to reasonable range
        normalized[key] = Math.max(-3, Math.min(3, normalized[key]));
        // Convert to 0-1 range
        normalized[key] = (normalized[key] + 3) / 6;
      } else {
        normalized[key] = value;
      }
    }

    return normalized;
  }

  private calculateEmotionScore(emotion: Emotion, normalizedFeatures: Record<string, number>): number {
    const model = this.emotionModels[emotion];
    let score = model.bias;

    // Check if features are within thresholds
    const thresholds = model.thresholds;
    let thresholdScore = 0;

    for (const [feature, value] of Object.entries(normalizedFeatures)) {
      if (feature in thresholds) {
        const threshold = thresholds[feature as keyof EmotionThresholds];
        if (value >= threshold.min && value <= threshold.max) {
          thresholdScore += 0.2; // Bonus for being in range
        }
      }

      // Add weighted contribution
      if (feature in model.weights) {
        score += value * model.weights[feature];
      }
    }

    // Combine threshold score with weighted score
    score += thresholdScore;

    // Apply sigmoid-like activation
    score = 1 / (1 + Math.exp(-score));

    return score;
  }

  getEmotionEmoji(emotion: Emotion): string {
    const emojiMap: Record<Emotion, string> = {
      neutral: '',
      happy: '😊',
      sad: '😢',
      angry: '😠',
      urgent: '⚠️',
    };
    return emojiMap[emotion];
  }

  // Validation and calibration methods
  validateEmotionDetection(testData: Array<{ audioData: number[], expectedEmotion: Emotion }>): {
    accuracy: number;
    confusionMatrix: Record<Emotion, Record<Emotion, number>>;
    featureImportance: Record<string, number>;
  } {
    let correct = 0;
    const total = testData.length;
    const confusionMatrix: Record<Emotion, Record<Emotion, number>> = {
      neutral: { neutral: 0, happy: 0, sad: 0, angry: 0, urgent: 0 },
      happy: { neutral: 0, happy: 0, sad: 0, angry: 0, urgent: 0 },
      sad: { neutral: 0, happy: 0, sad: 0, angry: 0, urgent: 0 },
      angry: { neutral: 0, happy: 0, sad: 0, angry: 0, urgent: 0 },
      urgent: { neutral: 0, happy: 0, sad: 0, angry: 0, urgent: 0 }
    };

    const featureContributions: Record<string, number[]> = {
      energy: [],
      pitch: [],
      tempo: [],
      spectralCentroid: [],
      zeroCrossingRate: []
    };

    for (const test of testData) {
      const result = this.analyzeAudioForEmotion(test.audioData);
      const predicted = result.emotion;
      const expected = test.expectedEmotion;

      if (predicted === expected) {
        correct++;
      }

      confusionMatrix[expected][predicted]++;

      // Track feature contributions
      const features = this.extractAudioFeatures(test.audioData);
      const normalizedFeatures = this.normalizeFeatures(features);

      for (const feature of Object.keys(featureContributions)) {
        const contribution = this.calculateFeatureContribution(feature, normalizedFeatures, predicted);
        featureContributions[feature].push(contribution);
      }
    }

    // Calculate average feature importance
    const featureImportance: Record<string, number> = {};
    for (const [feature, contributions] of Object.entries(featureContributions)) {
      featureImportance[feature] = contributions.reduce((a, b) => a + b, 0) / contributions.length;
    }

    return {
      accuracy: correct / total,
      confusionMatrix,
      featureImportance
    };
  }

  private calculateFeatureContribution(
    featureName: string,
    normalizedFeatures: Record<string, number>,
    predictedEmotion: Emotion
  ): number {
    const model = this.emotionModels[predictedEmotion];
    const weight = model.weights[featureName] || 0;
    const value = normalizedFeatures[featureName] || 0;
    return weight * value;
  }

  // Method to update calibration data based on real usage
  updateCalibration(audioData: number[], detectedEmotion: Emotion): void {
    const features = this.extractAudioFeatures(audioData);

    // Update calibration means and stds incrementally
    for (const [key, value] of Object.entries(features)) {
      if (key in this.calibrationData) {
        const cal = this.calibrationData[key as keyof typeof this.calibrationData];
        // Simple incremental update (could be made more sophisticated)
        cal.mean = (cal.mean * 0.99) + (value * 0.01);
        const diff = value - cal.mean;
        cal.std = Math.sqrt((cal.std * cal.std * 0.99) + (diff * diff * 0.01));
      }
    }

    console.log(`Updated calibration for emotion: ${detectedEmotion}`);
  }

  // Method to get current emotion detection statistics
  getEmotionStats(): {
    totalAnalyses: number;
    emotionDistribution: Record<Emotion, number>;
    averageConfidence: number;
  } {
    // This would be populated by tracking actual usage
    // For now, return placeholder data
    return {
      totalAnalyses: 0,
      emotionDistribution: {
        neutral: 0,
        happy: 0,
        sad: 0,
        angry: 0,
        urgent: 0
      },
      averageConfidence: 0.5
    };
  }

  // Enable/disable debug mode
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    console.log(`Emotion detection debug mode: ${enabled ? 'ON' : 'OFF'}`);
  }

  // Get current debug mode state
  getDebugMode(): boolean {
    return this.debugMode;
  }
}

export default new EmotionDetectionService();

