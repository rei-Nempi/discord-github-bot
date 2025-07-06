// ==================================================
// 外部ライブラリのインポート（外部から機能を借りてくる）
// ==================================================

// node-cache: メモリ上でデータを一時保存するためのライブラリ
// - 高速なデータアクセスが可能
// - TTL（Time To Live）: データの自動期限切れ機能
// - イベントリスナー: データの追加・削除・期限切れを監視
// 例: 同じIssue情報を何度もGitHub APIから取得しないよう一時保存
import NodeCache from 'node-cache';

// ==================================================
// 自分で作ったファイルのインポート
// ==================================================

// ログ出力を管理するユーティリティ関数
// console.logより高機能で、ファイルに保存したりレベル分けができる
import { createLogger } from '../utils/logger';

// データベース接続を管理するマネージャー関数
// SQLiteデータベースへの接続・操作を担当
import { getDatabaseManager } from '../database/index';

// TypeScript型定義のインポート
// プログラミング初心者向け説明:
// - ICacheService: キャッシュサービスのインターフェース（設計図）
// - CacheError: キャッシュ関連のエラーを表すクラス
// - CACHE_KEYS: キャッシュのキー名を生成する関数群
// - BOT_LIMITS: Botの制限値（キャッシュ時間など）の定数
// - GitHubIssue: GitHub Issue情報の型定義
import { ICacheService, CacheError, CACHE_KEYS, BOT_LIMITS, GitHubIssue } from '../types/index';

// ==================================================
// ログシステムの初期化
// ==================================================

/**
 * このファイル専用のログ出力システムを作成
 *
 * 【ロガーとは？】
 * console.logの高機能版。以下の機能がある：
 * - ファイル識別: どのファイルからのログかを記録
 * - レベル分け: info（情報）, warn（警告）, error（エラー）など
 * - ファイル保存: ログをファイルに自動保存
 * - タイムスタンプ: いつのログかを記録
 *
 * 'cache-service' は このファイルの識別名
 */
const logger = createLogger('cache-service');

// ==================================================
// キャッシュサービスクラスの定義
// ==================================================

/**
 * キャッシュサービスクラス - データの一時保存と高速アクセスを担当
 *
 * 【キャッシュとは？】
 * 一度取得したデータを一時的に保存し、次回のアクセスを高速化する仕組み
 * 例: GitHub APIから取得したIssue情報を保存し、同じ情報の再取得を避ける
 *
 * 【implements ICacheService とは？】
 * ICacheServiceインターフェース（設計図）の約束を守ることを宣言
 * 指定されたメソッドを必ず実装する必要がある
 *
 * 【二層キャッシュ構造】
 * 1. メモリキャッシュ（NodeCache）: 超高速だが、プログラム終了で消える
 * 2. データベースキャッシュ（SQLite）: 少し遅いが、永続化される
 */
export class CacheService implements ICacheService {
  /**
   * プライベートプロパティ（クラス内部でのみ使用）
   *
   * 【private とは？】
   * クラスの外部からは直接アクセスできない内部変数
   * データの安全性を保つためのカプセル化
   */

  /**
   * メモリキャッシュのインスタンス
   *
   * 【NodeCache とは？】
   * Node.jsでメモリ上にデータを保存するライブラリ
   * - 高速アクセス: ディスクアクセスより圧倒的に高速
   * - 自動期限切れ: 指定時間後にデータを自動削除
   * - イベント通知: データの追加・削除・期限切れを監視可能
   */
  private memoryCache: NodeCache;

  /**
   * デフォルトのTTL（Time To Live）値
   *
   * 【TTL とは？】
   * データがキャッシュに保存される時間（秒単位）
   * この時間が経過するとデータは自動的に削除される
   * 例: 300秒 = 5分間データを保持
   */
  private defaultTTL: number;

  /**
   * キャッシュ操作の統計情報
   *
   * 【統計情報の用途】
   * - パフォーマンス監視: キャッシュの効果を測定
   * - デバッグ: 問題の原因調査
   * - 最適化: キャッシュ設定の調整判断
   *
   * 【各項目の説明】
   * - hits: キャッシュヒット数（データが見つかった回数）
   * - misses: キャッシュミス数（データが見つからなかった回数）
   * - sets: データ保存回数
   * - deletes: データ削除回数
   */
  private stats: {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
  };

