import type { Database, SqlJsStatic } from 'sql.js';
import { DatabaseAdapter } from './types';

export class SQLiteAdapter implements DatabaseAdapter {
  private SQL: SqlJsStatic | null = null;
  private db: Database | null = null;
  private isMemory: boolean;
  private filename: string;
  private initialized = false;

  constructor(filename: string = 'offline-ai.db', memory: boolean = true) {
    this.filename = filename;
    this.isMemory = memory;
  }

  async initialize(): Promise<void> {
    try {
      console.log('Initializing SQLite adapter...');

      // Initialize sql.js using dynamic import
      const initSqlJs = (await import('sql.js')).default;
      this.SQL = await initSqlJs({
        // WASM files should be in public/sql-wasm/
        locateFile: (file) => `/sql-wasm/${file}`
      });

      // Create or load database
      if (this.isMemory) {
        this.db = new this.SQL.Database();
      } else {
        // Try to load existing database from localStorage
        const savedDb = localStorage.getItem(`sqlite_${this.filename}`);
        if (savedDb) {
          const buffer = new Uint8Array(JSON.parse(savedDb));
          this.db = new this.SQL.Database(buffer);
        } else {
          this.db = new this.SQL.Database();
        }
      }

      // Create tables
      await this.createTables();
      
      this.initialized = true;
      console.log('SQLite adapter initialized successfully');
    } catch (error) {
      console.error('SQLite initialization failed:', error);
      throw new Error(`SQLite initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async execute(sql: string, params: any[] = []): Promise<any> {
    this.ensureInitialized();
    
    try {
      const stmt = this.db!.prepare(sql);
      const result = stmt.run(params);
      stmt.free();
      
      // Save to localStorage if not in memory mode
      if (!this.isMemory) {
        this.saveDatabase();
      }
      
      return result;
    } catch (error) {
      console.error('SQLite execute error:', error);
      throw new Error(`SQL execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    this.ensureInitialized();
    
    try {
      const stmt = this.db!.prepare(sql);
      const results: any[] = [];
      
      while (stmt.step()) {
        const row = stmt.getAsObject();
        results.push(row);
      }
      
      stmt.free();
      return results;
    } catch (error) {
      console.error('SQLite query error:', error);
      throw new Error(`SQL query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      // Save database before closing if not in memory mode
      if (!this.isMemory) {
        this.saveDatabase();
      }
      
      this.db.close();
      this.db = null;
    }
    this.initialized = false;
  }

  isInitialized(): boolean {
    return this.initialized && this.db !== null;
  }

  // Specialized methods for the offline AI app
  async insertConversation(conversation: any): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO conversations 
      (id, title, model, created, updated, metadata, message_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.execute(sql, [
      conversation.id,
      conversation.title,
      conversation.model,
      conversation.created,
      conversation.updated,
      JSON.stringify(conversation.metadata || {}),
      conversation.messages?.length || 0
    ]);

    // Insert messages
    if (conversation.messages && conversation.messages.length > 0) {
      await this.insertMessages(conversation.id, conversation.messages);
    }
  }

  async insertMessages(conversationId: string, messages: any[]): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO messages 
      (id, conversation_id, role, content, timestamp, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    for (const message of messages) {
      await this.execute(sql, [
        message.id,
        conversationId,
        message.role,
        message.content,
        message.timestamp,
        JSON.stringify(message.metadata || {})
      ]);
    }
  }

  async getConversations(limit: number = 50, offset: number = 0): Promise<any[]> {
    const sql = `
      SELECT * FROM conversations 
      ORDER BY updated DESC 
      LIMIT ? OFFSET ?
    `;
    
    const conversations = await this.query(sql, [limit, offset]);
    
    // Load messages for each conversation
    for (const conversation of conversations) {
      conversation.messages = await this.getMessages(conversation.id);
      conversation.metadata = JSON.parse(conversation.metadata || '{}');
    }
    
    return conversations;
  }

  async getMessages(conversationId: string): Promise<any[]> {
    const sql = `
      SELECT * FROM messages 
      WHERE conversation_id = ? 
      ORDER BY timestamp ASC
    `;
    
    const messages = await this.query(sql, [conversationId]);
    return messages.map(msg => ({
      ...msg,
      metadata: JSON.parse(msg.metadata || '{}')
    }));
  }

  async insertDocument(document: any): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO documents 
      (id, name, content, type, size, created, updated, tags, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.execute(sql, [
      document.id,
      document.name,
      document.content,
      document.type,
      document.size,
      document.created,
      document.updated,
      JSON.stringify(document.tags || []),
      JSON.stringify(document.metadata || {})
    ]);
  }

  async searchDocuments(query: string, limit: number = 20): Promise<any[]> {
    const sql = `
      SELECT * FROM documents 
      WHERE name LIKE ? OR content LIKE ? 
      ORDER BY updated DESC 
      LIMIT ?
    `;
    
    const searchTerm = `%${query}%`;
    const documents = await this.query(sql, [searchTerm, searchTerm, limit]);
    
    return documents.map(doc => ({
      ...doc,
      tags: JSON.parse(doc.tags || '[]'),
      metadata: JSON.parse(doc.metadata || '{}')
    }));
  }

  async updateModelMetrics(modelId: string, metrics: any): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO model_metrics 
      (model_id, total_inferences, average_latency, total_tokens, average_tokens_per_second, last_used)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    await this.execute(sql, [
      modelId,
      metrics.totalInferences,
      metrics.averageLatency,
      metrics.totalTokens,
      metrics.averageTokensPerSecond,
      Date.now()
    ]);
  }

  async getModelMetrics(modelId?: string): Promise<any[]> {
    let sql = 'SELECT * FROM model_metrics';
    const params: any[] = [];
    
    if (modelId) {
      sql += ' WHERE model_id = ?';
      params.push(modelId);
    }
    
    sql += ' ORDER BY last_used DESC';
    
    return await this.query(sql, params);
  }

  async getStorageStats(): Promise<any> {
    const stats = {
      conversations: await this.query('SELECT COUNT(*) as count FROM conversations'),
      messages: await this.query('SELECT COUNT(*) as count FROM messages'),
      documents: await this.query('SELECT COUNT(*) as count FROM documents'),
      models: await this.query('SELECT COUNT(*) as count FROM model_metrics'),
      totalSize: 0
    };

    // Calculate approximate database size
    if (!this.isMemory) {
      const data = this.db!.export();
      stats.totalSize = data.length;
    }

    return {
      conversations: stats.conversations[0]?.count || 0,
      messages: stats.messages[0]?.count || 0,
      documents: stats.documents[0]?.count || 0,
      models: stats.models[0]?.count || 0,
      totalSize: stats.totalSize
    };
  }

  private async createTables(): Promise<void> {
    const tables = [
      // Notes table (primary content type)
      `CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        summary TEXT,
        tags TEXT DEFAULT '[]',
        folder TEXT,
        created INTEGER NOT NULL,
        updated INTEGER NOT NULL,
        wordCount INTEGER DEFAULT 0,
        metadata TEXT DEFAULT '{}'
      )`,

      // Conversations table
      `CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        model TEXT,
        created INTEGER NOT NULL,
        updated INTEGER NOT NULL,
        metadata TEXT DEFAULT '{}',
        message_count INTEGER DEFAULT 0
      )`,
      
      // Messages table
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        metadata TEXT DEFAULT '{}',
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      )`,
      
      // Documents table
      `CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT,
        size INTEGER,
        created INTEGER NOT NULL,
        updated INTEGER NOT NULL,
        tags TEXT DEFAULT '[]',
        metadata TEXT DEFAULT '{}'
      )`,
      
      // Model metrics table
      `CREATE TABLE IF NOT EXISTS model_metrics (
        model_id TEXT PRIMARY KEY,
        total_inferences INTEGER DEFAULT 0,
        average_latency REAL DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        average_tokens_per_second REAL DEFAULT 0,
        last_used INTEGER
      )`,
      
      // Search index table
      `CREATE TABLE IF NOT EXISTS search_index (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT,
        content TEXT,
        keywords TEXT,
        created INTEGER NOT NULL,
        updated INTEGER NOT NULL
      )`
    ];

    for (const sql of tables) {
      await this.execute(sql);
    }

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated)',
      'CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created)',
      'CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder)',
      'CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(title)',
      'CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated)',
      'CREATE INDEX IF NOT EXISTS idx_conversations_model ON conversations(model)',
      'CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)',
      'CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_documents_name ON documents(name)',
      'CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type)',
      'CREATE INDEX IF NOT EXISTS idx_documents_updated ON documents(updated)',
      'CREATE INDEX IF NOT EXISTS idx_search_type ON search_index(type)',
      'CREATE INDEX IF NOT EXISTS idx_search_updated ON search_index(updated)'
    ];

    for (const sql of indexes) {
      await this.execute(sql);
    }
  }

  private saveDatabase(): void {
    if (this.db && !this.isMemory) {
      try {
        const data = this.db.export();
        const buffer = Array.from(data);
        localStorage.setItem(`sqlite_${this.filename}`, JSON.stringify(buffer));
      } catch (error) {
        console.error('Failed to save SQLite database:', error);
      }
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.db) {
      throw new Error('SQLite adapter not initialized. Call initialize() first.');
    }
  }

  // Backup and restore methods
  async exportDatabase(): Promise<Uint8Array> {
    this.ensureInitialized();
    return this.db!.export();
  }

  async importDatabase(data: Uint8Array): Promise<void> {
    if (this.SQL) {
      if (this.db) {
        this.db.close();
      }
      this.db = new this.SQL.Database(data);
      
      if (!this.isMemory) {
        this.saveDatabase();
      }
    }
  }
}