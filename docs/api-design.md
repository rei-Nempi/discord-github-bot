# Discord GitHub連携Bot API設計書

## 1. API概要

### 1.1 API種別
- **Discord Events API**: Discord.jsイベントベース
- **GitHub REST API**: GitHub API v4 連携
- **Internal Service API**: 内部サービス間通信
- **Configuration API**: 設定管理
- **Cache API**: キャッシュ管理

### 1.2 認証方式
- **Discord**: Bot Token (Bearer Token)
- **GitHub**: Personal Access Token (PAT)
- **Internal**: Service-to-Service (No Auth)

## 2. Discord Events API

### 2.1 メッセージ処理API

#### 2.1.1 messageCreate Event
```typescript
interface MessageCreateEvent {
  message: Discord.Message;
  
  // Event Handler
  handler: (message: Discord.Message) => Promise<void>;
}

// Implementation
class MessageHandler {
  async handleMessageCreate(message: Discord.Message): Promise<void> {
    // 1. ボットメッセージを除外
    if (message.author.bot) return;
    
    // 2. Issue番号検出
    const issueRefs = this.parseIssueReferences(message.content);
    if (issueRefs.length === 0) return;
    
    // 3. Guild設定確認
    const config = await this.getGuildConfig(message.guild.id);
    if (!config.enabled) return;
    
    // 4. Issue情報取得・表示
    await this.processIssueReferences(message, issueRefs, config);
  }
}
```

#### 2.1.2 Issue参照処理
```typescript
interface IssueReferenceRequest {
  messageId: string;
  guildId: string;
  channelId: string;
  issueReferences: IssueReference[];
  userPermissions: PermissionFlags;
}

interface IssueReferenceResponse {
  success: boolean;
  processedIssues: ProcessedIssue[];
  errors: IssueError[];
  responseTime: number;
}

interface ProcessedIssue {
  issueNumber: number;
  repository: string;
  embed: Discord.EmbedBuilder;
  cached: boolean;
}
```

### 2.2 コマンド処理API

#### 2.2.1 スラッシュコマンド定義
```typescript
// Repository管理コマンド
const COMMANDS = [
  {
    name: 'github',
    description: 'GitHub連携設定管理',
    options: [
      {
        name: 'add-repo',
        description: 'リポジトリを追加',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'repository',
            description: 'owner/repo形式',
            type: ApplicationCommandOptionType.String,
            required: true
          },
          {
            name: 'alias',
            description: 'エイリアス名',
            type: ApplicationCommandOptionType.String,
            required: false
          }
        ]
      },
      {
        name: 'list-repos',
        description: 'リポジトリ一覧表示',
        type: ApplicationCommandOptionType.Subcommand
      },
      {
        name: 'remove-repo',
        description: 'リポジトリを削除',
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: 'repository',
            description: 'owner/repo形式またはエイリアス',
            type: ApplicationCommandOptionType.String,
            required: true
          }
        ]
      }
    ]
  }
];
```

#### 2.2.2 コマンド処理インターフェース
```typescript
interface CommandRequest {
  interaction: Discord.CommandInteraction;
  command: string;
  subcommand?: string;
  options: Record<string, any>;
  user: Discord.User;
  guild: Discord.Guild;
  member: Discord.GuildMember;
}

interface CommandResponse {
  type: 'reply' | 'edit' | 'followUp';
  content?: string;
  embeds?: Discord.EmbedBuilder[];
  ephemeral?: boolean;
  components?: Discord.ActionRowBuilder[];
}

// Command Handlers
abstract class BaseCommand {
  abstract name: string;
  abstract description: string;
  abstract execute(request: CommandRequest): Promise<CommandResponse>;
  
  protected checkPermissions(member: Discord.GuildMember): boolean {
    return member.permissions.has(PermissionFlagsBits.ManageGuild);
  }
}
```

## 3. GitHub API連携

### 3.1 Issue情報取得API

#### 3.1.1 Issue取得エンドポイント
```typescript
interface GitHubIssueRequest {
  owner: string;
  repo: string;
  issueNumber: number;
  includeComments?: boolean;
  includeEvents?: boolean;
}

interface GitHubIssueResponse {
  issue: GitHubIssue;
  rateLimit: RateLimitInfo;
  cached: boolean;
  requestTime: number;
}

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  user: GitHubUser;
  assignees: GitHubUser[];
  labels: GitHubLabel[];
  milestone?: GitHubMilestone;
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  html_url: string;
  repository: GitHubRepository;
}
```

