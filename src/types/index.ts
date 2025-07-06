// ==================================================
// Discord GitHub Bot 型定義ファイル
// ==================================================

/**
 * このファイルについて
 *
 * 【型定義ファイルとは？】
 * TypeScript で使用するデータの「形」を定義するファイル
 * - オブジェクトがどんなプロパティを持つか
 * - 関数がどんな引数と戻り値を持つか
 * - データの型（文字列、数値、真偽値など）
 *
 * 【なぜ型定義が重要？】
 * 1. エラーの早期発見：コンパイル時に型の間違いを検出
 * 2. 自動補完：IDEが正確な候補を表示
 * 3. ドキュメント：コードの意図が明確になる
 * 4. リファクタリング：安全にコードを変更可能
 *
 * 【export とは？】
 * 他のファイルからこの型定義を使えるように公開する
 */

// ==================================================
// GitHub API 関連の型定義
// ==================================================

/**
 * GitHub Issue情報の型定義
 *
 * 【interface とは？】
 * オブジェクトの構造（形）を定義する仕組み
 * このオブジェクトが持つべきプロパティとその型を指定
 *
 * 【GitHub Issue とは？】
 * GitHubリポジトリで管理される課題・タスク・バグ報告
 * - タイトルと説明
 * - 開いている／閉じている状態
 * - ラベルやコメント
 * - 作成者情報
 */
export interface GitHubIssue {
  /**
   * Issue の一意識別子
   *
   * 【number型について】
   * 整数値を格納する型
   * GitHubが自動で割り当てる内部ID
   */
  id: number;

  /**
   * Issue 番号（#123 の 123 部分）
   *
   * 【Issue番号とは？】
   * リポジトリ内でのIssueの通し番号
   * Pull Request と共通の番号体系
   * URL: https://github.com/owner/repo/issues/123
   */
  number: number;

  /**
   * Issue のタイトル
   *
   * 【string型について】
   * 文字列を格納する型
   * Issue の概要を表す短いテキスト
   */
  title: string;

  /**
   * Issue の詳細説明
   *
   * 【string | null 型について】
   * 文字列または null（値なし）を許可する型
   * | は Union型（複数の型のいずれか）
   * 説明が空の場合は null になる
   */
  body: string | null;

  /**
   * Issue の状態
   *
   * 【リテラル型 'open' | 'closed'】
   * 指定された文字列のみを許可する型
   * 'open': 未解決（作業中）
   * 'closed': 解決済み（完了）
   */
  state: 'open' | 'closed';

  /**
   * 下書き状態かどうか
   *
   * 【? オプショナルプロパティ】
   * このプロパティは省略可能
   * 値がない場合は undefined
   *
   * 【boolean型について】
   * true または false を格納する型
   * draft: true = 下書き状態
   */
  draft?: boolean;

  /**
   * Issue 作成者の情報
   *
   * 【ネストしたオブジェクト型】
   * オブジェクトの中にさらにオブジェクトを定義
   * user.login や user.avatar_url でアクセス
   */
  user: {
    /**
     * GitHubユーザー名
     * 例: "microsoft", "facebook", "google"
     */
    login: string;

    /**
     * ユーザーのアバター画像URL
     * GitHub がホストする画像への直リンク
     */
    avatar_url: string;
  };

  /**
   * Issue に付けられたラベルの配列
   *
   * 【Array<型> について】
   * 指定した型の要素を持つ配列
   * ここでは「オブジェクトの配列」
   *
   * 【ラベルとは？】
   * Issue の分類・タグ付けに使用
   * 例: bug, enhancement, documentation
   */
  labels: Array<{
    /**
     * ラベルの名前
     * 例: "bug", "enhancement", "good first issue"
     */
    name: string;

    /**
     * ラベルの色（16進数）
     * 例: "ff0000" (赤色), "00ff00" (緑色)
     */
    color: string;
  }>;

  /**
   * Issue 作成日時
   *
   * 【ISO 8601 形式の日時文字列】
   * 例: "2023-12-25T10:30:00Z"
   * UTC（協定世界時）で表現
   */
  created_at: string;

