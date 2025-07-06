# Discord ID取得ガイド

## 📋 手順

### 1. 開発者モードを有効化
1. Discord設定（⚙️）→ 詳細設定 → 開発者モード：**ON**

### 2. チャンネルIDの取得
1. 投稿したいチャンネルを **右クリック**
2. **「IDをコピー」** をクリック
3. コピーしたIDを `TARGET_CHANNEL_ID` に設定

### 3. サーバーIDの取得
1. サーバー名（左サイドバー）を **右クリック**
2. **「IDをコピー」** をクリック  
3. コピーしたIDを `TARGET_GUILD_ID` に設定

## 📄 .env設定例

```env
# 取得したIDを設定（#を外してコメントアウト解除）
TARGET_CHANNEL_ID=1234567890123456789
TARGET_GUILD_ID=9876543210987654321
```

## ⚠️ 注意点

- IDは18-19桁の数字です
- `#` を外して実際のIDに置き換えてください
- 権限：Botがそのチャンネル/サーバーに参加している必要があります

## 🔍 ID確認方法

正しく取得できているかの確認：

```bash
# .envファイルの内容を確認
cat .env | grep TARGET
```

## 🤖 使用例

### スラッシュコマンドで使用：
```
/send issue:123 channel:#target-channel
```

### プログラムで直接送信：
```javascript
await notifier.sendIssueToChannel(process.env.TARGET_CHANNEL_ID, issueData);
```