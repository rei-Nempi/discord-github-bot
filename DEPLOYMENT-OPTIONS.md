# Discord Bot デプロイメントオプション

## 🏠 ローカル環境

### 1. PM2（推奨）
**メリット:**
- ✅ 簡単セットアップ
- ✅ 自動再起動
- ✅ ログ管理
- ✅ モニタリング機能

**使用方法:**
```bash
npm install -g pm2
npm run pm2:start
```

### 2. systemd（Linux/macOS）
**メリット:**
- ✅ システムレベル管理
- ✅ 高い安定性
- ✅ OS標準機能

**使用方法:**
```bash
sudo cp discord-bot.service /etc/systemd/system/
sudo systemctl enable discord-bot
sudo systemctl start discord-bot
```

### 3. nohup（シンプル）
**メリット:**
- ✅ 追加ツール不要
- ✅ 軽量

**使用方法:**
```bash
npm run build
nohup node dist/index.js > bot.log 2>&1 &
```

## ☁️ クラウドサービス

### 1. Railway（推奨）
**メリット:**
- ✅ 無料プラン有り
- ✅ GitHub連携
- ✅ 自動デプロイ

**手順:**
1. GitHub リポジトリ作成
2. Railway でプロジェクト作成
3. 環境変数設定

### 2. Render
**メリット:**
- ✅ 無料プラン有り
- ✅ 簡単デプロイ

### 3. Heroku
**メリット:**
- ✅ 実績豊富
- ✅ アドオン充実

**注意:** 無料プランは廃止済み

### 4. DigitalOcean
**メリット:**
- ✅ 高性能
- ✅ 柔軟性

**料金:** $4/月〜

### 5. AWS EC2
**メリット:**
- ✅ 高い拡張性
- ✅ 豊富なサービス

## 🐳 Docker

### Dockerfile例
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY .env ./

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### docker-compose.yml例
```yaml
version: '3.8'
services:
  discord-bot:
    build: .
    restart: unless-stopped
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
```

## 📊 比較表

| 方法 | 費用 | 設定難易度 | 安定性 | 推奨度 |
|------|------|------------|--------|--------|
| PM2 | 無料 | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| systemd | 無料 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| nohup | 無料 | ⭐ | ⭐⭐ | ⭐⭐ |
| Railway | 無料〜 | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Render | 無料〜 | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Docker | 無料 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

## 🎯 推奨デプロイ戦略

### 開発・テスト環境
```bash
npm run dev  # 開発時
npm run pm2:start  # テスト時
```

### 本番環境（ローカル）
```bash
npm run pm2:start
npm run pm2:startup  # 自動起動設定
```

### 本番環境（クラウド）
1. Railway または Render を選択
2. GitHub連携で自動デプロイ
3. 環境変数を設定
4. モニタリング設定

## ⚠️ 注意事項

1. **環境変数の管理**
   - `.env` ファイルをGitにコミットしない
   - 本番では環境変数で管理

2. **ログ管理**
   - ログローテーション設定
   - ディスク容量の監視

3. **バックアップ**
   - データベースファイル
   - 設定ファイル

4. **監視**
   - プロセス死活監視
   - メモリ使用量監視