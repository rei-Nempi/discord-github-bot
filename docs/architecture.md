# Discord GitHub連携Bot アーキテクチャ設計書

## 1. システム全体アーキテクチャ

### 1.1 システム概要図
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Discord User  │    │  GitHub Issues  │    │   Config Web    │
│                 │    │   Repository    │    │   Interface     │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │ Message              │ API Request          │ Config
          │ (#100)               │                      │ Management
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Discord Bot Server                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │   Message   │  │   GitHub    │  │   Embed     │  │  Config │ │
│  │   Handler   │  │   Service   │  │   Builder   │  │ Manager │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │    Cache    │  │    Logger   │  │   Security  │  │  Metrics│ │
│  │   Manager   │  │   Service   │  │   Manager   │  │ Service │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
└─────────────────────────────────────────────────────────────────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Discord API   │    │   GitHub API    │    │   SQLite DB     │
│                 │    │   REST v4       │    │   Config Store  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 1.2 レイヤード・アーキテクチャ
```
┌─────────────────────────────────────────────────────┐
│                Presentation Layer                   │
│            (Discord Event Handlers)                 │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│                Application Layer                    │
│        (Business Logic & Orchestration)            │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│                 Service Layer                       │
│         (GitHub API, Cache, Security)              │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│                Infrastructure Layer                 │
│        (Database, Logging, Monitoring)             │
└─────────────────────────────────────────────────────┘
```

## 2. コンポーネント設計

### 2.1 主要コンポーネント

#### 2.1.1 Core Components
```typescript
// Bot Entry Point
class DiscordBot {
  - client: Discord.Client
  - eventManager: EventManager
  - serviceContainer: ServiceContainer
  + initialize(): Promise<void>
  + start(): Promise<void>
  + shutdown(): Promise<void>
}

// Event Management
class EventManager {
  - handlers: Map<string, EventHandler[]>
  + registerHandler(event: string, handler: EventHandler): void
  + emit(event: string, data: any): Promise<void>
}

// Service Container (DI)
class ServiceContainer {
  - services: Map<string, any>
  + register<T>(name: string, service: T): void
  + get<T>(name: string): T
}
```

#### 2.1.2 Message Processing Components
```typescript
// Message Handler
class MessageHandler {
  - issueParser: IssueParser
  - githubService: GitHubService
  - embedBuilder: EmbedBuilder
  + handleMessage(message: Discord.Message): Promise<void>
  - processIssueReferences(content: string): Promise<Issue[]>
}

// Issue Parser
class IssueParser {
  - patterns: RegExp[]
  + extractIssueNumbers(content: string): IssueReference[]
  + validateIssueNumber(number: number): boolean
  - isInCodeBlock(content: string, position: number): boolean
}

// Issue Reference Model
interface IssueReference {
  number: number;
  pattern: string;
  position: number;
  repository?: string;
}
```

#### 2.1.3 GitHub Integration Components
```typescript
// GitHub Service
class GitHubService {
  - octokit: Octokit
  - cache: CacheManager
  - rateLimiter: RateLimiter
  + getIssue(owner: string, repo: string, number: number): Promise<Issue>
  + validateRepository(owner: string, repo: string): Promise<boolean>
  - handleApiError(error: RequestError): IssueError
}

// Cache Manager
class CacheManager {
  - cache: Map<string, CacheEntry>
  - ttl: number
  + get<T>(key: string): T | null
  + set<T>(key: string, value: T, ttl?: number): void
  + invalidate(key: string): void
  + cleanup(): void
}

// Rate Limiter
class RateLimiter {
  - requests: TimestampQueue
  - limit: number
  - window: number
  + checkLimit(): boolean
  + waitForAvailability(): Promise<void>
}
```

### 2.2 データモデル

#### 2.2.1 Core Models
```typescript
// Issue Model
interface Issue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  user: User;
  assignees: User[];
  labels: Label[];
  comments: number;
  created_at: string;
  updated_at: string;
  html_url: string;
  repository: Repository;
}

// Repository Model
interface Repository {
  owner: string;
  name: string;
  full_name: string;
  private: boolean;
  description?: string;
  url: string;
}

// Configuration Model
interface GuildConfig {
  guildId: string;
  repositories: RepositoryConfig[];
  enabled: boolean;
  settings: BotSettings;
  created_at: Date;
  updated_at: Date;
}

interface RepositoryConfig {
  owner: string;
  repo: string;
  alias?: string;
  enabled: boolean;
  channels?: string[]; // 特定チャンネルのみ有効
}

interface BotSettings {
  responseDelay: number;
  maxIssuesPerMessage: number;
  cacheTimeout: number;
  enableAnalytics: boolean;
}
```

## 3. データフロー設計

### 3.1 Issue参照フロー
```
1. Message Received
   ↓
2. Parse Issue Numbers (#100, git#123)
   ↓
3. Validate Issue Numbers
   ↓
4. Check Cache
   ↓ (Cache Miss)
5. GitHub API Request
   ↓
6. Process Response
   ↓
7. Cache Result
   ↓
8. Build Discord Embed
   ↓
9. Send Response
   ↓
10. Log Analytics
```

### 3.2 設定管理フロー
```
1. Admin Command Received
   ↓
2. Validate Permissions
   ↓
3. Parse Command Parameters
   ↓
4. Update Configuration
   ↓
5. Validate GitHub Repository
   ↓
6. Store in Database
   ↓
7. Update Runtime Cache
   ↓
8. Send Confirmation
```

## 4. データベース設計

### 4.1 テーブル構造
```sql
-- Guild Configuration
CREATE TABLE guild_configs (
    guild_id TEXT PRIMARY KEY,
    enabled BOOLEAN DEFAULT true,
    settings TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Repository Configuration
CREATE TABLE repositories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    owner TEXT NOT NULL,
    repo TEXT NOT NULL,
    alias TEXT,
    enabled BOOLEAN DEFAULT true,
    channels TEXT, -- JSON array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guild_id) REFERENCES guild_configs(guild_id),
    UNIQUE(guild_id, owner, repo)
);

-- Usage Analytics
CREATE TABLE usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT,
    channel_id TEXT,
    user_id TEXT,
    issue_number INTEGER,
    repository TEXT,
    success BOOLEAN,
    response_time INTEGER, -- milliseconds
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Cache Entries
CREATE TABLE cache_entries (
    cache_key TEXT PRIMARY KEY,
    data TEXT, -- JSON
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 インデックス設計
```sql
-- Performance Indexes
CREATE INDEX idx_repositories_guild_enabled ON repositories(guild_id, enabled);
CREATE INDEX idx_usage_logs_guild_date ON usage_logs(guild_id, created_at);
CREATE INDEX idx_cache_expires ON cache_entries(expires_at);

-- Cleanup Indexes
CREATE INDEX idx_usage_logs_cleanup ON usage_logs(created_at);
CREATE INDEX idx_cache_cleanup ON cache_entries(expires_at);
```

## 5. セキュリティアーキテクチャ

### 5.1 認証・認可
```typescript
// Security Manager
class SecurityManager {
  - tokenManager: TokenManager
  - permissionChecker: PermissionChecker
  + validateGitHubToken(): Promise<boolean>
  + checkBotPermissions(guild: Guild): BotPermissions
  + validateUserPermissions(user: User, action: string): boolean
}

// Token Management
class TokenManager {
  - encryptionKey: string
  + encryptToken(token: string): string
  + decryptToken(encryptedToken: string): string
  + rotateTokens(): Promise<void>
}

// Permission Checker
class PermissionChecker {
  + canManageBot(member: GuildMember): boolean
  + canUseBot(member: GuildMember, channel: Channel): boolean
  + hasRepositoryAccess(repository: string): Promise<boolean>
}
```

### 5.2 データ保護
```typescript
// Data Sanitizer
class DataSanitizer {
  + sanitizeIssueContent(content: string): string
  + maskSensitiveData(log: LogEntry): LogEntry
  + validateInput(input: any, schema: Schema): ValidationResult
}

// Audit Logger
class AuditLogger {
  + logSecurityEvent(event: SecurityEvent): void
  + logConfigChange(change: ConfigChange): void
  + logApiAccess(access: ApiAccess): void
}
```

## 6. パフォーマンス設計

### 6.1 キャッシュ戦略
```typescript
// Multi-Level Cache
class CacheStrategy {
  - memoryCache: Map<string, any>      // L1: In-Memory (60秒)
  - databaseCache: DatabaseCache       // L2: SQLite (5分)
  - distributedCache?: RedisCache      // L3: Redis (30分)
  
  + get(key: string): Promise<any>
  + set(key: string, value: any, ttl: number): Promise<void>
  + invalidate(pattern: string): Promise<void>
}

// Cache Keys
const CACHE_KEYS = {
  ISSUE: (owner: string, repo: string, number: number) => 
    `issue:${owner}:${repo}:${number}`,
  REPOSITORY: (owner: string, repo: string) => 
    `repo:${owner}:${repo}`,
  USER: (username: string) => 
    `user:${username}`,
  RATE_LIMIT: () => 
    'rate_limit:github'
};
```

### 6.2 非同期処理
```typescript
// Queue Manager
class QueueManager {
  - queues: Map<string, Queue>
  + addToQueue(queueName: string, job: Job): Promise<void>
  + processQueue(queueName: string): Promise<void>
  + getQueueStatus(queueName: string): QueueStatus
}

// Job Types
interface IssueProcessingJob {
  type: 'issue_processing';
  messageId: string;
  issueReferences: IssueReference[];
  guildId: string;
  channelId: string;
}

interface CacheCleanupJob {
  type: 'cache_cleanup';
  threshold: Date;
}
```

## 7. 監視・ログ設計

### 7.1 ログ構造
```typescript
// Log Levels
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

// Log Entry
interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  component: string;
  message: string;
  metadata?: Record<string, any>;
  traceId?: string;
  userId?: string;
  guildId?: string;
}

