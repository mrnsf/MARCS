import React, { useState, useCallback } from 'react';
import { Upload, FileText, Eye, BarChart3, Trash2, FolderOpen, HardDrive, Download, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { formatBytes, formatDate } from '../../lib/utils';
import { useFileSystem, FileSystemFile } from '../../lib/fileSystem';
import { analyzeDocument, DocumentAnalysis } from '../../lib/documentAnalyzer';
import type { DocumentData } from '../../lib/storage/types';

interface DocumentProcessorProps {
  documents: DocumentData[];
  onUpload: (files: FileList) => void;
  onDelete: (id: string) => void;
  onAnalyze: (id: string) => void;
  onView: (document: DocumentData) => void;
  isProcessing: boolean;
  onFileSystemUpload?: (files: FileSystemFile[]) => void;
  onDirectoryUpload?: (directory: any) => void;
}

export function DocumentProcessor({
  documents,
  isProcessing,
  onUpload,
  onDelete,
  onAnalyze,
  onView,
  onFileSystemUpload,
  onDirectoryUpload
}: DocumentProcessorProps) {
  const [dragActive, setDragActive] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const { isSupported, pickFiles, pickDirectory, saveFile } = useFileSystem();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUpload(e.dataTransfer.files);
    }
  }, [onUpload]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files);
    }
  }, [onUpload]);

  const handleFileSystemPick = useCallback(async () => {
    try {
      const files = await pickFiles({
        types: [{
          description: 'Documents',
          accept: {
            'text/plain': ['.txt'],
            'text/markdown': ['.md'],
            'application/pdf': ['.pdf'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'text/html': ['.html'],
            'application/json': ['.json']
          }
        }],
        multiple: true
      });

      if (files.length > 0 && onFileSystemUpload) {
        onFileSystemUpload(files);
      }
    } catch (error) {
      console.error('Error picking files:', error);
    }
  }, [pickFiles, onFileSystemUpload]);

  const handleDirectoryPick = useCallback(async () => {
    try {
      const directory = await pickDirectory({ mode: 'read' });
      if (onDirectoryUpload) {
        onDirectoryUpload(directory);
      }
    } catch (error) {
      console.error('Error picking directory:', error);
    }
  }, [pickDirectory, onDirectoryUpload]);

  const handleAnalyzeDocument = useCallback(async (doc: DocumentData) => {
    onAnalyze(doc.id);
  }, [onAnalyze]);

  const handleExportDocument = useCallback(async (doc: DocumentData) => {
    try {
      await saveFile(doc.content, doc.name, doc.type);
    } catch (error) {
      console.error('Error exporting document:', error);
    }
  }, [saveFile]);

  return (
    <div className="h-full flex flex-col">
      {/* Upload area */}
      <div className="p-6 border-b">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-gray-400"
          } ${isProcessing && 'opacity-50 pointer-events-none'}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-900 mb-2">
            Drop files here or choose upload method
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Supports PDF, DOC, DOCX, TXT, MD, HTML, JSON files
          </p>
          
          <div className="flex flex-wrap gap-3 justify-center">
            {/* Traditional file input */}
            <div>
              <input
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt,.md,.html,.json"
                onChange={handleFileInput}
                className="hidden"
                id="file-upload"
                disabled={isProcessing}
              />
              <label htmlFor="file-upload">
                <Button disabled={isProcessing} className="cursor-pointer">
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Choose Files
                    </>
                  )}
                </Button>
              </label>
            </div>

            {/* File System Access API buttons */}
            {isSupported && (
              <>
                <Button
                  onClick={handleFileSystemPick}
                  variant="outline"
                  disabled={isProcessing}
                >
                  <HardDrive className="h-4 w-4 mr-2" />
                  Pick Files
                </Button>
                <Button
                  onClick={handleDirectoryPick}
                  variant="outline"
                  disabled={isProcessing}
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Pick Folder
                </Button>
              </>
            )}
          </div>

          {!isSupported && (
            <p className="text-xs text-gray-400 mt-2">
              Advanced file system features require a modern browser
            </p>
          )}
        </div>
      </div>

      {/* Documents list */}
      <div className="flex-1 overflow-y-auto p-6">
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Documents</h3>
            <p className="text-muted-foreground max-w-md">
              Upload documents to analyze them with AI. All processing happens locally
              on your device.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {documents.map((document) => (
              <DocumentCard
                key={document.id}
                document={document}
                onDelete={() => onDelete(document.id)}
                onAnalyze={() => handleAnalyzeDocument(document)}
                onView={() => onView(document)}
                onExport={handleExportDocument}
                isAnalyzing={analyzing === document.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface DocumentCardProps {
  document: DocumentData;
  onDelete: () => void;
  onAnalyze: () => void;
  onView: () => void;
  onExport?: (doc: DocumentData) => void;
  isAnalyzing: boolean;
}

function DocumentCard({ document, onDelete, onAnalyze, onView, onExport, isAnalyzing }: DocumentCardProps) {
  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('doc')) return '📝';
    if (type.includes('text') || type.includes('markdown')) return '📋';
    return '📄';
  };

  // Extract metadata fields
  const summary = document.metadata?.summary as string | undefined;
  const analysis = document.metadata?.analysis as DocumentAnalysis | undefined;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">{getFileIcon(document.type)}</span>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm truncate">{document.name}</CardTitle>
              <div className="text-xs text-gray-500">
                {formatBytes(document.size)} • {formatDate(new Date(document.created))}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {summary && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {summary}
          </p>
        )}

        {analysis && typeof analysis === 'object' && 'wordCount' in analysis && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Words: {analysis.wordCount}</div>
              <div>Reading: {analysis.readingTime}min</div>
              <div>Language: {analysis.language}</div>
              <div>Sentiment: {analysis.sentiment}</div>
            </div>
            {analysis.keywords && analysis.keywords.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-gray-500 mb-1">Keywords:</div>
                <div className="flex flex-wrap gap-1">
                  {analysis.keywords.slice(0, 5).map((keyword, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onView} className="flex-1">
            <Eye className="h-3 w-3 mr-1" />
            View
          </Button>
          <Button size="sm" variant="outline" onClick={onAnalyze} className="flex-1" disabled={isAnalyzing}>
            {isAnalyzing ? (
              <>
                <div className="h-3 w-3 mr-1 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                Analyzing
              </>
            ) : (
              <>
                <BarChart3 className="h-3 w-3 mr-1" />
                Analyze
              </>
            )}
          </Button>
          {onExport && (
            <Button size="sm" variant="outline" onClick={() => onExport(document)}>
              <Download className="h-3 w-3 mr-1" />
              Export
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onDelete} className="text-red-600 hover:text-red-700">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}