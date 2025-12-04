export interface VoiceEmbedding {
  features: number[];
  timestamp: number;
}

export interface Speaker {
  id: number;
  color: string;
  label: string;
  embeddings: VoiceEmbedding[];
  centroid: number[];
}

export interface SpeakerIdentification {
  speakerId: number;
  confidence: number;
  color: string;
  label: string;
}

const SPEAKER_COLORS = [
  '#6366F1', // Indigo
  '#EC4899', // Pink
  '#10B981', // Green
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#F97316', // Orange
];

class SpeakerDiarizationService {
  private speakers: Speaker[] = [];
  private nextSpeakerId = 1;
  private readonly SIMILARITY_THRESHOLD = 0.75;
  private readonly MIN_SAMPLES_FOR_SPEAKER = 2;
  private readonly MAX_SPEAKERS = 8;

  identifySpeaker(audioData: number[], useAdvanced: boolean = false): SpeakerIdentification {
    const embedding = useAdvanced
      ? this.extractVoiceEmbedding(audioData)
      : this.extractVoiceEmbeddingFast(audioData);

    if (embedding.features.every(f => f === 0)) {
      return this.getDefaultSpeaker();
    }

    let bestMatch: Speaker | null = null;
    let bestSimilarity = 0;

    // Early exit if no speakers yet
    if (this.speakers.length === 0) {
      const newSpeaker = this.createNewSpeaker(embedding);
      return {
        speakerId: newSpeaker.id,
        confidence: 1.0,
        color: newSpeaker.color,
        label: newSpeaker.label,
      };
    }

    for (const speaker of this.speakers) {
      const similarity = this.calculateSimilarity(embedding.features, speaker.centroid);

      if (similarity > bestSimilarity && similarity > this.SIMILARITY_THRESHOLD) {
        bestSimilarity = similarity;
        bestMatch = speaker;
      }
    }

    if (bestMatch) {
      this.updateSpeakerFast(bestMatch, embedding);
      return {
        speakerId: bestMatch.id,
        confidence: bestSimilarity,
        color: bestMatch.color,
        label: bestMatch.label,
      };
    } else {
      if (this.speakers.length < this.MAX_SPEAKERS) {
        const newSpeaker = this.createNewSpeaker(embedding);
        return {
          speakerId: newSpeaker.id,
          confidence: 1.0,
          color: newSpeaker.color,
          label: newSpeaker.label,
        };
      } else {
        return this.assignToClosestSpeaker(embedding);
      }
    }
  }

  private extractVoiceEmbeddingFast(audioData: number[]): VoiceEmbedding {
    if (audioData.length === 0) {
      return {
        features: new Array(6).fill(0),
        timestamp: Date.now(),
      };
    }

    // Sample first 1500 samples for performance
    const sample = audioData.length > 1500 ? audioData.slice(0, 1500) : audioData;

    const features: number[] = [];

    features.push(this.calculatePitchFast(sample));
    features.push(this.calculateZeroCrossingRate(sample));
    features.push(this.calculateEnergyFast(sample));
    features.push(this.calculateSpectralCentroidFast(sample));
    features.push(this.calculateShimmerFast(sample));
    features.push(this.calculateEnergyVariance(sample));

    const normalized = this.normalizeFeaturesSimple(features);

    return {
      features: normalized,
      timestamp: Date.now(),
    };
  }

  // Fast helper methods
  private calculatePitchFast(audioData: number[]): number {
    // Simple autocorrelation with reduced range
    const minLag = 20;
    const maxLag = Math.min(200, audioData.length / 2); // Reduced from 400
    let bestLag = minLag;
    let maxCorrelation = -Infinity;

    for (let lag = minLag; lag < maxLag; lag += 2) { // Step by 2 for speed
      let correlation = 0;
      for (let i = 0; i < Math.min(500, audioData.length - lag); i++) { // Max 500 samples
        correlation += audioData[i] * audioData[i + lag];
      }

      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestLag = lag;
      }
    }

