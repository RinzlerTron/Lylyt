import AsyncStorage from '@react-native-async-storage/async-storage';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  userId?: string;
  sessionId?: string;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  context?: Record<string, any>;
}

export interface UserEvent {
  event: string;
  timestamp: string;
  properties?: Record<string, any>;
  userId?: string;
  sessionId?: string;
}

class Logger {
  private static instance: Logger;
  private sessionId: string;
  private userId?: string;
  private logs: LogEntry[] = [];
  private metrics: PerformanceMetric[] = [];
  private events: UserEvent[] = [];
  private readonly maxLogs = 1000;
  private readonly maxMetrics = 500;
  private readonly maxEvents = 500;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.loadPersistedData();
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async loadPersistedData() {
    try {
      const persistedLogs = await AsyncStorage.getItem('lylyt_logs');
      const persistedMetrics = await AsyncStorage.getItem('lylyt_metrics');
      const persistedEvents = await AsyncStorage.getItem('lylyt_events');

      if (persistedLogs) {
        this.logs = JSON.parse(persistedLogs);
      }
      if (persistedMetrics) {
        this.metrics = JSON.parse(persistedMetrics);
      }
      if (persistedEvents) {
        this.events = JSON.parse(persistedEvents);
      }
    } catch (error) {
      console.error('Failed to load persisted logging data:', error);
    }
  }

  private async persistData() {
    try {
      await AsyncStorage.setItem('lylyt_logs', JSON.stringify(this.logs));
      await AsyncStorage.setItem('lylyt_metrics', JSON.stringify(this.metrics));
      await AsyncStorage.setItem('lylyt_events', JSON.stringify(this.events));
    } catch (error) {
      console.error('Failed to persist logging data:', error);
    }
  }

  private addLog(level: LogLevel, message: string, context?: Record<string, any>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      userId: this.userId,
      sessionId: this.sessionId,
    };

    this.logs.push(entry);

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Persist logs periodically (every 10 entries)
    if (this.logs.length % 10 === 0) {
      this.persistData();
    }

    // Also log to console in development
    if (__DEV__) {
      const consoleMethod = level === LogLevel.ERROR ? 'error' :
                           level === LogLevel.WARN ? 'warn' :
                           level === LogLevel.INFO ? 'info' : 'debug';
      console[consoleMethod](`[${level}] ${message}`, context || '');
    }
  }

  debug(message: string, context?: Record<string, any>) {
    this.addLog(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>) {
    this.addLog(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>) {
    this.addLog(LogLevel.WARN, message, context);
  }

  error(message: string, context?: Record<string, any>) {
    this.addLog(LogLevel.ERROR, message, context);
  }

  trackMetric(name: string, value: number, unit: string, context?: Record<string, any>) {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
      context,
    };

    this.metrics.push(metric);

    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    this.debug(`Performance metric: ${name} = ${value} ${unit}`, context);
  }

  trackEvent(event: string, properties?: Record<string, any>) {
    const userEvent: UserEvent = {
      event,
      timestamp: new Date().toISOString(),
      properties,
      userId: this.userId,
      sessionId: this.sessionId,
    };

    this.events.push(userEvent);

    // Keep only the most recent events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    this.info(`User event: ${event}`, properties);
  }

  startPerformanceTimer(name: string): () => void {
    const startTime = performance.now();
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      this.trackMetric(`${name}_duration`, duration, 'ms');
    };
  }

  async measureAsync<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const endTimer = this.startPerformanceTimer(name);
    try {
      const result = await operation();
      endTimer();
      return result;
    } catch (error) {
      endTimer();
      this.error(`Operation ${name} failed`, { error: error.message });
      throw error;
    }
  }

  setUserId(userId: string) {
    this.userId = userId;
    this.info('User ID set', { userId });
  }

  getLogs(level?: LogLevel): LogEntry[] {
    if (level) {
      return this.logs.filter(log => log.level === level);
    }
    return [...this.logs];
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  getEvents(): UserEvent[] {
    return [...this.events];
  }

  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      logsCount: this.logs.length,
      metricsCount: this.metrics.length,
      eventsCount: this.events.length,
    };
  }

  async clearAllData() {
    this.logs = [];
    this.metrics = [];
    this.events = [];
    await AsyncStorage.multiRemove(['lylyt_logs', 'lylyt_metrics', 'lylyt_events']);
    this.info('All logging data cleared');
  }

  async exportData(): Promise<string> {
    const data = {
      sessionInfo: this.getSessionInfo(),
      logs: this.getLogs(),
      metrics: this.getMetrics(),
      events: this.getEvents(),
      exportTimestamp: new Date().toISOString(),
    };

    return JSON.stringify(data, null, 2);
  }
}

export const logger = Logger.getInstance();

// Convenience functions for common logging patterns
export const logPerformance = (name: string, value: number, unit: string = 'ms', context?: Record<string, any>) => {
  logger.trackMetric(name, value, unit, context);
};

export const logUserAction = (action: string, properties?: Record<string, any>) => {
  logger.trackEvent(`user_action_${action}`, properties);
};

export const logError = (message: string, context?: Record<string, any>) => {
  logger.error(message, context);
};

export const logInfo = (message: string, context?: Record<string, any>) => {
  logger.info(message, context);
};

export const measurePerformance = logger.measureAsync.bind(logger);
export const startTimer = logger.startPerformanceTimer.bind(logger);
