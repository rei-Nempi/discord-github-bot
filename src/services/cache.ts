import NodeCache from 'node-cache';
import { createLogger } from '../utils/logger';
import { getDatabaseManager } from '../database/index';
import { 
  ICacheService, 
  CacheError, 
  CACHE_KEYS, 
  BOT_LIMITS,
  GitHubIssue 
} from '../types/index';

const logger = createLogger('cache-service');

export class CacheService implements ICacheService {
  private memoryCache: NodeCache;
  private defaultTTL: number;
  private stats: {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
  };

  constructor(ttl: number = BOT_LIMITS.CACHE_TTL_SECONDS) {
    this.defaultTTL = ttl;
    this.memoryCache = new NodeCache({
      stdTTL: ttl,
      checkperiod: ttl * 0.2, // 20%の頻度でクリーンアップ
      useClones: false,
      deleteOnExpire: true
    });

    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0
    };

    // イベントリスナーの設定
    this.setupEventListeners();

    logger.info(`Cache service initialized with TTL: ${ttl}s`);
  }

  /**
   * キャッシュからデータを取得
   * メモリキャッシュ → データベースキャッシュの順で確認
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // 1. メモリキャッシュを確認
      const memoryValue = this.memoryCache.get<T>(key);
      if (memoryValue !== undefined) {
        this.stats.hits++;
        logger.debug(`Memory cache hit: ${key}`);
        return memoryValue;
      }

      // 2. データベースキャッシュを確認
      const dbValue = await this.getFromDatabase<T>(key);
      if (dbValue !== null) {
        // メモリキャッシュにも保存
        this.memoryCache.set(key, dbValue);
        this.stats.hits++;
        logger.debug(`Database cache hit: ${key}`);
        return dbValue;
      }

      this.stats.misses++;
      logger.debug(`Cache miss: ${key}`);
      return null;

    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * キャッシュにデータを保存
   * メモリキャッシュとデータベースキャッシュの両方に保存
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const cacheTTL = ttl || this.defaultTTL;

      // 1. メモリキャッシュに保存
      this.memoryCache.set(key, value, cacheTTL);

      // 2. データベースキャッシュに保存
      await this.saveToDatabase(key, value, cacheTTL);

      this.stats.sets++;
      logger.debug(`Cache set: ${key} (TTL: ${cacheTTL}s)`);

    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      throw new CacheError(`Failed to set cache: ${error}`, { key, value });
    }
  }

  /**
   * キャッシュからデータを削除
   */
  async delete(key: string): Promise<void> {
    try {
      // 1. メモリキャッシュから削除
      this.memoryCache.del(key);

      // 2. データベースキャッシュから削除
      await this.deleteFromDatabase(key);

      this.stats.deletes++;
      logger.debug(`Cache deleted: ${key}`);

    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      throw new CacheError(`Failed to delete cache: ${error}`, { key });
    }
  }

  /**
   * 全キャッシュをクリア
   */
  async clear(): Promise<void> {
    try {
      // 1. メモリキャッシュをクリア
      this.memoryCache.flushAll();

      // 2. データベースキャッシュをクリア
      await this.clearDatabase();

      logger.info('All cache cleared');

    } catch (error) {
      logger.error('Cache clear error:', error);
      throw new CacheError(`Failed to clear cache: ${error}`);
    }
  }

  /**
   * キャッシュ統計情報を取得
   */
  async getStats(): Promise<{ hits: number; misses: number; size: number }> {
    const memorySize = this.memoryCache.keys().length;
    const dbSize = await this.getDatabaseCacheSize();

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: Math.max(memorySize, dbSize)
    };
  }

  /**
   * GitHub Issue専用のキャッシュメソッド
   */
  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue | null> {
    const key = CACHE_KEYS.GITHUB_ISSUE(owner, repo, issueNumber);
    return await this.get<GitHubIssue>(key);
  }

  /**
   * GitHub Issue専用のキャッシュ保存メソッド
   */
  async setIssue(owner: string, repo: string, issueNumber: number, issue: GitHubIssue): Promise<void> {
    const key = CACHE_KEYS.GITHUB_ISSUE(owner, repo, issueNumber);
    await this.set(key, issue);
  }

  /**
   * データベースからキャッシュデータを取得
   */
  private async getFromDatabase<T>(key: string): Promise<T | null> {
    try {
      const db = await getDatabaseManager().getDatabase();
      
      // Issue専用のキャッシュテーブルから取得
      if (key.startsWith('github:issue:')) {
        const parts = key.split(':');
        if (parts.length >= 5) {
          const owner = parts[2];
          const repo = parts[3];
          const number = parseInt(parts[4], 10);

          const row = await db.get(
            'SELECT * FROM issues WHERE owner = ? AND repo = ? AND number = ? AND expires_at > datetime("now")',
            [owner, repo, number]
          );

          if (row) {
            // データベースレコードをGitHubIssue形式に変換
            const issue: GitHubIssue = {
              id: row.id,
              number: row.number,
              title: row.title,
              body: row.body,
              state: row.state as 'open' | 'closed',
              draft: row.draft === 1,
              user: {
                login: row.user_login,
                avatar_url: row.user_avatar_url
              },
              labels: row.labels ? JSON.parse(row.labels) : [],
              created_at: row.created_at,
              updated_at: row.updated_at,
              comments: row.comments,
              html_url: row.html_url,
              repository: {
                name: repo,
                full_name: `${owner}/${repo}`,
                owner: { login: owner }
              }
            };

            return issue as T;
          }
        }
      }

      return null;

    } catch (error) {
      logger.error(`Database cache get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * データベースにキャッシュデータを保存
   */
  private async saveToDatabase<T>(key: string, value: T, ttl: number): Promise<void> {
    try {
      const db = await getDatabaseManager().getDatabase();
      
      // Issue専用のキャッシュテーブルに保存
      if (key.startsWith('github:issue:') && typeof value === 'object' && value !== null) {
        const issue = value as any;
        const parts = key.split(':');
        
        if (parts.length >= 5 && issue.number && issue.title) {
          const owner = parts[2];
          const repo = parts[3];
          const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

          await db.run(`
            INSERT OR REPLACE INTO issues (
              id, number, owner, repo, title, body, state, draft,
              user_login, user_avatar_url, labels, comments, html_url,
              created_at, updated_at, cached_at, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"), ?)
          `, [
            issue.id,
            issue.number,
            owner,
            repo,
            issue.title,
            issue.body,
            issue.state,
            issue.draft ? 1 : 0,
            issue.user?.login || '',
            issue.user?.avatar_url || '',
            JSON.stringify(issue.labels || []),
            issue.comments || 0,
            issue.html_url,
            issue.created_at,
            issue.updated_at,
            expiresAt
          ]);
        }
      }

    } catch (error) {
      logger.error(`Database cache save error for key ${key}:`, error);
    }
  }

  /**
   * データベースからキャッシュデータを削除
   */
  private async deleteFromDatabase(key: string): Promise<void> {
    try {
      const db = await getDatabaseManager().getDatabase();
      
      if (key.startsWith('github:issue:')) {
        const parts = key.split(':');
        if (parts.length >= 5) {
          const owner = parts[2];
          const repo = parts[3];
          const number = parseInt(parts[4], 10);

          await db.run(
            'DELETE FROM issues WHERE owner = ? AND repo = ? AND number = ?',
            [owner, repo, number]
          );
        }
      }

    } catch (error) {
      logger.error(`Database cache delete error for key ${key}:`, error);
    }
  }

  /**
   * データベースキャッシュをクリア
   */
  private async clearDatabase(): Promise<void> {
    try {
      const db = await getDatabaseManager().getDatabase();
      await db.run('DELETE FROM issues');

    } catch (error) {
      logger.error('Database cache clear error:', error);
    }
  }

  /**
   * データベースキャッシュサイズを取得
   */
  private async getDatabaseCacheSize(): Promise<number> {
    try {
      const db = await getDatabaseManager().getDatabase();
      const result = await db.get('SELECT COUNT(*) as count FROM issues WHERE expires_at > datetime("now")');
      return result?.count || 0;

    } catch (error) {
      logger.error('Database cache size error:', error);
      return 0;
    }
  }

  /**
   * イベントリスナーの設定
   */
  private setupEventListeners(): void {
    this.memoryCache.on('expired', (key, _value) => {
      logger.debug(`Memory cache expired: ${key}`);
    });

    this.memoryCache.on('del', (key, _value) => {
      logger.debug(`Memory cache deleted: ${key}`);
    });

    this.memoryCache.on('set', (key, _value) => {
      logger.debug(`Memory cache set: ${key}`);
    });
  }

  /**
   * 期限切れキャッシュのクリーンアップ
   */
  async cleanupExpired(): Promise<void> {
    try {
      const db = await getDatabaseManager().getDatabase();
      const result = await db.run('DELETE FROM issues WHERE expires_at < datetime("now")');
      
      if (result.changes && result.changes > 0) {
        logger.info(`Cleaned up ${result.changes} expired cache entries`);
      }

    } catch (error) {
      logger.error('Cache cleanup error:', error);
    }
  }
}

// シングルトンインスタンス
let cacheService: CacheService | null = null;

export function getCacheService(): CacheService {
  if (!cacheService) {
    const ttl = parseInt(process.env.CACHE_TTL || '300', 10);
    cacheService = new CacheService(ttl);
  }
  return cacheService;
}