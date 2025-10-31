import { ResponseProcessor, ChatMessage, ChatCompletionResponse } from './types';

export class AIResponseProcessor implements ResponseProcessor {
  private conversationHistory: ChatMessage[] = [];
  private maxHistoryLength: number = 50;

  processResponse(response: string, context?: any): ChatCompletionResponse {
    const processedResponse = this.cleanAndFormatResponse(response);
    
    return {
      id: this.generateId(),
      object: 'chat.completion',
      created: Date.now(),
      model: context?.model || 'unknown',
      choices: [{
        index: 0,
        message: {
          id: this.generateId(),
          role: 'assistant',
          content: processedResponse,
          timestamp: Date.now()
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: context?.promptTokens || 0,
        completion_tokens: this.estimateTokens(processedResponse),
        total_tokens: (context?.promptTokens || 0) + this.estimateTokens(processedResponse)
      }
    };
  }

  addToHistory(message: ChatMessage): void {
    this.conversationHistory.push({
      ...message,
      timestamp: Date.now()
    });

    // Maintain history length limit
    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
    }
  }

  getHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  formatPrompt(messages: ChatMessage[]): string {
    // Convert chat messages to a single prompt string
    let prompt = '';
    
    for (const message of messages) {
      switch (message.role) {
        case 'system':
          prompt += `System: ${message.content}\n\n`;
          break;
        case 'user':
          prompt += `Human: ${message.content}\n\n`;
          break;
        case 'assistant':
          prompt += `Assistant: ${message.content}\n\n`;
          break;
      }
    }

    // Add final assistant prompt
    prompt += 'Assistant: ';
    
    return prompt;
  }

  extractCodeBlocks(text: string): Array<{ language: string; code: string }> {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const codeBlocks: Array<{ language: string; code: string }> = [];
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      codeBlocks.push({
        language: match[1] || 'text',
        code: match[2].trim()
      });
    }

    return codeBlocks;
  }

  extractUrls(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
    return text.match(urlRegex) || [];
  }

  summarizeConversation(): string {
    if (this.conversationHistory.length === 0) {
      return 'No conversation history available.';
    }

    const messageCount = this.conversationHistory.length;
    const userMessages = this.conversationHistory.filter(m => m.role === 'user').length;
    const assistantMessages = this.conversationHistory.filter(m => m.role === 'assistant').length;
    
    const firstMessage = this.conversationHistory[0];
    const lastMessage = this.conversationHistory[this.conversationHistory.length - 1];
    
    const duration = lastMessage.timestamp && firstMessage.timestamp 
      ? lastMessage.timestamp - firstMessage.timestamp 
      : 0;

    return `Conversation Summary:
- Total messages: ${messageCount}
- User messages: ${userMessages}
- Assistant messages: ${assistantMessages}
- Duration: ${this.formatDuration(duration)}
- Started: ${firstMessage.timestamp ? new Date(firstMessage.timestamp).toLocaleString() : 'Unknown'}
- Last activity: ${lastMessage.timestamp ? new Date(lastMessage.timestamp).toLocaleString() : 'Unknown'}`;
  }

  private cleanAndFormatResponse(response: string): string {
    // Remove excessive whitespace
    let cleaned = response.replace(/\s+/g, ' ').trim();
    
    // Fix common formatting issues
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n'); // Multiple newlines to double
    cleaned = cleaned.replace(/([.!?])\s*([A-Z])/g, '$1 $2'); // Ensure space after sentence endings
    
    // Remove incomplete sentences at the end
    const sentences = cleaned.split(/[.!?]+/);
    if (sentences.length > 1) {
      const lastSentence = sentences[sentences.length - 1].trim();
      if (lastSentence.length < 10 && !lastSentence.match(/^[A-Z]/)) {
        sentences.pop();
        cleaned = sentences.join('.') + (sentences.length > 0 ? '.' : '');
      }
    }
    
    return cleaned;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private generateId(): string {
    return `chatcmpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    }
    
    const seconds = Math.floor(milliseconds / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ${seconds % 60}s`;
    }
    
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }

  setMaxHistoryLength(length: number): void {
    this.maxHistoryLength = Math.max(1, length);
    
    // Trim current history if needed
    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
    }
  }

  exportHistory(): string {
    return JSON.stringify(this.conversationHistory, null, 2);
  }

  importHistory(historyJson: string): void {
    try {
      const history = JSON.parse(historyJson);
      if (Array.isArray(history)) {
        this.conversationHistory = history.slice(-this.maxHistoryLength);
      }
    } catch (error) {
      console.error('Failed to import conversation history:', error);
      throw new Error('Invalid history format');
    }
  }

  validateResponse(response: string): boolean {
    return typeof response === 'string' && response.trim().length > 0;
  }

  formatResponse(response: string, format: 'text' | 'json' | 'markdown'): string {
    switch (format) {
      case 'json':
        try {
          return JSON.stringify({ response }, null, 2);
        } catch {
          return JSON.stringify({ response: response.toString() }, null, 2);
        }
      case 'markdown':
        return `## AI Response\n\n${response}`;
      case 'text':
      default:
        return response;
    }
  }
}