import { Events, Interaction } from 'discord.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('interactionCreate');

export default {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    try {
      // スラッシュコマンドの処理
      if (interaction.isChatInputCommand()) {
        const command = (interaction.client as any).commands.get(interaction.commandName);
        
        if (!command) {
          logger.warn(`Unknown command: ${interaction.commandName}`);
          return;
        }

        logger.info(`Command executed: ${interaction.commandName} by ${interaction.user.username}`);

        try {
          await command.execute(interaction);
        } catch (error) {
          logger.error(`Command execution failed: ${interaction.commandName}`, error);
          
          const errorMessage = 'コマンドの実行中にエラーが発生しました。';
          
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
        
        // ボタンの処理は将来的に実装
        await interaction.reply({ content: 'ボタン機能は現在開発中です。', ephemeral: true });
      }
      
      // セレクトメニューの処理
      else if (interaction.isStringSelectMenu()) {
        logger.info(`Select menu interaction: ${interaction.customId} by ${interaction.user.username}`);
        
        // セレクトメニューの処理は将来的に実装
        await interaction.reply({ content: 'セレクトメニュー機能は現在開発中です。', ephemeral: true });
      }
      
    } catch (error) {
      logger.error('Error processing interaction:', error);
      
      try {
        const errorMessage = 'インタラクションの処理中にエラーが発生しました。';
        
        if (interaction.isChatInputCommand() || interaction.isButton() || interaction.isStringSelectMenu()) {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
          } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
          }
        }
      } catch (replyError) {
        logger.error('Failed to send error reply:', replyError);
      }
    }
  },
};