#### 3.1.2 GitHub Service実装
```typescript
class GitHubService {
  private octokit: Octokit;
  private cache: CacheManager;
  private rateLimiter: RateLimiter;

  async getIssue(request: GitHubIssueRequest): Promise<GitHubIssueResponse> {
    // 1. キャッシュ確認
    const cacheKey = this.generateCacheKey(request);
    const cached = await this.cache.get<GitHubIssue>(cacheKey);
    
    if (cached) {
      return {
        issue: cached,
        rateLimit: await this.getRateLimit(),
        cached: true,
        requestTime: 0
      };
    }

    // 2. レート制限確認
    await this.rateLimiter.waitForAvailability();

    // 3. GitHub API呼び出し
    const startTime = Date.now();
    try {
      const response = await this.octokit.rest.issues.get({
        owner: request.owner,
        repo: request.repo,
        issue_number: request.issueNumber
      });

      const issue = this.transformIssueData(response.data);
      
      // 4. キャッシュ保存
      await this.cache.set(cacheKey, issue, 300); // 5分

      return {
        issue,
        rateLimit: this.extractRateLimit(response.headers),
        cached: false,
        requestTime: Date.now() - startTime
      };
    } catch (error) {
      throw this.handleGitHubError(error);
    }
  }

  private generateCacheKey(request: GitHubIssueRequest): string {
    return `issue:${request.owner}:${request.repo}:${request.issueNumber}`;
  }
}
```

### 3.2 Repository検証API
```typescript
interface RepositoryValidationRequest {
  owner: string;
  repo: string;
  checkAccess?: boolean;
}

interface RepositoryValidationResponse {
  valid: boolean;
  repository?: GitHubRepository;
  permissions?: RepositoryPermissions;
  error?: ValidationError;
}

interface RepositoryPermissions {
  admin: boolean;
  maintain: boolean;
  push: boolean;
  triage: boolean;
  pull: boolean;
}

class RepositoryValidator {
  async validateRepository(
    request: RepositoryValidationRequest
  ): Promise<RepositoryValidationResponse> {
    try {
      const response = await this.octokit.rest.repos.get({
        owner: request.owner,
        repo: request.repo
      });

      const permissions = request.checkAccess 
        ? await this.getRepositoryPermissions(request.owner, request.repo)
        : undefined;

      return {
        valid: true,
        repository: response.data,
        permissions
      };
    } catch (error) {
      return {
        valid: false,
        error: this.handleValidationError(error)
      };
    }
  }
}
```

## 4. 内部サービスAPI

### 4.1 設定管理API

#### 4.1.1 Guild設定管理
```typescript
interface GuildConfigService {
  // 設定取得
  getConfig(guildId: string): Promise<GuildConfig>;
  
  // 設定更新
  updateConfig(guildId: string, config: Partial<GuildConfig>): Promise<void>;
  
  // リポジトリ追加
  addRepository(guildId: string, repo: RepositoryConfig): Promise<void>;
  
  // リポジトリ削除
  removeRepository(guildId: string, identifier: string): Promise<void>;
  
  // リポジトリ一覧
  listRepositories(guildId: string): Promise<RepositoryConfig[]>;
}

interface GuildConfig {
  guildId: string;
  enabled: boolean;
  repositories: RepositoryConfig[];
  settings: BotSettings;
  createdAt: Date;
  updatedAt: Date;
}

interface RepositoryConfig {
  id?: number;
  owner: string;
  repo: string;
  alias?: string;
  enabled: boolean;
  channels?: string[]; // 特定チャンネルのみ
  createdAt: Date;
}

interface BotSettings {
  responseDelay: number; // ms
  maxIssuesPerMessage: number;
  cacheTimeout: number; // seconds
  enableAnalytics: boolean;
  allowedChannels?: string[];
  blockedChannels?: string[];
}
```