  /**
   * Issue 最終更新日時
   * 作成後に編集があった場合の最新更新時刻
   */
  updated_at: string;

  /**
   * コメント数
   * Issue に投稿されたコメントの総数
   */
  comments: number;

  /**
   * Issue の Web ブラウザ用 URL
   * 例: "https://github.com/microsoft/vscode/issues/123"
   */
  html_url: string;

  /**
   * 所属リポジトリの情報
   *
   * 【? オプショナルプロパティ】
   * このプロパティは省略可能
   * API 呼び出しによっては含まれない場合がある
   */
  repository?: {
    /**
     * リポジトリ名
     * 例: "vscode", "react", "nodejs"
     */
    name: string;

    /**
     * 所有者/リポジトリ名の形式
     * 例: "microsoft/vscode", "facebook/react"
     */
    full_name: string;

    /**
     * リポジトリ所有者の情報
     */
    owner: {
      /**
       * 所有者のGitHubユーザー名
       * 個人ユーザーまたは組織名
       */
      login: string;
    };
  };
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  html_url: string;
  description: string | null;
  private: boolean;
}

export interface GuildConfig {
  guild_id: string;
  repository: string | null; // format: "owner/repo"
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CacheEntry {
  key: string;
  value: any;
  expires_at: number;
  created_at: string;
}

export interface IssuePattern {
  pattern: string;
  issue_number: number;
  repository?: string; // for git#123 pattern
  start_index: number;
  end_index: number;
}

export interface EmbedColor {
  OPEN: number;
  CLOSED: number;
  DRAFT: number;
  ERROR: number;
}

export interface BotConfig {
  discord: {
    token: string;
    client_id: string;
  };
  github: {
    token: string;
    api_url: string;
  };
  database: {
    path: string;
  };
  cache: {
    ttl: number; // seconds
    max_size: number;
  };
  logging: {
    level: string;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset_at: number;
  resource: string;
}

export interface UsageStats {
  guild_id: string;
  command_count: number;
  issue_requests: number;
  cache_hits: number;
  cache_misses: number;
  last_used: string;
}

// Discord.js related types
export interface DiscordMessage {
  id: string;
  content: string;
  author: {
    id: string;
    username: string;
    bot: boolean;
  };
  channel: {
    id: string;
    type: number;
  };
  guild: {
    id: string;
    name: string;
  } | null;
  timestamp: string;
}

// Error types
export class BotError extends Error {
  code: string;
  details?: any;

  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'BotError';
    this.code = code;
    this.details = details;
  }
}

export class GitHubAPIError extends BotError {
  status: number;

  constructor(message: string, status: number, details?: any) {
    super(message, 'GITHUB_API_ERROR', details);
    this.status = status;
  }
}

export class DatabaseError extends BotError {
  constructor(message: string, details?: any) {
    super(message, 'DATABASE_ERROR', details);
  }
}

export class CacheError extends BotError {
  constructor(message: string, details?: any) {
    super(message, 'CACHE_ERROR', details);
  }
}

// Service interfaces
export interface IGitHubService {
  getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue>;
  searchIssues(owner: string, repo: string, query: string, state?: string): Promise<GitHubIssue[]>;
  validateRepository(owner: string, repo: string): Promise<boolean>;
  getRateLimitInfo(): Promise<RateLimitInfo>;
}

export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  getStats(): Promise<{ hits: number; misses: number; size: number }>;
}

export interface IConfigService {
  getGuildConfig(guildId: string): Promise<GuildConfig>;
  updateGuildConfig(guildId: string, config: Partial<GuildConfig>): Promise<GuildConfig>;
  deleteGuildConfig(guildId: string): Promise<void>;
  getAllGuildConfigs(): Promise<GuildConfig[]>;
}

export interface IMessageHandler {
  handleMessage(message: DiscordMessage): Promise<void>;
  detectIssuePatterns(content: string): IssuePattern[];
}

// ==================================================
// アプリケーション定数の定義
// ==================================================

