import { NativeModules } from 'react-native';

const { Tokenizer } = NativeModules;

interface TokenizerService {
    encode(text: string): Promise<number[]>;
    decode(tokens: number[]): Promise<string>;
}

class TokenizerServiceImpl implements TokenizerService {
    async encode(text: string): Promise<number[]> {
        try {
            const result = await Tokenizer.encode(text);
            return result;
        } catch (error) {
            console.error('Tokenizer encode error:', error);
            throw error;
        }
    }

    async decode(tokens: number[]): Promise<string> {
        try {
            const result = await Tokenizer.decode(tokens);
            return result;
        } catch (error) {
            console.error('Tokenizer decode error:', error);
            throw error;
        }
    }
}

export default new TokenizerServiceImpl();
