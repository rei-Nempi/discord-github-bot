import { Events, ActivityType } from 'discord.js';
import { createLogger } from '../utils/logger';
import { initializeDatabase } from '../database/index';

const logger = createLogger('ready');

/**
 * Bot準備完了イベントの設定
 * Botがログインして利用可能になった際に一度だけ実行される
 */
export default {
  name: Events.ClientReady,
  once: true, // このイベントは一度だけ実行
  /**
   * Botの初期化処理を実行
   * @param client - Discordクライアントインスタンス
   */
  async execute(client: any) {
    try {
      logger.info(`Bot logged in as ${client.user.tag}`);
      console.log('Bot ready event fired!');
      
      // データベースの初期化処理
      logger.info('Initializing database...');
      await initializeDatabase();
      logger.info('Database initialized successfully');
      
      // Botのステータスを設定
      // 「GitHub Issuesを監視中」と表示
      client.user.setActivity('GitHub Issues', { type: ActivityType.Watching });
      
      logger.info(`Bot is ready! Serving ${client.guilds.cache.size} servers`);
      
      // 接続されている全サーバー（ギルド）の情報をログに出力
      client.guilds.cache.forEach((guild: any) => {
        logger.info(`Connected to guild: ${guild.name} (${guild.id})`);
      });
      
      console.log('Bot initialization complete!');
      
    } catch (error) {
      // 初期化中にエラーが発生した場合はプロセスを終了
      logger.error('Failed to initialize bot:', error);
      console.error('Ready event error:', error);
      process.exit(1);
    }
  },
};