#### 4.1.2 設定サービス実装
```typescript
class ConfigService implements GuildConfigService {
  constructor(private db: Database) {}

  async getConfig(guildId: string): Promise<GuildConfig> {
    const query = `
      SELECT g.*, 
             json_group_array(
               json_object(
                 'id', r.id,
                 'owner', r.owner,
                 'repo', r.repo,
                 'alias', r.alias,
                 'enabled', r.enabled,
                 'channels', json(r.channels),
                 'createdAt', r.created_at
               )
             ) as repositories
      FROM guild_configs g
      LEFT JOIN repositories r ON g.guild_id = r.guild_id AND r.enabled = 1
      WHERE g.guild_id = ?
      GROUP BY g.guild_id
    `;

    const result = await this.db.get(query, [guildId]);
    
    if (!result) {
      return this.createDefaultConfig(guildId);
    }

    return this.transformConfigData(result);
  }

  async addRepository(
    guildId: string, 
    repo: RepositoryConfig
  ): Promise<void> {
    const query = `
      INSERT INTO repositories (
        guild_id, owner, repo, alias, enabled, channels
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    await this.db.run(query, [
      guildId,
      repo.owner,
      repo.repo,
      repo.alias,
      repo.enabled,
      JSON.stringify(repo.channels || [])
    ]);
  }
}
```

### 4.2 キャッシュ管理API

#### 4.2.1 キャッシュインターフェース
```typescript
interface CacheManager {
  // 基本操作
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  
  // バッチ操作
  mget<T>(keys: string[]): Promise<(T | null)[]>;
  mset<T>(entries: Array<{key: string, value: T, ttl?: number}>): Promise<void>;
  
  // パターン操作
  keys(pattern: string): Promise<string[]>;
  deletePattern(pattern: string): Promise<number>;
  
  // 統計
  getStats(): Promise<CacheStats>;
  cleanup(): Promise<number>;
}

interface CacheStats {
  totalKeys: number;
  memoryUsage: number;
  hitRate: number;
  missRate: number;
  expiredKeys: number;
}

// Cache Key Constants
export const CACHE_KEYS = {
  ISSUE: (owner: string, repo: string, number: number) => 
    `issue:${owner}:${repo}:${number}`,
  
  REPOSITORY: (owner: string, repo: string) => 
    `repo:${owner}:${repo}`,
    
  USER: (username: string) => 
    `user:${username}`,
    
  GUILD_CONFIG: (guildId: string) => 
    `config:guild:${guildId}`,
    
  RATE_LIMIT: (service: string) => 
    `rate_limit:${service}`,
    
  REPOSITORY_LIST: (guildId: string) => 
    `repos:${guildId}`
} as const;
```

#### 4.2.2 多層キャッシュ実装
```typescript
class MultiLevelCache implements CacheManager {
  private memoryCache: Map<string, CacheEntry>;
  private databaseCache: DatabaseCache;
  
  constructor(
    private maxMemorySize: number = 1000,
    private defaultTTL: number = 300
  ) {
    this.memoryCache = new Map();
  }

  async get<T>(key: string): Promise<T | null> {
    // L1: Memory Cache
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && !this.isExpired(memoryEntry)) {
      return memoryEntry.value as T;
    }

    // L2: Database Cache
    const dbEntry = await this.databaseCache.get<T>(key);
    if (dbEntry) {
      // Promote to memory cache
      this.setMemoryCache(key, dbEntry, this.defaultTTL);
      return dbEntry;
    }

    return null;
  }

  async set<T>(key: string, value: T, ttl: number = this.defaultTTL): Promise<void> {
    // Set in both layers
    this.setMemoryCache(key, value, ttl);
    await this.databaseCache.set(key, value, ttl);
  }

  private setMemoryCache<T>(key: string, value: T, ttl: number): void {
    // LRU eviction if needed
    if (this.memoryCache.size >= this.maxMemorySize) {
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }

    this.memoryCache.set(key, {
      value,
      expiresAt: Date.now() + (ttl * 1000)
    });
  }
}
```

## 5. エラーハンドリングAPI

### 5.1 エラー定義
```typescript
// Base Error Classes
abstract class BotError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;
  abstract readonly userMessage: string;
  abstract readonly category: ErrorCategory;
  
  constructor(
    message: string,
    public readonly cause?: Error,
    public readonly metadata?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
  }
  
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      statusCode: this.statusCode,
      category: this.category,
      metadata: this.metadata,
      stack: this.stack
    };
  }
}

enum ErrorCategory {
  GITHUB_API = 'github_api',
  DISCORD_API = 'discord_api',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  RATE_LIMIT = 'rate_limit',
  INTERNAL = 'internal'
}

// Specific Error Types
class GitHubApiError extends BotError {
  readonly code = 'GITHUB_API_ERROR';
  readonly statusCode = 503;
  readonly userMessage = 'GitHub APIでエラーが発生しました';
  readonly category = ErrorCategory.GITHUB_API;
}

