import RNFS from 'react-native-fs';

class GenAIService {
    async checkModelExists(): Promise<boolean> {
        return true; // Always ready - no model needed
    }

    async getModelSizeMB(): Promise<number> {
        return 0;
    }

    isDownloadingModel(): boolean {
        return false;
    }

    getDownloadProgress(): number {
        return 100;
    }

    getExpectedSizeMB(): number {
        return 0;
    }

    async downloadModel(): Promise<boolean> {
        return true; // No download needed
    }

    async summarizeConversation(transcript: string): Promise<string> {
        if (!transcript || transcript.trim().length < 20) {
            return "Conversation too short to summarize.";
        }

        // Fast extractive summarization - 100% local, instant
        const cleanText = transcript.replace(/\s+/g, ' ').trim();
        const sentences = cleanText
            .split(/(?<=[.!?])\s+/)
            .map(s => s.trim())
            .filter(s => s.length > 5);

        if (sentences.length <= 2) {
            return sentences.join(' ');
        }

        // Extract key sentences (first, middle, last)
        const keyPoints: string[] = [];
        keyPoints.push(sentences[0]);
        
        if (sentences.length > 3) {
            const middleIdx = Math.floor(sentences.length / 2);
            keyPoints.push(sentences[middleIdx]);
        }
        
        keyPoints.push(sentences[sentences.length - 1]);

        return keyPoints.join(' ');
    }

    isReady(): boolean {
        return true;
    }

    isModelLoaded(): boolean {
        return true;
    }
}

export default new GenAIService();
