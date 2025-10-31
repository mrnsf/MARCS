import React, { useState } from 'react';
import { Download, Trash2, CheckCircle, AlertCircle, Loader2, Brain, Zap, FileText, Code } from 'lucide-react';
import { useAI } from '../hooks/useAI';
import { toast } from 'sonner';

const ModelManager: React.FC = () => {
  const {
    availableModels,
    loadedModels,
    loading,
    error,
    loadModel,
    unloadModel,
    isModelLoaded,
    clearError
  } = useAI();

  const [loadingModels, setLoadingModels] = useState<Set<string>>(new Set());

  const handleLoadModel = async (modelName: string) => {
    setLoadingModels(prev => new Set(prev).add(modelName));
    
    try {
      const success = await loadModel(modelName);
      if (success) {
        toast.success(`Model ${modelName} loaded successfully`);
      } else {
        toast.error(`Failed to load model ${modelName}`);
      }
    } catch (error) {
      toast.error(`Error loading model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoadingModels(prev => {
        const newSet = new Set(prev);
        newSet.delete(modelName);
        return newSet;
      });
    }
  };

  const handleUnloadModel = async (modelName: string) => {
    setLoadingModels(prev => new Set(prev).add(modelName));
    
    try {
      const success = await unloadModel(modelName);
      if (success) {
        toast.success(`Model ${modelName} unloaded successfully`);
      } else {
        toast.error(`Failed to unload model ${modelName}`);
      }
    } catch (error) {
      toast.error(`Error unloading model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoadingModels(prev => {
        const newSet = new Set(prev);
        newSet.delete(modelName);
        return newSet;
      });
    }
  };

  const getCapabilityIcon = (capability: string) => {
    switch (capability) {
      case 'chat':
      case 'text-generation':
        return <Brain className="w-4 h-4" />;
      case 'code-assistance':
        return <Code className="w-4 h-4" />;
      case 'document-analysis':
      case 'text-classification':
      case 'sentiment-analysis':
        return <FileText className="w-4 h-4" />;
      case 'reasoning':
      case 'instruction-following':
        return <Zap className="w-4 h-4" />;
      default:
        return <Brain className="w-4 h-4" />;
    }
  };

  const formatSize = (size: string) => {
    return size;
  };

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center gap-2 text-red-700 mb-2">
          <AlertCircle className="w-5 h-5" />
          <h3 className="font-semibold">Error Loading Models</h3>
        </div>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={clearError}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">AI Models</h2>
        <div className="text-sm text-gray-600">
          {loadedModels.length} of {availableModels.length} models loaded
        </div>
      </div>

      {loading && availableModels.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading models...</span>
        </div>
      )}

      <div className="grid gap-4">
        {availableModels.map((model) => {
          const isLoaded = isModelLoaded(model.name);
          const isLoadingModel = loadingModels.has(model.name);

          return (
            <div
              key={model.name}
              className={`p-6 border rounded-lg transition-all ${
                isLoaded
                  ? 'border-green-200 bg-green-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {model.displayName}
                    </h3>
                    {isLoaded && (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    )}
                    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {formatSize(model.size)}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 mb-3">{model.description}</p>
                  
                  <div className="flex flex-wrap gap-2">
                    {model.capabilities.map((capability) => (
                      <div
                        key={capability}
                        className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full"
                      >
                        {getCapabilityIcon(capability)}
                        <span className="capitalize">
                          {capability.replace('-', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="ml-4">
                  {isLoaded ? (
                    <button
                      onClick={() => handleUnloadModel(model.name)}
                      disabled={isLoadingModel}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isLoadingModel ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Unload
                    </button>
                  ) : (
                    <button
                      onClick={() => handleLoadModel(model.name)}
                      disabled={isLoadingModel}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isLoadingModel ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Load
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {availableModels.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-500">
          <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No AI models available</p>
        </div>
      )}
    </div>
  );
};

export default ModelManager;