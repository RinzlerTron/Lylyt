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

export interface TensorFlowLiteModule {
  loadModel(modelPath: string): Promise<ModelInfo>;
  loadModelFromAssets(assetPath: string): Promise<ModelInfo>;
  runInference(inputData: number[]): Promise<InferenceResult>;
  runInferenceWithShape(
    inputData: number[],
    inputShape: number[],
  ): Promise<InferenceResult>;
  getModelInfo(): Promise<ModelInfo>;
  close(): Promise<void>;
}

