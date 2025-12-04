/**
 * Visual Audio Waveform Component
 * Shows real-time audio visualization for deaf users to "see" sound
 * Uses FFT to convert audio to frequency domain and display as bars
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

interface WaveformVisualizerProps {
  audioData: number[];
  sampleRate?: number;
  barCount?: number;
  height?: number;
  color?: string;
}

const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  audioData,
  sampleRate = 16000,
  barCount = 32,
  height = 60,
  color = '#6750A4',
}) => {
  const [barHeights, setBarHeights] = useState<number[]>(new Array(barCount).fill(0));
  const animationRefs = useRef<Animated.Value[]>(
    new Array(barCount).fill(0).map(() => new Animated.Value(0))
  );

  useEffect(() => {
    if (audioData.length === 0) {
      // Reset bars when no audio
      setBarHeights(new Array(barCount).fill(0));
      return;
    }

    // Perform FFT on audio data
    const fftResult = performFFT(audioData, barCount);
    
    // Normalize and update bar heights
    const maxMagnitude = Math.max(...fftResult, 0.001); // Avoid division by zero
    const normalized = fftResult.map(magnitude => 
      Math.min(1.0, magnitude / maxMagnitude)
    );

    // Animate bars smoothly
    normalized.forEach((height, index) => {
      Animated.spring(animationRefs.current[index], {
        toValue: height,
        useNativeDriver: false,
        tension: 50,
        friction: 7,
      }).start();
    });

    setBarHeights(normalized);
  }, [audioData, barCount]);

  return (
    <View style={[styles.container, { height }]}>
      {animationRefs.current.map((animatedValue, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              backgroundColor: color,
              height: animatedValue.interpolate({
                inputRange: [0, 1],
                outputRange: [2, height - 4], // Min 2px, max height-4px
              }),
            },
          ]}
        />
      ))}
    </View>
  );
};

/**
 * Simple FFT implementation for real-time audio visualization
 * Uses Cooley-Tukey FFT algorithm (optimized for mobile)
 */
function performFFT(audioData: number[], outputBins: number): number[] {
  const N = Math.min(audioData.length, 512); // Limit FFT size for performance
  const samples = audioData.slice(-N); // Use last N samples
  
  // Zero-pad to power of 2
  const paddedLength = Math.pow(2, Math.ceil(Math.log2(N)));
  const padded = new Array(paddedLength).fill(0);
  samples.forEach((sample, i) => {
    padded[i] = sample;
  });

  // Perform FFT
  const fft = cooleyTukeyFFT(padded);
  
  // Group FFT bins into output bars (logarithmic scaling for better visualization)
  const result = new Array(outputBins).fill(0);
  const binSize = Math.floor(fft.length / outputBins);
  
  for (let i = 0; i < outputBins; i++) {
    const startBin = i * binSize;
    const endBin = Math.min(startBin + binSize, fft.length);
    let sum = 0;
    
    for (let j = startBin; j < endBin; j++) {
      const magnitude = Math.sqrt(fft[j].real * fft[j].real + fft[j].imag * fft[j].imag);
      sum += magnitude;
    }
    
    result[i] = sum / binSize;
  }
  
  return result;
}

/**
 * Cooley-Tukey FFT algorithm (optimized for real-time use)
 */
function cooleyTukeyFFT(samples: number[]): Array<{ real: number; imag: number }> {
  const N = samples.length;
  
  if (N <= 1) {
    return samples.map(s => ({ real: s, imag: 0 }));
  }

  // Divide
  const even = cooleyTukeyFFT(samples.filter((_, i) => i % 2 === 0));
  const odd = cooleyTukeyFFT(samples.filter((_, i) => i % 2 === 1));

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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 2,
  },
  bar: {
    flex: 1,
    minWidth: 2,
    borderRadius: 1,
    opacity: 0.8,
  },
});

export default WaveformVisualizer;







