package com.lylyt.tflite

import android.content.Context
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.support.common.FileUtil
import java.io.File
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.channels.FileChannel
import java.nio.MappedByteBuffer

class TensorFlowLiteModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var interpreter: Interpreter? = null
    private var modelPath: String? = null
    private val reactContext: ReactApplicationContext = reactContext

    override fun getName(): String {
        return "TensorFlowLite"
    }

    @ReactMethod
    fun loadModel(modelPath: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val modelFile = File(modelPath)
            
            if (!modelFile.exists()) {
                promise.reject("MODEL_NOT_FOUND", "Model file not found at path: $modelPath")
                return
            }

            val options = Interpreter.Options()
            options.setNumThreads(4)
            options.setUseNNAPI(true)

            val modelBuffer = loadModelFile(modelFile)
            interpreter = Interpreter(modelBuffer, options)
            
            this.modelPath = modelPath
            
            val inputTensor = interpreter!!.getInputTensor(0)
            val outputTensor = interpreter!!.getOutputTensor(0)
            
            val result = WritableNativeMap().apply {
                putString("modelPath", modelPath)
                putArray("inputShape", WritableNativeArray().apply {
                    inputTensor.shape().forEach { pushInt(it) }
                })
                putArray("outputShape", WritableNativeArray().apply {
                    outputTensor.shape().forEach { pushInt(it) }
                })
                putString("inputDataType", inputTensor.dataType().toString())
                putString("outputDataType", outputTensor.dataType().toString())
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("LOAD_ERROR", "Failed to load model: ${e.message}", e)
        }
    }

    @ReactMethod
    fun loadModelFromAssets(assetPath: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val modelBuffer = FileUtil.loadMappedFile(context, assetPath)
            
            // Try with NNAPI first, fallback to CPU if it fails
            var loadedInterpreter: Interpreter? = null
            var usingNNAPI = false
            
            try {
                val nnapiOptions = Interpreter.Options()
                nnapiOptions.setNumThreads(4)
                nnapiOptions.setUseNNAPI(true)
                loadedInterpreter = Interpreter(modelBuffer, nnapiOptions)
                usingNNAPI = true
                android.util.Log.i("TensorFlowLite", "Model loaded successfully with NNAPI acceleration")
            } catch (nnapiError: Exception) {
                android.util.Log.w("TensorFlowLite", "Failed to load with NNAPI: ${nnapiError.message}. Falling back to CPU.")
                // Reload the model buffer
                val modelBufferCpu = FileUtil.loadMappedFile(context, assetPath)
                val cpuOptions = Interpreter.Options()
                cpuOptions.setNumThreads(4)
                cpuOptions.setUseNNAPI(false)
                loadedInterpreter = Interpreter(modelBufferCpu, cpuOptions)
                android.util.Log.i("TensorFlowLite", "Model loaded successfully with CPU")
            }

            interpreter = loadedInterpreter
            this.modelPath = assetPath
            
            val inputTensor = interpreter!!.getInputTensor(0)
            val outputTensor = interpreter!!.getOutputTensor(0)
            
            val result = WritableNativeMap().apply {
                putString("modelPath", assetPath)
                putArray("inputShape", WritableNativeArray().apply {
                    inputTensor.shape().forEach { pushInt(it) }
                })
                putArray("outputShape", WritableNativeArray().apply {
                    outputTensor.shape().forEach { pushInt(it) }
                })
                putString("inputDataType", inputTensor.dataType().toString())
                putString("outputDataType", outputTensor.dataType().toString())
                putBoolean("usingNNAPI", usingNNAPI)
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("LOAD_ERROR", "Failed to load model from assets: ${e.message}", e)
        }
    }

    @ReactMethod
    fun runInference(inputData: ReadableArray, promise: Promise) {
        try {
            val interpreter = this.interpreter
            if (interpreter == null) {
                promise.reject("MODEL_NOT_LOADED", "Model not loaded. Call loadModel first.")
                return
            }

            val inputTensor = interpreter.getInputTensor(0)
            val inputShape = inputTensor.shape()
            val inputSize = inputShape.fold(1) { acc, dim -> acc * dim }
            
            val inputBuffer = ByteBuffer.allocateDirect(inputSize * 4)
            inputBuffer.order(ByteOrder.nativeOrder())
            
            for (i in 0 until inputData.size()) {
                val value = inputData.getDouble(i).toFloat()
                inputBuffer.putFloat(value)
            }
            inputBuffer.rewind()

            val outputTensor = interpreter.getOutputTensor(0)
            val outputShape = outputTensor.shape()
            val outputSize = outputShape.fold(1) { acc, dim -> acc * dim }
            
            val outputBuffer = ByteBuffer.allocateDirect(outputSize * 4)
            outputBuffer.order(ByteOrder.nativeOrder())

            val startTime = System.currentTimeMillis()
            interpreter.run(inputBuffer, outputBuffer)
            val inferenceTime = System.currentTimeMillis() - startTime

            outputBuffer.rewind()
            val outputArray = FloatArray(outputSize)
            outputBuffer.asFloatBuffer().get(outputArray)

            val result = WritableNativeMap().apply {
                putArray("output", WritableNativeArray().apply {
                    outputArray.forEach { pushDouble(it.toDouble()) }
                })
                putInt("inferenceTimeMs", inferenceTime.toInt())
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("INFERENCE_ERROR", "Inference failed: ${e.message}", e)
        }
    }

    @ReactMethod
    fun runInferenceWithShape(inputData: ReadableArray, inputShape: ReadableArray, promise: Promise) {
        try {
            val interpreter = this.interpreter
            if (interpreter == null) {
                promise.reject("MODEL_NOT_LOADED", "Model not loaded. Call loadModel first.")
                return
            }

            val shape = IntArray(inputShape.size())
            for (i in 0 until inputShape.size()) {
                shape[i] = inputShape.getInt(i)
            }
            
            val inputSize = shape.fold(1) { acc, dim -> acc * dim }
            
            if (inputData.size() != inputSize) {
                promise.reject("INVALID_INPUT", "Input data size ${inputData.size()} does not match shape ${shape.contentToString()}")
                return
            }

            val inputBuffer = ByteBuffer.allocateDirect(inputSize * 4)
            inputBuffer.order(ByteOrder.nativeOrder())
            
            for (i in 0 until inputData.size()) {
                val value = inputData.getDouble(i).toFloat()
                inputBuffer.putFloat(value)
            }
            inputBuffer.rewind()

            val outputTensor = interpreter.getOutputTensor(0)
            val outputShape = outputTensor.shape()
            val outputSize = outputShape.fold(1) { acc, dim -> acc * dim }
            
            val outputBuffer = ByteBuffer.allocateDirect(outputSize * 4)
            outputBuffer.order(ByteOrder.nativeOrder())

            val startTime = System.currentTimeMillis()
            interpreter.run(inputBuffer, outputBuffer)
            val inferenceTime = System.currentTimeMillis() - startTime

            outputBuffer.rewind()
            val outputArray = FloatArray(outputSize)
            outputBuffer.asFloatBuffer().get(outputArray)

            val result = WritableNativeMap().apply {
                putArray("output", WritableNativeArray().apply {
                    outputArray.forEach { pushDouble(it.toDouble()) }
                })
                putInt("inferenceTimeMs", inferenceTime.toInt())
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("INFERENCE_ERROR", "Inference failed: ${e.message}", e)
        }
    }

    @ReactMethod
    fun getModelInfo(promise: Promise) {
        try {
            val interpreter = this.interpreter
            if (interpreter == null) {
                promise.reject("MODEL_NOT_LOADED", "Model not loaded")
                return
            }

            val inputTensor = interpreter.getInputTensor(0)
            val outputTensor = interpreter.getOutputTensor(0)
            
            val result = WritableNativeMap().apply {
                putString("modelPath", modelPath ?: "unknown")
                putArray("inputShape", WritableNativeArray().apply {
                    inputTensor.shape().forEach { pushInt(it) }
                })
                putArray("outputShape", WritableNativeArray().apply {
                    outputTensor.shape().forEach { pushInt(it) }
                })
                putString("inputDataType", inputTensor.dataType().toString())
                putString("outputDataType", outputTensor.dataType().toString())
            }
            
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("INFO_ERROR", "Failed to get model info: ${e.message}", e)
        }
    }

    @ReactMethod
    fun close(promise: Promise) {
        try {
            interpreter?.close()
            interpreter = null
            modelPath = null
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CLOSE_ERROR", "Failed to close interpreter: ${e.message}", e)
        }
    }

    private fun loadModelFile(file: File): MappedByteBuffer {
        val fileInputStream = FileInputStream(file)
        val fileChannel = fileInputStream.channel
        val startOffset = 0L
        val declaredLength = fileChannel.size()
        return fileChannel.map(FileChannel.MapMode.READ_ONLY, startOffset, declaredLength)
    }
}

