// Main Storage Manager
export { StorageManager, getStorageManager, resetStorageManager } from './storageManager';

// Storage Adapters
export { IndexedDBAdapter } from './indexedDBAdapter';
export { SQLiteAdapter } from './sqliteAdapter';

// Types
export type {
  StorageAdapter,
  DatabaseAdapter,
  ConversationData,
  ChatMessageData,
  DocumentData,
  ModelData,
  UserSettings,
  FileData,
  SearchIndex,
  StorageConfig,
  StorageEvent,
  StorageEventListener,
  QueryOptions,
  SearchOptions,
  BackupData,
  SyncStatus
} from './types';