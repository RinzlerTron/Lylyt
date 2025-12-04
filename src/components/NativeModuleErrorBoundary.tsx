import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  children: ReactNode;
  onRetry?: () => void;
  moduleName: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class NativeModuleErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is a native module related error
    const errorMessage = error.message.toLowerCase();
    const isNativeModuleError =
      errorMessage.includes('native') ||
      errorMessage.includes('module') ||
      errorMessage.includes('vosk') ||
      errorMessage.includes('tensorflow') ||
      errorMessage.includes('audio') ||
      errorMessage.includes('permission');

    return isNativeModuleError ? { hasError: true, error } : { hasError: false };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error(`${this.props.moduleName} ErrorBoundary caught an error:`, error, errorInfo);

    // Log native module errors specifically
    if (error.message.toLowerCase().includes('native') ||
        error.message.toLowerCase().includes('module')) {
      console.error(`Native module ${this.props.moduleName} failed:`, error);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>{this.props.moduleName} Error</Text>
            <Text style={styles.errorMessage}>
              There was a problem with the {this.props.moduleName.toLowerCase()} system.
              This might be due to device compatibility or permissions.
            </Text>

            {__DEV__ && this.state.error && (
              <Text style={styles.errorDetails}>
                {this.state.error.message}
              </Text>
            )}

            <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>

            <Text style={styles.helpText}>
              If issues persist, try restarting the app or checking device permissions.
            </Text>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1a1a1a',
  },
  errorCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    maxWidth: 350,
    width: '100%',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#cccccc',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  errorDetails: {
    fontSize: 12,
    color: '#ff6b6b',
    backgroundColor: '#1a1a1a',
    padding: 8,
    borderRadius: 4,
    marginBottom: 16,
    textAlign: 'center',
    width: '100%',
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default NativeModuleErrorBoundary;
