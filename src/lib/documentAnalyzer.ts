// Document analyzer for processing various file types locally

import { FileSystemFile } from './fileSystem';

export interface DocumentAnalysis {
  id: string;
  filename: string;
  type: string;
  size: number;
  wordCount: number;
  characterCount: number;
  language: string;
  summary: string;
  keywords: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
  readingTime: number; // in minutes
  structure: DocumentStructure;
  metadata: Record<string, any>;
}

export interface DocumentStructure {
  headings: Array<{
    level: number;
    text: string;
    position: number;
  }>;
  paragraphs: number;
  sentences: number;
  links: string[];
  images: string[];
}

export interface TextChunk {
  id: string;
  content: string;
  position: number;
  length: number;
  type: 'paragraph' | 'heading' | 'list' | 'code' | 'quote';
}

class DocumentAnalyzer {
  private readonly WORDS_PER_MINUTE = 200; // Average reading speed

  // Analyze a document file
  public async analyzeDocument(file: FileSystemFile): Promise<DocumentAnalysis> {
    const content = await this.extractTextContent(file);
    const structure = this.analyzeStructure(content, file.type);
    const wordCount = this.countWords(content);
    const characterCount = content.length;
    const language = this.detectLanguage(content);
    const summary = this.generateSummary(content);
    const keywords = this.extractKeywords(content);
    const sentiment = this.analyzeSentiment(content);
    const readingTime = Math.ceil(wordCount / this.WORDS_PER_MINUTE);

    return {
      id: this.generateId(),
      filename: file.name,
      type: file.type,
      size: file.size,
      wordCount,
      characterCount,
      language,
      summary,
      keywords,
      sentiment,
      readingTime,
      structure,
      metadata: {
        lastModified: file.lastModified,
        analyzed: Date.now()
      }
    };
  }

  // Extract text content from different file types
  private async extractTextContent(file: FileSystemFile): Promise<string> {
    if (typeof file.content === 'string') {
      return file.content;
    }

    // Handle binary files
    if (file.type === 'application/pdf') {
      return await this.extractPDFText(file.content as ArrayBuffer);
    }

    // Try to decode as text
    try {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(file.content as ArrayBuffer);
    } catch {
      return '[Binary file - content not readable]';
    }
  }

  // Extract text from PDF (simplified - in real app you'd use pdf.js)
  private async extractPDFText(buffer: ArrayBuffer): Promise<string> {
    // This is a placeholder - in a real implementation, you'd use pdf.js
    // For now, return a placeholder message
    return '[PDF content extraction requires pdf.js library - content not available in this demo]';
  }

  // Analyze document structure
  private analyzeStructure(content: string, type: string): DocumentStructure {
    const structure: DocumentStructure = {
      headings: [],
      paragraphs: 0,
      sentences: 0,
      links: [],
      images: []
    };

    if (type === 'text/markdown' || content.includes('#')) {
      // Markdown headings
      const headingRegex = /^(#{1,6})\s+(.+)$/gm;
      let match;
      let position = 0;
      
      while ((match = headingRegex.exec(content)) !== null) {
        structure.headings.push({
          level: match[1].length,
          text: match[2].trim(),
          position: match.index
        });
      }

      // Markdown links
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      while ((match = linkRegex.exec(content)) !== null) {
        structure.links.push(match[2]);
      }

      // Markdown images
      const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      while ((match = imageRegex.exec(content)) !== null) {
        structure.images.push(match[2]);
      }
    } else {
      // HTML-like headings
      const htmlHeadingRegex = /<h([1-6])[^>]*>([^<]+)<\/h[1-6]>/gi;
      let match;
      
      while ((match = htmlHeadingRegex.exec(content)) !== null) {
        structure.headings.push({
          level: parseInt(match[1]),
          text: match[2].trim(),
          position: match.index
        });
      }

      // HTML links
      const htmlLinkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
      while ((match = htmlLinkRegex.exec(content)) !== null) {
        structure.links.push(match[1]);
      }

      // HTML images
      const htmlImageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
      while ((match = htmlImageRegex.exec(content)) !== null) {
        structure.images.push(match[1]);
      }
    }

    // Count paragraphs (double line breaks or <p> tags)
    const paragraphRegex = /\n\s*\n|\<p[^>]*\>/g;
    structure.paragraphs = (content.match(paragraphRegex) || []).length + 1;

    // Count sentences
    const sentenceRegex = /[.!?]+/g;
    structure.sentences = (content.match(sentenceRegex) || []).length;

    return structure;
  }

  // Count words in text
  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  // Simple language detection
  private detectLanguage(text: string): string {
    const sample = text.toLowerCase().substring(0, 1000);
    
    // Simple heuristics for common languages
    const patterns = {
      english: /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/g,
      spanish: /\b(el|la|los|las|y|o|pero|en|con|por|para|de)\b/g,
      french: /\b(le|la|les|et|ou|mais|dans|sur|avec|par|pour|de)\b/g,
      german: /\b(der|die|das|und|oder|aber|in|auf|mit|von|zu|für)\b/g,
      portuguese: /\b(o|a|os|as|e|ou|mas|em|com|por|para|de)\b/g
    };

    let maxMatches = 0;
    let detectedLanguage = 'unknown';

    for (const [lang, pattern] of Object.entries(patterns)) {
      const matches = (sample.match(pattern) || []).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        detectedLanguage = lang;
      }
    }

    return maxMatches > 5 ? detectedLanguage : 'unknown';
  }