class IssueNotFoundError extends BotError {
  readonly code = 'ISSUE_NOT_FOUND';
  readonly statusCode = 404;
  readonly userMessage = 'Issue が見つかりません';
  readonly category = ErrorCategory.GITHUB_API;
}

class RateLimitExceededError extends BotError {
  readonly code = 'RATE_LIMIT_EXCEEDED';
  readonly statusCode = 429;
  readonly userMessage = 'しばらく時間をおいて再試行してください';
  readonly category = ErrorCategory.RATE_LIMIT;
  
  constructor(
    message: string,
    public readonly resetTime: Date,
    public readonly limit: number,
    public readonly remaining: number
  ) {
    super(message, undefined, { resetTime, limit, remaining });
  }
}

class RepositoryNotConfiguredError extends BotError {
  readonly code = 'REPOSITORY_NOT_CONFIGURED';
  readonly statusCode = 400;
  readonly userMessage = 'リポジトリが設定されていません';
  readonly category = ErrorCategory.VALIDATION;
}

class InsufficientPermissionsError extends BotError {
  readonly code = 'INSUFFICIENT_PERMISSIONS';
  readonly statusCode = 403;
  readonly userMessage = 'この操作を実行する権限がありません';
  readonly category = ErrorCategory.AUTHENTICATION;
}
```

### 5.2 エラーハンドラー
```typescript
interface ErrorHandler {
  handleError(error: Error, context: ErrorContext): Promise<ErrorResponse>;
  canHandle(error: Error): boolean;
}

interface ErrorContext {
  guildId?: string;
  channelId?: string;
  userId?: string;
  messageId?: string;
  command?: string;
  issueNumber?: number;
  repository?: string;
}

interface ErrorResponse {
  userNotification?: {
    content?: string;
    embed?: Discord.EmbedBuilder;
    ephemeral: boolean;
  };
  logLevel: 'warn' | 'error' | 'fatal';
  shouldRetry: boolean;
  retryAfter?: number; // seconds
}

class GitHubErrorHandler implements ErrorHandler {
  canHandle(error: Error): boolean {
    return error instanceof GitHubApiError || 
           error.message.includes('GitHub') ||
           (error as any).status >= 400;
  }

  async handleError(error: Error, context: ErrorContext): Promise<ErrorResponse> {
    if (error instanceof RateLimitExceededError) {
      return {
        userNotification: {
          embed: this.createRateLimitEmbed(error),
          ephemeral: true
        },
        logLevel: 'warn',
        shouldRetry: true,
        retryAfter: Math.ceil((error.resetTime.getTime() - Date.now()) / 1000)
      };
    }

    if (error instanceof IssueNotFoundError) {
      return {
        userNotification: {
          embed: this.createNotFoundEmbed(context.issueNumber, context.repository),
          ephemeral: true
        },
        logLevel: 'warn',
        shouldRetry: false
      };
    }

    // Generic GitHub API error
    return {
      userNotification: {
        content: 'GitHub APIでエラーが発生しました。しばらく時間をおいて再試行してください。',
        ephemeral: true
      },
      logLevel: 'error',
      shouldRetry: true,
      retryAfter: 60
    };
  }
}
```

## 6. レート制限API

### 6.1 レート制限管理
```typescript
interface RateLimiter {
  checkLimit(service: string, identifier?: string): Promise<RateLimitResult>;
  waitForAvailability(service: string, identifier?: string): Promise<void>;
  getRemainingRequests(service: string): Promise<number>;
  getResetTime(service: string): Promise<Date>;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number; // seconds
}

interface RateLimitConfig {
  requests: number;
  window: number; // seconds
  burst?: number; // burst allowance
}

const RATE_LIMITS = {
  GITHUB_API: { requests: 5000, window: 3600 }, // per hour
  DISCORD_API: { requests: 50, window: 1 },     // per second
  ISSUE_PROCESSING: { requests: 10, window: 60 } // per minute per guild
} as const;

class TokenBucketRateLimiter implements RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();

  async checkLimit(service: string, identifier = 'default'): Promise<RateLimitResult> {
    const key = `${service}:${identifier}`;
    const config = this.getServiceConfig(service);
    const bucket = this.getBucket(key, config);

    const available = bucket.consume(1);
    
    return {
      allowed: available,
      remaining: bucket.tokens,
      resetTime: new Date(Date.now() + bucket.getRefillTime()),
      retryAfter: available ? undefined : bucket.getRefillTime() / 1000
    };
  }

  async waitForAvailability(service: string, identifier = 'default'): Promise<void> {
    const result = await this.checkLimit(service, identifier);
    
    if (!result.allowed && result.retryAfter) {
      await new Promise(resolve => setTimeout(resolve, result.retryAfter * 1000));
    }
  }
}
```

## 7. 認証・認可API

### 7.1 権限管理
```typescript
interface PermissionManager {
  checkBotPermissions(guild: Discord.Guild): Promise<BotPermissionResult>;
  checkUserPermissions(member: Discord.GuildMember, action: string): Promise<boolean>;
  checkRepositoryAccess(repository: string): Promise<RepositoryAccessResult>;
}

