-- Discord GitHub Bot Database Schema
-- SQLite Database Schema for configuration and caching

-- Guild configurations table
CREATE TABLE IF NOT EXISTS guild_configs (
    guild_id TEXT PRIMARY KEY,
    repository TEXT,  -- format: "owner/repo"
    enabled BOOLEAN DEFAULT TRUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Repository cache table
CREATE TABLE IF NOT EXISTS repositories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner TEXT NOT NULL,
    repo TEXT NOT NULL,
    full_name TEXT NOT NULL,
    description TEXT,
    private BOOLEAN DEFAULT FALSE,
    html_url TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(owner, repo)
);

-- Issue cache table
CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY,
    number INTEGER NOT NULL,
    owner TEXT NOT NULL,
    repo TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    state TEXT NOT NULL CHECK (state IN ('open', 'closed')),
    draft BOOLEAN DEFAULT FALSE,
    user_login TEXT NOT NULL,
    user_avatar_url TEXT,
    labels TEXT, -- JSON array of labels
    comments INTEGER DEFAULT 0,
    html_url TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    cached_at TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    UNIQUE(owner, repo, number)
);

-- Usage statistics table
CREATE TABLE IF NOT EXISTS usage_stats (
    guild_id TEXT PRIMARY KEY,
    command_count INTEGER DEFAULT 0,
    issue_requests INTEGER DEFAULT 0,
    cache_hits INTEGER DEFAULT 0,
    cache_misses INTEGER DEFAULT 0,
    last_used TEXT DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Rate limit tracking table
CREATE TABLE IF NOT EXISTS rate_limits (
    resource TEXT PRIMARY KEY,
    limit_count INTEGER NOT NULL,
    remaining INTEGER NOT NULL,
    reset_at TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_guild_configs_enabled ON guild_configs(enabled);
CREATE INDEX IF NOT EXISTS idx_repositories_owner_repo ON repositories(owner, repo);
CREATE INDEX IF NOT EXISTS idx_issues_owner_repo_number ON issues(owner, repo, number);
CREATE INDEX IF NOT EXISTS idx_issues_expires_at ON issues(expires_at);
CREATE INDEX IF NOT EXISTS idx_usage_stats_last_used ON usage_stats(last_used);

-- Triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_guild_configs_timestamp
    AFTER UPDATE ON guild_configs
    FOR EACH ROW
BEGIN
    UPDATE guild_configs SET updated_at = CURRENT_TIMESTAMP WHERE guild_id = NEW.guild_id;
END;

CREATE TRIGGER IF NOT EXISTS update_repositories_timestamp
    AFTER UPDATE ON repositories
    FOR EACH ROW
BEGIN
    UPDATE repositories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_usage_stats_timestamp
    AFTER UPDATE ON usage_stats
    FOR EACH ROW
BEGIN
    UPDATE usage_stats SET updated_at = CURRENT_TIMESTAMP WHERE guild_id = NEW.guild_id;
END;

-- Cleanup expired cache entries
CREATE TRIGGER IF NOT EXISTS cleanup_expired_issues
    AFTER INSERT ON issues
    FOR EACH ROW
BEGIN
    DELETE FROM issues WHERE expires_at < CURRENT_TIMESTAMP;
END;