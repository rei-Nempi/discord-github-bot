# Discord GitHub Bot

GitHubのIssue情報をDiscordチャンネルに表示するBotです。

## 🌟 主な機能

- `/send #123` コマンドでGitHub Issue情報を指定チャンネルに投稿
- Issue情報をリッチな埋め込み形式で表示
- ステータスによる色分け（Open: 緑、Closed: 赤、Draft: 黄）
- 5分間のキャッシュ機能でAPIレート制限を回避
- 24時間365日稼働（Railway使用）

## 🚀 使い方

### コマンド

```
/send #123
```

- Issue番号（#123 または 123）を指定して、Issue情報を投稿します
- 投稿先は環境変数で設定した特定チャンネルになります

## 🔧 必要な環境

- Node.js 18.0.0以上
- Discord Bot Token
- GitHub Personal Access Token
- SQLite3

## 📦 インストール

1. リポジトリをクローン:

```bash
git clone https://github.com/rei-Nempi/discord-github-bot.git
cd discord-github-bot
```

2. 依存関係をインストール:

```bash
npm install
```

3. 環境変数を設定:

```bash
cp .env.example .env
```

4. `.env`ファイルを編集:

```env
DISCORD_BOT_TOKEN=あなたのDiscordボットトークン
GITHUB_TOKEN=あなたのGitHubトークン
TARGET_CHANNEL_ID=投稿先チャンネルID
TARGET_GUILD_ID=サーバーID
DEFAULT_REPOSITORY=microsoft/vscode
```

## 🏃 開発

### 開発モードで実行:

```bash
npm run dev
```

### ビルド:

```bash
npm run build
```

### 本番環境で実行:

```bash
npm start
```

### PM2で常時起動:

```bash
npm run pm2:start
```

### その他のコマンド:

```bash
npm run lint        # Lintチェック
npm run typecheck   # 型チェック
npm test           # テスト実行
```

## 📁 プロジェクト構造

```
discord-github-bot/
├── src/
│   ├── commands/      # Discordスラッシュコマンド
│   ├── events/        # Discordイベントハンドラー
│   ├── handlers/      # メッセージ処理
│   ├── services/      # GitHub API、キャッシュ管理
│   ├── database/      # データベース管理
│   ├── utils/         # ユーティリティ関数
│   └── types/         # TypeScript型定義
├── docs/              # 設計ドキュメント
├── dist/              # ビルド出力
└── data/              # SQLiteデータベース
```

## ☁️ デプロイ（Railway）

1. GitHubにプッシュ
2. Railwayでプロジェクト作成
3. 環境変数を設定
4. 自動デプロイ完了

詳細は[DEPLOYMENT-OPTIONS.md](./DEPLOYMENT-OPTIONS.md)を参照

## 🔐 必要な権限

### Discord Bot権限

- Send Messages
- Embed Links
- Use Slash Commands
- Read Message History

### Discord Developer Portal設定

- Message Content Intentを有効化

## 🛠️ トラブルシューティング

### Botがオンラインにならない

- Discord Developer PortalでMessage Content Intentが有効か確認
- DISCORD_BOT_TOKENが正しく設定されているか確認

### Issue情報が表示されない

- GITHUB_TOKENが正しく設定されているか確認
- GitHubトークンに必要な権限があるか確認

## 📝 今後の機能追加予定

- [ ] 複数リポジトリ対応
- [ ] PR情報表示
- [ ] Issue作成機能
- [ ] 通知機能

## 🤝 コントリビューション

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. Pull Requestを作成

## 📄 ライセンス

MITライセンス
