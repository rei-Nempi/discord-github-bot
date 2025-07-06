import { Message } from 'discord.js';
import { createLogger } from '../utils/logger.js';
import { GitHubService } from '../services/github.js';
import { getCacheService } from '../services/cache.js';
import { IssuePattern, ISSUE_PATTERNS, BOT_LIMITS, EMBED_COLORS, GitHubIssue } from '../types/index.js';

const logger = createLogger('messageHandler');

export class MessageHandler {
  private githubService: GitHubService;
  private cacheService: any;

  constructor() {
    this.githubService = new GitHubService();
    this.cacheService = getCacheService();
  }
  
  /**
   * メッセージを処理し、Issue番号を検出してGitHub Issue情報を表示する
   */
  async handleMessage(message: Message): Promise<void> {
    try {
      // Issue番号パターンを検出
      const issuePatterns = this.detectIssuePatterns(message.content);
      
      if (issuePatterns.length === 0) {
        logger.debug('No issue patterns detected in message');
        return;
      }
      
      logger.info(`Detected ${issuePatterns.length} issue patterns in message`);
      
      // 最大Issue数の制限チェック
      const limitedPatterns = issuePatterns.slice(0, BOT_LIMITS.MAX_ISSUES_PER_MESSAGE);
      
      if (issuePatterns.length > BOT_LIMITS.MAX_ISSUES_PER_MESSAGE) {
        logger.warn(`Message contains ${issuePatterns.length} issues, limited to ${BOT_LIMITS.MAX_ISSUES_PER_MESSAGE}`);
      }
      
      // 各Issue番号に対してGitHub APIで情報を取得
      for (const pattern of limitedPatterns) {
        await this.processIssuePattern(message, pattern);
      }
      
    } catch (error) {
      logger.error('Error handling message:', error);
      throw error;
    }
  }
  
  /**
   * メッセージからIssue番号パターンを検出する
   */
  detectIssuePatterns(content: string): IssuePattern[] {
    const patterns: IssuePattern[] = [];
    
    try {
      // 除外パターンをマスクして一時的に置換
      let maskedContent = content;
      
      // URLs, コードブロック, インラインコード, 引用をマスクする
      const masks: Array<{pattern: RegExp, replacement: string}> = [
        { pattern: ISSUE_PATTERNS.EXCLUDE_URLS, replacement: '___URL___' },
        { pattern: ISSUE_PATTERNS.EXCLUDE_CODE_BLOCKS, replacement: '___CODE_BLOCK___' },
        { pattern: ISSUE_PATTERNS.EXCLUDE_INLINE_CODE, replacement: '___INLINE_CODE___' },
      ];
      
      masks.forEach(mask => {
        maskedContent = maskedContent.replace(mask.pattern, mask.replacement);
      });
      
      // 引用行を除外
      const lines = maskedContent.split('\n');
      const filteredLines = lines.filter(line => !ISSUE_PATTERNS.EXCLUDE_QUOTES.test(line));
      maskedContent = filteredLines.join('\n');
      
      // 標準パターン (#123) を検出
      const standardMatches = Array.from(maskedContent.matchAll(ISSUE_PATTERNS.STANDARD));
      standardMatches.forEach(match => {
        if (match.index !== undefined) {
          const issueNumber = parseInt(match[1], 10);
          if (issueNumber >= 1 && issueNumber <= 99999) {
            patterns.push({
              pattern: match[0].trim(),
              issue_number: issueNumber,
              start_index: match.index,
              end_index: match.index + match[0].length
            });
          }
        }
      });
      
      // Git prefixedパターン (git#123) を検出
      const gitMatches = Array.from(maskedContent.matchAll(ISSUE_PATTERNS.GIT_PREFIXED));
      gitMatches.forEach(match => {
        if (match.index !== undefined) {
          const issueNumber = parseInt(match[1], 10);
          if (issueNumber >= 1 && issueNumber <= 99999) {
            patterns.push({
              pattern: match[0].trim(),
              issue_number: issueNumber,
              start_index: match.index,
              end_index: match.index + match[0].length
            });
          }
        }
      });
      
      // 重複を除去（同じIssue番号）
      const uniquePatterns = patterns.filter((pattern, index, self) => 
        index === self.findIndex(p => p.issue_number === pattern.issue_number)
      );
      
      logger.debug(`Detected ${uniquePatterns.length} unique issue patterns`);
      
      return uniquePatterns;
      
    } catch (error) {
      logger.error('Error detecting issue patterns:', error);
      return [];
    }
  }
  
  /**
   * 検出されたIssue番号パターンを処理する
   */
  private async processIssuePattern(message: Message, pattern: IssuePattern): Promise<void> {
    try {
      logger.info(`Processing issue pattern: ${pattern.pattern} (Issue #${pattern.issue_number})`);
      
      // デフォルトリポジトリを取得（設定からまたは環境変数から）
      const defaultRepo = this.getDefaultRepository(message.guild?.id);
      if (!defaultRepo) {
        logger.warn(`No repository configured for guild ${message.guild?.id}`);
        await message.reply('リポジトリが設定されていません。管理者に設定を依頼してください。');
        return;
      }

      const [owner, repo] = defaultRepo.split('/');
      if (!owner || !repo) {
        logger.error(`Invalid repository format: ${defaultRepo}`);
        await message.reply('リポジトリの設定に問題があります。管理者に確認を依頼してください。');
        return;
      }

      // GitHub Issue情報を取得
      const issueData = await this.getIssueInfo(owner, repo, pattern.issue_number);
      
      // 元のチャンネルにEmbed表示（通常の動作）
      await this.sendIssueEmbed(message, issueData, pattern);
      
    } catch (error) {
      logger.error(`Error processing issue pattern ${pattern.pattern}:`, error);
      
      // エラーの場合はシンプルなメッセージを送信
      try {
        const errorMessage = this.getErrorMessage(error);
        await message.reply(errorMessage);
      } catch (replyError) {
        logger.error('Failed to send error reply:', replyError);
      }
    }
  }