  /**
   * コンストラクタ - クラスのインスタンス作成時に実行される初期化処理
   *
   * 【コンストラクタとは？】
   * new CacheService() でオブジェクトを作成する際に自動実行される関数
   * オブジェクトの初期設定を行う
   *
   * 【引数のデフォルト値 とは？】
   * 引数が省略された場合に使用される値
   * ttl: number = BOT_LIMITS.CACHE_TTL_SECONDS
   * → ttlが指定されない場合、BOT_LIMITS.CACHE_TTL_SECONDSを使用
   *
   * 【BOT_LIMITS.CACHE_TTL_SECONDS とは？】
   * 設定ファイルで定義されたキャッシュの標準保持時間
   * 通常は300秒（5分）に設定されている
   *
   * @param ttl - キャッシュの保持時間（秒）、省略時はデフォルト値を使用
   */
  constructor(ttl: number = BOT_LIMITS.CACHE_TTL_SECONDS) {
    /**
     * TTL値をインスタンス変数に保存
     *
     * 【this とは？】
     * 現在のクラスインスタンス自身を指すキーワード
     * this.defaultTTL = インスタンスのdefaultTTLプロパティに値を代入
     */
    this.defaultTTL = ttl;

    /**
     * NodeCacheインスタンスの作成と設定
     *
     * 【new NodeCache() とは？】
     * NodeCacheクラスから新しいキャッシュオブジェクトを作成
     * 設定オプションを指定してカスタマイズ可能
     */
    this.memoryCache = new NodeCache({
      /**
       * stdTTL: Standard Time To Live
       *
       * 【stdTTL とは？】
       * デフォルトのデータ保持時間（秒）
       * 個別にTTLを指定しない場合、この値が使用される
       */
      stdTTL: ttl,

      /**
       * checkperiod: 期限切れデータのチェック間隔
       *
       * 【checkperiod とは？】
       * 期限切れデータを削除する処理の実行間隔（秒）
       * ttl * 0.2 = TTLの20%の間隔でチェック
       * 例: TTL300秒の場合、60秒ごとにクリーンアップ
       *
       * 【なぜ20%？】
       * - 頻繁すぎる: CPU負荷が高い
       * - 少なすぎる: メモリ使用量が増加
       * 20%は一般的なバランスの良い値
       */
      checkperiod: ttl * 0.2,

      /**
       * useClones: データのクローン（複製）使用の可否
       *
       * 【useClones: false とは？】
       * オブジェクトの参照をそのまま返す（複製しない）
       * - false: 高速だが、元データが変更される可能性
       * - true: 安全だが、複製処理で低速
       *
       * 【なぜfalse？】
       * Issue情報は読み取り専用で変更しないため、
       * 高速化を優先してfalseに設定
       */
      useClones: false,

      /**
       * deleteOnExpire: 期限切れ時の自動削除
       *
       * 【deleteOnExpire: true とは？】
       * データが期限切れになった際に自動的に削除する
       * メモリリークの防止とリソース管理のため重要
       */
      deleteOnExpire: true,
    });

    /**
     * 統計情報の初期化
     *
     * 【統計情報のリセット】
     * キャッシュサービス開始時に全ての統計カウンターを0に設定
     * プログラム実行中の動作を正確に測定するため
     */
    this.stats = {
      hits: 0, // キャッシュヒット数: データが見つかった回数
      misses: 0, // キャッシュミス数: データが見つからなかった回数
      sets: 0, // セット数: データを保存した回数
      deletes: 0, // 削除数: データを削除した回数
    };

    /**
     * イベントリスナーの設定
     *
     * 【イベントリスナーとは？】
     * 特定の出来事（イベント）が発生した時に自動実行される処理
     * キャッシュの動作を監視・ログ出力するために使用
     */
    this.setupEventListeners();

    /**
     * 初期化完了のログ出力
     *
     * 【ログの重要性】
     * - サービス開始の確認
     * - 設定値の記録（デバッグ時に有用）
     * - 運用監視での状態把握
     *
     * 【テンプレートリテラル記法】
     * `文字列 ${変数} 文字列` でログメッセージを作成
     */
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
      size: Math.max(memorySize, dbSize),
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
  async setIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    issue: GitHubIssue
  ): Promise<void> {
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
                avatar_url: row.user_avatar_url,
              },
              labels: row.labels ? JSON.parse(row.labels) : [],
              created_at: row.created_at,
              updated_at: row.updated_at,
              comments: row.comments,
              html_url: row.html_url,
              repository: {
                name: repo,
                full_name: `${owner}/${repo}`,
                owner: { login: owner },
              },
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

          await db.run(
            `
            INSERT OR REPLACE INTO issues (
              id, number, owner, repo, title, body, state, draft,
              user_login, user_avatar_url, labels, comments, html_url,
              created_at, updated_at, cached_at, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"), ?)
          `,
            [
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
              expiresAt,
            ]
          );
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

          await db.run('DELETE FROM issues WHERE owner = ? AND repo = ? AND number = ?', [
            owner,
            repo,
            number,
          ]);
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
      const result = await db.get(
        'SELECT COUNT(*) as count FROM issues WHERE expires_at > datetime("now")'
      );
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
