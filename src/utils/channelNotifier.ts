import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { createLogger } from './logger.js';
import { GitHubIssue, EMBED_COLORS } from '../types/index.js';

const logger = createLogger('channel-notifier');

export class ChannelNotifier {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * 特定チャンネルにIssue情報を送信
   */
  async sendIssueToChannel(channelId: string, issue: GitHubIssue): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      
      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${channelId} is not a text channel`);
      }

      const embed = this.createIssueEmbed(issue);
      
      await (channel as TextChannel).send({ 
        content: `🔔 新しいIssue情報`,
        embeds: [embed] 
      });

      logger.info(`Issue #${issue.number} sent to channel ${channelId}`);

    } catch (error) {
      logger.error(`Failed to send issue to channel ${channelId}:`, error);
      throw error;
    }
  }

  /**
   * 複数チャンネルにIssue情報を送信
   */
  async sendIssueToMultipleChannels(channelIds: string[], issue: GitHubIssue): Promise<void> {
    const promises = channelIds.map(channelId => 
      this.sendIssueToChannel(channelId, issue)
    );

    try {
      await Promise.allSettled(promises);
      logger.info(`Issue #${issue.number} sent to ${channelIds.length} channels`);
    } catch (error) {
      logger.error('Failed to send issue to multiple channels:', error);
    }
  }

  /**
   * 定期的なIssue通知（新しいIssueをチェック）
   */
  async sendPeriodicNotification(channelId: string, message: string): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      
      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${channelId} is not a text channel`);
      }

      await (channel as TextChannel).send(message);
      logger.info(`Periodic notification sent to channel ${channelId}`);

    } catch (error) {
      logger.error(`Failed to send periodic notification to channel ${channelId}:`, error);
    }
  }

  /**
   * Issue Embedを作成
   */
  private createIssueEmbed(issue: GitHubIssue): EmbedBuilder {
    let color = EMBED_COLORS.OPEN;
    if (issue.state === 'closed') {
      color = EMBED_COLORS.CLOSED;
    } else if (issue.draft) {
      color = EMBED_COLORS.DRAFT;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`Issue #${issue.number}: ${issue.title}`)
      .setURL(issue.html_url)
      .setDescription(this.truncateDescription(issue.body || 'No description provided'))
      .addFields(
        {
          name: 'Status',
          value: this.getStatusEmoji(issue),
          inline: true
        },
        {
          name: 'Author',
          value: `[@${issue.user.login}](https://github.com/${issue.user.login})`,
          inline: true
        },
        {
          name: 'Comments',
          value: `💬 ${issue.comments}`,
          inline: true
        }
      )
      .setFooter({
        text: `${issue.repository?.full_name || 'GitHub'} Issue`,
        iconURL: issue.user.avatar_url || 'https://github.com/github.png'
      })
      .setTimestamp(new Date(issue.created_at));

    // ラベルがある場合は追加
    if (issue.labels && issue.labels.length > 0) {
      const labelsText = issue.labels
        .slice(0, 10)
        .map(label => `\`${label.name}\``)
        .join(' ');
      
      embed.addFields({
        name: 'Labels',
        value: labelsText,
        inline: false
      });
    }

    // 作成日と更新日
    const createdDate = new Date(issue.created_at).toLocaleDateString('ja-JP');
    const updatedDate = new Date(issue.updated_at).toLocaleDateString('ja-JP');
    
    embed.addFields({
      name: 'Created',
      value: createdDate,
      inline: true
    });

    if (issue.created_at !== issue.updated_at) {
      embed.addFields({
        name: 'Updated',
        value: updatedDate,
        inline: true
      });
    }

    return embed;
  }

  /**
   * Issueの状態に応じた絵文字を取得
   */
  private getStatusEmoji(issue: GitHubIssue): string {
    if (issue.state === 'closed') {
      return '🔴 Closed';
    } else if (issue.draft) {
      return '🟡 Draft';
    } else {
      return '🟢 Open';
    }
  }

  /**
   * 説明文を適切な長さに切り詰める
   */
  private truncateDescription(description: string): string {
    const maxLength = 2048;
    
    if (description.length <= maxLength) {
      return description;
    }
    
    return description.substring(0, maxLength - 3) + '...';
  }

  /**
   * チャンネルが利用可能かチェック
   */
  async isChannelAccessible(channelId: string): Promise<boolean> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      return channel !== null && channel.isTextBased();
    } catch (error) {
      logger.warn(`Channel ${channelId} is not accessible:`, error);
      return false;
    }
  }

  /**
   * 複数チャンネルの利用可能性をチェック
   */
  async getAccessibleChannels(channelIds: string[]): Promise<string[]> {
    const checks = channelIds.map(async (channelId) => {
      const accessible = await this.isChannelAccessible(channelId);
      return accessible ? channelId : null;
    });

    const results = await Promise.all(checks);
    return results.filter((channelId): channelId is string => channelId !== null);
  }
}