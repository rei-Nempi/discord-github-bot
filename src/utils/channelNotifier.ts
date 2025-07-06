// ==================================================
// 外部ライブラリのインポート（外部から機能を借りてくる）
// ==================================================

// discord.js: Discord APIを簡単に使うためのライブラリ
// - Client: Discord APIとの接続を管理するメインクラス
//   チャンネル情報の取得、メッセージ送信などの中心となる
// - TextChannel: テキストチャンネルの型定義
//   メッセージの送信・受信が可能なチャンネル
// - EmbedBuilder: リッチな見た目のメッセージを作成するクラス
//   画像、リンク、色付きなど装飾されたメッセージを作成
import { Client, TextChannel, EmbedBuilder } from 'discord.js';

// ==================================================
// 自分で作ったファイルのインポート
// ==================================================

// ログ出力を管理するユーティリティ関数
// console.logより高機能で、ファイルに保存したりレベル分けができる
import { createLogger } from './logger';

// TypeScript型定義とアプリケーション定数のインポート
// プログラミング初心者向け説明:
// - GitHubIssue: GitHub Issue情報の型定義
// - EMBED_COLORS: Discord Embedの色定義（開いてるIssueは緑など）
import { GitHubIssue, EMBED_COLORS } from '../types/index';

// ==================================================
// ログシステムの初期化
// ==================================================

/**
 * このファイル専用のログ出力システムを作成
 *
 * 【ロガーとは？】
 * console.logの高機能版。以下の機能がある：
 * - ファイル識別: どのファイルからのログかを記録
 * - レベル分け: info（情報）, warn（警告）, error（エラー）など
 * - ファイル保存: ログをファイルに自動保存
 * - タイムスタンプ: いつのログかを記録
 *
 * 'channel-notifier' は このファイルの識別名
 */
const logger = createLogger('channel-notifier');

// ==================================================
// チャンネル通知クラスの定義
// ==================================================

/**
 * Discord チャンネル通知クラス - チャンネルへの通知送信を担当
 *
 * 【このクラスの役割】
 * 1. 指定されたDiscordチャンネルへのメッセージ送信
 * 2. Issue情報のEmbed形式での整形・送信
 * 3. 複数チャンネルへの一括通知
 * 4. チャンネルアクセス権限の確認
 *
 * 【export とは？】
 * このクラスを他のファイルから使えるように公開する
 * 他のファイルから import できるようになる
 *
 * 【なぜ独立したクラスにするのか？】
 * - 通知機能の責任分離
 * - テストの容易さ
 * - 再利用性の向上
 * - メンテナンス性の向上
 */
export class ChannelNotifier {
  /**
   * プライベートプロパティ（クラス内部でのみ使用）
   *
   * 【private とは？】
   * クラスの外部からは直接アクセスできない内部変数
   * データの安全性を保つためのカプセル化
   */

  /**
   * Discord クライアントのインスタンス
   *
   * 【Client とは？】
   * Discord APIとの接続・通信を管理するオブジェクト
   * - チャンネル情報の取得
   * - メッセージの送信
   * - ユーザー情報の取得
   * - イベントの監視
   *
   * 【なぜクライアントが必要？】
   * Discord APIとの全ての操作はClientオブジェクトを経由する
   * 認証情報やセッション管理を内部で処理
   */
  private client: Client;

  /**
   * コンストラクタ - クラスのインスタンス作成時に実行される初期化処理
   *
   * 【コンストラクタとは？】
   * new ChannelNotifier() でオブジェクトを作成する際に自動実行される関数
   * オブジェクトの初期設定を行う
   *
   * 【引数の説明】
   * @param client - Discord APIクライアントオブジェクト
   *
   * 【依存性注入パターン】
   * 外部からクライアントオブジェクトを受け取る設計
   * テストや設定変更が容易になる
   */
  constructor(client: Client) {
    /**
     * Discord クライアントの保存
     *
     * 【this.client の意味】
     * このクラスインスタンスのclientプロパティに
     * 引数で受け取ったClientオブジェクトを代入
     *
     * 【なぜ保存が必要？】
     * クラスの他のメソッドでもクライアントを使用するため
     * インスタンス変数として保持し、メソッド間で共有
     */
    this.client = client;
  }

  // ==================================================
  // パブリックメソッド群（外部から呼び出し可能）
  // ==================================================

