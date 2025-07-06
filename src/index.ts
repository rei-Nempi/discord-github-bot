// ==================================================
// 外部ライブラリのインポート（外部から機能を借りてくる）
// ==================================================

// dotenv: .envファイルから環境変数を読み込むためのライブラリ
// 例: DISCORD_BOT_TOKEN=abc123 → process.env.DISCORD_BOT_TOKENで取得可能
import { config } from 'dotenv';

// discord.js: Discord APIを簡単に使うためのライブラリ
// - Client: Discordに接続するためのメインクラス
// - GatewayIntentBits: Botがどんな情報を受け取るかを設定するもの
// - Collection: Map（辞書）のような便利なデータ構造
import { Client, GatewayIntentBits, Collection } from 'discord.js';

// ==================================================
// 自分で作ったファイルのインポート
// ==================================================

// ログ出力を管理するユーティリティ関数
// console.logより高機能で、ファイルに保存したりレベル分けができる
import { createLogger } from './utils/logger';

// データベースを閉じるための関数
// アプリケーション終了時にデータベース接続を安全に切断する
import { closeDatabase } from './database/index';

// Node.js標準ライブラリ
// fs: ファイルシステム操作（ファイル読み書き）
// path: ファイルパスの操作（フォルダの区切り文字などを自動調整）
import fs from 'fs';
import path from 'path';

// ==================================================
// 環境変数の読み込み
// ==================================================

/**
 * .envファイルから環境変数を読み込む
 *
 * 【環境変数とは？】
 * アプリケーションの設定値を外部ファイルに保存する仕組み
 * 例: DISCORD_BOT_TOKEN=abc123
 *
 * 【なぜ使うの？】
 * - セキュリティ: トークンなどの秘密情報をコードに直接書かない
 * - 柔軟性: 環境（開発・本番）ごとに設定を変更できる
 */
try {
  config(); // .envファイルを読み込んでprocess.envに設定
} catch (error) {
  // エラーが発生した場合はコンソールに出力
  // 通常のconsole.errorを使用（まだloggerが初期化されていないため）
  console.error('Error loading dotenv:', error);
}

// ==================================================
// ログシステムの初期化
// ==================================================

/**
 * ロガー（ログ出力システム）を作成
 *
 * 【ロガーとは？】
 * console.logの高機能版。以下の機能がある：
 * - レベル分け: info, warn, error など
 * - ファイル保存: ログをファイルに自動保存
 * - タイムスタンプ: いつのログかを記録
 * - フォーマット: 見やすい形式で出力
 */
const logger = createLogger('main'); // 'main'はこのファイルの識別名

// ==================================================
// Discord クライアントの作成
// ==================================================

/**
 * Discord クライアント（Bot）を作成
 *
 * 【Clientとは？】
 * DiscordのAPIと通信するためのメインオブジェクト
 * 人間がDiscordアプリを使うように、BotがDiscordに接続するための「アプリ」
 *
 * 【Intentsとは？】
 * Botがどんな情報を受け取りたいかをDiscordに伝える設定
 * プライバシー保護のため、必要な情報だけを指定する必要がある
 */
const client = new Client({
  intents: [
    // Guilds: サーバー（ギルド）の基本情報を受け取る
    // 例: サーバー名、チャンネル一覧、メンバー数など
    GatewayIntentBits.Guilds,

    // GuildMessages: サーバー内のメッセージイベントを受け取る
    // 例: メッセージが投稿された、編集された、削除されたなど
    GatewayIntentBits.GuildMessages,

    // MessageContent: メッセージの内容を読み取る権限
    // 注意: 2022年以降、これは特別な権限申請が必要
    GatewayIntentBits.MessageContent,
  ],
});

// ==================================================
// コマンド管理システムの準備
// ==================================================

