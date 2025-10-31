// File System Access API utilities for local document processing

export interface FileSystemFile {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  content: string | ArrayBuffer;
  handle?: FileSystemFileHandle;
}

export interface FileSystemDirectory {
  name: string;
  handle: FileSystemDirectoryHandle;
  files: FileSystemFile[];
  subdirectories: FileSystemDirectory[];
}

export interface FilePickerOptions {
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
  excludeAcceptAllOption?: boolean;
  multiple?: boolean;
}

export interface DirectoryPickerOptions {
  mode?: 'read' | 'readwrite';
}

class FileSystemManager {
  private isSupported: boolean;

  constructor() {
    this.isSupported = 'showOpenFilePicker' in window && 'showDirectoryPicker' in window;
  }

  public isFileSystemAccessSupported(): boolean {
    return this.isSupported;
  }

  // Pick single or multiple files
  public async pickFiles(options: FilePickerOptions = {}): Promise<FileSystemFile[]> {
    if (!this.isSupported) {
      throw new Error('File System Access API is not supported');
    }

    try {
      const defaultOptions: FilePickerOptions = {
        types: [
          {
            description: 'Text files',
            accept: {
              'text/plain': ['.txt'],
              'text/markdown': ['.md'],
              'application/pdf': ['.pdf'],
              'application/msword': ['.doc'],
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
            }
          }
        ],
        multiple: true,
        ...options
      };

      const fileHandles = await (window as any).showOpenFilePicker(defaultOptions);
      const files: FileSystemFile[] = [];

      for (const handle of fileHandles) {
        const file = await handle.getFile();
        const content = await this.readFileContent(file);
        
        files.push({
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          content,
          handle
        });
      }

      return files;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return []; // User cancelled
      }
      throw error;
    }
  }

  // Pick a directory
  public async pickDirectory(options: DirectoryPickerOptions = {}): Promise<FileSystemDirectory> {
    if (!this.isSupported) {
      throw new Error('File System Access API is not supported');
    }

    try {
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: options.mode || 'read'
      });

      return await this.readDirectory(dirHandle);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error('Directory selection cancelled');
      }
      throw error;
    }
  }

  // Save a file
  public async saveFile(
    content: string | ArrayBuffer,
    suggestedName: string = 'document.txt',
    type: string = 'text/plain'
  ): Promise<void> {
    if (!this.isSupported) {
      // Fallback to download
      this.downloadFile(content, suggestedName, type);
      return;
    }

    try {
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [{
          description: 'Text files',
          accept: { [type]: [this.getFileExtension(suggestedName)] }
        }]
      });

      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return; // User cancelled
      }
      throw error;
    }
  }

  // Read directory contents recursively
  private async readDirectory(dirHandle: FileSystemDirectoryHandle): Promise<FileSystemDirectory> {
    const files: FileSystemFile[] = [];
    const subdirectories: FileSystemDirectory[] = [];

    for await (const [name, handle] of (dirHandle as any).entries()) {
      if (handle.kind === 'file') {
        try {
          const file = await handle.getFile();
          const content = await this.readFileContent(file);
          
          files.push({
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            content,
            handle
          });
        } catch (error) {
          console.warn(`Failed to read file ${name}:`, error);
        }
      } else if (handle.kind === 'directory') {
        try {
          const subdir = await this.readDirectory(handle);
          subdirectories.push(subdir);
        } catch (error) {
          console.warn(`Failed to read directory ${name}:`, error);
        }
      }
    }

    return {
      name: dirHandle.name,
      handle: dirHandle,
      files,
      subdirectories
    };
  }

  // Read file content based on type
  private async readFileContent(file: File): Promise<string | ArrayBuffer> {
    if (file.type.startsWith('text/') || 
        file.type === 'application/json' ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.txt')) {
      return await file.text();
    } else if (file.type === 'application/pdf') {
      // For PDF files, return as ArrayBuffer for processing
      return await file.arrayBuffer();
    } else {
      // For other files, try to read as text first
      try {
        return await file.text();
      } catch {
        return await file.arrayBuffer();
      }
    }
  }

  // Fallback download method
  private downloadFile(content: string | ArrayBuffer, filename: string, type: string): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }

  // Get file extension from filename
  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(lastDot) : '.txt';
  }

  // Check if a file handle has write permission
  public async verifyPermission(fileHandle: FileSystemFileHandle, readWrite: boolean = false): Promise<boolean> {
    const options: any = {};
    if (readWrite) {
      options.mode = 'readwrite';
    }

    // Check if permission was already granted
    if ((await (fileHandle as any).queryPermission(options)) === 'granted') {
      return true;
    }

    // Request permission
    if ((await (fileHandle as any).requestPermission(options)) === 'granted') {
      return true;
    }

    return false;
  }

  // Watch for file changes (if supported)
  public async watchFile(fileHandle: FileSystemFileHandle, callback: (file: File) => void): Promise<() => void> {
    if (!('createSyncAccessHandle' in fileHandle)) {
      throw new Error('File watching is not supported');
    }

    let isWatching = true;
    let lastModified = 0;

    const checkForChanges = async () => {
      if (!isWatching) return;

      try {
        const file = await fileHandle.getFile();
        if (file.lastModified > lastModified) {
          lastModified = file.lastModified;
          callback(file);
        }
      } catch (error) {
        console.warn('Error checking file changes:', error);
      }

      if (isWatching) {
        setTimeout(checkForChanges, 1000); // Check every second
      }
    };

    checkForChanges();

    return () => {
      isWatching = false;
    };
  }
}

// Singleton instance
export const fileSystemManager = new FileSystemManager();

// Utility functions
export const isFileSystemSupported = () => fileSystemManager.isFileSystemAccessSupported();
export const pickFiles = (options?: FilePickerOptions) => fileSystemManager.pickFiles(options);
export const pickDirectory = (options?: DirectoryPickerOptions) => fileSystemManager.pickDirectory(options);
export const saveFile = (content: string | ArrayBuffer, name?: string, type?: string) => 
  fileSystemManager.saveFile(content, name, type);

// React hook for file system operations
export function useFileSystem() {
  const [isSupported] = React.useState(fileSystemManager.isFileSystemAccessSupported());

  const pickFiles = React.useCallback(async (options?: FilePickerOptions) => {
    return fileSystemManager.pickFiles(options);
  }, []);

  const pickDirectory = React.useCallback(async (options?: DirectoryPickerOptions) => {
    return fileSystemManager.pickDirectory(options);
  }, []);

  const saveFile = React.useCallback(async (
    content: string | ArrayBuffer,
    name?: string,
    type?: string
  ) => {
    return fileSystemManager.saveFile(content, name, type);
  }, []);

  return {
    isSupported,
    pickFiles,
    pickDirectory,
    saveFile
  };
}

// Add React import for the hook
import React from 'react';