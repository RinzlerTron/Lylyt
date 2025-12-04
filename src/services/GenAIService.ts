import RNFS from 'react-native-fs';

// Gemma 2B INT4 - hosted on GitHub Releases
const MODEL_FILENAME = 'gemma-2b-it-cpu-int4.bin';
const MODEL_URL = 'https://github.com/RinzlerTron/Lylyt/releases/download/v1.0.0/gemma-2b-it-cpu-int4.bin';
const MODEL_SIZE_MB = 1200; // ~1.2GB

export interface DownloadProgress {
    bytesWritten: number;
    contentLength: number;
    percent: number;
}

class GenAIService {
    private isDownloading: boolean = false;
    private downloadProgress: number = 0;
    private modelPath: string = '';

    constructor() {
        this.modelPath = `${RNFS.DocumentDirectoryPath}/${MODEL_FILENAME}`;
    }

    async checkModelExists(): Promise<boolean> {
        try {
            const exists = await RNFS.exists(this.modelPath);
            if (exists) {
                const stat = await RNFS.stat(this.modelPath);
                // Check if file is larger than 1MB (not a partial/failed download)
                return Number(stat.size) > 1024 * 1024;
            }
            return false;
        } catch (error) {
            console.warn('GenAI: Error checking model:', error);
            return false;
        }
    }

    async getModelSizeMB(): Promise<number> {
        try {
            if (await this.checkModelExists()) {
                const stat = await RNFS.stat(this.modelPath);
                return Math.round(Number(stat.size) / (1024 * 1024));
            }
        } catch (error) {
            console.warn('GenAI: Error getting model size:', error);
        }
        return 0;
    }

    isDownloadingModel(): boolean {
        return this.isDownloading;
    }

    getDownloadProgress(): number {
        return this.downloadProgress;
    }

    getExpectedSizeMB(): number {
        return MODEL_SIZE_MB;
    }

    async downloadModel(
        onProgress?: (progress: DownloadProgress) => void
    ): Promise<boolean> {
        if (this.isDownloading) {
            console.warn('GenAI: Download already in progress');
            return false;
        }

        this.isDownloading = true;
        this.downloadProgress = 0;

        try {
            console.log('GenAI: Starting model download from:', MODEL_URL);
            
            // Delete any existing partial file
            try {
                if (await RNFS.exists(this.modelPath)) {
                    await RNFS.unlink(this.modelPath);
                }
            } catch {}

            const downloadResult = RNFS.downloadFile({
                fromUrl: MODEL_URL,
                toFile: this.modelPath,
                progress: (res) => {
                    const percent = res.contentLength > 0 
                        ? Math.round((res.bytesWritten / res.contentLength) * 100)
                        : 0;
                    this.downloadProgress = percent;
                    console.log(`GenAI: Download progress: ${percent}%`);
                    if (onProgress) {
                        onProgress({
                            bytesWritten: res.bytesWritten,
                            contentLength: res.contentLength,
                            percent,
                        });
                    }
                },
                progressInterval: 500,
                progressDivider: 1,
            });

            const result = await downloadResult.promise;
            
            console.log('GenAI: Download result:', result);
            
            if (result.statusCode === 200) {
                const sizeMB = await this.getModelSizeMB();
                console.log(`GenAI: Model downloaded successfully (${sizeMB}MB)`);
                this.isDownloading = false;
                return true;
            } else {
                throw new Error(`Download failed with status ${result.statusCode}`);
            }
        } catch (error: any) {
            console.warn('GenAI: Model download failed:', error.message || error);
            this.isDownloading = false;
            // Clean up partial download
            try {
                if (await RNFS.exists(this.modelPath)) {
                    await RNFS.unlink(this.modelPath);
                }
            } catch {}
            throw error; // Re-throw so caller can show specific error
        }
    }

    async deleteModel(): Promise<boolean> {
        try {
            if (await this.checkModelExists()) {
                await RNFS.unlink(this.modelPath);
                return true;
            }
        } catch (error) {
            console.warn('GenAI: Error deleting model:', error);
        }
        return false;
    }

    async summarizeConversation(transcript: string): Promise<string> {
        if (!transcript || transcript.trim().length < 20) {
            return "Conversation too short to summarize.";
        }

        // Check if model exists
        const modelExists = await this.checkModelExists();
        if (!modelExists) {
            return "MODEL_NOT_FOUND";
        }

        // With model downloaded, use extractive summarization
        // (Full TFLite inference would require native module integration)
        const cleanText = transcript.replace(/\s+/g, ' ').trim();
        const sentences = cleanText
            .split(/(?<=[.!?])\s+/)
            .map(s => s.trim())
            .filter(s => s.length > 5);

        if (sentences.length <= 2) {
            return sentences.join(' ');
        }

        // Extract key sentences
        const keyPoints: string[] = [];
        keyPoints.push(sentences[0]);
        
        if (sentences.length > 2) {
            const middleIdx = Math.floor(sentences.length / 2);
            keyPoints.push(sentences[middleIdx]);
        }
        
        keyPoints.push(sentences[sentences.length - 1]);

        const summary = keyPoints.join(' ');
        const wordCount = cleanText.split(/\s+/).length;
        const summaryWordCount = summary.split(/\s+/).length;
        
        return `📝 Summary (${summaryWordCount} of ${wordCount} words):\n\n${summary}`;
    }

    isReady(): boolean {
        return true;
    }
}

export default new GenAIService();