/**
 * スラッシュコマンドを管理するコレクションを作成
 *
 * 【Collection とは？】
 * Map（辞書・連想配列）の強化版
 * キー（コマンド名）と値（コマンドオブジェクト）を関連付けて保存
 *
 * 【なぜ (client as any) を使うの？】
 * TypeScriptの型チェックを一時的に無効にするため
 * discord.jsのClientクラスには標準でcommandsプロパティがないが、
 * カスタムプロパティとして追加している
 */
(client as any).commands = new Collection();

// ==================================================
// イベントハンドラー読み込み関数
// ==================================================

/**
 * イベントハンドラーを読み込む関数
 *
 * 【イベントハンドラーとは？】
 * 「何かが起きたときに実行される関数」のこと
 * 例: メッセージが投稿されたとき、Botがサーバーに参加したときなど
 *
 * 【この関数の役割】
 * 1. eventsフォルダ内の全ファイルを自動検索
 * 2. 各ファイルからイベント処理コードを読み込み
 * 3. Discord.jsのイベントシステムに登録
 *
 * 【非同期関数（async）とは？】
 * 時間のかかる処理（ファイル読み込みなど）を行う関数
 * awaitキーワードで処理の完了を待つことができる
 */
async function loadEvents() {
  // __dirnameは現在のファイルがあるフォルダのパス
  // path.joinでフォルダパスを安全に結合（OSの違いに対応）
  const eventsPath = path.join(__dirname, 'events');
  console.log('Loading events from:', eventsPath);

  /**
   * ディレクトリ内のファイル一覧を取得してフィルタリング
   *
   * 【fs.readdirSync とは？】
   * フォルダ内のファイル・フォルダ名を配列で取得する関数
   *
   * 【filter とは？】
   * 配列から条件に合う要素だけを取り出す関数
   * ここでは「.jsで終わる」かつ「.d.tsで終わらない」ファイルのみ
   */
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith('.js') && !file.endsWith('.d.ts'));

  // 各イベントファイルを順番に処理
  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    console.log(`Loading event file: ${file}`);

    try {
      /**
       * require() でファイルを読み込み
       *
       * 【require とは？】
       * 他のJavaScriptファイルを読み込んで、その中身を取得する関数
       * import文の古い書き方（CommonJS形式）
       */
      const event = require(filePath);

      /**
       * イベントリスナーの登録
       *
       * 【once vs on の違い】
       * - once: 一度だけ実行される（例: Bot起動時の初期化）
       * - on: 何度でも実行される（例: メッセージ受信時の処理）
       *
       * 【...args とは？】
       * 「残りの引数をすべて」という意味（スプレッド構文）
       * イベントから渡される引数の数が不明でも対応できる
       */
      if (event.default.once) {
        // 一度だけ実行されるイベント（例: ready イベント）
        client.once(event.default.name, (...args) => event.default.execute(...args));
      } else {
        // 繰り返し実行されるイベント（例: messageCreate イベント）
        client.on(event.default.name, (...args) => event.default.execute(...args));
      }

      logger.info(`Loaded event: ${event.default.name}`);
    } catch (error) {
      // ファイル読み込みエラーの処理
      console.error(`Error loading event ${file}:`, error);
      throw error; // エラーを上位に投げ直して処理を停止
    }
  }
}

// ==================================================
// スラッシュコマンド読み込み関数
// ==================================================

/**
 * スラッシュコマンドを読み込む関数
 *
 * 【スラッシュコマンドとは？】
 * Discord上で「/コマンド名」で実行できる機能
 * 例: /send #123 → Issue情報を送信
 *
 * 【この関数の役割】
 * 1. commandsフォルダ内のコマンドファイルを自動検索
 * 2. 各コマンドの設定とロジックを読み込み
 * 3. Botのコマンドコレクションに登録
 */
