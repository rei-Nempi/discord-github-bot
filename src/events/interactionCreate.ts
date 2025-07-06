import { Events, Interaction } from 'discord.js';
import { createLogger } from '../utils/logger';

const logger = createLogger('interactionCreate');

/**
 * インタラクション作成イベントの設定
 * スラッシュコマンド、ボタン、セレクトメニューなどの操作時に実行
 */
export default {
  name: Events.InteractionCreate,
  /**
   * インタラクションの処理
   * @param interaction - インタラクションオブジェクト
   */
  async execute(interaction: Interaction) {
    try {
      // スラッシュコマンドの処理
      if (interaction.isChatInputCommand()) {
        // コマンドコレクションから該当コマンドを取得
        const command = (interaction.client as any).commands.get(interaction.commandName);
        
        if (!command) {
          logger.warn(`Unknown command: ${interaction.commandName}`);
          return;
        }

        logger.info(`Command executed: ${interaction.commandName} by ${interaction.user.username}`);

        try {
          // コマンドを実行
          await command.execute(interaction);
        } catch (error) {
          // コマンド実行エラーの処理
          logger.error(`Command execution failed: ${interaction.commandName}`, error);
          
          const errorMessage = 'コマンドの実行中にエラーが発生しました。';
          
          // インタラクションの状態に応じて適切な返信方法を選択
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
          } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
          }
        }
      }
      
      // ボタンインタラクションの処理
      else if (interaction.isButton()) {
        logger.info(`Button interaction: ${interaction.customId} by ${interaction.user.username}`);
        
        // ボタンの処理は将来的に実装予定
        await interaction.reply({ content: 'ボタン機能は現在開発中です。', ephemeral: true });
      }
      
      // セレクトメニューの処理
      else if (interaction.isStringSelectMenu()) {
        logger.info(`Select menu interaction: ${interaction.customId} by ${interaction.user.username}`);
        
        // セレクトメニューの処理は将来的に実装予定
        await interaction.reply({ content: 'セレクトメニュー機能は現在開発中です。', ephemeral: true });
      }
      
    } catch (error) {
      // イベントハンドラー全体のエラー処理
      logger.error('Error processing interaction:', error);
      
      try {
        const errorMessage = 'インタラクションの処理中にエラーが発生しました。';
        
        // 返信可能なインタラクションの場合のみエラーメッセージを送信
        if (interaction.isChatInputCommand() || interaction.isButton() || interaction.isStringSelectMenu()) {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
          } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
          }
        }
      } catch (replyError) {
        // エラーメッセージの送信に失敗した場合
        logger.error('Failed to send error reply:', replyError);
      }
    }
  },
};