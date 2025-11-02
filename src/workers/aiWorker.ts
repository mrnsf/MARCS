import * as ort from 'onnxruntime-web';
import { pipeline, env } from '@xenova/transformers';
import { expose } from 'comlink';

// Configure environments
ort.env.wasm.wasmPaths = '/onnx/';
ort.env.wasm.numThreads = Math.min(navigator.hardwareConcurrency || 4, 4);
ort.env.wasm.simd = true;
ort.env.logLevel = 'warning';

// Configure Transformers.js
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = '/models/';
env.cacheDir = '/models/';

interface ModelInfo {
  name: string;
  path: string;
  modelType: 't5' | 'decoder' | 'encoder';
  pipeline?: any; // Transformers.js pipeline
  session?: ort.InferenceSession; // ONNX session for non-T5 models
}

class AIWorker {
  private models: Map<string, ModelInfo> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log('AI Worker initializing...');
      this.initialized = true;
      console.log('AI Worker initialized');
    } catch (error) {
      console.error('Failed to initialize AI Worker:', error);
      throw error;
    }
  }

  async loadModel(modelName: string, modelPath: string, modelType: 't5' | 'decoder' | 'encoder' = 'decoder'): Promise<boolean> {
    try {
      await this.initialize();

      if (this.models.has(modelName)) {
        console.log(`Model ${modelName} already loaded`);
        return true;
      }

      console.log(`Loading ${modelType} model: ${modelName} from ${modelPath}`);

      if (modelType === 't5') {
        // Use Transformers.js for T5 models
        console.log('Loading T5 model with Transformers.js...');

        // For T5, use the text2text-generation pipeline
        const t5Pipeline = await pipeline(
          'text2text-generation',
          modelPath,
          {
            quantized: false,
          }
        );

        this.models.set(modelName, {
          name: modelName,
          path: modelPath,
          modelType: 't5',
          pipeline: t5Pipeline
        });

        console.log(`T5 model ${modelName} loaded successfully`);
      } else {
        // Use ONNX Runtime for decoder-only models
        console.log('Loading model with ONNX Runtime...');

        const session = await ort.InferenceSession.create(modelPath, {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
          enableCpuMemArena: false,
          enableMemPattern: false,
          executionMode: 'sequential'
        });

        this.models.set(modelName, {
          name: modelName,
          path: modelPath,
          modelType,
          session
        });

        console.log(`Model ${modelName} loaded successfully`);
      }

      return true;
    } catch (error) {
      console.error(`Failed to load model ${modelName}:`, error);
      console.error('Error details:', error);
      return false;
    }
  }

  async unloadModel(modelName: string): Promise<boolean> {
    try {
      const modelInfo = this.models.get(modelName);
      if (!modelInfo) {
        console.warn(`Model ${modelName} not found`);
        return false;
      }

      if (modelInfo.session) {
        await modelInfo.session.release();
      }

      // Pipeline will be garbage collected
      this.models.delete(modelName);
      console.log(`Model ${modelName} unloaded successfully`);
      return true;
    } catch (error) {
      console.error(`Failed to unload model ${modelName}:`, error);
      return false;
    }
  }

  async generateText(
    modelName: string,
    prompt: string,
    options: {
      maxTokens?: number;
      temperature?: number;
      topP?: number;
      stopTokens?: string[];
    } = {}
  ): Promise<string> {
    try {
      const modelInfo = this.models.get(modelName);
      if (!modelInfo) {
        throw new Error(`Model ${modelName} not loaded`);
      }

      console.log(`Generating text with ${modelInfo.modelType} model: "${prompt.substring(0, 50)}..."`);

      if (modelInfo.modelType === 't5' && modelInfo.pipeline) {
        // Use Transformers.js pipeline for T5
        const maxLength = options.maxTokens || 200;

        console.log(`Running T5 inference with max_length=${maxLength}`);
        const startTime = performance.now();

        const result = await modelInfo.pipeline(prompt, {
          max_length: maxLength,
          temperature: options.temperature || 0.7,
          top_p: options.topP || 0.9,
          do_sample: true,
        });

        const inferenceTime = performance.now() - startTime;
        console.log(`T5 inference completed in ${inferenceTime.toFixed(2)}ms`);

        // Transformers.js returns array of results
        const generatedText = Array.isArray(result) ? result[0].generated_text : result.generated_text;
        console.log(`Generated text: "${generatedText.substring(0, 100)}..."`);

        return generatedText || 'Generated response from T5 model';

      } else if (modelInfo.session) {
        // Fallback to basic ONNX inference
        console.log('Using basic ONNX inference (decoder-only)');
        return '[ONNX decoder-only models not fully implemented yet. Please use T5 models for now.]';
      } else {
        throw new Error('Model not properly loaded');
      }

    } catch (error) {
      console.error(`Failed to generate text with ${modelName}:`, error);
      return `[Inference Error: ${error instanceof Error ? error.message : 'Unknown error'}]`;
    }
  }

  async analyzeDocument(
    modelName: string,
    content: string,
    analysisType: 'summary' | 'keywords' | 'sentiment' | 'classification' = 'summary'
  ): Promise<any> {
    try {
      const modelInfo = this.models.get(modelName);
      if (!modelInfo) {
        throw new Error(`Model ${modelName} not loaded`);
      }

      const startTime = performance.now();

      // Create task-specific prompts for T5
      const taskPrompts = {
        summary: `summarize: ${content}`,
        keywords: `extract keywords: ${content}`,
        sentiment: `sentiment: ${content}`,
        classification: `classify: ${content}`
      };

      const prompt = taskPrompts[analysisType];

      // Use the T5 model for analysis
      const result = await this.generateText(modelName, prompt, {
        maxTokens: analysisType === 'summary' ? 200 : 50,
        temperature: 0.3
      });

      const processingTime = performance.now() - startTime;

      return {
        type: analysisType,
        content: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
        results: {
          [analysisType]: result
        },
        processingTime,
        modelUsed: modelName
      };
    } catch (error) {
      console.error(`Failed to analyze document with ${modelName}:`, error);

      return {
        type: analysisType,
        content: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
        results: {
          [analysisType]: `[Analysis Error: ${error instanceof Error ? error.message : 'Unknown error'}]`
        },
        processingTime: 0,
        modelUsed: modelName
      };
    }
  }

  async getLoadedModels(): Promise<string[]> {
    return Array.from(this.models.keys());
  }

  async getModelInfo(modelName: string): Promise<any | null> {
    const modelInfo = this.models.get(modelName);
    if (!modelInfo) return null;

    return {
      name: modelInfo.name,
      path: modelInfo.path,
      modelType: modelInfo.modelType,
    };
  }

  async cleanup(): Promise<void> {
    try {
      for (const [modelName] of this.models) {
        await this.unloadModel(modelName);
      }
      console.log('AI Worker cleanup completed');
    } catch (error) {
      console.error('Failed to cleanup AI Worker:', error);
    }
  }
}

const aiWorker = new AIWorker();

// Expose the worker methods via Comlink
expose(aiWorker);

export type { AIWorker };