async function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');

  /**
   * commandsディレクトリの存在確認
   *
   * 【fs.existsSync とは？】
   * 指定されたパス（ファイルやフォルダ）が存在するかを確認する関数
   * 戻り値: true（存在する）/ false（存在しない）
   */
  if (!fs.existsSync(commandsPath)) {
    logger.info('Commands directory not found, skipping command loading');
    return; // 関数を終了（以降の処理をスキップ）
  }

  /**
   * コマンドファイルの一覧を取得
   * イベントファイルと同様の処理
   */
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith('.js') && !file.endsWith('.d.ts'));

  // 各コマンドファイルを順番に処理
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    /**
     * コマンドの構造チェック
     *
     * 【なぜチェックが必要？】
     * コマンドファイルには以下が必須:
     * - data: コマンドの設定（名前、説明、オプションなど）
     * - execute: 実際に実行される処理
     *
     * 【'data' in command.default とは？】
     * オブジェクトに特定のプロパティが存在するかを確認する書き方
     */
    if ('data' in command.default && 'execute' in command.default) {
      /**
       * コマンドをコレクションに登録
       *
       * 【.set() とは？】
       * Map/Collectionにキーと値のペアを保存する関数
       * ここでは: キー=コマンド名、値=コマンドオブジェクト
       */
      (client as any).commands.set(command.default.data.name, command.default);
      logger.info(`Loaded command: ${command.default.data.name}`);
    } else {
      // 必須プロパティが不足している場合の警告
      logger.warn(`Command at ${filePath} is missing required "data" or "execute" property`);
    }
  }
}

/**
 * Botの起動処理を行うメイン関数
 * 環境変数の検証、イベント・コマンドの読み込み、
 * Discordへのログインを実行する
 */
async function main() {
  try {
    logger.info('Starting Discord GitHub Bot...');

    // 環境変数の設定状況を確認
    console.log('=== Environment Variables Check ===');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('DISCORD_BOT_TOKEN:', process.env.DISCORD_BOT_TOKEN ? 'Set' : 'Not set');
    console.log('GITHUB_TOKEN:', process.env.GITHUB_TOKEN ? 'Set' : 'Not set');
    console.log('TARGET_CHANNEL_ID:', process.env.TARGET_CHANNEL_ID);
    console.log('TARGET_GUILD_ID:', process.env.TARGET_GUILD_ID);
    console.log('================================');

    // 必須環境変数の検証
    if (!process.env.DISCORD_BOT_TOKEN) {
      console.error('ERROR: DISCORD_BOT_TOKEN is not set in Railway Variables!');
      throw new Error('DISCORD_BOT_TOKEN is required');
    }

    if (!process.env.GITHUB_TOKEN) {
      console.error('ERROR: GITHUB_TOKEN is not set in Railway Variables!');
      throw new Error('GITHUB_TOKEN is required');
    }

    // イベントハンドラーを読み込み
    await loadEvents();
    logger.info('Events loaded successfully');

    // コマンドを読み込み
    await loadCommands();
    logger.info('Commands loaded successfully');

    // Discordにログイン
    logger.info('Attempting to login to Discord...');
    await client.login(process.env.DISCORD_BOT_TOKEN);
    logger.info('Successfully logged in to Discord');
  } catch (error) {
    logger.error('Failed to start bot:', error);
    console.error('CRITICAL ERROR:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    process.exit(1);
  }
}

/**
 * グレースフルシャットダウンを処理する関数
 * データベース接続のクローズとDiscordクライアントの
 * 適切な終了処理を行う
 */
async function shutdown() {
  logger.info('Shutting down bot...');

  try {
    // データベース接続をクローズ
    await closeDatabase();
    logger.info('Database connections closed');

    // Discordクライアントを破棄
    client.destroy();
    logger.info('Discord client destroyed');
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }

  process.exit(0);
}

/**
 * プロセスシグナルのハンドリング
 * SIGINT: Ctrl+C による終了
 * SIGTERM: システムからの終了要求
 */
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

/**
 * 未処理のPromiseリジェクションをキャッチ
 * エラーログを出力するが、プロセスは継続
 */
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled promise rejection:', error);
});

/**
 * 未キャッチの例外をハンドリング
 * 致命的なエラーのため、シャットダウン処理を実行
 */
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  shutdown();
});

// Botを起動
main();
