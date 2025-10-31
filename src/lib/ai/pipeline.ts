import { 
  AIProcessingPipeline, 
  ChatCompletionRequest, 
  ChatCompletionResponse, 
  DocumentAnalysisRequest, 
  DocumentAnalysisResponse,
  ModelPerformanceMetrics,
  AIEngineConfig
} from './types';
import { ONNXModelLoader } from './modelLoader';
import { ONNXInferenceEngine } from './inferenceEngine';
import { AIResponseProcessor } from './responseProcessor';

export class OfflineAIPipeline implements AIProcessingPipeline {
  private modelLoader: ONNXModelLoader;
  private inferenceEngine: ONNXInferenceEngine;
  private responseProcessor: AIResponseProcessor;
  private performanceMetrics: Map<string, ModelPerformanceMetrics> = new Map();
  private config: AIEngineConfig;

  constructor(config: AIEngineConfig) {
    this.config = config;
    this.modelLoader = new ONNXModelLoader();
    this.inferenceEngine = new ONNXInferenceEngine(this.modelLoader);
    this.responseProcessor = new AIResponseProcessor();
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing AI Pipeline...');
      await this.modelLoader.initialize();
      console.log('AI Pipeline initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AI Pipeline:', error);
      throw new Error(`AI Pipeline initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const startTime = performance.now();
    
    try {
      // Validate request
      if (!request.messages || request.messages.length === 0) {
        throw new Error('No messages provided in chat completion request');
      }

      // Set model if specified
      if (request.model) {
        await this.setModel(request.model);
      }

      // Format messages into a prompt
      const prompt = this.responseProcessor.formatPrompt(request.messages);
      
      // Add messages to history
      request.messages.forEach(msg => this.responseProcessor.addToHistory(msg));

      // Generate response
      const response = await this.inferenceEngine.generateText(prompt, {
        maxTokens: request.max_tokens,
        temperature: request.temperature,
        topP: request.top_p,
        topK: request.top_k,
        stopSequences: request.stop
      });

      // Process and format response
      const chatResponse = this.responseProcessor.processResponse(response, {
        model: request.model || this.inferenceEngine.getCurrentModel(),
        promptTokens: this.estimateTokens(prompt)
      });

      // Add assistant response to history
      if (chatResponse.choices[0]?.message) {
        this.responseProcessor.addToHistory(chatResponse.choices[0].message);
      }

      // Update performance metrics
      this.updatePerformanceMetrics(request.model || 'unknown', startTime, response.length);

      return chatResponse;
    } catch (error) {
      console.error('Chat completion error:', error);
      throw new Error(`Chat completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async* chatCompletionStream(request: ChatCompletionRequest): AsyncGenerator<ChatCompletionResponse> {
    const startTime = performance.now();
    
    try {
      // Validate request
      if (!request.messages || request.messages.length === 0) {
        throw new Error('No messages provided in chat completion request');
      }

      // Set model if specified
      if (request.model) {
        await this.setModel(request.model);
      }

      // Format messages into a prompt
      const prompt = this.responseProcessor.formatPrompt(request.messages);
      
      // Add messages to history
      request.messages.forEach(msg => this.responseProcessor.addToHistory(msg));

      let fullResponse = '';
      let tokenCount = 0;

      // Generate streaming response
      for await (const token of this.inferenceEngine.generateStream(prompt, {
        maxTokens: request.max_tokens,
        temperature: request.temperature,
        topP: request.top_p,
        topK: request.top_k,
        stopSequences: request.stop
      })) {
        fullResponse += token;
        tokenCount++;

        // Create streaming response chunk
        const chunk: ChatCompletionResponse = {
          id: `chatcmpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          object: 'chat.completion.chunk',
          created: Date.now(),
          model: request.model || this.inferenceEngine.getCurrentModel() || 'unknown',
          choices: [{
            index: 0,
            delta: {
              content: token
            },
            finish_reason: null
          }],
          usage: {
            prompt_tokens: this.estimateTokens(prompt),
            completion_tokens: tokenCount,
            total_tokens: this.estimateTokens(prompt) + tokenCount
          }
        };

        yield chunk;
      }

      // Send final chunk
      const finalChunk: ChatCompletionResponse = {
        id: `chatcmpl-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: request.model || this.inferenceEngine.getCurrentModel() || 'unknown',
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop'
        }],
        usage: {
          prompt_tokens: this.estimateTokens(prompt),
          completion_tokens: tokenCount,
          total_tokens: this.estimateTokens(prompt) + tokenCount
        }
      };

      yield finalChunk;

      // Add assistant response to history
      this.responseProcessor.addToHistory({
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        role: 'assistant',
        content: fullResponse,
        timestamp: Date.now()
      });

      // Update performance metrics
      this.updatePerformanceMetrics(request.model || 'unknown', startTime, fullResponse.length);

    } catch (error) {
      console.error('Streaming chat completion error:', error);
      throw new Error(`Streaming chat completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyzeDocument(request: DocumentAnalysisRequest): Promise<DocumentAnalysisResponse> {
    const startTime = performance.now();
    
    try {
      // Validate request
      if (!request.document || request.document.trim().length === 0) {
        throw new Error('No document content provided for analysis');
      }

      // Set model if specified
      if (request.model) {
        await this.setModel(request.model);
      }

      // Perform document analysis
      const analysis = await this.inferenceEngine.analyzeDocument(
        request.document,
        request.task || 'summarize'
      );

      // Update performance metrics
      this.updatePerformanceMetrics(request.model || 'unknown', startTime, analysis.length);

      return {
        id: `doc-analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        task: request.task || 'summarize',
        result: analysis,
        model: request.model || this.inferenceEngine.getCurrentModel() || 'unknown',
        created: Date.now(),
        usage: {
          prompt_tokens: this.estimateTokens(request.document),
          completion_tokens: this.estimateTokens(analysis),
          total_tokens: this.estimateTokens(request.document) + this.estimateTokens(analysis)
        }
      };
    } catch (error) {
      console.error('Document analysis error:', error);
      throw new Error(`Document analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async setModel(modelId: string): Promise<void> {
    try {
      // Check if model is available
      const availableModels = await this.getAvailableModels();
      if (!availableModels.includes(modelId)) {
        throw new Error(`Model ${modelId} is not available`);
      }

      // Load model if not already loaded
      if (!this.modelLoader.isModelLoaded(modelId)) {
        await this.modelLoader.loadModel(modelId);
      }

      // Set current model in inference engine
      this.inferenceEngine.setModel(modelId);
      
      console.log(`Model set to: ${modelId}`);
    } catch (error) {
      console.error('Failed to set model:', error);
      throw new Error(`Failed to set model ${modelId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAvailableModels(): Promise<string[]> {
    try {
      const models = this.modelLoader.getAvailableModels();
      return models.map(model => model.id);
    } catch (error) {
      console.error('Failed to get available models:', error);
      return [];
    }
  }

  getCurrentModel(): string | null {
    return this.inferenceEngine.getCurrentModel();
  }

  getPerformanceMetrics(modelId?: string): ModelPerformanceMetrics | Map<string, ModelPerformanceMetrics> {
    if (modelId) {
      return this.performanceMetrics.get(modelId) || {
        modelId,
        totalInferences: 0,
        averageLatency: 0,
        totalTokens: 0,
        averageTokensPerSecond: 0,
        lastInferenceTime: 0
      };
    }
    return this.performanceMetrics;
  }

  clearHistory(): void {
    this.responseProcessor.clearHistory();
  }

  getConversationHistory() {
    return this.responseProcessor.getHistory();
  }

  exportConversation(): string {
    return this.responseProcessor.exportHistory();
  }

  async importConversation(historyJson: string): Promise<void> {
    this.responseProcessor.importHistory(historyJson);
  }

  async cleanup(): Promise<void> {
    try {
      // Unload all models
      const availableModels = await this.getAvailableModels();
      for (const modelId of availableModels) {
        if (this.modelLoader.isModelLoaded(modelId)) {
          await this.modelLoader.unloadModel(modelId);
        }
      }
      
      // Clear history and metrics
      this.clearHistory();
      this.performanceMetrics.clear();
      
      console.log('AI Pipeline cleaned up successfully');
    } catch (error) {
      console.error('Failed to cleanup AI Pipeline:', error);
    }
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private updatePerformanceMetrics(modelId: string, startTime: number, responseLength: number): void {
    const endTime = performance.now();
    const latency = endTime - startTime;
    const tokens = this.estimateTokens(responseLength.toString());
    const tokensPerSecond = tokens / (latency / 1000);

    const existing = this.performanceMetrics.get(modelId);
    
    if (existing) {
      const totalInferences = existing.totalInferences + 1;
      const totalLatency = (existing.averageLatency * existing.totalInferences) + latency;
      const totalTokens = existing.totalTokens + tokens;
      const totalTime = totalLatency / 1000; // Convert to seconds

      this.performanceMetrics.set(modelId, {
        modelId,
        totalInferences,
        averageLatency: totalLatency / totalInferences,
        totalTokens,
        averageTokensPerSecond: totalTokens / totalTime,
        lastInferenceTime: Date.now()
      });
    } else {
      this.performanceMetrics.set(modelId, {
        modelId,
        totalInferences: 1,
        averageLatency: latency,
        totalTokens: tokens,
        averageTokensPerSecond: tokensPerSecond,
        lastInferenceTime: Date.now()
      });
    }
  }
}