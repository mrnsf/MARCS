import { wrap, Remote } from 'comlink';
import type { AIWorker } from '../../workers/aiWorker';

export interface AIModelConfig {
  name: string;
  displayName: string;
  path: string;
  size: string;
  description: string;
  capabilities: string[];
  loaded: boolean;
}

export interface GenerationOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopTokens?: string[];
}

export interface DocumentAnalysisOptions {
  type: 'summary' | 'keywords' | 'sentiment' | 'classification';
}

class AIService {
  private worker: Worker | null = null;
  private aiWorker: Remote<AIWorker> | null = null;
  private initialized = false;
  // Available models will be loaded from configuration
  private static availableModels: AIModelConfig[] = [];

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load model configurations
      await this.loadModelConfigurations();
      
      // Create and initialize the AI worker
      this.worker = new Worker(
        new URL('../../workers/aiWorker.ts', import.meta.url),
        { type: 'module' }
      );

      this.aiWorker = wrap<AIWorker>(this.worker);
      await this.aiWorker.initialize();

      this.initialized = true;
      console.log('AI Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AI Service:', error);
      throw error;
    }
  }

  private async loadModelConfigurations(): Promise<void> {
    try {
      const response = await fetch('/models/models.json');
      if (!response.ok) {
        throw new Error(`Failed to load model configurations: ${response.statusText}`);
      }
      
      const data = await response.json();
      AIService.availableModels = data.models || [];
      console.log(`Loaded ${AIService.availableModels.length} model configurations`);
    } catch (error) {
      console.warn('Failed to load model configurations, using defaults:', error);
      // Fallback to default models
      AIService.availableModels = [
        {
          id: 'tinyllama',
          name: 'TinyLlama 1.1B',
          description: 'A compact language model optimized for chat and text generation',
          size: '637MB',
          capabilities: ['chat', 'text-generation'],
          url: '/models/tinyllama.onnx'
        }
      ];
    }
  }

  async loadModel(modelName: string): Promise<boolean> {
    if (!this.aiWorker) {
      throw new Error('AI Service not initialized');
    }

    const modelConfig = this.availableModels.find(m => m.name === modelName);
    if (!modelConfig) {
      throw new Error(`Model ${modelName} not found in available models`);
    }

    try {
      const success = await this.aiWorker.loadModel(modelName, modelConfig.path);
      if (success) {
        modelConfig.loaded = true;
      }
      return success;
    } catch (error) {
      console.error(`Failed to load model ${modelName}:`, error);
      return false;
    }
  }

  async unloadModel(modelName: string): Promise<boolean> {
    if (!this.aiWorker) {
      throw new Error('AI Service not initialized');
    }

    try {
      const success = await this.aiWorker.unloadModel(modelName);
      if (success) {
        const modelConfig = this.availableModels.find(m => m.name === modelName);
        if (modelConfig) {
          modelConfig.loaded = false;
        }
      }
      return success;
    } catch (error) {
      console.error(`Failed to unload model ${modelName}:`, error);
      return false;
    }
  }

  async generateText(
    modelName: string,
    prompt: string,
    options: GenerationOptions = {}
  ): Promise<string> {
    if (!this.aiWorker) {
      throw new Error('AI Service not initialized');
    }

    const modelConfig = this.availableModels.find(m => m.name === modelName);
    if (!modelConfig || !modelConfig.loaded) {
      throw new Error(`Model ${modelName} is not loaded`);
    }

    try {
      return await this.aiWorker.generateText(modelName, prompt, options);
    } catch (error) {
      console.error(`Failed to generate text with ${modelName}:`, error);
      throw error;
    }
  }

  async analyzeDocument(
    modelName: string,
    content: string,
    options: DocumentAnalysisOptions = { type: 'summary' }
  ): Promise<any> {
    if (!this.aiWorker) {
      throw new Error('AI Service not initialized');
    }

    const modelConfig = this.availableModels.find(m => m.name === modelName);
    if (!modelConfig || !modelConfig.loaded) {
      throw new Error(`Model ${modelName} is not loaded`);
    }

    try {
      return await this.aiWorker.analyzeDocument(modelName, content, options.type);
    } catch (error) {
      console.error(`Failed to analyze document with ${modelName}:`, error);
      throw error;
    }
  }

  async getAvailableModels(): Promise<AIModelConfig[]> {
    return [...AIService.availableModels];
  }

  async getLoadedModels(): Promise<string[]> {
    if (!this.aiWorker) {
      return [];
    }

    try {
      return await this.aiWorker.getLoadedModels();
    } catch (error) {
      console.error('Failed to get loaded models:', error);
      return [];
    }
  }

  async isModelLoaded(modelName: string): Promise<boolean> {
    const modelConfig = this.availableModels.find(m => m.name === modelName);
    return modelConfig?.loaded || false;
  }

  async getModelCapabilities(modelName: string): Promise<string[]> {
    const modelConfig = this.availableModels.find(m => m.name === modelName);
    return modelConfig?.capabilities || [];
  }

  async cleanup(): Promise<void> {
    try {
      if (this.aiWorker) {
        await this.aiWorker.cleanup();
      }
      
      if (this.worker) {
        this.worker.terminate();
        this.worker = null;
      }

      this.aiWorker = null;
      this.initialized = false;
      
      // Reset model loaded states
      this.availableModels.forEach(model => {
        model.loaded = false;
      });

      console.log('AI Service cleanup completed');
    } catch (error) {
      console.error('Failed to cleanup AI Service:', error);
    }
  }

  // Utility method to check if a model supports a specific capability
  supportsCapability(modelName: string, capability: string): boolean {
    const modelConfig = this.availableModels.find(m => m.name === modelName);
    return modelConfig?.capabilities.includes(capability) || false;
  }

  // Get recommended model for a specific task
  getRecommendedModel(capability: string): string | null {
    const suitableModels = AIService.availableModels.filter(model =>
      model.capabilities.includes(capability as any)
    );
    
    // Return the first suitable model, or null if none found
    return suitableModels.length > 0 ? suitableModels[0].id : null;
  }
}

// Create and export a singleton instance
export const aiService = new AIService();

// Export the class for testing purposes
export { AIService };