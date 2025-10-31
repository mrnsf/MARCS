import { useState, useEffect, useCallback } from 'react';
import { aiService, type AIModelConfig, type GenerationOptions, type DocumentAnalysisOptions } from '../lib/ai/aiService';

export interface UseAIState {
  initialized: boolean;
  loading: boolean;
  error: string | null;
  availableModels: AIModelConfig[];
  loadedModels: string[];
}

export interface UseAIActions {
  initialize: () => Promise<void>;
  loadModel: (modelName: string) => Promise<boolean>;
  unloadModel: (modelName: string) => Promise<boolean>;
  generateText: (modelName: string, prompt: string, options?: GenerationOptions) => Promise<string>;
  analyzeDocument: (modelName: string, content: string, options?: DocumentAnalysisOptions) => Promise<any>;
  refreshModels: () => Promise<void>;
  clearError: () => void;
  isModelLoaded: (modelName: string) => boolean;
  getRecommendedModel: (task: 'chat' | 'analysis' | 'code' | 'reasoning') => string | null;
}

export function useAI(): UseAIState & UseAIActions {
  const [state, setState] = useState<UseAIState>({
    initialized: false,
    loading: false,
    error: null,
    availableModels: [],
    loadedModels: []
  });

  const updateState = useCallback((updates: Partial<UseAIState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  const initialize = useCallback(async () => {
    if (state.initialized) return;

    updateState({ loading: true, error: null });
    
    try {
      await aiService.initialize();
      const availableModels = await aiService.getAvailableModels();
      const loadedModels = await aiService.getLoadedModels();
      
      updateState({
        initialized: true,
        loading: false,
        availableModels,
        loadedModels
      });
    } catch (error) {
      console.error('Failed to initialize AI service:', error);
      updateState({
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to initialize AI service'
      });
    }
  }, [state.initialized, updateState]);

  const loadModel = useCallback(async (modelName: string): Promise<boolean> => {
    updateState({ loading: true, error: null });
    
    try {
      const success = await aiService.loadModel(modelName);
      
      if (success) {
        const loadedModels = await aiService.getLoadedModels();
        const availableModels = await aiService.getAvailableModels();
        updateState({ 
          loading: false, 
          loadedModels,
          availableModels
        });
      } else {
        updateState({ 
          loading: false, 
          error: `Failed to load model: ${modelName}` 
        });
      }
      
      return success;
    } catch (error) {
      console.error(`Failed to load model ${modelName}:`, error);
      updateState({
        loading: false,
        error: error instanceof Error ? error.message : `Failed to load model: ${modelName}`
      });
      return false;
    }
  }, [updateState]);

  const unloadModel = useCallback(async (modelName: string): Promise<boolean> => {
    updateState({ loading: true, error: null });
    
    try {
      const success = await aiService.unloadModel(modelName);
      
      if (success) {
        const loadedModels = await aiService.getLoadedModels();
        const availableModels = await aiService.getAvailableModels();
        updateState({ 
          loading: false, 
          loadedModels,
          availableModels
        });
      } else {
        updateState({ 
          loading: false, 
          error: `Failed to unload model: ${modelName}` 
        });
      }
      
      return success;
    } catch (error) {
      console.error(`Failed to unload model ${modelName}:`, error);
      updateState({
        loading: false,
        error: error instanceof Error ? error.message : `Failed to unload model: ${modelName}`
      });
      return false;
    }
  }, [updateState]);

  const generateText = useCallback(async (
    modelName: string, 
    prompt: string, 
    options?: GenerationOptions
  ): Promise<string> => {
    updateState({ loading: true, error: null });
    
    try {
      const result = await aiService.generateText(modelName, prompt, options);
      updateState({ loading: false });
      return result;
    } catch (error) {
      console.error(`Failed to generate text with ${modelName}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate text';
      updateState({
        loading: false,
        error: errorMessage
      });
      throw new Error(errorMessage);
    }
  }, [updateState]);

  const analyzeDocument = useCallback(async (
    modelName: string, 
    content: string, 
    options?: DocumentAnalysisOptions
  ): Promise<any> => {
    updateState({ loading: true, error: null });
    
    try {
      const result = await aiService.analyzeDocument(modelName, content, options);
      updateState({ loading: false });
      return result;
    } catch (error) {
      console.error(`Failed to analyze document with ${modelName}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to analyze document';
      updateState({
        loading: false,
        error: errorMessage
      });
      throw new Error(errorMessage);
    }
  }, [updateState]);

  const refreshModels = useCallback(async () => {
    if (!state.initialized) return;
    
    try {
      const availableModels = await aiService.getAvailableModels();
      const loadedModels = await aiService.getLoadedModels();
      
      updateState({
        availableModels,
        loadedModels
      });
    } catch (error) {
      console.error('Failed to refresh models:', error);
      updateState({
        error: error instanceof Error ? error.message : 'Failed to refresh models'
      });
    }
  }, [state.initialized, updateState]);

  const isModelLoaded = useCallback((modelName: string): boolean => {
    return state.loadedModels.includes(modelName);
  }, [state.loadedModels]);

  const getRecommendedModel = useCallback((task: 'chat' | 'analysis' | 'code' | 'reasoning'): string | null => {
    return aiService.getRecommendedModel(task);
  }, []);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      aiService.cleanup();
    };
  }, []);

  return {
    ...state,
    initialize,
    loadModel,
    unloadModel,
    generateText,
    analyzeDocument,
    refreshModels,
    clearError,
    isModelLoaded,
    getRecommendedModel
  };
}