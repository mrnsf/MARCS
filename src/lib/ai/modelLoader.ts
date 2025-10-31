import * as ort from 'onnxruntime-web';
import { ModelConfig, ModelLoader, ModelManifest } from './types';

export class ONNXModelLoader implements ModelLoader {
  private loadedModels: Map<string, ort.InferenceSession> = new Map();
  private modelConfigs: Map<string, ModelConfig> = new Map();
  private manifest: ModelManifest | null = null;

  constructor() {
    // Configure ONNX Runtime for web
    ort.env.wasm.wasmPaths = '/node_modules/onnxruntime-web/dist/';
    ort.env.wasm.numThreads = navigator.hardwareConcurrency || 4;
  }

  async initialize(): Promise<void> {
    try {
      // Load model manifest
      const response = await fetch('/models/manifest.json');
      this.manifest = await response.json();
      
      // Cache model configurations
      this.manifest.models.forEach(model => {
        this.modelConfigs.set(model.id, model);
      });

      console.log('Model loader initialized with', this.manifest.models.length, 'models');
    } catch (error) {
      console.error('Failed to initialize model loader:', error);
      throw error;
    }
  }

  async loadModel(modelId: string): Promise<void> {
    if (this.loadedModels.has(modelId)) {
      console.log(`Model ${modelId} is already loaded`);
      return;
    }

    const config = this.modelConfigs.get(modelId);
    if (!config) {
      throw new Error(`Model configuration not found for ${modelId}`);
    }

    try {
      console.log(`Loading model ${modelId}...`);
      const modelPath = `/models/${config.file}`;
      
      // Create inference session with optimized options
      const session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all',
        enableCpuMemArena: true,
        enableMemPattern: true,
        executionMode: 'parallel'
      });

      this.loadedModels.set(modelId, session);
      console.log(`Model ${modelId} loaded successfully`);
    } catch (error) {
      console.error(`Failed to load model ${modelId}:`, error);
      throw error;
    }
  }

  async unloadModel(modelId: string): Promise<void> {
    const session = this.loadedModels.get(modelId);
    if (session) {
      try {
        await session.release();
        this.loadedModels.delete(modelId);
        console.log(`Model ${modelId} unloaded successfully`);
      } catch (error) {
        console.error(`Failed to unload model ${modelId}:`, error);
        throw error;
      }
    }
  }

  isModelLoaded(modelId: string): boolean {
    return this.loadedModels.has(modelId);
  }

  getLoadedModels(): string[] {
    return Array.from(this.loadedModels.keys());
  }

  getModelConfig(modelId: string): ModelConfig | undefined {
    return this.modelConfigs.get(modelId);
  }

  getAvailableModels(): ModelConfig[] {
    return this.manifest?.models || [];
  }

  async getModelSession(modelId: string): Promise<ort.InferenceSession> {
    if (!this.loadedModels.has(modelId)) {
      await this.loadModel(modelId);
    }
    
    const session = this.loadedModels.get(modelId);
    if (!session) {
      throw new Error(`Failed to get session for model ${modelId}`);
    }
    
    return session;
  }

  async preloadModels(modelIds: string[]): Promise<void> {
    console.log('Preloading models:', modelIds);
    
    const loadPromises = modelIds.map(async (modelId) => {
      try {
        await this.loadModel(modelId);
      } catch (error) {
        console.error(`Failed to preload model ${modelId}:`, error);
      }
    });

    await Promise.allSettled(loadPromises);
  }

  getMemoryUsage(): { [modelId: string]: number } {
    const usage: { [modelId: string]: number } = {};
    
    this.loadedModels.forEach((session, modelId) => {
      // Estimate memory usage (this is approximate)
      const config = this.modelConfigs.get(modelId);
      if (config) {
        // Parse size string (e.g., "2.2GB" -> 2200MB)
        const sizeMatch = config.size.match(/(\d+\.?\d*)(GB|MB)/);
        if (sizeMatch) {
          const value = parseFloat(sizeMatch[1]);
          const unit = sizeMatch[2];
          usage[modelId] = unit === 'GB' ? value * 1024 : value;
        }
      }
    });

    return usage;
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up model loader...');
    
    const unloadPromises = Array.from(this.loadedModels.keys()).map(
      modelId => this.unloadModel(modelId)
    );

    await Promise.allSettled(unloadPromises);
    this.loadedModels.clear();
    this.modelConfigs.clear();
    this.manifest = null;
  }
}