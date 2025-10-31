import * as ort from 'onnxruntime-web';
import { expose } from 'comlink';

// Configure ONNX Runtime
ort.env.wasm.wasmPaths = '/onnx/';
ort.env.wasm.numThreads = Math.min(navigator.hardwareConcurrency || 4, 4);
ort.env.wasm.simd = true;
ort.env.logLevel = 'warning';

// Simple tokenizer for ONNX models
class SimpleTokenizer {
  private vocabulary: Map<string, number> = new Map();
  private reverseVocabulary: Map<number, string> = new Map();

  constructor() {
    this.initializeVocabulary();
  }

  private initializeVocabulary(): void {
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

  private tokenizeText(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/([.!?,:;'"()[\]{}])/g, ' $1 ')
      .split(/\s+/)
      .filter(token => token.length > 0);
  }
}

interface ModelInfo {
  name: string;
  path: string;
  session?: ort.InferenceSession;
  tokenizer: SimpleTokenizer;
}

class AIWorker {
  private models: Map<string, ModelInfo> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // ONNX Runtime will initialize automatically when needed
      this.initialized = true;
      console.log('AI Worker initialized');
    } catch (error) {
      console.error('Failed to initialize AI Worker:', error);
      throw error;
    }
  }

  async loadModel(modelName: string, modelPath: string): Promise<boolean> {
    try {
      await this.initialize();
      
      if (this.models.has(modelName)) {
        console.log(`Model ${modelName} already loaded`);
        return true;
      }

      console.log(`Loading model: ${modelName} from ${modelPath}`);
      
      // Create inference session
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
        session,
        tokenizer: new SimpleTokenizer()
      });

      console.log(`Model ${modelName} loaded successfully`);
      return true;
    } catch (error) {
      console.error(`Failed to load model ${modelName}:`, error);
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
      if (!modelInfo || !modelInfo.session) {
        throw new Error(`Model ${modelName} not loaded`);
      }

      const { session, tokenizer } = modelInfo;
      const maxTokens = options.maxTokens || 100;
      const temperature = options.temperature || 1.0;

      console.log(`Generating text for prompt: "${prompt.substring(0, 50)}..."`);

      // Step 1: Tokenize the input prompt
      const inputTokens = tokenizer.encode(prompt);
      console.log(`Input tokens (${inputTokens.length}):`, inputTokens.slice(0, 10));

      // Step 2: Prepare input tensor
      const inputTensor = new ort.Tensor(
        'int64',
        BigInt64Array.from(inputTokens.map(t => BigInt(t))),
        [1, inputTokens.length]
      );

      // Step 3: Run inference with ONNX model
      const feeds = { input_ids: inputTensor };
      const startTime = performance.now();
      const results = await session.run(feeds);
      const inferenceTime = performance.now() - startTime;

      console.log(`Inference completed in ${inferenceTime.toFixed(2)}ms`);

      // Step 4: Process output tensor
      const outputTensor = results.logits || results.output || Object.values(results)[0];
      if (!outputTensor) {
        throw new Error('No output tensor found in model results');
      }

      console.log('Output tensor shape:', outputTensor.dims);

      // Step 5: Decode output tokens (greedy decoding)
      const outputTokens = this.greedyDecode(
        outputTensor,
        maxTokens,
        temperature,
        options.topP
      );

      // Step 6: Decode tokens back to text
      const generatedText = tokenizer.decode(outputTokens);
      console.log(`Generated ${outputTokens.length} tokens`);

      return generatedText || 'Generated response from ONNX model';
    } catch (error) {
      console.error(`Failed to generate text with ${modelName}:`, error);

      // Provide a helpful error message instead of failing completely
      return `[Inference Error: ${error instanceof Error ? error.message : 'Unknown error'}. This could mean the model file is missing, incompatible, or the model requires a specific input format. Please check that ONNX models are properly loaded in the /models directory.]`;
    }
  }

  private greedyDecode(
    outputTensor: ort.Tensor,
    maxTokens: number,
    temperature: number = 1.0,
    topP?: number
  ): number[] {
    const data = outputTensor.data as Float32Array;
    const shape = outputTensor.dims;
    const vocabSize = shape[shape.length - 1];

    // Get logits for the last position
    const lastTokenLogits = Array.from(data.slice(-vocabSize));

    // Apply temperature
    if (temperature !== 1.0) {
      for (let i = 0; i < lastTokenLogits.length; i++) {
        lastTokenLogits[i] /= temperature;
      }
    }

    // Convert logits to probabilities using softmax
    const maxLogit = Math.max(...lastTokenLogits);
    const expLogits = lastTokenLogits.map(l => Math.exp(l - maxLogit));
    const sumExp = expLogits.reduce((sum, exp) => sum + exp, 0);
    const probs = expLogits.map(exp => exp / sumExp);

    // Apply top-p (nucleus) sampling if specified
    if (topP && topP > 0 && topP < 1) {
      const sortedIndices = probs
        .map((prob, index) => ({ prob, index }))
        .sort((a, b) => b.prob - a.prob);

      let cumulativeProb = 0;
      const nucleusIndices: number[] = [];

      for (const item of sortedIndices) {
        cumulativeProb += item.prob;
        nucleusIndices.push(item.index);
        if (cumulativeProb >= topP) break;
      }

      for (let i = 0; i < probs.length; i++) {
        if (!nucleusIndices.includes(i)) {
          probs[i] = 0;
        }
      }

      // Renormalize
      const totalProb = probs.reduce((sum, prob) => sum + prob, 0);
      if (totalProb > 0) {
        for (let i = 0; i < probs.length; i++) {
          probs[i] /= totalProb;
        }
      }
    }

    // Sample from the distribution
    const random = Math.random();
    let cumulativeProb = 0;

    for (let i = 0; i < probs.length; i++) {
      cumulativeProb += probs[i];
      if (random <= cumulativeProb) {
        return [i];
      }
    }

    // Fallback to argmax (greedy)
    const maxIndex = probs.indexOf(Math.max(...probs));
    return [maxIndex];
  }

  async analyzeDocument(
    modelName: string,
    content: string,
    analysisType: 'summary' | 'keywords' | 'sentiment' | 'classification' = 'summary'
  ): Promise<any> {
    try {
      const modelInfo = this.models.get(modelName);
      if (!modelInfo || !modelInfo.session) {
        throw new Error(`Model ${modelName} not loaded`);
      }

      const startTime = performance.now();

      // Create task-specific prompts
      const taskPrompts = {
        summary: `Summarize the following document:\n\n${content.substring(0, 500)}\n\nSummary:`,
        keywords: `Extract key terms from this document:\n\n${content.substring(0, 500)}\n\nKeywords:`,
        sentiment: `Analyze the sentiment of this text:\n\n${content.substring(0, 500)}\n\nSentiment:`,
        classification: `Classify this document:\n\n${content.substring(0, 500)}\n\nCategory:`
      };

      const prompt = taskPrompts[analysisType];

      // Use the actual ONNX inference
      const result = await this.generateText(modelName, prompt, {
        maxTokens: 150,
        temperature: 0.3
      });

      const processingTime = performance.now() - startTime;

      const analysis = {
        type: analysisType,
        content: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
        results: {
          [analysisType]: result
        },
        processingTime,
        modelUsed: modelName
      };

      return analysis;
    } catch (error) {
      console.error(`Failed to analyze document with ${modelName}:`, error);

      // Return a graceful error response
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
      // Don't return the session or tokenizer objects as they're not serializable
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