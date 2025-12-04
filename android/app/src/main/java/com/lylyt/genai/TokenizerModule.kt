package com.lylyt.genai

import com.facebook.react.bridge.*

/**
 * React Native bridge for tokenization
 */
class TokenizerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    override fun getName(): String = "Tokenizer"
    
    @ReactMethod
    fun encode(text: String, promise: Promise) {
        try {
            val tokens = SimpleTokenizer.encode(text)
            val result = WritableNativeArray()
            tokens.forEach { result.pushInt(it) }
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("TOKENIZE_ERROR", "Failed to tokenize: ${e.message}", e)
        }
    }
    
    @ReactMethod
    fun decode(tokens: ReadableArray, promise: Promise) {
        try {
            val tokenArray = IntArray(tokens.size()) { tokens.getInt(it) }
            val text = SimpleTokenizer.decode(tokenArray)
            promise.resolve(text)
        } catch (e: Exception) {
            promise.reject("DETOKENIZE_ERROR", "Failed to detokenize: ${e.message}", e)
        }
    }
}