  /**
   * デフォルトリポジトリを取得
   */
  private getDefaultRepository(_guildId?: string): string | null {
    // TODO: データベースから設定を取得する実装
    // 現在は環境変数から取得
    const envRepo = process.env.DEFAULT_REPOSITORY;
    if (envRepo) {
      return envRepo;
    }

    // フォールバック用のデフォルト値
    return 'microsoft/vscode'; // テスト用
  }

  /**
   * エラーメッセージを生成
   */
  private getErrorMessage(error: any): string {
    if (error.status === 404) {
      return 'Issue が見つかりませんでした。Issue番号とリポジトリ設定を確認してください。';
    } else if (error.status === 403) {
      return 'GitHub API の制限に達しました。しばらく待ってから再試行してください。';
    } else if (error.status === 401) {
      return 'GitHub API の認証に失敗しました。設定を確認してください。';
    } else {
      return `Issue #${error.details?.issueNumber || '?'} の情報を取得できませんでした。`;
    }
  }
  
  /**
   * GitHub Issue情報を取得（キャッシュ優先）
   */
  private async getIssueInfo(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    try {
      // 1. キャッシュから取得を試行
      const cachedIssue = await this.cacheService.getIssue(owner, repo, issueNumber);
      if (cachedIssue) {
        logger.debug(`Issue found in cache: ${owner}/${repo}#${issueNumber}`);
        return cachedIssue;
      }

      // 2. GitHub APIから取得
      logger.info(`Fetching issue from GitHub API: ${owner}/${repo}#${issueNumber}`);
      const issue = await this.githubService.getIssue(owner, repo, issueNumber);

      // 3. キャッシュに保存
      await this.cacheService.setIssue(owner, repo, issueNumber, issue);

      return issue;

    } catch (error) {
      logger.error(`Failed to get issue info for ${owner}/${repo}#${issueNumber}:`, error);
      throw error;
    }
  }
  
  /**
   * Issue情報をDiscord Embedで送信
   */
  private async sendIssueEmbed(message: Message, issueData: GitHubIssue, _pattern: IssuePattern): Promise<void> {
    try {
      // 状態に応じた色を設定
      let color = EMBED_COLORS.OPEN;
      if (issueData.state === 'closed') {
        color = EMBED_COLORS.CLOSED;
      } else if (issueData.draft) {
        color = EMBED_COLORS.DRAFT;
      }

      const embed = {
        color: color,
        title: `Issue #${issueData.number}: ${issueData.title}`,
        url: issueData.html_url,
        description: this.truncateDescription(issueData.body || 'No description provided'),
        fields: [
          {
            name: 'Status',
            value: this.getStatusEmoji(issueData),
            inline: true
          },
          {
            name: 'Author',
            value: `[@${issueData.user.login}](https://github.com/${issueData.user.login})`,
            inline: true
          },
          {
            name: 'Comments',
            value: `💬 ${issueData.comments}`,
            inline: true
          }
        ],
        footer: {
          text: `${issueData.repository?.full_name || 'GitHub'} Issue`,
          icon_url: issueData.user.avatar_url || 'https://github.com/github.png'
        },
        timestamp: new Date(issueData.created_at).toISOString()
      };
      
      // ラベルがある場合は追加
      if (issueData.labels && issueData.labels.length > 0) {
        const labelsText = issueData.labels
          .slice(0, 10) // 最大10個のラベルまで表示
          .map((label: any) => `\`${label.name}\``)
          .join(' ');
        
        embed.fields.push({
          name: 'Labels',
          value: labelsText,
          inline: false
        });
      }

      // 作成日と更新日の情報
      const createdDate = new Date(issueData.created_at).toLocaleDateString('ja-JP');
      const updatedDate = new Date(issueData.updated_at).toLocaleDateString('ja-JP');
      
      embed.fields.push({
        name: 'Created',
        value: createdDate,
        inline: true
      });

      if (issueData.created_at !== issueData.updated_at) {
        embed.fields.push({
          name: 'Updated',
          value: updatedDate,
          inline: true
        });
      }
      
      await message.reply({ embeds: [embed] });
      
      logger.info(`Issue embed sent for #${issueData.number} in ${issueData.repository?.full_name}`);
      
    } catch (error) {
      logger.error('Error sending issue embed:', error);
      throw error;
    }
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
    const maxLength = BOT_LIMITS.MAX_EMBED_DESCRIPTION_LENGTH;
    
    if (description.length <= maxLength) {
      return description;
    }
    
    return description.substring(0, maxLength - 3) + '...';
  }
}