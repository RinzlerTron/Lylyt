import TensorFlowLiteService from '../TensorFlowLiteService';

describe('TensorFlowLiteService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(TensorFlowLiteService).toBeDefined();
  });

  it('should have loadModelFromAssets method', () => {
    expect(TensorFlowLiteService.loadModelFromAssets).toBeDefined();
  });

  it('should have loadModel method', () => {
    expect(TensorFlowLiteService.loadModel).toBeDefined();
  });

  it('should have runInference method', () => {
    expect(TensorFlowLiteService.runInference).toBeDefined();
  });

  it('should have getModelInfo method', () => {
    expect(TensorFlowLiteService.getModelInfo).toBeDefined();
  });

  it('should have close method', () => {
    expect(TensorFlowLiteService.close).toBeDefined();
  });
});

