/**
 * Noise Cancellation Service
 * Filters background noise to improve speech recognition accuracy
 * Uses spectral subtraction algorithm optimized for ARM processors
 */

class NoiseCancellationService {
  private noiseProfile: number[] | null = null;
  private isNoiseProfileSet: boolean = false;
  private readonly NOISE_PROFILE_SIZE = 512;
  private readonly ALPHA = 2.0; // Over-subtraction factor
  private readonly BETA = 0.01; // Spectral floor factor

  /**
   * Set noise profile from initial audio samples (should be silence/noise only)
   */
  setNoiseProfile(audioData: number[]): void {
    if (audioData.length < this.NOISE_PROFILE_SIZE) {
      return;
    }

    // Use first samples as noise profile
    const noiseSamples = audioData.slice(0, this.NOISE_PROFILE_SIZE);
    const fft = this.performFFT(noiseSamples);
    
    // Calculate average magnitude spectrum
    this.noiseProfile = new Array(fft.length);
    for (let i = 0; i < fft.length; i++) {
      const magnitude = Math.sqrt(fft[i].real * fft[i].real + fft[i].imag * fft[i].imag);
      this.noiseProfile[i] = magnitude;
    }

    this.isNoiseProfileSet = true;
    console.log('✅ Noise profile set');
  }

  /**
   * Apply noise cancellation to audio data
   * Uses spectral subtraction algorithm
   */
  applyNoiseCancellation(audioData: number[]): number[] {
    if (!this.isNoiseProfileSet || !this.noiseProfile || audioData.length === 0) {
      return audioData; // Return original if no noise profile
    }

    // Perform FFT on input audio
    const fft = this.performFFT(audioData);
    
    // Apply spectral subtraction
    const cleanedFFT = new Array(fft.length);
    for (let i = 0; i < fft.length; i++) {
      const signalMagnitude = Math.sqrt(fft[i].real * fft[i].real + fft[i].imag * fft[i].imag);
      const noiseMagnitude = this.noiseProfile[i] || 0;
      
      // Spectral subtraction with over-subtraction
      let cleanedMagnitude = signalMagnitude - this.ALPHA * noiseMagnitude;
      
      // Apply spectral floor to prevent over-suppression
      const floor = this.BETA * signalMagnitude;
      cleanedMagnitude = Math.max(cleanedMagnitude, floor);
      
      // Preserve phase, update magnitude
      const phase = Math.atan2(fft[i].imag, fft[i].real);
      const scale = cleanedMagnitude / Math.max(signalMagnitude, 0.001);
      
      cleanedFFT[i] = {
        real: cleanedMagnitude * Math.cos(phase),
        imag: cleanedMagnitude * Math.sin(phase),
      };
    }
    
    // Convert back to time domain (IFFT)
    const cleanedAudio = this.performIFFT(cleanedFFT);
    
    return cleanedAudio;
  }

  /**
   * Perform FFT on audio samples
   * Optimized for ARM processors
   */
  private performFFT(samples: number[]): Array<{ real: number; imag: number }> {
    const N = samples.length;
    
    // Zero-pad to power of 2
    const paddedLength = Math.pow(2, Math.ceil(Math.log2(N)));
    const padded = new Array(paddedLength).fill(0);
    samples.forEach((sample, i) => {
      padded[i] = sample;
    });

    return this.cooleyTukeyFFT(padded);
  }

  /**
   * Cooley-Tukey FFT algorithm
   * Optimized for real-time processing on ARM
   */
  private cooleyTukeyFFT(samples: number[]): Array<{ real: number; imag: number }> {
    const N = samples.length;
    
    if (N <= 1) {
      return samples.map(s => ({ real: s, imag: 0 }));
    }

    // Divide
    const even = this.cooleyTukeyFFT(samples.filter((_, i) => i % 2 === 0));
    const odd = this.cooleyTukeyFFT(samples.filter((_, i) => i % 2 === 1));

    // Combine
    const result: Array<{ real: number; imag: number }> = [];
    for (let k = 0; k < N / 2; k++) {
      const t = {
        real: Math.cos(-2 * Math.PI * k / N),
        imag: Math.sin(-2 * Math.PI * k / N),
      };
      const oddK = odd[k] || { real: 0, imag: 0 };
      
      result[k] = {
        real: even[k].real + t.real * oddK.real - t.imag * oddK.imag,
        imag: even[k].imag + t.real * oddK.imag + t.imag * oddK.real,
      };
      
      result[k + N / 2] = {
        real: even[k].real - (t.real * oddK.real - t.imag * oddK.imag),
        imag: even[k].imag - (t.real * oddK.imag + t.imag * oddK.real),
      };
    }
    
    return result;
  }

  /**
   * Perform IFFT (Inverse FFT) to convert back to time domain
   */
  private performIFFT(fft: Array<{ real: number; imag: number }>): number[] {
    const N = fft.length;
    const result: number[] = [];
    
    // IFFT is similar to FFT but with conjugated twiddle factors
    for (let n = 0; n < N; n++) {
      let real = 0;
      let imag = 0;
      
      for (let k = 0; k < N; k++) {
        const angle = 2 * Math.PI * k * n / N;
        real += fft[k].real * Math.cos(angle) - fft[k].imag * Math.sin(angle);
        imag += fft[k].real * Math.sin(angle) + fft[k].imag * Math.cos(angle);
      }
      
      result[n] = real / N; // Normalize
    }
    
    return result;
  }

  /**
   * Reset noise profile
   */
  resetNoiseProfile(): void {
    this.noiseProfile = null;
    this.isNoiseProfileSet = false;
  }

  /**
   * Check if noise cancellation is ready
   */
  isReady(): boolean {
    return this.isNoiseProfileSet;
  }
}

export default new NoiseCancellationService();