  /**
   * 特定チャンネルにIssue情報を送信
   *
   * 【このメソッドの目的】
   * GitHub Issue情報を指定されたDiscordチャンネルに
   * 見やすいEmbed形式で送信する
   *
   * 【async/await とは？】
   * 非同期処理（時間のかかる処理）を扱うための仕組み
   * - async: この関数は非同期処理を含むことを宣言
   * - await: 処理の完了を待つキーワード
   *
   * 【引数の説明】
   * @param channelId - 送信先DiscordチャンネルのID（文字列）
   * @param issue - 送信するGitHub Issue情報オブジェクト
   *
   * 【戻り値の型 Promise<void>】
   * - Promise: 非同期処理の結果を表すオブジェクト
   * - void: 戻り値なし（処理の成功/失敗のみを返す）
   */
  async sendIssueToChannel(channelId: string, issue: GitHubIssue): Promise<void> {
    /**
     * エラーハンドリング（エラー処理）のためのtry-catch文
     *
     * 【try-catch とは？】
     * エラーが発生する可能性のある処理を安全に実行する仕組み
     * - try: エラーが発生するかもしれない処理を書く
     * - catch: エラーが発生した場合の対処を書く
     */
    try {
      /**
       * チャンネル情報の取得
       *
       * 【this.client.channels.fetch() とは？】
       * Discord APIを使ってチャンネル情報を取得する関数
       * - channelId: 取得したいチャンネルのID
       * - 戻り値: Channelオブジェクト（チャンネル情報）
       *
       * 【await の必要性】
       * Discord APIとの通信は時間がかかる非同期処理
       * 結果が返ってくるまで待つ必要がある
       *
       * 【const の使用理由】
       * 取得したチャンネル情報は変更しないため
       */
      const channel = await this.client.channels.fetch(channelId);

      /**
       * チャンネルの有効性チェック
       *
       * 【2つの条件チェック】
       * 1. !channel: チャンネルが存在しない場合
       * 2. !channel.isTextBased(): テキストチャンネルでない場合
       *
       * 【|| 演算子（論理OR）とは？】
       * 左側または右側のどちらかが true の場合に true を返す
       * どちらかの条件に該当すればエラーを投げる
       *
       * 【isTextBased() メソッド】
       * Discord.jsが提供するチャンネル判定メソッド
       * テキストの送受信が可能なチャンネルかを判定
       *
       * 【throw new Error() とは？】
       * エラーオブジェクトを作成して例外を発生させる
       * catch ブロックでエラーを捕捉可能
       */
      if (!channel || !channel.isTextBased()) {
        throw new Error(`Channel ${channelId} is not a text channel`);
      }

      /**
       * Issue Embed の作成
       *
       * 【this.createIssueEmbed() とは？】
       * このクラス内で定義されたプライベートメソッド
       * GitHub Issue情報を Discord Embed形式に変換
       *
       * 【Embed とは？】
       * Discordの装飾されたメッセージ形式
       * - タイトル、説明、フィールド
       * - 色付き、画像、リンクなど
       * - 視覚的に情報を整理して表示
       */
      const embed = this.createIssueEmbed(issue);

      /**
       * チャンネルへのメッセージ送信
       *
       * 【(channel as TextChannel) とは？】
       * TypeScriptの型アサーション（型の強制指定）
       * channelをTextChannel型として扱うことを明示
       *
       * 【なぜ型アサーションが必要？】
       * 上でisTextBased()チェックをしているが、
       * TypeScriptはそれを理解できないため明示的に指定
       *
       * 【send() メソッドの引数】
       * - content: 通常のテキストメッセージ
       * - embeds: Embed配列（装飾されたメッセージ）
       *
       * 【🔔 絵文字の意味】
       * 通知を表す視覚的なアイコン
       * ユーザーが新しい情報だと分かりやすくする
       */
      await (channel as TextChannel).send({
        content: `🔔 新しいIssue情報`, // 通常テキスト部分
        embeds: [embed], // 装飾されたEmbed部分（配列形式）
      });

      /**
       * 送信成功をログに記録
       *
       * 【ログ記録の目的】
       * - 運用監視: システムの正常動作確認
       * - デバッグ: 問題発生時の追跡調査
       * - 統計: 利用状況の把握
       *
       * 【テンプレートリテラル記法】
       * `文字列 ${変数} 文字列` でログメッセージを作成
       */
      logger.info(`Issue #${issue.number} sent to channel ${channelId}`);

      /**
       * エラーハンドリング（エラー処理）
       *
       * 【catch ブロックの役割】
       * try ブロック内で発生したエラーを捕捉
       * ログ出力後に上位レイヤーにエラーを再投げ
       */
    } catch (error) {
      // エラーをログに記録（デバッグ・監視用）
      logger.error(`Failed to send issue to channel ${channelId}:`, error);
      // エラーを上位レイヤーに再投げ（エラーチェーンの継続）
      throw error;
    }
  }

  /**
   * 複数チャンネルにIssue情報を送信
   */
  async sendIssueToMultipleChannels(channelIds: string[], issue: GitHubIssue): Promise<void> {
    const promises = channelIds.map((channelId) => this.sendIssueToChannel(channelId, issue));

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
          inline: true,
        },
        {
          name: 'Author',
          value: `[@${issue.user.login}](https://github.com/${issue.user.login})`,
          inline: true,
        },
        {
          name: 'Comments',
          value: `💬 ${issue.comments}`,
          inline: true,
        }
      )
      .setFooter({
        text: `${issue.repository?.full_name || 'GitHub'} Issue`,
        iconURL: issue.user.avatar_url || 'https://github.com/github.png',
      })
      .setTimestamp(new Date(issue.created_at));

    // ラベルがある場合は追加
    if (issue.labels && issue.labels.length > 0) {
      const labelsText = issue.labels
        .slice(0, 10)
        .map((label) => `\`${label.name}\``)
        .join(' ');

      embed.addFields({
        name: 'Labels',
        value: labelsText,
        inline: false,
      });
    }

    // 作成日と更新日
    const createdDate = new Date(issue.created_at).toLocaleDateString('ja-JP');
    const updatedDate = new Date(issue.updated_at).toLocaleDateString('ja-JP');

    embed.addFields({
      name: 'Created',
      value: createdDate,
      inline: true,
    });

    if (issue.created_at !== issue.updated_at) {
      embed.addFields({
        name: 'Updated',
        value: updatedDate,
        inline: true,
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
