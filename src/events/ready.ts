import { Events } from 'discord.js';
import { createLogger } from '../utils/logger.js';
import { initializeDatabase } from '../database/index.js';

const logger = createLogger('ready');

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: any) {
    try {
      logger.info(`Bot logged in as ${client.user.tag}`);
      
      // データベースの初期化
      await initializeDatabase();
      logger.info('Database initialized successfully');
      
      // ボットの状態を設定
      client.user.setActivity('GitHub Issues', { type: 'WATCHING' });
      
      logger.info(`Bot is ready! Serving ${client.guilds.cache.size} servers`);
      
      // ギルド情報をログ出力
      client.guilds.cache.forEach((guild: any) => {
        logger.info(`Connected to guild: ${guild.name} (${guild.id})`);
      });
      
    } catch (error) {
      logger.error('Failed to initialize bot:', error);
      process.exit(1);
    }
  },
};