  // Generate a simple summary
  private generateSummary(text: string): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    
    if (sentences.length === 0) return 'No content to summarize.';
    if (sentences.length <= 3) return sentences.join('. ').trim() + '.';

    // Take first sentence, middle sentence, and last sentence
    const firstSentence = sentences[0].trim();
    const middleSentence = sentences[Math.floor(sentences.length / 2)].trim();
    const lastSentence = sentences[sentences.length - 1].trim();

    return `${firstSentence}. ${middleSentence}. ${lastSentence}.`;
  }

  // Extract keywords using simple frequency analysis
  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    // Common stop words to filter out
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above',
      'below', 'between', 'among', 'this', 'that', 'these', 'those', 'they', 'them',
      'their', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'any',
      'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own',
      'same', 'than', 'too', 'very', 'will', 'just', 'should', 'now', 'can', 'could',
      'would', 'have', 'has', 'had', 'been', 'being', 'were', 'was', 'are', 'is'
    ]);

    // Count word frequencies
    const wordCount = new Map<string, number>();
    words.forEach(word => {
      if (!stopWords.has(word)) {
        wordCount.set(word, (wordCount.get(word) || 0) + 1);
      }
    });

    // Sort by frequency and return top keywords
    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  // Simple sentiment analysis
  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = [
      'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'awesome',
      'love', 'like', 'enjoy', 'happy', 'pleased', 'satisfied', 'perfect', 'best',
      'success', 'successful', 'win', 'winner', 'achieve', 'achievement'
    ];

    const negativeWords = [
      'bad', 'terrible', 'awful', 'horrible', 'hate', 'dislike', 'angry', 'sad',
      'disappointed', 'frustrated', 'annoyed', 'upset', 'worst', 'fail', 'failure',
      'problem', 'issue', 'error', 'wrong', 'difficult', 'hard', 'impossible'
    ];

    const words = text.toLowerCase().split(/\W+/);
    let positiveScore = 0;
    let negativeScore = 0;

    words.forEach(word => {
      if (positiveWords.includes(word)) positiveScore++;
      if (negativeWords.includes(word)) negativeScore++;
    });

    const threshold = Math.max(1, words.length * 0.01); // 1% threshold

    if (positiveScore > negativeScore && positiveScore > threshold) {
      return 'positive';
    } else if (negativeScore > positiveScore && negativeScore > threshold) {
      return 'negative';
    } else {
      return 'neutral';
    }
  }

  // Split document into chunks for processing
  public chunkDocument(content: string, maxChunkSize: number = 1000): TextChunk[] {
    const chunks: TextChunk[] = [];
    const paragraphs = content.split(/\n\s*\n/);
    
    let currentChunk = '';
    let chunkStart = 0;
    let position = 0;

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
        // Save current chunk
        chunks.push({
          id: this.generateId(),
          content: currentChunk.trim(),
          position: chunkStart,
          length: currentChunk.length,
          type: this.detectChunkType(currentChunk)
        });

        // Start new chunk
        currentChunk = paragraph;
        chunkStart = position;
      } else {
        if (currentChunk.length > 0) currentChunk += '\n\n';
        currentChunk += paragraph;
      }

      position += paragraph.length + 2; // +2 for \n\n
    }

    // Add final chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: this.generateId(),
        content: currentChunk.trim(),
        position: chunkStart,
        length: currentChunk.length,
        type: this.detectChunkType(currentChunk)
      });
    }

    return chunks;
  }

  // Detect chunk type
  private detectChunkType(content: string): TextChunk['type'] {
    const trimmed = content.trim();
    
    if (trimmed.startsWith('#')) return 'heading';
    if (trimmed.startsWith('```') || trimmed.includes('```')) return 'code';
    if (trimmed.startsWith('>')) return 'quote';
    if (trimmed.match(/^\s*[-*+]\s/m) || trimmed.match(/^\s*\d+\.\s/m)) return 'list';
    
    return 'paragraph';
  }

  // Generate unique ID
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Search within document content
  public searchInDocument(content: string, query: string): Array<{
    position: number;
    context: string;
    match: string;
  }> {
    const results: Array<{ position: number; context: string; match: string }> = [];
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let match;

    while ((match = regex.exec(content)) !== null) {
      const start = Math.max(0, match.index - 50);
      const end = Math.min(content.length, match.index + match[0].length + 50);
      const context = content.substring(start, end);

      results.push({
        position: match.index,
        context: context.trim(),
        match: match[0]
      });
    }

    return results;
  }
}

// Singleton instance
export const documentAnalyzer = new DocumentAnalyzer();

// Utility functions
export const analyzeDocument = (file: FileSystemFile) => documentAnalyzer.analyzeDocument(file);
export const chunkDocument = (content: string, maxSize?: number) => documentAnalyzer.chunkDocument(content, maxSize);
export const searchInDocument = (content: string, query: string) => documentAnalyzer.searchInDocument(content, query);