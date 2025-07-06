# Discord GitHub Bot

Discord bot for GitHub issue integration that automatically displays issue information when issue numbers are mentioned in Discord messages.

## Features

- Automatic issue number detection (#123 or git#123)
- Rich embed display with issue details
- Caching for performance optimization
- Rate limit handling
- Multi-repository support

## Prerequisites

- Node.js 18.0.0 or higher
- Discord Bot Token
- GitHub Personal Access Token
- SQLite3

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/discord-github-bot.git
cd discord-github-bot
```

2. Install dependencies:
```bash
npm install
```

3. Copy the environment variables template:
```bash
cp .env.example .env
```

4. Configure your `.env` file with the required tokens and settings.

## Configuration

Edit the `.env` file with your configuration:

- `DISCORD_BOT_TOKEN`: Your Discord bot token
- `DISCORD_CLIENT_ID`: Your Discord application client ID
- `GITHUB_TOKEN`: Your GitHub personal access token
- `GITHUB_OWNER`: Default repository owner
- `GITHUB_REPO`: Default repository name

## Development

### Running in development mode:
```bash
npm run dev
```

### Building the project:
```bash
npm run build
```

### Running tests:
```bash
npm test
```

### Linting:
```bash
npm run lint
```

### Type checking:
```bash
npm run typecheck
```

## Project Structure

```
discord-github-bot/
├── src/
│   ├── commands/      # Discord slash commands
│   ├── events/        # Discord event handlers
│   ├── handlers/      # Message and interaction handlers
│   ├── services/      # Business logic (GitHub API, Cache, etc.)
│   ├── utils/         # Utility functions
│   └── types/         # TypeScript type definitions
├── tests/
│   ├── unit/          # Unit tests
│   └── integration/   # Integration tests
├── data/              # SQLite database storage
└── dist/              # Compiled JavaScript output
```

## Usage

1. Start the bot:
```bash
npm start
```

2. In Discord, mention an issue number in any message:
   - Example: "Check out issue #123"
   - Example: "This is related to git#456"

3. The bot will automatically fetch and display the issue information in an embed.

## Commands

- `!github set-repo owner/repository-name` - Set the repository for the current server
- `!github list-repos` - List configured repositories
- `!github remove-repo owner/repository-name` - Remove a repository configuration

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.