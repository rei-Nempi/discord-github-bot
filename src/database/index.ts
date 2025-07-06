import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { createLogger } from '../utils/logger.js';
import { DatabaseError } from '../types/index.js';
import fs from 'fs';
import path from 'path';

const logger = createLogger('database');

export class DatabaseManager {
  private db: Database | null = null;
  private dbPath: string;

  constructor(dbPath: string = './data/bot.db') {
    // Railway環境またはNODE_ENV=productionではインメモリDBを使用
    if (process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production') {
      this.dbPath = ':memory:';
      logger.info('Using in-memory database for production environment');
    } else {
      this.dbPath = dbPath;
    }
  }

  async initialize(): Promise<void> {
    try {
      // データベースディレクトリの作成（インメモリDBの場合はスキップ）
      if (this.dbPath !== ':memory:') {
        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
          logger.info(`Created database directory: ${dbDir}`);
        }
      }

      // データベース接続
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database
      });

      logger.info(`Database connected: ${this.dbPath}`);

      // スキーマの初期化
      await this.initializeSchema();
      
      // データベースの最適化
      await this.optimizeDatabase();

      logger.info('Database initialization completed');
    } catch (error) {
      logger.error('Database initialization failed:', error);
      throw new DatabaseError('Failed to initialize database', error);
    }
  }

  private async initializeSchema(): Promise<void> {
    try {
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schema = fs.readFileSync(schemaPath, 'utf8');
      
      // スキーマを実行
      await this.db!.exec(schema);
      logger.info('Database schema initialized');
    } catch (error) {
      logger.error('Schema initialization failed:', error);
      throw new DatabaseError('Failed to initialize database schema', error);
    }
  }

  private async optimizeDatabase(): Promise<void> {
    try {
      // WALモードの有効化（並行アクセスの改善）
      await this.db!.exec('PRAGMA journal_mode = WAL');
      
      // 外部キー制約の有効化
      await this.db!.exec('PRAGMA foreign_keys = ON');
      
      // 同期設定の最適化
      await this.db!.exec('PRAGMA synchronous = NORMAL');
      
      // キャッシュサイズの設定
      await this.db!.exec('PRAGMA cache_size = 10000');
      
      logger.info('Database optimization completed');
    } catch (error) {
      logger.error('Database optimization failed:', error);
      throw new DatabaseError('Failed to optimize database', error);
    }
  }

  async getDatabase(): Promise<Database> {
    if (!this.db) {
      await this.initialize();
    }
    return this.db!;
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      logger.info('Database connection closed');
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.db) {
        return false;
      }
      
      const result = await this.db.get('SELECT 1 as test');
      return result && result.test === 1;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }

  async vacuum(): Promise<void> {
    try {
      if (!this.db) {
        throw new DatabaseError('Database not initialized');
      }
      
      await this.db.exec('VACUUM');
      logger.info('Database vacuum completed');
    } catch (error) {
      logger.error('Database vacuum failed:', error);
      throw new DatabaseError('Failed to vacuum database', error);
    }
  }

  async getStats(): Promise<{
    dbSize: number;
    tableCount: number;
    indexCount: number;
    connectionStatus: boolean;
  }> {
    try {
      if (!this.db) {
        throw new DatabaseError('Database not initialized');
      }

      const dbSize = this.dbPath === ':memory:' ? 0 : fs.statSync(this.dbPath).size;
      
      const tables = await this.db.all(
        "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'"
      );
      
      const indexes = await this.db.all(
        "SELECT COUNT(*) as count FROM sqlite_master WHERE type='index'"
      );

      const connectionStatus = await this.healthCheck();

      return {
        dbSize,
        tableCount: tables[0].count,
        indexCount: indexes[0].count,
        connectionStatus
      };
    } catch (error) {
      logger.error('Failed to get database stats:', error);
      throw new DatabaseError('Failed to get database statistics', error);
    }
  }

  async cleanupExpiredCache(): Promise<void> {
    try {
      if (!this.db) {
        throw new DatabaseError('Database not initialized');
      }

      const result = await this.db.run(
        'DELETE FROM issues WHERE expires_at < datetime("now")'
      );

      if (result.changes && result.changes > 0) {
        logger.info(`Cleaned up ${result.changes} expired cache entries`);
      }
    } catch (error) {
      logger.error('Cache cleanup failed:', error);
      throw new DatabaseError('Failed to cleanup expired cache', error);
    }
  }
}

// シングルトンインスタンス
let dbManager: DatabaseManager | null = null;

export function getDatabaseManager(): DatabaseManager {
  if (!dbManager) {
    const dbPath = process.env.DATABASE_PATH || './data/bot.db';
    dbManager = new DatabaseManager(dbPath);
  }
  return dbManager;
}

export async function initializeDatabase(): Promise<void> {
  const db = getDatabaseManager();
  await db.initialize();
}

export async function closeDatabase(): Promise<void> {
  if (dbManager) {
    await dbManager.close();
    dbManager = null;
  }
}