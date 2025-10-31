import * as ort from 'onnxruntime-web';
import { InferenceEngine, InferenceOptions, ModelConfig } from './types';
import { ONNXModelLoader } from './modelLoader';
import { createTokenizer, Tokenizer } from './tokenizer';

export class ONNXInferenceEngine implements InferenceEngine {
  private modelLoader: ONNXModelLoader;
  private tokenizer: Tokenizer;
  private currentModel: string | null = null;

  constructor(modelLoader: ONNXModelLoader) {
    this.modelLoader = modelLoader;
    this.tokenizer = createTokenizer('simple');
  }

  async generateText(prompt: string, options: InferenceOptions = {}): Promise<string> {
    if (!this.currentModel) {
      throw new Error('No model selected for inference');
    }

    try {
      const session = await this.modelLoader.getModelSession(this.currentModel);
      const config = this.modelLoader.getModelConfig(this.currentModel);
      
      if (!config) {
        throw new Error(`Model configuration not found for ${this.currentModel}`);
      }

      // Tokenize input
      const inputTokens = this.tokenizer.encode(prompt);
      const maxTokens = Math.min(options.maxTokens || config.maxTokens, config.maxTokens);
      
      // Prepare input tensor
      const inputTensor = new ort.Tensor('int64', BigInt64Array.from(inputTokens.map(t => BigInt(t))), [1, inputTokens.length]);
      
      // Run inference
      const feeds = { input_ids: inputTensor };
      const results = await session.run(feeds);
      
      // Process output
      const outputTensor = results.logits || results.output || Object.values(results)[0];
      if (!outputTensor) {
        throw new Error('No output tensor found in model results');
      }

      // Simple greedy decoding for now
      const outputTokens = this.greedyDecode(outputTensor, inputTokens.length, maxTokens, options);
      
      // Decode tokens to text
      const generatedText = this.tokenizer.decode(outputTokens);
      
      return this.cleanupResponse(generatedText, prompt);
    } catch (error) {
      console.error('Inference error:', error);
      throw new Error(`Inference failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async* generateStream(prompt: string, options: InferenceOptions = {}): AsyncGenerator<string> {
    if (!this.currentModel) {
      throw new Error('No model selected for inference');
    }

    try {
      const session = await this.modelLoader.getModelSession(this.currentModel);
      const config = this.modelLoader.getModelConfig(this.currentModel);
      
      if (!config) {
        throw new Error(`Model configuration not found for ${this.currentModel}`);
      }

      const inputTokens = this.tokenizer.encode(prompt);
      const maxTokens = Math.min(options.maxTokens || config.maxTokens, config.maxTokens);
      const temperature = options.temperature ?? config.temperature;
      
      let currentTokens = [...inputTokens];
      let generatedText = '';

      for (let i = 0; i < maxTokens; i++) {
        // Prepare input tensor
        const inputTensor = new ort.Tensor('int64', BigInt64Array.from(currentTokens.map(t => BigInt(t))), [1, currentTokens.length]);
        
        // Run inference
        const feeds = { input_ids: inputTensor };
        const results = await session.run(feeds);
        
        const outputTensor = results.logits || results.output || Object.values(results)[0];
        if (!outputTensor) {
          break;
        }

        // Sample next token
        const nextToken = this.sampleToken(outputTensor, temperature, options.topP, options.topK);
        
        if (this.isStopToken(nextToken, options.stopSequences)) {
          break;
        }

        currentTokens.push(nextToken);
        
        // Decode and yield new token
        const newText = this.tokenizer.decode([nextToken]);
        generatedText += newText;
        yield newText;

        // Prevent infinite loops
        if (currentTokens.length > config.maxTokens) {
          break;
        }
      }
    } catch (error) {
      console.error('Streaming inference error:', error);
      throw new Error(`Streaming inference failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyzeDocument(document: string, task: string): Promise<string> {
    const taskPrompts = {
      summarize: `Please provide a concise summary of the following document:\n\n${document}\n\nSummary:`,
      qa: `Based on the following document, please answer questions about it:\n\n${document}\n\nDocument analysis:`,
      extract: `Please extract key information from the following document:\n\n${document}\n\nKey information:`,
      classify: `Please classify the following document and identify its main topics:\n\n${document}\n\nClassification:`
    };

    const prompt = taskPrompts[task as keyof typeof taskPrompts] || taskPrompts.summarize;
    
    return this.generateText(prompt, {
      maxTokens: 512,
      temperature: 0.3
    });
  }

  setModel(modelId: string): void {
    this.currentModel = modelId;
  }

  getCurrentModel(): string | null {
    return this.currentModel;
  }

  private greedyDecode(outputTensor: ort.Tensor, inputLength: number, maxTokens: number, options: InferenceOptions): number[] {
    const data = outputTensor.data as Float32Array;
    const shape = outputTensor.dims;
    
    // Simple greedy decoding - select token with highest probability
    const vocabSize = shape[shape.length - 1];
    const lastTokenLogits = data.slice(-vocabSize);
    
    // Apply temperature if specified
    const temperature = options.temperature || 1.0;
    if (temperature !== 1.0) {
      for (let i = 0; i < lastTokenLogits.length; i++) {
        lastTokenLogits[i] /= temperature;
      }
    }

    // Find token with highest probability
    let maxIndex = 0;
    let maxValue = lastTokenLogits[0];
    
    for (let i = 1; i < lastTokenLogits.length; i++) {
      if (lastTokenLogits[i] > maxValue) {
        maxValue = lastTokenLogits[i];
        maxIndex = i;
      }
    }

    return [maxIndex];
  }

  private sampleToken(outputTensor: ort.Tensor, temperature: number = 1.0, topP?: number, topK?: number): number {
    const data = outputTensor.data as Float32Array;
    const shape = outputTensor.dims;
    const vocabSize = shape[shape.length - 1];
    const logits = Array.from(data.slice(-vocabSize));

    // Apply temperature
    if (temperature !== 1.0) {
      for (let i = 0; i < logits.length; i++) {
        logits[i] /= temperature;
      }
    }

    // Convert logits to probabilities
    const maxLogit = Math.max(...logits);
    const expLogits = logits.map(l => Math.exp(l - maxLogit));
    const sumExp = expLogits.reduce((sum, exp) => sum + exp, 0);
    const probs = expLogits.map(exp => exp / sumExp);

    // Apply top-k filtering
    if (topK && topK > 0) {
      const topKIndices = probs
        .map((prob, index) => ({ prob, index }))
        .sort((a, b) => b.prob - a.prob)
        .slice(0, topK)
        .map(item => item.index);
      
      for (let i = 0; i < probs.length; i++) {
        if (!topKIndices.includes(i)) {
          probs[i] = 0;
        }
      }
    }

    // Apply top-p (nucleus) filtering
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
    }

    // Renormalize probabilities
    const totalProb = probs.reduce((sum, prob) => sum + prob, 0);
    if (totalProb > 0) {
      for (let i = 0; i < probs.length; i++) {
        probs[i] /= totalProb;
      }
    }

    // Sample from the distribution
    const random = Math.random();
    let cumulativeProb = 0;
    
    for (let i = 0; i < probs.length; i++) {
      cumulativeProb += probs[i];
      if (random <= cumulativeProb) {
        return i;
      }
    }

    // Fallback to last token
    return probs.length - 1;
  }

  private isStopToken(token: number, stopSequences?: string[]): boolean {
    if (!stopSequences || stopSequences.length === 0) {
      return false;
    }

    const tokenText = this.tokenizer.decode([token]);
    return stopSequences.some(seq => tokenText.includes(seq));
  }

  private cleanupResponse(response: string, prompt: string): string {
    // Remove the original prompt from the response
    let cleaned = response.replace(prompt, '').trim();
    
    // Remove common artifacts
    cleaned = cleaned.replace(/^[:\-\s]+/, ''); // Remove leading colons, dashes, spaces
    cleaned = cleaned.replace(/\s+/g, ' '); // Normalize whitespace
    
    return cleaned;
  }
}