# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Commands

- `npm run dev` - Start development server with hot reload (uses tsx watch)
- `npm run build` - Compile TypeScript to JavaScript in dist/
- `npm start` - Run production build from dist/
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode for TDD
- `npm run test:coverage` - Generate coverage report
- `npm run lint` - Check code style issues
- `npm run lint:fix` - Auto-fix linting issues
- `npm run typecheck` - Verify TypeScript types without building

### Running Single Tests

```bash
npm test -- path/to/specific.test.ts
npm test -- --testNamePattern="specific test name"
```

## Architecture Overview

This Discord bot integrates GitHub issues into Discord channels using an event-driven architecture:

### Core Flow

1. **Message Detection**: Bot monitors Discord messages for issue patterns (#123 or git#123)
2. **GitHub Integration**: Uses Octokit to fetch issue data from GitHub API
3. **Caching Layer**: node-cache prevents excessive API calls (5-minute TTL)
4. **Rich Display**: Renders GitHub issues as Discord embeds with color-coding
5. **Configuration Storage**: SQLite database stores per-server repository settings

### Key Architectural Decisions

- **Event-Driven Design**: Separates Discord events from business logic through handler pattern
- **Service Layer**: GitHub API, caching, and database operations are isolated in services/
- **Type Safety**: Full TypeScript coverage with strict mode enabled
- **Error Boundaries**: Each layer handles its own errors with appropriate fallbacks
- **Rate Limiting**: Built-in protection for both Discord and GitHub API limits

### Module Responsibilities

- `src/events/`: Discord.js event listeners (ready, messageCreate, interactionCreate)
- `src/handlers/`: Process messages and commands, coordinate between services
- `src/services/`: External integrations (GitHub API, cache, database)
- `src/commands/`: Slash command implementations for bot configuration
- `src/utils/`: Cross-cutting concerns like logging

## Key Requirements

From docs/requirements.md:

- Issue detection patterns: `#123` and `git#123` (excluding URLs, code blocks, quotes)
- Cache TTL: 5 minutes for issue data
- Performance: 3-second response time (95%ile), 50 requests/second
- GitHub API limit: 5000 requests/hour
- Discord embeds color-coded: Open (green), Closed (red), Draft (yellow)

## Testing Strategy

- Unit tests mock external dependencies (Discord.js, Octokit, SQLite)
- Integration tests use in-memory SQLite and API mocks
- Test setup in `tests/setup.ts` suppresses console output
- Use `@/` alias for importing from src/ in tests

## Configuration

Environment variables (see .env.example):

- `DISCORD_BOT_TOKEN`: Required for bot authentication
- `GITHUB_TOKEN`: Personal access token for GitHub API
- `DATABASE_PATH`: SQLite file location (default: ./data/bot.db)
- `CACHE_TTL`: Cache duration in seconds (default: 300)
- `LOG_LEVEL`: Winston log level (default: info)

## Database Schema

SQLite tables for configuration:

- Server settings: guild_id, repository mappings, enabled status
- Repository cache: owner/repo pairs with metadata
- User preferences: per-user notification settings

##　重要
必ず日本語で出力してください

### Voice Notification Rules

- **全てのタスク完了時には必ずVOICEVOXの音声通知機能を使用すること**
- **重要なお知らせやエラー発生時にも音声通知を行うこと**
- **音声通知の設定: speaker=1, speedScale=1.3を使用すること**
- **英単語は適切にカタカナに変換してVOICEVOXに送信すること**
- **VOICEVOXに送信するテキストは不要なスペースを削除すること**
- **1回の音声通知は100文字以内でシンプルに話すこと**
- **以下のタイミングで細かく音声通知を行うこと：**
  - 命令受領時: 「了解です」「承知しました」
  - 作業開始時: 「〜を開始します」
  - 作業中: 「調査中です」「修正中です」
  - 進捗報告: 「半分完了です」「もう少しです」
  - 完了時: 「完了です」「修正完了です」
- **詳しい技術的説明は音声通知に含めず、結果のみを簡潔に報告すること**
