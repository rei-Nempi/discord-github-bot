# PM2でDiscord Botを常時起動させる方法

## 📋 セットアップ手順

### 1. PM2をインストール
```bash
npm install -g pm2
```

### 2. Botを起動
```bash
npm run pm2:start
```

### 3. システム起動時に自動起動を設定（オプション）
```bash
npm run pm2:startup
# 表示されたコマンドをコピーして実行
```

## 🎛️ PM2コマンド

### 基本操作
```bash
# Botを起動
npm run pm2:start

# Botを停止
npm run pm2:stop

# Botを再起動
npm run pm2:restart

# ステータス確認
npm run pm2:status

# ログを確認
npm run pm2:logs
```

### 詳細なPM2コマンド
```bash
# プロセス一覧表示
pm2 list

# モニタリング
pm2 monit

# ログをリアルタイム表示
pm2 logs discord-github-bot --lines 50

# プロセス詳細情報
pm2 show discord-github-bot

# 設定をリロード
pm2 reload ecosystem.config.js

# 全プロセス停止
pm2 stop all

# 全プロセス削除
pm2 delete all
```

## 📊 ログ管理

### ログの場所
- **結合ログ**: `./logs/combined.log`
- **標準出力**: `./logs/out.log`
- **エラーログ**: `./logs/error.log`

### ログローテーション設定
```bash
# PM2-logrotateをインストール
pm2 install pm2-logrotate

# 設定
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```

## 🔧 設定ファイル（ecosystem.config.js）

主要な設定項目：
- **instances**: 1（単一インスタンス）
- **autorestart**: true（自動再起動）
- **max_memory_restart**: 1G（メモリ制限）
- **max_restarts**: 10（最大再起動回数）
- **min_uptime**: 10s（最小稼働時間）

## ⚠️ トラブルシューティング

### Bot が起動しない場合
```bash
# ログを確認
npm run pm2:logs

# 手動ビルド
npm run build

# 設定ファイルをチェック
pm2 show discord-github-bot
```

### メモリ使用量が多い場合
```bash
# メモリ使用量を確認
pm2 monit

# 制限値を調整（ecosystem.config.js）
max_memory_restart: '512M'
```

### 環境変数が読み込まれない場合
```bash
# .envファイルの場所を確認
ls -la .env

# 手動で環境変数を設定
pm2 set discord-github-bot:NODE_ENV production
```

## 🚀 本番運用のベストプラクティス

1. **定期的なログ確認**
   ```bash
   npm run pm2:logs
   ```

2. **システム監視**
   ```bash
   pm2 monit
   ```

3. **定期的な再起動**（必要に応じて）
   ```bash
   # 毎日深夜2時に再起動（crontab例）
   0 2 * * * /usr/local/bin/pm2 restart discord-github-bot
   ```

4. **バックアップ**
   - `.env` ファイル
   - `data/` ディレクトリ（データベース）
   - ログファイル

## 💡 その他のオプション

### systemd（Linux）
- システムサービスとして登録
- より高い安定性

### Docker
- コンテナ化による分離
- 環境の一貫性

### クラウドサービス
- Heroku
- Railway
- Render
- DigitalOcean

PM2が最もシンプルで効果的な解決策です！