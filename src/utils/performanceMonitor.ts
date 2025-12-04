/**
 * Performance Monitoring Utility
 * Helps track and identify performance bottlenecks in the app
 */

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private enabled: boolean = __DEV__; // Only enabled in development

  /**
   * Start timing an operation
   */
  start(operationName: string): void {
    if (!this.enabled) return;

    this.metrics.set(operationName, {
      name: operationName,
      startTime: performance.now(),
    });
  }

  /**
   * End timing an operation and log the duration
   */
  end(operationName: string): number | null {
    if (!this.enabled) return null;

    const metric = this.metrics.get(operationName);
    if (!metric) {
      console.warn(`Performance metric "${operationName}" was not started`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - metric.startTime;

    metric.endTime = endTime;
    metric.duration = duration;

    // Log warnings for slow operations
    if (duration > 100) {
      console.warn(
        `⚠️ SLOW OPERATION: "${operationName}" took ${duration.toFixed(2)}ms`
      );
    } else if (duration > 50) {
      console.log(
        `⏱️ "${operationName}" took ${duration.toFixed(2)}ms`
      );
    } else {
      console.log(
        `✓ "${operationName}" took ${duration.toFixed(2)}ms`
      );
    }

    this.metrics.delete(operationName);
    return duration;
  }

  /**
   * Measure the execution time of a function
   */
  async measure<T>(
    operationName: string,
    fn: () => T | Promise<T>
  ): Promise<T> {
    if (!this.enabled) {
      return await fn();
    }

    this.start(operationName);
    try {
      const result = await fn();
      this.end(operationName);
      return result;
    } catch (error) {
      this.end(operationName);
      throw error;
    }
  }

  /**
   * Measure synchronous function execution
   */
  measureSync<T>(operationName: string, fn: () => T): T {
    if (!this.enabled) {
      return fn();
    }

    this.start(operationName);
    try {
      const result = fn();
      this.end(operationName);
      return result;
    } catch (error) {
      this.end(operationName);
      throw error;
    }
  }

  /**
   * Log memory usage (useful for detecting memory leaks)
   */
  logMemoryUsage(label?: string): void {
    if (!this.enabled) return;

    if ((performance as any).memory) {
      const memory = (performance as any).memory;
      const usedMB = (memory.usedJSHeapSize / 1048576).toFixed(2);
      const totalMB = (memory.totalJSHeapSize / 1048576).toFixed(2);
      const limitMB = (memory.jsHeapSizeLimit / 1048576).toFixed(2);

      console.log(
        `📊 Memory ${label || ''}:`,
        `${usedMB}MB / ${totalMB}MB (limit: ${limitMB}MB)`
      );
    }
  }

  /**
   * Create a performance mark (for React DevTools Profiler)
   */
  mark(markName: string): void {
    if (!this.enabled) return;

    if (performance.mark) {
      performance.mark(markName);
    }
  }

  /**
   * Measure between two performance marks
   */
  measureMarks(
    measureName: string,
    startMark: string,
    endMark: string
  ): number | null {
    if (!this.enabled) return null;

    try {
      if (performance.measure) {
        performance.measure(measureName, startMark, endMark);
        const entries = performance.getEntriesByName(measureName);
        if (entries.length > 0) {
          const duration = entries[0].duration;
          console.log(`📏 ${measureName}: ${duration.toFixed(2)}ms`);
          return duration;
        }
      }
    } catch (error) {
      console.warn('Performance measurement failed:', error);
    }
    return null;
  }

  /**
   * Enable/disable performance monitoring
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Get all active metrics (still running)
   */
  getActiveMetrics(): PerformanceMetric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics.clear();
    if (performance.clearMarks) {
      performance.clearMarks();
    }
    if (performance.clearMeasures) {
      performance.clearMeasures();
    }
  }

  /**
   * Create a throttled version of a function
   */
  throttle<T extends (...args: any[]) => any>(
    fn: T,
    waitMs: number
  ): (...args: Parameters<T>) => void {
    let lastCall = 0;
    let timeout: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCall;

      if (timeSinceLastCall >= waitMs) {
        lastCall = now;
        fn(...args);
      } else {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          lastCall = Date.now();
          fn(...args);
        }, waitMs - timeSinceLastCall);
      }
    };
  }

  /**
   * Create a debounced version of a function
   */
  debounce<T extends (...args: any[]) => any>(
    fn: T,
    waitMs: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return (...args: Parameters<T>) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), waitMs);
    };
  }

  /**
   * Track frame rate (for detecting UI freezes)
   */
  startFrameRateMonitoring(intervalMs: number = 1000): () => void {
    if (!this.enabled) return () => {};

    let frameCount = 0;
    let lastTime = performance.now();
    let rafId: number;

    const countFrame = () => {
      frameCount++;
      rafId = requestAnimationFrame(countFrame);
    };

    const interval = setInterval(() => {
      const now = performance.now();
      const elapsed = now - lastTime;
      const fps = Math.round((frameCount * 1000) / elapsed);

      if (fps < 30) {
        console.warn(`⚠️ LOW FPS: ${fps} (target: 60)`);
      } else if (fps < 50) {
        console.log(`⚡ FPS: ${fps}`);
      }

      frameCount = 0;
      lastTime = now;
    }, intervalMs);

    rafId = requestAnimationFrame(countFrame);

    // Return cleanup function
    return () => {
      clearInterval(interval);
      cancelAnimationFrame(rafId);
    };
  }
}

export default new PerformanceMonitor();

