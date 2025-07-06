import { Events, Message } from 'discord.js';
import { createLogger } from '../utils/logger';

const logger = createLogger('messageCreate');

export default {
  name: Events.MessageCreate,
  async execute(message: Message) {
    try {
      // ボット自身のメッセージは無視
      if (message.author.bot) return;
      
      // DMは無視（ギルドメッセージのみ処理）
      if (!message.guild) return;
      
      // 通常メッセージでのIssue検出・表示機能は無効
      // /sendコマンドのみでIssue情報を指定チャンネルに投稿
      logger.debug(`Message from ${message.author.username} in ${message.guild.name}: ${message.content} (Issue detection disabled)`);
      
    } catch (error) {
      logger.error('Error processing message:', error);
    }
  },
};