// Logger Interface
interface ILogger {
  debug(message: string, metadata?: any): void;
  info(message: string, metadata?: any): void;
  warn(message: string, metadata?: any): void;
  error(message: string, error?: Error, metadata?: any): void;
  fatal(message: string, error?: Error, metadata?: any): void;
}
```

### 7.2 メトリクス
```typescript
// Metrics Collector
class MetricsCollector {
  - counters: Map<string, number>
  - gauges: Map<string, number>
  - histograms: Map<string, number[]>
  
  + incrementCounter(name: string, value: number): void
  + setGauge(name: string, value: number): void
  + recordHistogram(name: string, value: number): void
  + getMetrics(): MetricsSnapshot
}

// Key Metrics
const METRICS = {
  ISSUES_PROCESSED: 'issues_processed_total',
  API_REQUESTS: 'github_api_requests_total',
  CACHE_HITS: 'cache_hits_total',
  CACHE_MISSES: 'cache_misses_total',
  RESPONSE_TIME: 'response_time_seconds',
  ERROR_RATE: 'error_rate_percent',
  ACTIVE_GUILDS: 'active_guilds_total'
};
```

## 8. 拡張性設計

### 8.1 プラグインアーキテクチャ
```typescript
// Plugin Interface
interface IBotPlugin {
  name: string;
  version: string;
  initialize(bot: DiscordBot): Promise<void>;
  shutdown(): Promise<void>;
  handleEvent?(event: BotEvent): Promise<void>;
}