/**
 * Discord Embed の色定義
 *
 * 【色の16進数表記について】
 * 0x で始まる16進数形式で色を指定
 * 0xRRGGBB の形式（Red, Green, Blue）
 *
 * 【色の選択理由】
 * GitHub の Issue状態と視覚的に対応
 * ユーザーが直感的に状態を理解可能
 */
export const EMBED_COLORS: EmbedColor = {
  /**
   * 開いているIssue用の色（緑）
   * 0x28a745 = RGB(40, 167, 69)
   * GitHub の成功・進行中を表す緑色
   */
  OPEN: 0x28a745, // Green

  /**
   * 閉じられたIssue用の色（赤）
   * 0xdc3545 = RGB(220, 53, 69)
   * GitHub の完了・終了を表す赤色
   */
  CLOSED: 0xdc3545, // Red

  /**
   * 下書きIssue用の色（黄）
   * 0xffc107 = RGB(255, 193, 7)
   * 注意・作業中を表す黄色
   */
  DRAFT: 0xffc107, // Yellow

  /**
   * エラー用の色（グレー）
   * 0x6c757d = RGB(108, 117, 125)
   * 問題・無効を表すグレー色
   */
  ERROR: 0x6c757d, // Gray
};

/**
 * Issue番号パターンの正規表現定義
 *
 * 【正規表現とは？】
 * 文字列のパターンマッチングを行うための記法
 * 特定の形式の文字列を検出・抽出できる
 *
 * 【g フラグについて】
 * Global（全体）検索を意味するフラグ
 * 文字列内の全ての該当箇所を検出
 */
