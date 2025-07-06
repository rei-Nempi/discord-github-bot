import { Events, ActivityType } from 'discord.js';
import { createLogger } from '../utils/logger';
import { initializeDatabase } from '../database/index';

const logger = createLogger('ready');

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: any) {
    try {
      logger.info(`Bot logged in as ${client.user.tag}`);
      console.log('Bot ready event fired!');
      
      // データベースの初期化
      logger.info('Initializing database...');
      await initializeDatabase();
      logger.info('Database initialized successfully');
      
      // ボットの状態を設定（Discord.js v14の正しい方法）
      client.user.setActivity('GitHub Issues', { type: ActivityType.Watching });
      
      logger.info(`Bot is ready! Serving ${client.guilds.cache.size} servers`);
      
      // ギルド情報をログ出力
      client.guilds.cache.forEach((guild: any) => {
        logger.info(`Connected to guild: ${guild.name} (${guild.id})`);
      });
      
      console.log('Bot initialization complete!');
      
    } catch (error) {
      logger.error('Failed to initialize bot:', error);
      console.error('Ready event error:', error);
      process.exit(1);
    }
  },
};