import { Events, Message } from 'discord.js';
import { createLogger } from '../utils/logger';

const logger = createLogger('messageCreate');

/**
 * メッセージ作成イベントの設定
 * Discord上でメッセージが投稿されるたびに実行される
 */
export default {
  name: Events.MessageCreate,
  /**
   * メッセージ作成イベントの処理
   * @param message - 作成されたメッセージオブジェクト
   */
  async execute(message: Message) {
    try {
      // Bot自身のメッセージは無視
      if (message.author.bot) return;
      
      // DMは無視（サーバー内のメッセージのみ処理）
      if (!message.guild) return;
      
      // 通常メッセージでのIssue検出機能は無効化されています
      // /sendコマンドのみでIssue情報を指定チャンネルに投稿する設計です
      logger.debug(`Message from ${message.author.username} in ${message.guild.name}: ${message.content} (Issue detection disabled)`);
      
    } catch (error) {
      // エラーが発生した場合はログに記録
      logger.error('Error processing message:', error);
    }
  },
};