    return 16000 / bestLag;
  }

  private calculateEnergyFast(audioData: number[]): number {
    let sum = 0;
    const len = Math.min(audioData.length, 1000);
    for (let i = 0; i < len; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / len);
  }

  private calculateSpectralCentroidFast(audioData: number[]): number {
    // Simplified without full FFT
    let weightedSum = 0;
    let totalMagnitude = 0;
    const len = Math.min(audioData.length, 512);

    for (let i = 1; i < len; i++) {
      const magnitude = Math.abs(audioData[i] - audioData[i - 1]);
      weightedSum += i * magnitude;
      totalMagnitude += magnitude;
    }

    return totalMagnitude > 0 ? weightedSum / totalMagnitude / len : 0;
  }

  private calculateShimmerFast(audioData: number[]): number {
    // Simplified shimmer calculation
    const windowSize = 200; // Reduced from 400
    const amplitudes: number[] = [];
    const maxWindows = 10; // Limit number of windows

    for (let i = 0; i < Math.min(audioData.length - windowSize, windowSize * maxWindows); i += windowSize) {
      const window = audioData.slice(i, i + windowSize);
      const amplitude = Math.max(...window.map(Math.abs));
      amplitudes.push(amplitude);
    }

    if (amplitudes.length < 2) return 0;

    let shimmer = 0;
    for (let i = 1; i < amplitudes.length; i++) {
      shimmer += Math.abs(amplitudes[i] - amplitudes[i - 1]);
    }

    const avgAmplitude = amplitudes.reduce((sum, a) => sum + a, 0) / amplitudes.length;
    return avgAmplitude > 0 ? shimmer / ((amplitudes.length - 1) * avgAmplitude) : 0;
  }

  private calculateEnergyVariance(audioData: number[]): number {
    // Calculate energy variance across small windows
    const windowSize = 200;
    const energies: number[] = [];
    const maxWindows = 10;

    for (let i = 0; i < Math.min(audioData.length - windowSize, windowSize * maxWindows); i += windowSize) {
      const window = audioData.slice(i, i + windowSize);
      const energy = window.reduce((sum, val) => sum + val * val, 0) / windowSize;
      energies.push(energy);
    }

    if (energies.length < 2) return 0;

    const mean = energies.reduce((sum, e) => sum + e, 0) / energies.length;
    const variance = energies.reduce((sum, e) => sum + Math.pow(e - mean, 2), 0) / energies.length;
    return Math.sqrt(variance);
  }

  private normalizeFeaturesSimple(features: number[]): number[] {
    // Fast min-max normalization
    const min = Math.min(...features);
    const max = Math.max(...features);
    const range = max - min;

    if (range === 0) return features.map(() => 0.5);

    return features.map(f => (f - min) / range);
  }

  private extractVoiceEmbedding(audioData: number[]): VoiceEmbedding {
    if (audioData.length === 0) {
      return {
        features: new Array(16).fill(0),
        timestamp: Date.now(),
      };
    }

    const features: number[] = [];

    features.push(this.calculateMFCC(audioData, 0));
    features.push(this.calculateMFCC(audioData, 1));
    features.push(this.calculateMFCC(audioData, 2));
    features.push(this.calculateMFCC(audioData, 3));

    features.push(this.calculatePitch(audioData));
    features.push(this.calculateFormant(audioData, 1));
    features.push(this.calculateFormant(audioData, 2));

    features.push(this.calculateSpectralCentroid(audioData));
    features.push(this.calculateSpectralRolloff(audioData));
    features.push(this.calculateSpectralFlux(audioData));

    features.push(this.calculateZeroCrossingRate(audioData));
    features.push(this.calculateEnergyEntropy(audioData));

    features.push(this.calculateJitter(audioData));
    features.push(this.calculateShimmer(audioData));

    features.push(this.calculateHarmonicToNoiseRatio(audioData));
    features.push(this.calculateSpectralEntropy(audioData));

    const normalized = this.normalizeFeatures(features);

    return {
      features: normalized,
      timestamp: Date.now(),
    };
  }

  private calculateMFCC(audioData: number[], coefficient: number): number {
    const windowSize = Math.min(512, audioData.length);
    const window = audioData.slice(0, windowSize);

    const spectrum = this.computeSpectrum(window);
    const melSpectrum = this.applyMelFilterbank(spectrum, coefficient);

    return Math.log(melSpectrum + 1e-10);
  }

  private computeSpectrum(window: number[]): number[] {
    const spectrum: number[] = [];
    const n = window.length;

    for (let k = 0; k < n / 2; k++) {
      let real = 0;
      let imag = 0;

      for (let i = 0; i < n; i++) {
        const angle = (2 * Math.PI * k * i) / n;
        real += window[i] * Math.cos(angle);
        imag -= window[i] * Math.sin(angle);
      }

      spectrum.push(Math.sqrt(real * real + imag * imag));
    }

    return spectrum;
  }

  private applyMelFilterbank(spectrum: number[], filterIndex: number): number {
    const startBin = Math.floor((filterIndex * spectrum.length) / 20);
    const endBin = Math.min(startBin + 50, spectrum.length);

    let sum = 0;
    for (let i = startBin; i < endBin; i++) {
      sum += spectrum[i];
    }

    return sum / (endBin - startBin);
  }

  private calculatePitch(audioData: number[]): number {
    const minLag = 20;
    const maxLag = 400;
    let bestLag = minLag;
    let maxCorrelation = -Infinity;

    for (let lag = minLag; lag < maxLag && lag < audioData.length / 2; lag++) {
      let correlation = 0;
      let norm1 = 0;
      let norm2 = 0;

      for (let i = 0; i < audioData.length - lag; i++) {
        correlation += audioData[i] * audioData[i + lag];
        norm1 += audioData[i] * audioData[i];
        norm2 += audioData[i + lag] * audioData[i + lag];
      }

      const normalizedCorr = correlation / Math.sqrt(norm1 * norm2 + 1e-10);

      if (normalizedCorr > maxCorrelation) {
        maxCorrelation = normalizedCorr;
        bestLag = lag;
      }
    }

    return 16000 / bestLag;
  }

  private calculateFormant(audioData: number[], formantNumber: number): number {
    const spectrum = this.computeSpectrum(audioData);
    const peaks = this.findSpectralPeaks(spectrum, formantNumber + 1);

    if (peaks.length > formantNumber) {
      return peaks[formantNumber];
    }

    return 0;
  }

  private findSpectralPeaks(spectrum: number[], numPeaks: number): number[] {
    const peaks: Array<{ index: number; value: number }> = [];

    for (let i = 1; i < spectrum.length - 1; i++) {
      if (spectrum[i] > spectrum[i - 1] && spectrum[i] > spectrum[i + 1]) {
        peaks.push({ index: i, value: spectrum[i] });
      }
    }

    peaks.sort((a, b) => b.value - a.value);

    return peaks.slice(0, numPeaks).map(p => p.index);
  }

  private calculateSpectralCentroid(audioData: number[]): number {
    const spectrum = this.computeSpectrum(audioData);
    let weightedSum = 0;
    let totalMagnitude = 0;

    for (let i = 0; i < spectrum.length; i++) {
      weightedSum += i * spectrum[i];
      totalMagnitude += spectrum[i];
    }

    return totalMagnitude > 0 ? weightedSum / totalMagnitude : 0;
  }

  private calculateSpectralRolloff(audioData: number[]): number {
    const spectrum = this.computeSpectrum(audioData);
    const totalEnergy = spectrum.reduce((sum, val) => sum + val, 0);
    const threshold = 0.85 * totalEnergy;

    let cumEnergy = 0;
    for (let i = 0; i < spectrum.length; i++) {
      cumEnergy += spectrum[i];
      if (cumEnergy >= threshold) {
        return i / spectrum.length;
      }
    }

    return 1.0;
  }

  private calculateSpectralFlux(audioData: number[]): number {
    const windowSize = 512;
    const hopSize = 256;
    let totalFlux = 0;
    let count = 0;

    let prevSpectrum: number[] | null = null;

    for (let i = 0; i < audioData.length - windowSize; i += hopSize) {
      const window = audioData.slice(i, i + windowSize);
      const spectrum = this.computeSpectrum(window);

      if (prevSpectrum) {
        let flux = 0;
        for (let j = 0; j < Math.min(spectrum.length, prevSpectrum.length); j++) {
          const diff = spectrum[j] - prevSpectrum[j];
          flux += diff * diff;
        }
        totalFlux += Math.sqrt(flux);
        count++;
      }

      prevSpectrum = spectrum;
    }

    return count > 0 ? totalFlux / count : 0;
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

  private calculateEnergyEntropy(audioData: number[]): number {
    const windowSize = 256;
    const energies: number[] = [];

    for (let i = 0; i < audioData.length - windowSize; i += windowSize) {
      const window = audioData.slice(i, i + windowSize);
      const energy = window.reduce((sum, val) => sum + val * val, 0);
      energies.push(energy);
    }

    const totalEnergy = energies.reduce((sum, e) => sum + e, 0);
    if (totalEnergy === 0) return 0;

    let entropy = 0;
    for (const energy of energies) {
      const probability = energy / totalEnergy;
      if (probability > 0) {
        entropy -= probability * Math.log2(probability);
      }
    }

    return entropy;
  }

  private calculateJitter(audioData: number[]): number {
    const periods = this.extractPitchPeriods(audioData);
    if (periods.length < 2) return 0;

    const avgPeriod = periods.reduce((sum, p) => sum + p, 0) / periods.length;

    let jitter = 0;
    for (let i = 1; i < periods.length; i++) {
      jitter += Math.abs(periods[i] - periods[i - 1]);
    }

    return avgPeriod > 0 ? jitter / ((periods.length - 1) * avgPeriod) : 0;
  }

  private calculateShimmer(audioData: number[]): number {
    const windowSize = 400;
    const amplitudes: number[] = [];

    for (let i = 0; i < audioData.length - windowSize; i += windowSize) {
      const window = audioData.slice(i, i + windowSize);
      const amplitude = Math.max(...window.map(Math.abs));
      amplitudes.push(amplitude);
    }

    if (amplitudes.length < 2) return 0;

    const avgAmplitude = amplitudes.reduce((sum, a) => sum + a, 0) / amplitudes.length;

    let shimmer = 0;
    for (let i = 1; i < amplitudes.length; i++) {
      shimmer += Math.abs(amplitudes[i] - amplitudes[i - 1]);
    }

    return avgAmplitude > 0 ? shimmer / ((amplitudes.length - 1) * avgAmplitude) : 0;
  }

  private extractPitchPeriods(audioData: number[]): number[] {
    const periods: number[] = [];
    let i = 0;

    while (i < audioData.length - 400) {
      const window = audioData.slice(i, i + 400);
      const period = this.findPeriod(window);
      if (period > 0) {
        periods.push(period);
        i += period;
      } else {
        i += 100;
      }
    }

    return periods;
  }

  private findPeriod(window: number[]): number {
    const minLag = 20;
    const maxLag = Math.min(400, window.length / 2);
    let bestLag = 0;
    let maxCorrelation = -Infinity;

    for (let lag = minLag; lag < maxLag; lag++) {
      let correlation = 0;
      for (let i = 0; i < window.length - lag; i++) {
        correlation += window[i] * window[i + lag];
      }
      if (correlation > maxCorrelation) {
        maxCorrelation = correlation;
        bestLag = lag;
      }
    }

    return bestLag;
  }

  private calculateHarmonicToNoiseRatio(audioData: number[]): number {
    const spectrum = this.computeSpectrum(audioData);
    const pitch = this.calculatePitch(audioData);

    if (pitch === 0) return 0;

    const fundamentalBin = Math.floor((pitch * audioData.length) / 16000);

    let harmonicEnergy = 0;
    let totalEnergy = 0;

    for (let i = 0; i < spectrum.length; i++) {
      totalEnergy += spectrum[i] * spectrum[i];

      for (let harmonic = 1; harmonic <= 5; harmonic++) {
        const harmonicBin = fundamentalBin * harmonic;
        if (Math.abs(i - harmonicBin) < 3) {
          harmonicEnergy += spectrum[i] * spectrum[i];
          break;
        }
      }
    }

    const noiseEnergy = totalEnergy - harmonicEnergy;
    return noiseEnergy > 0 ? 10 * Math.log10(harmonicEnergy / noiseEnergy) : 0;
  }

  private calculateSpectralEntropy(audioData: number[]): number {
    const spectrum = this.computeSpectrum(audioData);
    const totalEnergy = spectrum.reduce((sum, val) => sum + val, 0);

    if (totalEnergy === 0) return 0;

    let entropy = 0;
    for (const magnitude of spectrum) {
      const probability = magnitude / totalEnergy;
      if (probability > 0) {
        entropy -= probability * Math.log2(probability);
      }
    }

    return entropy / Math.log2(spectrum.length);
  }

  private normalizeFeatures(features: number[]): number[] {
    const mean = features.reduce((sum, f) => sum + f, 0) / features.length;
    const variance = features.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / features.length;
    const std = Math.sqrt(variance);

    if (std === 0) return features.map(() => 0);

    return features.map(f => (f - mean) / std);
  }

  private calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) return 0;

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const magnitude = Math.sqrt(norm1 * norm2);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  private createNewSpeaker(embedding: VoiceEmbedding): Speaker {
    const colorIndex = (this.nextSpeakerId - 1) % SPEAKER_COLORS.length;

    const newSpeaker: Speaker = {
      id: this.nextSpeakerId++,
      color: SPEAKER_COLORS[colorIndex],
      label: `Speaker ${this.speakers.length + 1}`,
      embeddings: [embedding],
      centroid: [...embedding.features],
    };

    this.speakers.push(newSpeaker);
    console.log(`Created new speaker: ${newSpeaker.label}`);

    return newSpeaker;
  }

  private updateSpeakerFast(speaker: Speaker, embedding: VoiceEmbedding): void {
    speaker.embeddings.push(embedding);

    // Keep only last 5 embeddings (reduced from 10) to save memory
    if (speaker.embeddings.length > 5) {
      speaker.embeddings = speaker.embeddings.slice(-5);
    }

    // Incremental centroid update
    const alpha = 0.2;
    for (let i = 0; i < speaker.centroid.length; i++) {
      speaker.centroid[i] = (1 - alpha) * speaker.centroid[i] + alpha * embedding.features[i];
    }
  }

  private updateSpeaker(speaker: Speaker, embedding: VoiceEmbedding): void {
    speaker.embeddings.push(embedding);

    if (speaker.embeddings.length > 10) {
      speaker.embeddings = speaker.embeddings.slice(-10);
    }

    this.updateCentroid(speaker);
  }

  private updateCentroid(speaker: Speaker): void {
    const numFeatures = speaker.centroid.length;
    const newCentroid = new Array(numFeatures).fill(0);

    for (const embedding of speaker.embeddings) {
      for (let i = 0; i < numFeatures; i++) {
        newCentroid[i] += embedding.features[i];
      }
    }

    for (let i = 0; i < numFeatures; i++) {
      newCentroid[i] /= speaker.embeddings.length;
    }

    speaker.centroid = newCentroid;
  }

  private assignToClosestSpeaker(embedding: VoiceEmbedding): SpeakerIdentification {
    let closestSpeaker = this.speakers[0];
    let bestSimilarity = this.calculateSimilarity(embedding.features, closestSpeaker.centroid);

    for (let i = 1; i < this.speakers.length; i++) {
      const similarity = this.calculateSimilarity(embedding.features, this.speakers[i].centroid);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        closestSpeaker = this.speakers[i];
      }
    }

    this.updateSpeaker(closestSpeaker, embedding);

    return {
      speakerId: closestSpeaker.id,
      confidence: bestSimilarity,
      color: closestSpeaker.color,
      label: closestSpeaker.label,
    };
  }

  private getDefaultSpeaker(): SpeakerIdentification {
    if (this.speakers.length === 0) {
      const newSpeaker = this.createNewSpeaker({
        features: new Array(16).fill(0),
        timestamp: Date.now(),
      });
      return {
        speakerId: newSpeaker.id,
        confidence: 0.5,
        color: newSpeaker.color,
        label: newSpeaker.label,
      };
    }

    return {
      speakerId: this.speakers[0].id,
      confidence: 0.5,
      color: this.speakers[0].color,
      label: this.speakers[0].label,
    };
  }

  getSpeakers(): Speaker[] {
    return [...this.speakers];
  }

  resetSpeakers(): void {
    this.speakers = [];
    this.nextSpeakerId = 1;
    console.log('Speaker database reset');
  }

  getSpeakerStats(): {
    totalSpeakers: number;
    speakers: Array<{ id: number; label: string; color: string; sampleCount: number }>;
  } {
    return {
      totalSpeakers: this.speakers.length,
      speakers: this.speakers.map(s => ({
        id: s.id,
        label: s.label,
        color: s.color,
        sampleCount: s.embeddings.length,
      })),
    };
  }
}

export default new SpeakerDiarizationService();

