import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { StorageAdapter, StorageEvent, StorageEventListener } from './types';

interface OfflineAIDB extends DBSchema {
  notes: {
    key: string;
    value: any;
    indexes: {
      title: string;
      created: number;
      updated: number;
      folder: string;
      tags: string;
    };
  };
  conversations: {
    key: string;
    value: any;
    indexes: {
      created: number;
      updated: number;
      model: string;
    };
  };
  documents: {
    key: string;
    value: any;
    indexes: { 
      name: string; 
      type: string; 
      created: number; 
      tags: string; 
    };
  };
  settings: {
    key: string;
    value: any;
  };
  models: {
    key: string;
    value: any;
    indexes: { 
      name: string; 
      downloaded: boolean; 
      lastUsed: number; 
    };
  };
  files: {
    key: string;
    value: any;
    indexes: { 
      name: string; 
      type: string; 
      lastModified: number; 
    };
  };
  cache: {
    key: string;
    value: any;
    indexes: { 
      timestamp: number; 
    };
  };
}

type StoreNames = 'notes' | 'conversations' | 'documents' | 'settings' | 'models' | 'files' | 'cache';

export class IndexedDBAdapter implements StorageAdapter {
  private db: IDBPDatabase<OfflineAIDB> | null = null;
  private dbName: string;
  private version: number;
  private listeners: Set<StorageEventListener> = new Set();

  constructor(dbName: string = 'OfflineAI', version: number = 1) {
    this.dbName = dbName;
    this.version = version;
  }

