// Storage interfaces and types
export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
  has(key: string): Promise<boolean>;
}

export interface DatabaseAdapter {
  initialize(): Promise<void>;
  execute(sql: string, params?: any[]): Promise<any>;
  query(sql: string, params?: any[]): Promise<any[]>;
  close(): Promise<void>;
  isInitialized(): boolean;
}

// Chat and conversation storage
export interface ConversationData {
  id: string;
  title: string;
  messages: ChatMessageData[];
  model: string;
  created: number;
  updated: number;
  metadata?: Record<string, any>;
}

export interface ChatMessageData {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

// Note storage (primary content type for note-taking)
export interface NoteData {
  id: string;
  title: string;
  content: string;        // Markdown content
  summary?: string;       // AI-generated summary
  tags: string[];
  folder?: string;
  created: number;        // timestamp
  updated: number;        // timestamp
  wordCount: number;
  metadata: {
    summaryGenerated?: number;     // timestamp
    summaryModel?: string;
    summaryLength?: 'short' | 'medium' | 'detailed';
    [key: string]: any;
  };
}

// Document storage (uploaded files)
export interface DocumentData {
  id: string;
  name: string;
  content: string;
  type: string;
  size: number;
  created: number;
  updated: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

// Model and AI data storage
export interface ModelData {
  id: string;
  name: string;
  description: string;
  version: string;
  size: number;
  format: string;
  capabilities: string[];
  downloaded: boolean;
  lastUsed?: number;
  performanceMetrics?: {
    averageLatency: number;
    totalInferences: number;
    averageTokensPerSecond: number;
  };
}

// User preferences and settings
export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  defaultModel: string;
  maxTokens: number;
  temperature: number;
  autoSave: boolean;
  offlineMode: boolean;
  notifications: boolean;
  privacy: {
    storeConversations: boolean;
    storeDocuments: boolean;
    shareAnalytics: boolean;
  };
}

// File system integration
export interface FileData {
  id: string;
  name: string;
  path: string;
  content: string | ArrayBuffer;
  type: string;
  size: number;
  lastModified: number;
  metadata?: Record<string, any>;
}

// Search and indexing
export interface SearchIndex {
  id: string;
  type: 'note' | 'conversation' | 'document' | 'file';
  title: string;
  content: string;
  keywords: string[];
  created: number;
  updated: number;
}

// Storage configuration
export interface StorageConfig {
  indexedDB: {
    name: string;
    version: number;
    stores: string[];
  };
  sqlite: {
    filename: string;
    memory: boolean;
  };
  cache: {
    maxSize: number;
    ttl: number;
  };
}

// Storage events
export interface StorageEvent {
  type: 'create' | 'update' | 'delete' | 'clear';
  store: string;
  key: string;
  data?: any;
  timestamp: number;
}

export type StorageEventListener = (event: StorageEvent) => void;

// Query and filtering
export interface QueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filter?: Record<string, any>;
}

export interface SearchOptions extends QueryOptions {
  query: string;
  fields?: string[];
  fuzzy?: boolean;
  highlight?: boolean;
}

// Backup and sync
export interface BackupData {
  version: string;
  timestamp: number;
  notes: NoteData[];
  conversations: ConversationData[];
  documents: DocumentData[];
  settings: UserSettings;
  models: ModelData[];
}

export interface SyncStatus {
  lastSync: number;
  pending: number;
  conflicts: number;
  status: 'idle' | 'syncing' | 'error';
}