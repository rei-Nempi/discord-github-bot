// Discord GitHub Bot Type Definitions

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  draft?: boolean;
  user: {
    login: string;
    avatar_url: string;
  };
  labels: Array<{
    name: string;
    color: string;
  }>;
  created_at: string;
  updated_at: string;
  comments: number;
  html_url: string;
  repository?: {
    name: string;
    full_name: string;
    owner: {
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

// Constants
export const EMBED_COLORS: EmbedColor = {
  OPEN: 0x28a745,   // Green
  CLOSED: 0xdc3545, // Red
  DRAFT: 0xffc107,  // Yellow
  ERROR: 0x6c757d   // Gray
};

export const ISSUE_PATTERNS = {
  STANDARD: /(?:^|\s)#(\d{1,5})(?:\s|$)/g,
  GIT_PREFIXED: /(?:^|\s)git#(\d{1,5})(?:\s|$)/g,
  EXCLUDE_URLS: /https?:\/\/[^\s]+/g,
  EXCLUDE_CODE_BLOCKS: /```[\s\S]*?```/g,
  EXCLUDE_INLINE_CODE: /`[^`]+`/g,
  EXCLUDE_QUOTES: /^>\s/gm
};

export const CACHE_KEYS = {
  GITHUB_ISSUE: (owner: string, repo: string, number: number) => `github:issue:${owner}:${repo}:${number}`,
  GITHUB_REPO: (owner: string, repo: string) => `github:repo:${owner}:${repo}`,
  RATE_LIMIT: 'github:rate_limit',
  GUILD_CONFIG: (guildId: string) => `guild:config:${guildId}`
};

export const BOT_LIMITS = {
  MAX_ISSUES_PER_MESSAGE: 3,
  MAX_EMBED_DESCRIPTION_LENGTH: 2048,
  MAX_EMBED_FIELD_VALUE_LENGTH: 1024,
  CACHE_TTL_SECONDS: 300, // 5 minutes
  RATE_LIMIT_RESET_BUFFER: 60 // seconds
};