  async initialize(): Promise<void> {
    try {
      this.db = await openDB<OfflineAIDB>(this.dbName, this.version, {
        upgrade(db, oldVersion, newVersion, transaction) {
          console.log(`Upgrading IndexedDB from version ${oldVersion} to ${newVersion}`);

          // Create object stores
          if (!db.objectStoreNames.contains('notes')) {
            const noteStore = db.createObjectStore('notes', { keyPath: 'id' });
            noteStore.createIndex('title', 'title');
            noteStore.createIndex('created', 'created');
            noteStore.createIndex('updated', 'updated');
            noteStore.createIndex('folder', 'folder');
            noteStore.createIndex('tags', 'tags', { multiEntry: true });
          }

          if (!db.objectStoreNames.contains('conversations')) {
            const conversationStore = db.createObjectStore('conversations', { keyPath: 'id' });
            conversationStore.createIndex('created', 'created');
            conversationStore.createIndex('updated', 'updated');
            conversationStore.createIndex('model', 'model');
          }

          if (!db.objectStoreNames.contains('documents')) {
            const documentStore = db.createObjectStore('documents', { keyPath: 'id' });
            documentStore.createIndex('name', 'name');
            documentStore.createIndex('type', 'type');
            documentStore.createIndex('created', 'created');
            documentStore.createIndex('tags', 'tags', { multiEntry: true });
          }

          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings');
          }

          if (!db.objectStoreNames.contains('models')) {
            const modelStore = db.createObjectStore('models', { keyPath: 'id' });
            modelStore.createIndex('name', 'name');
            modelStore.createIndex('downloaded', 'downloaded');
            modelStore.createIndex('lastUsed', 'lastUsed');
          }

          if (!db.objectStoreNames.contains('files')) {
            const fileStore = db.createObjectStore('files', { keyPath: 'id' });
            fileStore.createIndex('name', 'name');
            fileStore.createIndex('type', 'type');
            fileStore.createIndex('lastModified', 'lastModified');
          }

          if (!db.objectStoreNames.contains('cache')) {
            const cacheStore = db.createObjectStore('cache');
            cacheStore.createIndex('timestamp', 'timestamp');
          }
        },
        blocked() {
          console.warn('IndexedDB upgrade blocked by another connection');
        },
        blocking() {
          console.warn('IndexedDB blocking another connection upgrade');
        }
      });

      console.log('IndexedDB initialized successfully');
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error);
      throw new Error(`IndexedDB initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    this.ensureInitialized();
    
    try {
      // Parse store and key from composite key
      const { store, actualKey } = this.parseKey(key);
      if (!this.isValidStore(store)) {
        throw new Error(`Invalid store name: ${store}`);
      }
      const result = await this.db!.get(store, actualKey);
      return result || null;
    } catch (error) {
      console.error('IndexedDB get error:', error);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.ensureInitialized();
    
    try {
      const { store, actualKey } = this.parseKey(key);
      if (!this.isValidStore(store)) {
        throw new Error(`Invalid store name: ${store}`);
      }
      
      // Add metadata for tracking
      const dataWithMetadata = {
        ...value,
        id: actualKey,
        _stored: Date.now()
      };

      await this.db!.put(store, dataWithMetadata);
      
      // Emit storage event
      this.emitEvent({
        type: 'create',
        store,
        key: actualKey,
        data: value,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('IndexedDB set error:', error);
      throw new Error(`Failed to store data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async delete(key: string): Promise<void> {
    this.ensureInitialized();
    
    try {
      const { store, actualKey } = this.parseKey(key);
      if (!this.isValidStore(store)) {
        throw new Error(`Invalid store name: ${store}`);
      }
      await this.db!.delete(store, actualKey);
      
      // Emit storage event
      this.emitEvent({
        type: 'delete',
        store,
        key: actualKey,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('IndexedDB delete error:', error);
      throw new Error(`Failed to delete data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async clear(): Promise<void> {
    this.ensureInitialized();
    
    try {
      const stores: StoreNames[] = ['notes', 'conversations', 'documents', 'settings', 'models', 'files', 'cache'];
      
      for (const store of stores) {
        await this.db!.clear(store);
      }
      
      // Emit storage event
      this.emitEvent({
        type: 'clear',
        store: 'all',
        key: '',
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('IndexedDB clear error:', error);
      throw new Error(`Failed to clear storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async keys(): Promise<string[]> {
    this.ensureInitialized();
    
    try {
      const allKeys: string[] = [];
      const stores: StoreNames[] = ['notes', 'conversations', 'documents', 'settings', 'models', 'files', 'cache'];
      
      for (const store of stores) {
        const storeKeys = await this.db!.getAllKeys(store);
        allKeys.push(...storeKeys.map(key => `${store}:${key}`));
      }
      
      return allKeys;
    } catch (error) {
      console.error('IndexedDB keys error:', error);
      return [];
    }
  }

  async has(key: string): Promise<boolean> {
    this.ensureInitialized();
    
    try {
      const { store, actualKey } = this.parseKey(key);
      if (!this.isValidStore(store)) {
        return false;
      }
      const result = await this.db!.get(store, actualKey);
      return result !== undefined;
    } catch (error) {
      console.error('IndexedDB has error:', error);
      return false;
    }
  }

  // Additional IndexedDB-specific methods
  async getAllFromStore<T>(storeName: StoreNames): Promise<T[]> {
    this.ensureInitialized();
    
    try {
      return await this.db!.getAll(storeName);
    } catch (error) {
      console.error(`IndexedDB getAllFromStore error for ${storeName}:`, error);
      return [];
    }
  }

  async getByIndex<T>(storeName: StoreNames, indexName: string, value: any): Promise<T[]> {
    this.ensureInitialized();
    
    try {
      // Use transaction to access index
      const tx = this.db!.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      
      // Cast to any to bypass TypeScript index name checking
      const index = (store as any).index(indexName);
      const results = await index.getAll(value);
      return results;
    } catch (error) {
      console.error(`IndexedDB getByIndex error for ${storeName}.${indexName}:`, error);
      return [];
    }
  }

  async count(storeName: StoreNames): Promise<number> {
    this.ensureInitialized();
    
    try {
      return await this.db!.count(storeName);
    } catch (error) {
      console.error(`IndexedDB count error for ${storeName}:`, error);
      return 0;
    }
  }

  async cleanupCache(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    this.ensureInitialized();
    
    try {
      const cutoff = Date.now() - maxAge;
      const tx = this.db!.transaction('cache', 'readwrite');
      const store = tx.objectStore('cache');
      
      // Get all cache entries and filter by timestamp
      const allEntries = await store.getAll();
      const expiredKeys: string[] = [];
      
      for (const entry of allEntries) {
        if (entry.timestamp && entry.timestamp < cutoff) {
          // Find the key for this entry
          const cursor = await store.openCursor();
          if (cursor && cursor.value === entry) {
            expiredKeys.push(cursor.key as string);
          }
        }
      }
      
      // Delete expired entries
      for (const key of expiredKeys) {
        await store.delete(key);
      }
      
      await tx.done;
      console.log(`Cleaned up ${expiredKeys.length} expired cache entries`);
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }

  // Event handling
  addEventListener(listener: StorageEventListener): void {
    this.listeners.add(listener);
  }

  removeEventListener(listener: StorageEventListener): void {
    this.listeners.delete(listener);
  }

  private emitEvent(event: StorageEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Storage event listener error:', error);
      }
    });
  }

  private parseKey(key: string): { store: StoreNames; actualKey: string } {
    const parts = key.split(':');
    if (parts.length < 2) {
      throw new Error(`Invalid key format: ${key}. Expected format: store:key`);
    }
    
    const store = parts[0] as StoreNames;
    const actualKey = parts.slice(1).join(':');
    
    if (!this.isValidStore(store)) {
      throw new Error(`Invalid store name: ${store}`);
    }
    
    return { store, actualKey };
  }

  private isValidStore(store: string): store is StoreNames {
    const validStores: StoreNames[] = ['notes', 'conversations', 'documents', 'settings', 'models', 'files', 'cache'];
    return validStores.includes(store as StoreNames);
  }

  private ensureInitialized(): void {
    if (!this.db) {
      throw new Error('IndexedDB not initialized. Call initialize() first.');
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}