interface BotPermissionResult {
  hasRequiredPermissions: boolean;
  missingPermissions: string[];
  canSendMessages: boolean;
  canSendEmbeds: boolean;
  canUseSlashCommands: boolean;
}

interface RepositoryAccessResult {
  hasAccess: boolean;
  accessLevel: 'none' | 'read' | 'write' | 'admin';
  isPrivate: boolean;
  error?: string;
}

const REQUIRED_BOT_PERMISSIONS = [
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.UseSlashCommands
] as const;

const USER_ACTIONS = {
  MANAGE_REPOSITORIES: 'manage_repositories',
  VIEW_ANALYTICS: 'view_analytics',
  MODIFY_SETTINGS: 'modify_settings'
} as const;

class PermissionService implements PermissionManager {
  async checkBotPermissions(guild: Discord.Guild): Promise<BotPermissionResult> {
    const botMember = await guild.members.fetch(this.botUserId);
    const permissions = botMember.permissions;
    
    const missingPermissions = REQUIRED_BOT_PERMISSIONS.filter(
      perm => !permissions.has(perm)
    );

    return {
      hasRequiredPermissions: missingPermissions.length === 0,
      missingPermissions: missingPermissions.map(perm => perm.toString()),
      canSendMessages: permissions.has(PermissionFlagsBits.SendMessages),
      canSendEmbeds: permissions.has(PermissionFlagsBits.EmbedLinks),
      canUseSlashCommands: permissions.has(PermissionFlagsBits.UseSlashCommands)
    };
  }

  async checkUserPermissions(member: Discord.GuildMember, action: string): Promise<boolean> {
    switch (action) {
      case USER_ACTIONS.MANAGE_REPOSITORIES:
        return member.permissions.has(PermissionFlagsBits.ManageGuild) ||
               member.permissions.has(PermissionFlagsBits.Administrator);
      
      case USER_ACTIONS.VIEW_ANALYTICS:
        return member.permissions.has(PermissionFlagsBits.ManageMessages) ||
               member.permissions.has(PermissionFlagsBits.ManageGuild);
      
      case USER_ACTIONS.MODIFY_SETTINGS:
        return member.permissions.has(PermissionFlagsBits.Administrator);
      
      default:
        return false;
    }
  }
}
```

## 8. ログ・分析API

### 8.1 使用統計API
```typescript
interface AnalyticsService {
  recordIssueView(data: IssueViewEvent): Promise<void>;
  recordCommandUsage(data: CommandUsageEvent): Promise<void>;
  recordError(data: ErrorEvent): Promise<void>;
  
  getGuildStats(guildId: string, period: TimePeriod): Promise<GuildAnalytics>;
  getSystemStats(period: TimePeriod): Promise<SystemAnalytics>;
}

interface IssueViewEvent {
  guildId: string;
  channelId: string;
  userId: string;
  issueNumber: number;
  repository: string;
  success: boolean;
  responseTime: number;
  cached: boolean;
  timestamp: Date;
}

interface CommandUsageEvent {
  guildId: string;
  channelId: string;
  userId: string;
  command: string;
  success: boolean;
  executionTime: number;
  timestamp: Date;
}

interface ErrorEvent {
  guildId?: string;
  channelId?: string;
  userId?: string;
  errorCode: string;
  errorMessage: string;
  stackTrace?: string;
  context: Record<string, any>;
  timestamp: Date;
}

interface GuildAnalytics {
  totalIssueViews: number;
  uniqueUsers: number;
  mostViewedIssues: Array<{repository: string, issueNumber: number, views: number}>;
  commandUsage: Array<{command: string, count: number}>;
  errorRate: number;
  averageResponseTime: number;
  cacheHitRate: number;
}

enum TimePeriod {
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month'
}
```

このAPI設計書により、Discord GitHub連携Botの実装に必要なすべてのAPIが定義され、型安全性とエラーハンドリングが保証されます。