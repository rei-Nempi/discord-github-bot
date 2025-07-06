import { config } from 'dotenv';
import { Client, GatewayIntentBits, Collection } from 'discord.js';
import { createLogger } from './utils/logger';
import { closeDatabase } from './database/index';
import fs from 'fs';
import path from 'path';

/**
 * 環境変数を読み込む
 * .envファイルから設定値を取得
 */
try {
  config();
} catch (error) {
  console.error('Error loading dotenv:', error);
}

// ロガーインスタンスを作成
const logger = createLogger('main');

/**
 * Discord クライアントを作成
 * 必要な権限（Intents）を設定:
 * - Guilds: サーバー情報へのアクセス
 * - GuildMessages: メッセージの読み取り
 * - MessageContent: メッセージ内容へのアクセス
 */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// スラッシュコマンドを格納するコレクション
(client as any).commands = new Collection();

/**
 * イベントハンドラーを読み込む関数
 * eventsディレクトリから全てのイベントファイルを読み込み、
 * Discord.jsのイベントリスナーに登録する
 */
async function loadEvents() {
  const eventsPath = path.join(__dirname, 'events');
  console.log('Loading events from:', eventsPath);
  // .jsファイルのみを対象とし、型定義ファイル(.d.ts)は除外
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js') && !file.endsWith('.d.ts'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    console.log(`Loading event file: ${file}`);
    
    try {
      const event = require(filePath);
      
      // onceプロパティがtrueの場合は一度だけ実行されるイベントとして登録
      if (event.default.once) {
        client.once(event.default.name, (...args) => event.default.execute(...args));
      } else {
        // 通常のイベントリスナーとして登録
        client.on(event.default.name, (...args) => event.default.execute(...args));
      }
      
      logger.info(`Loaded event: ${event.default.name}`);
    } catch (error) {
      console.error(`Error loading event ${file}:`, error);
      throw error;
    }
  }
}

/**
 * スラッシュコマンドを読み込む関数
 * commandsディレクトリから全てのコマンドファイルを読み込み、
 * コマンドコレクションに登録する
 */
async function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');
  
  // commandsディレクトリが存在しない場合はスキップ
  if (!fs.existsSync(commandsPath)) {
    logger.info('Commands directory not found, skipping command loading');
    return;
  }
  
  // .jsファイルのみを対象とし、型定義ファイル(.d.ts)は除外
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') && !file.endsWith('.d.ts'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    // コマンドに必須のdataとexecuteプロパティが存在するか確認
    if ('data' in command.default && 'execute' in command.default) {
      (client as any).commands.set(command.default.data.name, command.default);
      logger.info(`Loaded command: ${command.default.data.name}`);
    } else {
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