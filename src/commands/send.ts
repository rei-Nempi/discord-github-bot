import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { createLogger } from '../utils/logger';
import { GitHubService } from '../services/github';
import { getCacheService } from '../services/cache';
import { ChannelNotifier } from '../utils/channelNotifier';

const logger = createLogger('send-command');

export default {
  data: new SlashCommandBuilder()
    .setName('send')
    .setDescription('指定チャンネルにIssue情報を送信（例: /send #123）')
    .addStringOption(option =>
      option.setName('number')
        .setDescription('Issue番号（#123 または 123）')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('repo')
        .setDescription('リポジトリ（省略可: デフォルト microsoft/vscode）')
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      // パラメータを取得
      const issueInput = interaction.options.get('number')?.value as string;
      const repository = (interaction.options.get('repo')?.value as string) || 
                        process.env.DEFAULT_REPOSITORY || 
                        'microsoft/vscode';

      // TARGET_CHANNEL_IDを環境変数から取得
      const targetChannelId = process.env.TARGET_CHANNEL_ID;

      // Issue番号を解析（#123 または 123 の形式を受け付ける）
      let issueNumber: number;
      const cleanInput = issueInput.replace(/^#/, ''); // 先頭の#を除去
      issueNumber = parseInt(cleanInput, 10);

      // バリデーション
      if (isNaN(issueNumber) || issueNumber < 1) {
        await interaction.editReply('❌ 有効なIssue番号を入力してください（例: #123 または 123）。');
        return;
      }

      if (!targetChannelId) {
        await interaction.editReply('❌ 送信先チャンネルが設定されていません。管理者にお問い合わせください。');
        return;
      }

      const [owner, repo] = repository.split('/');
      if (!owner || !repo) {
        await interaction.editReply('❌ リポジトリは "owner/repo" の形式で指定してください。');
        return;
      }

      logger.info(`Send command: Issue #${issueNumber} from ${repository} to channel ${targetChannelId}`);

      // GitHub Issue情報を取得
      const githubService = new GitHubService();
      const cacheService = getCacheService();

      // キャッシュから確認
      let issue = await cacheService.getIssue(owner, repo, issueNumber);
      
      if (!issue) {
        // GitHub APIから取得
        issue = await githubService.getIssue(owner, repo, issueNumber);
        await cacheService.setIssue(owner, repo, issueNumber, issue);
      }

      // 指定チャンネルに送信
      const notifier = new ChannelNotifier(interaction.client);
      await notifier.sendIssueToChannel(targetChannelId, issue);

      // 成功メッセージ
      await interaction.editReply(
        `✅ Issue #${issueNumber} の情報を指定チャンネルに送信しました。`
      );

      logger.info(`Successfully sent Issue #${issueNumber} to channel ${targetChannelId}`);

    } catch (error: any) {
      logger.error('Send command failed:', error);

      let errorMessage = '❌ Issue情報の送信に失敗しました。';
      
      if (error.status === 404) {
        errorMessage = '❌ 指定されたIssueが見つかりません。';
      } else if (error.status === 403) {
        errorMessage = '❌ GitHub API の制限に達しているか、アクセス権限がありません。';
      } else if (error.message.includes('Missing Permissions')) {
        errorMessage = '❌ 指定チャンネルに投稿する権限がありません。';
      } else if (error.message.includes('Channel') && error.message.includes('not')) {
        errorMessage = '❌ 指定チャンネルにアクセスできません。';
      }

      try {
        await interaction.editReply(errorMessage);
      } catch (replyError) {
        logger.error('Failed to send error reply:', replyError);
      }
    }
  },
};