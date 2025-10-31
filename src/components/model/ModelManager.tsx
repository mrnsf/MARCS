import React, { useState } from 'react';
import { Brain, Download, CheckCircle, AlertCircle, Loader2, Settings, Info } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { cn, formatBytes } from '../../lib/utils';
import type { ModelConfig, ModelPerformanceMetrics } from '../../lib/ai/types';

interface ModelManagerProps {
  availableModels: ModelConfig[];
  currentModel: string | null;
  modelMetrics: Record<string, ModelPerformanceMetrics>;
  isLoading: boolean;
  onSelectModel: (modelId: string) => void;
  onDownloadModel: (modelId: string) => void;
  onUnloadModel: (modelId: string) => void;
}

export function ModelManager({
  availableModels,
  currentModel,
  modelMetrics,
  isLoading,
  onSelectModel,
  onDownloadModel,
  onUnloadModel
}: ModelManagerProps) {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const getModelStatus = (modelId: string) => {
    if (currentModel === modelId) return 'active';
    if (modelMetrics[modelId]) return 'loaded';
    return 'available';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'loaded':
        return <Brain className="h-4 w-4 text-blue-500" />;
      default:
        return <Download className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'loaded':
        return 'Loaded';
      default:
        return 'Available';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">AI Models</h2>
            <p className="text-muted-foreground">
              Manage your local AI models for offline processing
            </p>
          </div>
          {currentModel && (
            <div className="text-right">
              <div className="text-sm font-medium">Current Model</div>
              <div className="text-lg text-primary">
                {availableModels.find(m => m.id === currentModel)?.name || currentModel}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Models grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {availableModels.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              status={getModelStatus(model.id)}
              metrics={modelMetrics[model.id]}
              isLoading={isLoading}
              isSelected={selectedModel === model.id}
              onSelect={() => setSelectedModel(model.id)}
              onActivate={() => onSelectModel(model.id)}
              onDownload={() => onDownloadModel(model.id)}
              onUnload={() => onUnloadModel(model.id)}
            />
          ))}
        </div>
      </div>

      {/* Model details panel */}
      {selectedModel && (
        <ModelDetailsPanel
          model={availableModels.find(m => m.id === selectedModel)!}
          metrics={modelMetrics[selectedModel]}
          onClose={() => setSelectedModel(null)}
        />
      )}
    </div>
  );
}

interface ModelCardProps {
  model: ModelConfig;
  status: 'active' | 'loaded' | 'available';
  metrics?: ModelPerformanceMetrics;
  isLoading: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onActivate: () => void;
  onDownload: () => void;
  onUnload: () => void;
}

function ModelCard({
  model,
  status,
  metrics,
  isLoading,
  isSelected,
  onSelect,
  onActivate,
  onDownload,
  onUnload
}: ModelCardProps) {
  const getCapabilityBadge = (capability: string) => {
    const colors = {
      'text-generation': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'chat': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'analysis': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'embedding': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
    };
    
    return (
      <span
        key={capability}
        className={cn(
          'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
          colors[capability as keyof typeof colors] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
        )}
      >
        {capability}
      </span>
    );
  };

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isSelected && 'ring-2 ring-primary',
        status === 'active' && 'border-green-500'
      )}
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <Brain className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">{model.name}</CardTitle>
              <CardDescription className="text-sm">
                {formatBytes(model.size)} • {model.quantization}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            {getStatusIcon(status)}
            <span className="text-xs font-medium">{getStatusText(status)}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {model.description}
        </p>

        <div className="flex flex-wrap gap-1">
          {model.capabilities.map(getCapabilityBadge)}
        </div>

        {metrics && (
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Avg Response: {metrics.averageResponseTime.toFixed(0)}ms</div>
            <div>Memory: {formatBytes(metrics.memoryUsage)}</div>
          </div>
        )}

        <div className="flex space-x-2 pt-2">
          {status === 'available' ? (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Download className="h-3 w-3 mr-1" />
              )}
              Download
            </Button>
          ) : status === 'loaded' ? (
            <>
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onActivate();
                }}
                disabled={isLoading}
                className="flex-1"
              >
                Activate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onUnload();
                }}
                disabled={isLoading}
              >
                Unload
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              disabled
              className="flex-1"
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Active
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ModelDetailsPanelProps {
  model: ModelConfig;
  metrics?: ModelPerformanceMetrics;
  onClose: () => void;
}

function ModelDetailsPanel({ model, metrics, onClose }: ModelDetailsPanelProps) {
  return (
    <div className="border-t bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Model Details</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          ×
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium mb-2">Information</h4>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Name:</dt>
              <dd>{model.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Size:</dt>
              <dd>{formatBytes(model.size)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Format:</dt>
              <dd>{model.format}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Quantization:</dt>
              <dd>{model.quantization}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Token Limit:</dt>
              <dd>{model.tokenLimit?.toLocaleString() || 'N/A'}</dd>
            </div>
          </dl>
        </div>

        {metrics && (
          <div>
            <h4 className="font-medium mb-2">Performance</h4>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Total Inferences:</dt>
                <dd>{metrics.totalInferences}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Avg Response Time:</dt>
                <dd>{metrics.averageResponseTime.toFixed(2)}ms</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Memory Usage:</dt>
                <dd>{formatBytes(metrics.memoryUsage)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last Used:</dt>
                <dd>{new Date(metrics.lastUsed).toLocaleString()}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}