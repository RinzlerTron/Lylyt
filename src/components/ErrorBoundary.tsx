import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // Here you could send the error to an error reporting service
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
            <Text style={styles.errorMessage}>
              The app encountered an unexpected error. This might be due to a native module issue or other technical problem.
            </Text>

            {__DEV__ && this.state.error && (
              <ScrollView style={styles.errorDetails}>
                <Text style={styles.errorText}>
                  {this.state.error.toString()}
                </Text>
                {this.state.errorInfo && (
                  <Text style={styles.errorText}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.retryButton} onPress={this.handleReset}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>

            <Text style={styles.helpText}>
              If this problem persists, try restarting the app or contact support.
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
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#cccccc',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  errorDetails: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    maxHeight: 200,
    width: '100%',
  },
  errorText: {
    fontSize: 12,
    color: '#ff6b6b',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
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

export default ErrorBoundary;
