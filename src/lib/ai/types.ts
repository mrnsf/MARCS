export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  size: string;
  quantization: 'int4' | 'int8' | 'fp16' | 'fp32';
  format: 'onnx' | 'tfjs';
  file: string;
  capabilities: string[];
  maxTokens: number;
  temperature: number;
  topP: number;
}

export interface ModelManifest {
  models: ModelConfig[];
  version: string;
  lastUpdated: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  tokens?: number;
  processingTime?: number;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  max_tokens?: number; // OpenAI API compatibility
  topP?: number;
  top_p?: number; // OpenAI API compatibility
  top_k?: number; // Additional parameter
  stop?: string[]; // Stop sequences
  stream?: boolean;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message?: ChatMessage;
    delta?: Partial<ChatMessage>;
    finish_reason: 'stop' | 'length' | 'error' | null;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface DocumentAnalysisRequest {
  document: string; // Document content as string
  task?: 'summarize' | 'qa' | 'extract' | 'classify';
  model?: string;
  prompt?: string;
}

export interface DocumentAnalysisResponse {
  id: string;
  task: string;
  result: string;
  model: string;
  created: number;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AIProcessingPipeline {
  modelLoader: ModelLoader;
  tokenizer: Tokenizer;
  inferenceEngine: InferenceEngine;
  responseProcessor: ResponseProcessor;
}

export interface ModelLoader {
  loadModel(modelId: string): Promise<void>;
  unloadModel(modelId: string): Promise<void>;
  isModelLoaded(modelId: string): boolean;
  getLoadedModels(): string[];
}

export interface Tokenizer {
  encode(text: string): number[];
  decode(tokens: number[]): string;
  countTokens(text: string): number;
}

export interface InferenceEngine {
  generateText(prompt: string, options?: InferenceOptions): Promise<string>;
  generateStream(prompt: string, options?: InferenceOptions): AsyncGenerator<string>;
  analyzeDocument(document: string, task: string): Promise<string>;
}

export interface ResponseProcessor {
  processResponse(response: string, context?: any): ChatCompletionResponse;
  validateResponse(response: string): boolean;
  formatResponse(response: string, format: 'text' | 'json' | 'markdown'): string;
  addToHistory(message: ChatMessage): void;
  getHistory(): ChatMessage[];
  clearHistory(): void;
}

export interface InferenceOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  repetitionPenalty?: number;
  stopSequences?: string[];
}

export interface ModelPerformanceMetrics {
  modelId: string;
  totalInferences: number;
  averageLatency: number;
  totalTokens: number;
  averageTokensPerSecond: number;
  lastInferenceTime: number;
}

export interface AIEngineConfig {
  maxConcurrentInferences: number;
  modelCacheSize: number;
  enablePerformanceMetrics: boolean;
  defaultTemperature: number;
  defaultMaxTokens: number;
  workerPoolSize: number;
}