// Plugin Manager
class PluginManager {
  - plugins: Map<string, IBotPlugin>
  + loadPlugin(plugin: IBotPlugin): Promise<void>
  + unloadPlugin(name: string): Promise<void>
  + getPlugin(name: string): IBotPlugin | null
}
```

### 8.2 設定の動的更新
```typescript
// Config Watcher
class ConfigWatcher {
  - watchers: Map<string, FileWatcher>
  + watchConfig(path: string, callback: ConfigChangeCallback): void
  + stopWatching(path: string): void
  - reloadConfig(configPath: string): Promise<void>
}

// Hot Reload Support
class HotReloader {
  + reloadModule(modulePath: string): Promise<void>
  + reloadServices(): Promise<void>
  + validateConfiguration(config: any): ValidationResult
}
```

## 9. エラーハンドリング設計

### 9.1 エラー階層
```typescript
// Base Error
abstract class BotError extends Error {
  abstract code: string;
  abstract statusCode: number;
  abstract userMessage: string;
  
  constructor(message: string, public cause?: Error) {
    super(message);
  }
}

// Specific Errors
class GitHubApiError extends BotError {
  code = 'GITHUB_API_ERROR';
  statusCode = 503;
  userMessage = 'GitHub APIにアクセスできません';
}

class IssueNotFoundError extends BotError {
  code = 'ISSUE_NOT_FOUND';
  statusCode = 404;
  userMessage = 'Issue が見つかりません';
}

class RateLimitError extends BotError {
  code = 'RATE_LIMIT_EXCEEDED';
  statusCode = 429;
  userMessage = 'しばらく時間をおいて再試行してください';
}
```

### 9.2 回復処理
```typescript
// Retry Manager
class RetryManager {
  + async retry<T>(
    operation: () => Promise<T>,
    options: RetryOptions
  ): Promise<T>
  
  - calculateBackoff(attempt: number, options: RetryOptions): number
  - shouldRetry(error: Error, attempt: number, options: RetryOptions): boolean
}

// Circuit Breaker
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  + async execute<T>(operation: () => Promise<T>): Promise<T>
  - recordSuccess(): void
  - recordFailure(): void
  - shouldAttempt(): boolean
}
```

この設計により、スケーラブルで保守性の高いDiscord GitHub連携Botを構築できます。