export const ISSUE_PATTERNS = {
  /**
   * 標準Issue番号パターン（#123形式）
   *
   * 【正規表現の詳細解説】
   * (?:^|\s)  : 行頭または空白文字（キャプチャなし）
   * #         : ハッシュ記号そのもの
   * (\d{1,5}) : 1〜5桁の数字（キャプチャグループ1）
   * (?:\s|$)  : 空白文字または行末（キャプチャなし）
   *
   * 【マッチ例】
   * "Check #123 please" → #123
   * "#456 is important" → #456
   * "Fix#789"          → マッチしない（前後に区切りが必要）
   */
  STANDARD: /(?:^|\s)#(\d{1,5})(?:\s|$)/g,

  /**
   * Git接頭辞付きパターン（git#123形式）
   *
   * 【このパターンの用途】
   * GitHub以外のサービスと区別するため
   * 明示的にGitHubのIssueを指定
   *
   * 【正規表現の詳細解説】
   * git# : "git#" という文字列
   * その他は標準パターンと同じ
   */
  GIT_PREFIXED: /(?:^|\s)git#(\d{1,5})(?:\s|$)/g,

  /**
   * URL除外パターン
   *
   * 【除外の理由】
   * URL内の#123は実際のIssue番号ではない
   * フラグメント識別子やアンカーリンク
   *
   * 【正規表現の詳細解説】
   * https?   : http または https
   * :\/\/    : "://" という文字列
   * [^\s]+   : 空白文字以外の1文字以上
   */
  EXCLUDE_URLS: /https?:\/\/[^\s]+/g,

  /**
   * コードブロック除外パターン
   *
   * 【除外の理由】
   * Markdownコードブロック内の#123は
   * コードの一部であり、Issue番号ではない
   *
   * 【正規表現の詳細解説】
   * ```      : トリプルバッククォート
   * [\s\S]*? : 任意の文字（改行含む）を非貪欲マッチ
   * ```      : 終了のトリプルバッククォート
   */
  EXCLUDE_CODE_BLOCKS: /```[\s\S]*?```/g,

  /**
   * インラインコード除外パターン
   *
   * 【除外の理由】
   * インラインコード内の#123も
   * コードの一部でありIssue番号ではない
   *
   * 【正規表現の詳細解説】
   * `     : バッククォート
   * [^`]+ : バッククォート以外の1文字以上
   * `     : 終了のバッククォート
   */
  EXCLUDE_INLINE_CODE: /`[^`]+`/g,

  /**
   * 引用行除外パターン
   *
   * 【除外の理由】
   * Markdown引用内の#123は
   * 他の人の発言の引用でありIssue番号ではない
   *
   * 【正規表現の詳細解説】
   * ^    : 行の開始
   * >    : 大なり記号（引用記号）
   * \s   : 空白文字
   *
   * 【m フラグについて】
   * Multiline（複数行）モード
   * ^ と $ が各行の開始・終了にマッチ
   */
  EXCLUDE_QUOTES: /^>\s/gm,
};

/**
 * キャッシュキー生成関数の定義
 *
 * 【キャッシュキーとは？】
 * データを一意に識別するための文字列
 * 同じキーで保存・取得を行う
 *
 * 【テンプレートリテラル の使用】
 * `文字列${変数}文字列` でキーを生成
 * 動的に値を埋め込んでユニークなキーを作成
 */
export const CACHE_KEYS = {
  /**
   * GitHub Issue用キー生成関数
   *
   * 【引数】
   * @param owner - リポジトリ所有者名
   * @param repo - リポジトリ名
   * @param number - Issue番号
   *
   * 【生成例】
   * GITHUB_ISSUE('microsoft', 'vscode', 123)
   * → 'github:issue:microsoft:vscode:123'
   *
   * 【コロン区切りの理由】
   * - 階層的な構造を表現
   * - Redis等のキー管理ツールで認識しやすい
   * - 人間にとっても読みやすい
   */
  GITHUB_ISSUE: (owner: string, repo: string, number: number) =>
    `github:issue:${owner}:${repo}:${number}`,

  /**
   * GitHub Repository用キー生成関数
   *
   * 【用途】
   * リポジトリ情報のキャッシュ
   * Issue より更新頻度が低い情報
   */
  GITHUB_REPO: (owner: string, repo: string) => `github:repo:${owner}:${repo}`,

  /**
   * GitHub API制限情報用キー
   *
   * 【固定キーの理由】
   * API制限は全体で共通の情報
   * アカウント単位で管理される
   */
  RATE_LIMIT: 'github:rate_limit',

  /**
   * Discord サーバー設定用キー生成関数
   *
   * 【用途】
   * 各Discordサーバーの設定情報
   * デフォルトリポジトリ等の設定
   */
  GUILD_CONFIG: (guildId: string) => `guild:config:${guildId}`,
};

/**
 * Bot の制限値定義
 *
 * 【制限値の必要性】
 * - スパム防止
 * - API制限の遵守
 * - UI/UXの最適化
 * - システム負荷の制御
 */
export const BOT_LIMITS = {
  /**
   * 1メッセージあたりの最大Issue表示数
   *
   * 【制限理由】
   * - Discord メッセージの見やすさ
   * - API呼び出し回数の制御
   * - レスポンス時間の最適化
   */
  MAX_ISSUES_PER_MESSAGE: 3,

  /**
   * Discord Embed 説明文の最大文字数
   *
   * 【Discord API制限】
   * Discord の Embed description は2048文字まで
   * この制限を超えるとAPIエラーが発生
   */
  MAX_EMBED_DESCRIPTION_LENGTH: 2048,

  /**
   * Discord Embed フィールド値の最大文字数
   *
   * 【Discord API制限】
   * Embed の各フィールドの value は1024文字まで
   */
  MAX_EMBED_FIELD_VALUE_LENGTH: 1024,

  /**
   * キャッシュの保持時間（秒）
   *
   * 【300秒 = 5分の理由】
   * - Issue情報の鮮度と効率のバランス
   * - GitHub API制限の有効活用
   * - ユーザー体験の最適化
   */
  CACHE_TTL_SECONDS: 300, // 5 minutes

  /**
   * レート制限リセット時のバッファ時間（秒）
   *
   * 【バッファの必要性】
   * GitHub API のレート制限リセット直後は
   * 一時的に不安定な場合があるため
   * 少し余裕を持って待機
   */
  RATE_LIMIT_RESET_BUFFER: 60, // seconds
};
