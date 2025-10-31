import { IndexedDBAdapter } from './indexedDBAdapter';
import { SQLiteAdapter } from './sqliteAdapter';
import {
  StorageConfig,
  NoteData,
  ConversationData,
  ChatMessageData,
  DocumentData,
  UserSettings,
  ModelData,
  FileData,
  QueryOptions,
  SearchOptions,
  BackupData,
  StorageEventListener
} from './types';

export class StorageManager {
  private indexedDB: IndexedDBAdapter;
  private sqlite: SQLiteAdapter;
  private config: StorageConfig;
  private initialized = false;

  constructor(config?: Partial<StorageConfig>) {
    this.config = {
      indexedDB: {
        name: 'OfflineAI',
        version: 1,
        stores: ['notes', 'conversations', 'documents', 'settings', 'models', 'files', 'cache']
      },
      sqlite: {
        filename: 'offline-ai.db',
        memory: false
      },
      cache: {
        maxSize: 100 * 1024 * 1024, // 100MB
        ttl: 24 * 60 * 60 * 1000 // 24 hours
      },
      ...config
    };

    this.indexedDB = new IndexedDBAdapter(this.config.indexedDB.name, this.config.indexedDB.version);
    this.sqlite = new SQLiteAdapter(this.config.sqlite.filename, this.config.sqlite.memory);
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing Storage Manager...');
      
      // Initialize both storage adapters
      await Promise.all([
        this.indexedDB.initialize(),
        this.sqlite.initialize()
      ]);

      // Set up periodic cache cleanup
      this.setupCacheCleanup();
      
      this.initialized = true;
      console.log('Storage Manager initialized successfully');
    } catch (error) {
      console.error('Storage Manager initialization failed:', error);
      throw new Error(`Storage Manager initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Conversation Management
  async saveConversation(conversation: ConversationData): Promise<void> {
    this.ensureInitialized();
    
    try {
      // Save to both IndexedDB and SQLite for redundancy
      await Promise.all([
        this.indexedDB.set(`conversations:${conversation.id}`, conversation),
        this.sqlite.insertConversation(conversation)
      ]);
    } catch (error) {
      console.error('Failed to save conversation:', error);
      throw new Error(`Failed to save conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getConversation(id: string): Promise<ConversationData | null> {
    this.ensureInitialized();
    
    try {
      // Try IndexedDB first (faster for single records)
      let conversation = await this.indexedDB.get<ConversationData>(`conversations:${id}`);
      
      // Fallback to SQLite if not found
      if (!conversation) {
        const conversations = await this.sqlite.query(
          'SELECT * FROM conversations WHERE id = ?', 
          [id]
        );
        if (conversations.length > 0) {
          conversation = conversations[0];
          conversation.messages = await this.sqlite.getMessages(id);
        }
      }
      
      return conversation;
    } catch (error) {
      console.error('Failed to get conversation:', error);
      return null;
    }
  }

  async getConversations(options: QueryOptions = {}): Promise<ConversationData[]> {
    this.ensureInitialized();

    try {
      // Use SQLite for complex queries
      return await this.sqlite.getConversations(options.limit, options.offset);
    } catch (error) {
      console.error('Failed to get conversations:', error);
      // Fallback to IndexedDB
      try {
        return await this.indexedDB.getAllFromStore<ConversationData>('conversations');
      } catch (fallbackError) {
        console.error('Fallback to IndexedDB also failed:', fallbackError);
        return [];
      }
    }
  }

  async getAllConversations(): Promise<ConversationData[]> {
    return this.getConversations();
  }

  async getConversationMessages(id: string): Promise<ChatMessageData[]> {
    this.ensureInitialized();

    try {
      const conversation = await this.getConversation(id);
      return conversation?.messages || [];
    } catch (error) {
      console.error('Failed to get conversation messages:', error);
      return [];
    }
  }

  async clearConversations(): Promise<void> {
    this.ensureInitialized();

    try {
      const conversations = await this.getConversations();
      for (const conversation of conversations) {
        await this.deleteConversation(conversation.id);
      }
    } catch (error) {
      console.error('Failed to clear conversations:', error);
      throw new Error(`Failed to clear conversations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteConversation(id: string): Promise<void> {
    this.ensureInitialized();
    
    try {
      await Promise.all([
        this.indexedDB.delete(`conversations:${id}`),
        this.sqlite.execute('DELETE FROM conversations WHERE id = ?', [id])
      ]);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      throw new Error(`Failed to delete conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Note Management (Primary feature for note-taking)
  async saveNote(note: NoteData): Promise<void> {
    this.ensureInitialized();

    try {
      await Promise.all([
        this.indexedDB.set(`notes:${note.id}`, note),
        this.sqlite.execute(`
          INSERT OR REPLACE INTO notes
          (id, title, content, summary, tags, folder, created, updated, wordCount, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          note.id,
          note.title,
          note.content,
          note.summary || null,
          JSON.stringify(note.tags),
          note.folder || null,
          note.created,
          note.updated,
          note.wordCount,
          JSON.stringify(note.metadata)
        ])
      ]);
    } catch (error) {
      console.error('Failed to save note:', error);
      throw new Error(`Failed to save note: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getNote(id: string): Promise<NoteData | null> {
    this.ensureInitialized();

    try {
      // Try IndexedDB first (faster for single records)
      let note = await this.indexedDB.get<NoteData>(`notes:${id}`);

      // Fallback to SQLite if not found
      if (!note) {
        const notes = await this.sqlite.query(
          'SELECT * FROM notes WHERE id = ?',
          [id]
        );
        if (notes.length > 0) {
          const raw = notes[0];
          note = {
            ...raw,
            tags: JSON.parse(raw.tags || '[]'),
            metadata: JSON.parse(raw.metadata || '{}')
          };
        }
      }

      return note;
    } catch (error) {
      console.error('Failed to get note:', error);
      return null;
    }
  }

  async getNotes(options: QueryOptions = {}): Promise<NoteData[]> {
    this.ensureInitialized();

    try {
      const notes = await this.indexedDB.getAllFromStore<NoteData>('notes');

      // Apply sorting if specified
      if (options.sortBy) {
        notes.sort((a: any, b: any) => {
          const order = options.sortOrder === 'asc' ? 1 : -1;
          return (a[options.sortBy!] > b[options.sortBy!] ? 1 : -1) * order;
        });
      }

      // Apply pagination
      const start = options.offset || 0;
      const end = options.limit ? start + options.limit : undefined;

      return notes.slice(start, end);
    } catch (error) {
      console.error('Failed to get notes:', error);
      return [];
    }
  }

  async getAllNotes(): Promise<NoteData[]> {
    return this.getNotes({ sortBy: 'updated', sortOrder: 'desc' });
  }

  async searchNotes(query: string, limit: number = 50): Promise<NoteData[]> {
    this.ensureInitialized();

    try {
      const allNotes = await this.getNotes();
      const searchLower = query.toLowerCase();

      // Simple client-side search
      const results = allNotes.filter(note =>
        note.title.toLowerCase().includes(searchLower) ||
        note.content.toLowerCase().includes(searchLower) ||
        note.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );

      return results.slice(0, limit);
    } catch (error) {
      console.error('Failed to search notes:', error);
      return [];
    }
  }

  async getNotesByTag(tag: string): Promise<NoteData[]> {
    this.ensureInitialized();

    try {
      const allNotes = await this.getNotes();
      return allNotes.filter(note => note.tags.includes(tag));
    } catch (error) {
      console.error('Failed to get notes by tag:', error);
      return [];
    }
  }

  async getNotesByFolder(folder: string): Promise<NoteData[]> {
    this.ensureInitialized();

    try {
      const allNotes = await this.getNotes();
      return allNotes.filter(note => note.folder === folder);
    } catch (error) {
      console.error('Failed to get notes by folder:', error);
      return [];
    }
  }

  async deleteNote(id: string): Promise<void> {
    this.ensureInitialized();

    try {
      await Promise.all([
        this.indexedDB.delete(`notes:${id}`),
        this.sqlite.execute('DELETE FROM notes WHERE id = ?', [id])
      ]);
    } catch (error) {
      console.error('Failed to delete note:', error);
      throw new Error(`Failed to delete note: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async clearNotes(): Promise<void> {
    this.ensureInitialized();

    try {
      const notes = await this.getNotes();
      for (const note of notes) {
        await this.deleteNote(note.id);
      }
    } catch (error) {
      console.error('Failed to clear notes:', error);
      throw new Error(`Failed to clear notes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Document Management
  async saveDocument(document: DocumentData): Promise<void> {
    this.ensureInitialized();
    
    try {
      await Promise.all([
        this.indexedDB.set(`documents:${document.id}`, document),
        this.sqlite.insertDocument(document)
      ]);
    } catch (error) {
      console.error('Failed to save document:', error);
      throw new Error(`Failed to save document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getDocument(id: string): Promise<DocumentData | null> {
    this.ensureInitialized();
    
    try {
      return await this.indexedDB.get<DocumentData>(`documents:${id}`);
    } catch (error) {
      console.error('Failed to get document:', error);
      return null;
    }
  }

  async getDocuments(options: QueryOptions = {}): Promise<DocumentData[]> {
    this.ensureInitialized();

    try {
      return await this.indexedDB.getAllFromStore<DocumentData>('documents');
    } catch (error) {
      console.error('Failed to get documents:', error);
      return [];
    }
  }

  async getAllDocuments(): Promise<DocumentData[]> {
    return this.getDocuments();
  }

  async searchDocuments(options: SearchOptions): Promise<DocumentData[]> {
    this.ensureInitialized();
    
    try {
      return await this.sqlite.searchDocuments(options.query, options.limit);
    } catch (error) {
      console.error('Failed to search documents:', error);
      return [];
    }
  }

  async deleteDocument(id: string): Promise<void> {
    this.ensureInitialized();
    
    try {
      await Promise.all([
        this.indexedDB.delete(`documents:${id}`),
        this.sqlite.execute('DELETE FROM documents WHERE id = ?', [id])
      ]);
    } catch (error) {
      console.error('Failed to delete document:', error);
      throw new Error(`Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Settings Management
  async saveSettings(settings: UserSettings): Promise<void> {
    this.ensureInitialized();
    
    try {
      await this.indexedDB.set('settings:user', settings);
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw new Error(`Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getSettings(): Promise<UserSettings | null> {
    this.ensureInitialized();
    
    try {
      return await this.indexedDB.get<UserSettings>('settings:user');
    } catch (error) {
      console.error('Failed to get settings:', error);
      return null;
    }
  }

  // Model Management
  async saveModelData(model: ModelData): Promise<void> {
    this.ensureInitialized();
    
    try {
      await Promise.all([
        this.indexedDB.set(`models:${model.id}`, model),
        this.sqlite.updateModelMetrics(model.id, model.performanceMetrics || {})
      ]);
    } catch (error) {
      console.error('Failed to save model data:', error);
      throw new Error(`Failed to save model data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getModelData(id: string): Promise<ModelData | null> {
    this.ensureInitialized();
    
    try {
      return await this.indexedDB.get<ModelData>(`models:${id}`);
    } catch (error) {
      console.error('Failed to get model data:', error);
      return null;
    }
  }

  async getAllModels(): Promise<ModelData[]> {
    this.ensureInitialized();
    
    try {
      return await this.indexedDB.getAllFromStore<ModelData>('models');
    } catch (error) {
      console.error('Failed to get all models:', error);
      return [];
    }
  }

  // File Management
  async saveFile(file: FileData): Promise<void> {
    this.ensureInitialized();
    
    try {
      await this.indexedDB.set(`files:${file.id}`, file);
    } catch (error) {
      console.error('Failed to save file:', error);
      throw new Error(`Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getFile(id: string): Promise<FileData | null> {
    this.ensureInitialized();
    
    try {
      return await this.indexedDB.get<FileData>(`files:${id}`);
    } catch (error) {
      console.error('Failed to get file:', error);
      return null;
    }
  }

  async getFiles(): Promise<FileData[]> {
    this.ensureInitialized();
    
    try {
      return await this.indexedDB.getAllFromStore<FileData>('files');
    } catch (error) {
      console.error('Failed to get files:', error);
      return [];
    }
  }

  async deleteFile(id: string): Promise<void> {
    this.ensureInitialized();
    
    try {
      await this.indexedDB.delete(`files:${id}`);
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Cache Management
  async setCache<T>(key: string, value: T, ttl?: number): Promise<void> {
    this.ensureInitialized();
    
    try {
      const cacheData = {
        data: value,
        timestamp: Date.now(),
        ttl: ttl || this.config.cache.ttl
      };
      
      await this.indexedDB.set(`cache:${key}`, cacheData);
    } catch (error) {
      console.error('Failed to set cache:', error);
    }
  }

  async getCache<T>(key: string): Promise<T | null> {
    this.ensureInitialized();
    
    try {
      const cacheData = await this.indexedDB.get<any>(`cache:${key}`);
      
      if (!cacheData) {
        return null;
      }
      
      // Check if cache has expired
      const now = Date.now();
      if (now - cacheData.timestamp > cacheData.ttl) {
        await this.indexedDB.delete(`cache:${key}`);
        return null;
      }
      
      return cacheData.data;
    } catch (error) {
      console.error('Failed to get cache:', error);
      return null;
    }
  }

  async clearCache(): Promise<void> {
    this.ensureInitialized();
    
    try {
      const keys = await this.indexedDB.keys();
      const cacheKeys = keys.filter(key => key.startsWith('cache:'));
      
      for (const key of cacheKeys) {
        await this.indexedDB.delete(key);
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  // Backup and Export
  async exportData(): Promise<BackupData> {
    this.ensureInitialized();

    try {
      const [notes, conversations, documents, settings, models] = await Promise.all([
        this.getNotes(),
        this.getConversations(),
        this.getDocuments(),
        this.getSettings(),
        this.getAllModels()
      ]);

      return {
        version: '1.0.0',
        timestamp: Date.now(),
        notes,
        conversations,
        documents,
        settings: settings || {} as UserSettings,
        models
      };
    } catch (error) {
      console.error('Failed to export data:', error);
      throw new Error(`Failed to export data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async importData(backup: BackupData): Promise<void> {
    this.ensureInitialized();

    try {
      // Import notes
      for (const note of backup.notes) {
        await this.saveNote(note);
      }

      // Import conversations
      for (const conversation of backup.conversations) {
        await this.saveConversation(conversation);
      }

      // Import documents
      for (const document of backup.documents) {
        await this.saveDocument(document);
      }

      // Import settings
      if (backup.settings) {
        await this.saveSettings(backup.settings);
      }

      // Import models
      for (const model of backup.models) {
        await this.saveModelData(model);
      }
    } catch (error) {
      console.error('Failed to import data:', error);
      throw new Error(`Failed to import data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Statistics and Monitoring
  async getStorageStats(): Promise<any> {
    this.ensureInitialized();
    
    try {
      const [sqliteStats, indexedDBCounts] = await Promise.all([
        this.sqlite.getStorageStats(),
        this.getIndexedDBStats()
      ]);

      return {
        sqlite: sqliteStats,
        indexedDB: indexedDBCounts,
        total: {
          conversations: sqliteStats.conversations,
          documents: sqliteStats.documents,
          models: indexedDBCounts.models,
          files: indexedDBCounts.files,
          cacheEntries: indexedDBCounts.cache
        }
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return null;
    }
  }

  // Event Handling
  addEventListener(listener: StorageEventListener): void {
    this.indexedDB.addEventListener(listener);
  }

  removeEventListener(listener: StorageEventListener): void {
    this.indexedDB.removeEventListener(listener);
  }

  // Cleanup and Maintenance
  async cleanup(): Promise<void> {
    try {
      // Clean up expired cache entries
      await this.indexedDB.cleanupCache(this.config.cache.ttl);
      
      console.log('Storage cleanup completed');
    } catch (error) {
      console.error('Storage cleanup failed:', error);
    }
  }

  async close(): Promise<void> {
    try {
      await Promise.all([
        this.indexedDB.close(),
        this.sqlite.close()
      ]);
      
      this.initialized = false;
    } catch (error) {
      console.error('Failed to close storage:', error);
    }
  }

  private async getIndexedDBStats(): Promise<any> {
    const stats = {
      conversations: await this.indexedDB.count('conversations'),
      documents: await this.indexedDB.count('documents'),
      models: await this.indexedDB.count('models'),
      files: await this.indexedDB.count('files'),
      cache: await this.indexedDB.count('cache')
    };

    return stats;
  }

  private setupCacheCleanup(): void {
    // Clean up cache every hour
    setInterval(() => {
      this.cleanup().catch(console.error);
    }, 60 * 60 * 1000);
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Storage Manager not initialized. Call initialize() first.');
    }
  }
}

// Singleton instance
let storageManagerInstance: StorageManager | null = null;

export function getStorageManager(config?: Partial<StorageConfig>): StorageManager {
  if (!storageManagerInstance) {
    storageManagerInstance = new StorageManager(config);
  }
  return storageManagerInstance;
}

export function resetStorageManager(): void {
  if (storageManagerInstance) {
    storageManagerInstance.close().catch(console.error);
    storageManagerInstance = null;
  }
}