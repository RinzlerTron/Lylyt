import { NativeModules } from 'react-native';

const { TensorFlowLite } = NativeModules;

// Check if native module exists
const isNativeModuleAvailable = TensorFlowLite != null;

export interface ModelInfo {
  modelPath: string;
  inputShape: number[];
  outputShape: number[];
  inputDataType: string;
  outputDataType: string;
}

export interface InferenceResult {
  output: number[];
  inferenceTimeMs: number;
}

class TensorFlowLiteService {
  private isModelLoaded = false;

  async loadModelFromAssets(assetPath: string): Promise<ModelInfo> {
    if (!isNativeModuleAvailable) {
      throw new Error('TensorFlowLite native module not available');
    }
    try {
      const result = await TensorFlowLite.loadModelFromAssets(assetPath);
      this.isModelLoaded = true;
      return {
        modelPath: result.modelPath,
        inputShape: this.parseShape(result.inputShape),
        outputShape: this.parseShape(result.outputShape),
        inputDataType: result.inputDataType,
        outputDataType: result.outputDataType,
      };
    } catch (error) {
      this.isModelLoaded = false;
      throw error;
    }
  }

  async loadModel(filePath: string): Promise<ModelInfo> {
    if (!isNativeModuleAvailable) {
      throw new Error('TensorFlowLite native module not available');
    }
    try {
      const result = await TensorFlowLite.loadModel(filePath);
      this.isModelLoaded = true;
      return {
        modelPath: result.modelPath,
        inputShape: this.parseShape(result.inputShape),
        outputShape: this.parseShape(result.outputShape),
        inputDataType: result.inputDataType,
        outputDataType: result.outputDataType,
      };
    } catch (error) {
      this.isModelLoaded = false;
      throw error;
    }
  }

  async runInference(inputData: number[]): Promise<InferenceResult> {
    if (!isNativeModuleAvailable) {
      throw new Error('TensorFlowLite native module not available');
    }
    if (!this.isModelLoaded) {
      throw new Error('Model not loaded. Call loadModel or loadModelFromAssets first.');
    }

    const result = await TensorFlowLite.runInference(inputData);
    return {
      output: result.output,
      inferenceTimeMs: result.inferenceTimeMs,
    };
  }

  async runInferenceWithShape(
    inputData: number[],
    inputShape: number[],
  ): Promise<InferenceResult> {
    if (!this.isModelLoaded) {
      throw new Error('Model not loaded. Call loadModel or loadModelFromAssets first.');
    }

    const result = await TensorFlowLite.runInferenceWithShape(inputData, inputShape);
    return {
      output: result.output,
      inferenceTimeMs: result.inferenceTimeMs,
    };
  }

  async getModelInfo(): Promise<ModelInfo> {
    const result = await TensorFlowLite.getModelInfo();
    return {
      modelPath: result.modelPath,
      inputShape: this.parseShape(result.inputShape),
      outputShape: this.parseShape(result.outputShape),
      inputDataType: result.inputDataType,
      outputDataType: result.outputDataType,
    };
  }

  async close(): Promise<void> {
    await TensorFlowLite.close();
    this.isModelLoaded = false;
  }

  private parseShape(shape: number[] | string): number[] {
    if (Array.isArray(shape)) {
      return shape;
    }
    if (!shape || shape === '[]') {
      return [];
    }
    const cleaned = shape.replace(/[[\]]/g, '');
    if (!cleaned) {
      return [];
    }
    return cleaned.split(',').map((s) => parseInt(s.trim(), 10));
  }
}

export default new TensorFlowLiteService();

