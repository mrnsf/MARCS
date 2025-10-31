import { Tokenizer } from './types';

export class SimpleTokenizer implements Tokenizer {
  private encoder: TextEncoder;
  private decoder: TextDecoder;
  
  // Simple vocabulary for basic tokenization
  private vocabulary: Map<string, number> = new Map();
  private reverseVocabulary: Map<number, string> = new Map();
  
  constructor() {
    this.encoder = new TextEncoder();
    this.decoder = new TextDecoder();
    this.initializeVocabulary();
  }

  private initializeVocabulary(): void {
    // Basic vocabulary with common tokens
    const commonTokens = [
      '<pad>', '<unk>', '<s>', '</s>', '<mask>',
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'I', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must',
      'not', 'no', 'yes', 'please', 'thank', 'hello', 'goodbye', 'sorry',
      '.', ',', '!', '?', ':', ';', '"', "'", '(', ')', '[', ']', '{', '}',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
    ];

    commonTokens.forEach((token, index) => {
      this.vocabulary.set(token, index);
      this.reverseVocabulary.set(index, token);
    });
  }

  encode(text: string): number[] {
    // Simple word-based tokenization
    const tokens: number[] = [];
    const words = this.tokenizeText(text);
    
    for (const word of words) {
      const tokenId = this.vocabulary.get(word.toLowerCase()) ?? this.vocabulary.get('<unk>') ?? 1;
      tokens.push(tokenId);
    }
    
    return tokens;
  }

  decode(tokens: number[]): string {
    const words: string[] = [];
    
    for (const tokenId of tokens) {
      const word = this.reverseVocabulary.get(tokenId) ?? '<unk>';
      if (word !== '<pad>' && word !== '<s>' && word !== '</s>') {
        words.push(word);
      }
    }
    
    return words.join(' ');
  }

  countTokens(text: string): number {
    return this.tokenizeText(text).length;
  }

  private tokenizeText(text: string): string[] {
    // Simple tokenization: split by whitespace and punctuation
    return text
      .toLowerCase()
      .replace(/([.!?,:;'"()[\]{}])/g, ' $1 ')
      .split(/\s+/)
      .filter(token => token.length > 0);
  }

  addToVocabulary(tokens: string[]): void {
    let nextId = Math.max(...this.vocabulary.values()) + 1;
    
    for (const token of tokens) {
      if (!this.vocabulary.has(token)) {
        this.vocabulary.set(token, nextId);
        this.reverseVocabulary.set(nextId, token);
        nextId++;
      }
    }
  }

  getVocabularySize(): number {
    return this.vocabulary.size;
  }

  getTokenId(token: string): number | undefined {
    return this.vocabulary.get(token);
  }

  getToken(tokenId: number): string | undefined {
    return this.reverseVocabulary.get(tokenId);
  }
}

export class BPETokenizer implements Tokenizer {
  private merges: Map<string, number> = new Map();
  private vocabulary: Map<string, number> = new Map();
  private reverseVocabulary: Map<number, string> = new Map();

  constructor() {
    this.initializeBPE();
  }

  private initializeBPE(): void {
    // Initialize with basic character vocabulary
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?;:\'"-()[]{}';
    
    chars.split('').forEach((char, index) => {
      this.vocabulary.set(char, index);
      this.reverseVocabulary.set(index, char);
    });

    // Add special tokens
    const specialTokens = ['<pad>', '<unk>', '<s>', '</s>', '<mask>'];
    let nextId = chars.length;
    
    specialTokens.forEach(token => {
      this.vocabulary.set(token, nextId);
      this.reverseVocabulary.set(nextId, token);
      nextId++;
    });
  }

  encode(text: string): number[] {
    // Simple character-level encoding for now
    const tokens: number[] = [];
    
    for (const char of text) {
      const tokenId = this.vocabulary.get(char) ?? this.vocabulary.get('<unk>') ?? 1;
      tokens.push(tokenId);
    }
    
    return tokens;
  }

  decode(tokens: number[]): string {
    let result = '';
    
    for (const tokenId of tokens) {
      const char = this.reverseVocabulary.get(tokenId);
      if (char && char !== '<pad>' && char !== '<s>' && char !== '</s>') {
        result += char;
      }
    }
    
    return result;
  }

  countTokens(text: string): number {
    return text.length; // Character-level counting
  }
}

// Factory function to create appropriate tokenizer
export function createTokenizer(type: 'simple' | 'bpe' = 'simple'): Tokenizer {
  switch (type) {
    case 'bpe':
      return new BPETokenizer();
    case 'simple':
    default:
      return new SimpleTokenizer();
  }
}