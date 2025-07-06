# Discord GitHub Bot 招待手順

## 必要な権限
このBotは以下の権限が必要です：

### テキスト権限
- ✅ メッセージを送信
- ✅ 埋め込みリンク
- ✅ メッセージ履歴を読む
- ✅ チャンネルを見る

### アプリケーション権限
- ✅ スラッシュコマンドを使用

## 招待手順

### ステップ 1: Application ID の確認
1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. あなたのBotアプリケーションを選択
3. 「General Information」タブで Application ID をコピー

### ステップ 2: 招待URLの作成
以下のURLの `YOUR_APPLICATION_ID` を実際のIDに置き換えてください：

```
https://discord.com/oauth2/authorize?client_id=YOUR_APPLICATION_ID&permissions=139586890752&scope=bot%20applications.commands
```

### ステップ 3: サーバーに招待
1. 上記URLをブラウザで開く
2. 招待先のサーバーを選択
3. 権限を確認して「認証」をクリック
4. Bot の招待完了

## 動作テスト

Bot が招待できたら、以下でテストできます：

### Issue番号の検出テスト
Discordチャンネルで以下のメッセージを送信：
```
#123
git#456
```

### 設定されているリポジトリの確認
現在は環境変数 `DEFAULT_REPOSITORY` で設定されたリポジトリを使用します。
例：`microsoft/vscode`

## トラブルシューティング

### よくある問題
1. **Bot がメッセージに反応しない**
   - Bot が正常に起動しているか確認
   - 必要な権限が付与されているか確認
   - チャンネルを見る権限があるか確認

2. **GitHub API エラー**
   - GitHub トークンが有効か確認
   - リポジトリ名が正しいか確認
   - APIレート制限に達していないか確認

3. **データベースエラー**
   - `data/` ディレクトリが作成されているか確認
   - 書き込み権限があるか確認

## 環境変数の設定

`.env` ファイルに以下が設定されていることを確認：

```env
DISCORD_BOT_TOKEN=your_discord_bot_token
GITHUB_TOKEN=your_github_token
DEFAULT_REPOSITORY=owner/repo
DATABASE_PATH=./data/bot.db
CACHE_TTL=300
LOG_LEVEL=info
```

## Bot の起動

```bash
# 開発モード
npm run dev

# 本番モード
npm run build && npm start
```