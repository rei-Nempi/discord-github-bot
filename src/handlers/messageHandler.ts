// ==================================================
// 外部ライブラリのインポート（外部から機能を借りてくる）
// ==================================================

// discord.js: Discord APIを簡単に使うためのライブラリ
// - Message: Discordメッセージオブジェクトの型定義
//   ユーザーが送信したメッセージの内容、送信者、チャンネル情報などを含む
//   例: message.content（メッセージ内容）, message.author（送信者）
import { Message } from 'discord.js';

// ==================================================
// 自分で作ったファイルのインポート
// ==================================================

// ログ出力を管理するユーティリティ関数
// console.logより高機能で、ファイルに保存したりレベル分けができる
import { createLogger } from '../utils/logger';

// GitHub APIと通信するためのサービスクラス
// Issue情報の取得、リポジトリ情報の取得などを担当
import { GitHubService } from '../services/github';

// キャッシュ（一時保存）を管理するサービス
// 同じIssue情報を何度もGitHub APIから取得しないよう、一時的に保存する
import { getCacheService } from '../services/cache';

// TypeScript型定義とアプリケーション定数のインポート
// プログラミング初心者向け説明:
// - IssuePattern: Issue番号パターンの型定義（#123の形式など）
// - ISSUE_PATTERNS: Issue検出用の正規表現パターン集
// - BOT_LIMITS: Botの制限値（最大Issue数、文字数制限など）
// - EMBED_COLORS: Discord Embedの色定義（開いてるIssueは緑など）
// - GitHubIssue: GitHub Issue情報の型定義
import {
  IssuePattern,
  ISSUE_PATTERNS,
  BOT_LIMITS,
  EMBED_COLORS,
  GitHubIssue,
} from '../types/index';

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
 * 'messageHandler' は このファイルの識別名
 */
const logger = createLogger('messageHandler');

// ==================================================
// メッセージハンドラークラスの定義
// ==================================================

/**
 * Discord メッセージハンドラークラス - メッセージ処理の中心となるクラス
 *
 * 【このクラスの役割】
 * 1. Discord メッセージの監視
 * 2. Issue番号パターンの検出（#123 や git#123）
 * 3. GitHub API からのIssue情報取得
 * 4. Discord Embed 形式での情報表示
 *
 * 【export とは？】
 * このクラスを他のファイルから使えるように公開する
 * 他のファイルから import できるようになる
 *
 * 【class とは？】
 * オブジェクト指向プログラミングの基本概念
 * データ（プロパティ）と機能（メソッド）をまとめた設計図
 * 実際の道具（インスタンス）を作るための型枠
 *
 * 【なぜクラスを使うのか？】
 * - 関連する機能をまとめて管理
 * - コードの再利用性向上
 * - メンテナンスの容易さ
 * - データの安全性（カプセル化）
 */
export class MessageHandler {
  /**
   * プライベートプロパティ（クラス内部でのみ使用）
   *
   * 【private とは？】
   * クラスの外部からは直接アクセスできない内部変数
   * データの安全性を保つためのカプセル化
   * 例: handler.githubService = null のような変更を防ぐ
   */

  /**
   * GitHub API サービスのインスタンス
   *
   * 【GitHubService とは？】
   * GitHub APIとの通信を担当するクラス
   * - Issue情報の取得
   * - リポジトリ情報の取得
   * - 認証処理
   * - エラーハンドリング
   */
  private githubService: GitHubService;

  /**
   * キャッシュサービスのインスタンス
   *
   * 【any型について】
   * TypeScriptの「どんな型でも受け入れる」型
   * 本来は具体的な型を指定すべきだが、
   * キャッシュサービスの型が複雑なため一時的にany型を使用
   *
   * 【キャッシュサービスの役割】
   * - Issue情報の一時保存
   * - API呼び出し回数の削減
   * - レスポンス速度の向上
   */
  private cacheService: any;

  /**
   * コンストラクタ - クラスのインスタンス作成時に実行される初期化処理
   *
   * 【コンストラクタとは？】
   * new MessageHandler() でオブジェクトを作成する際に自動実行される関数
   * オブジェクトの初期設定を行う
   *
   * 【引数なしのコンストラクタ】
   * 外部から設定を受け取らず、内部で全て初期化
   * シンプルで使いやすいが、設定の柔軟性は低い
   */
  constructor() {
    /**
     * GitHub サービスの初期化
     *
     * 【new キーワード とは？】
     * クラスからオブジェクト（インスタンス）を作成するキーワード
     * 設計図（クラス）から実際の道具（オブジェクト）を作る
     *
     * 【this.githubService の意味】
     * このクラスインスタンスのgithubServiceプロパティに
     * 新しく作成したGitHubServiceオブジェクトを代入
     */
    this.githubService = new GitHubService();

    /**
     * キャッシュサービスの初期化
     *
     * 【getCacheService() の特徴】
     * 関数形式でサービスを取得
     * 内部でシングルトンパターンを使用
     *
     * 【シングルトンパターンとは？】
     * アプリケーション全体で一つのインスタンスのみ作成する設計パターン
     * キャッシュデータの整合性を保つため重要
     */
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
        logger.warn(
          `Message contains ${issuePatterns.length} issues, limited to ${BOT_LIMITS.MAX_ISSUES_PER_MESSAGE}`
        );
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
      const masks: Array<{ pattern: RegExp; replacement: string }> = [
        { pattern: ISSUE_PATTERNS.EXCLUDE_URLS, replacement: '___URL___' },
        { pattern: ISSUE_PATTERNS.EXCLUDE_CODE_BLOCKS, replacement: '___CODE_BLOCK___' },
        { pattern: ISSUE_PATTERNS.EXCLUDE_INLINE_CODE, replacement: '___INLINE_CODE___' },
      ];

      masks.forEach((mask) => {
        maskedContent = maskedContent.replace(mask.pattern, mask.replacement);
      });

      // 引用行を除外
      const lines = maskedContent.split('\n');
      const filteredLines = lines.filter((line) => !ISSUE_PATTERNS.EXCLUDE_QUOTES.test(line));
      maskedContent = filteredLines.join('\n');

      // 標準パターン (#123) を検出
      const standardMatches = Array.from(maskedContent.matchAll(ISSUE_PATTERNS.STANDARD));
      standardMatches.forEach((match) => {
        if (match.index !== undefined) {
          const issueNumber = parseInt(match[1], 10);
          if (issueNumber >= 1 && issueNumber <= 99999) {
            patterns.push({
              pattern: match[0].trim(),
              issue_number: issueNumber,
              start_index: match.index,
              end_index: match.index + match[0].length,
            });
          }
        }
      });

      // Git prefixedパターン (git#123) を検出
      const gitMatches = Array.from(maskedContent.matchAll(ISSUE_PATTERNS.GIT_PREFIXED));
      gitMatches.forEach((match) => {
        if (match.index !== undefined) {
          const issueNumber = parseInt(match[1], 10);
          if (issueNumber >= 1 && issueNumber <= 99999) {
            patterns.push({
              pattern: match[0].trim(),
              issue_number: issueNumber,
              start_index: match.index,
              end_index: match.index + match[0].length,
            });
          }
        }
      });

      // 重複を除去（同じIssue番号）
      const uniquePatterns = patterns.filter(
        (pattern, index, self) =>
          index === self.findIndex((p) => p.issue_number === pattern.issue_number)
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
  private async getIssueInfo(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<GitHubIssue> {
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
  private async sendIssueEmbed(
    message: Message,
    issueData: GitHubIssue,
    _pattern: IssuePattern
  ): Promise<void> {
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
            inline: true,
          },
          {
            name: 'Author',
            value: `[@${issueData.user.login}](https://github.com/${issueData.user.login})`,
            inline: true,
          },
          {
            name: 'Comments',
            value: `💬 ${issueData.comments}`,
            inline: true,
          },
        ],
        footer: {
          text: `${issueData.repository?.full_name || 'GitHub'} Issue`,
          icon_url: issueData.user.avatar_url || 'https://github.com/github.png',
        },
        timestamp: new Date(issueData.created_at).toISOString(),
      };

      // ==================================================
      // ラベル情報の追加処理
      // ==================================================

      /**
       * GitHub Issue のラベル情報をEmbed に追加
       *
       * 【ラベルとは？】
       * Issue の分類・タグ付けに使用される機能
       * 例: bug（バグ）, enhancement（改良）, documentation（ドキュメント）
       *
       * 【if文の条件説明】
       * issueData.labels: ラベル配列が存在するかチェック
       * issueData.labels.length > 0: ラベルが1つ以上あるかチェック
       *
       * 【&& 演算子（論理AND）とは？】
       * 両方の条件が true の場合のみ true を返す
       * 左側が false の場合、右側は評価されない（ショートサーキット）
       */
      if (issueData.labels && issueData.labels.length > 0) {
        /**
         * ラベル名をテキスト形式に変換
         *
         * 【配列メソッドチェーンの説明】
         * 1. slice(0, 10): 配列の最初の10個を取得
         * 2. map(): 各要素を変換
         * 3. join(' '): 配列を文字列に結合
         *
         * 【slice(0, 10) とは？】
         * 配列の0番目から9番目（計10個）の要素を取得
         * Discord Embedの制限とレイアウトを考慮した制限
         *
         * 【map()メソッド とは？】
         * 配列の各要素に対して関数を実行し、新しい配列を作成
         * ここでは各ラベル名をバッククォートで囲む処理
         *
         * 【テンプレートリテラル とは？】
         * `文字列` で文字列を作成する記法
         * ここではバッククォート（`）でラベル名を囲んでコード表示
         *
         * 【join(' ') とは？】
         * 配列の要素を指定した文字（ここではスペース）で連結
         * 例: ['bug', 'urgent'] → '`bug` `urgent`'
         *
         * 【(label: any) => とは？】
         * アロー関数という短縮記法
         * label引数を受け取り、処理結果を返す関数
         * any型は「どんな型でも受け入れる」という意味
         */
        const labelsText = issueData.labels
          .slice(0, 10) // 最大10個のラベルまで表示（Discord表示制限）
          .map((label: any) => `\`${label.name}\``) // 各ラベル名をコード形式で装飾
          .join(' '); // スペースで連結してひとつの文字列に

        /**
         * Embedのフィールドとしてラベル情報を追加
         *
         * 【embed.fields.push() とは？】
         * Embedのフィールド配列に新しいフィールドを追加する関数
         *
         * 【フィールドオブジェクトの説明】
         * - name: フィールドのタイトル（太字で表示）
         * - value: フィールドの内容（通常のテキスト）
         * - inline: 横並び表示の可否（false = 縦並び）
         *
         * 【inline: false とは？】
         * フィールドを横並びにせず、縦に配置する設定
         * ラベルは通常複数あるため、横幅を確保して見やすく表示
         */
        embed.fields.push({
          name: 'Labels', // フィールド名「Labels」
          value: labelsText, // 変換されたラベル文字列
          inline: false, // 縦並び表示（横幅を全て使用）
        });
      }

      // ==================================================
      // 作成日・更新日情報の追加処理
      // ==================================================

      /**
       * Issue の作成日と更新日の情報を整形・追加
       *
       * 【日付の処理について】
       * GitHub APIから取得される日付はISO 8601形式（例: 2023-12-25T10:30:00Z）
       * これを日本語の読みやすい形式（例: 2023/12/25）に変換
       *
       * 【new Date() とは？】
       * JavaScript標準のDateオブジェクトを作成
       * 文字列形式の日付を解析してDateオブジェクトに変換
       *
       * 【toLocaleDateString('ja-JP') とは？】
       * 日付を指定した言語・地域の形式で文字列に変換
       * 'ja-JP': 日本語・日本地域（YYYY/MM/DD形式）
       *
       * 【const vs let の使い分け】
       * ここではconst（定数）を使用
       * 一度作成した日付文字列は変更する必要がないため
       */
      const createdDate = new Date(issueData.created_at).toLocaleDateString('ja-JP');
      const updatedDate = new Date(issueData.updated_at).toLocaleDateString('ja-JP');

      /**
       * 作成日をEmbedフィールドに追加
       *
       * 【inline: true とは？】
       * フィールドを横並び表示にする設定
       * 作成日と更新日は短い情報なので、横並びで省スペース化
       */
      embed.fields.push({
        name: 'Created', // フィールド名「Created」（作成日）
        value: createdDate, // 日本語形式の作成日
        inline: true, // 横並び表示を有効
      });

      /**
       * 更新日の表示条件チェックと追加
       *
       * 【なぜ条件チェックが必要？】
       * 作成直後のIssueは created_at と updated_at が同じ値
       * 同じ日付を2回表示するのを避けるため
       *
       * 【!== 演算子 とは？】
       * 厳密不等価演算子
       * 型と値の両方が異なる場合に true を返す
       * ここでは作成日時と更新日時の文字列が異なるかチェック
       *
       * 【文字列比較について】
       * ISO 8601形式の日時文字列は文字列として比較可能
       * '2023-12-25T10:30:00Z' !== '2023-12-25T15:45:00Z' → true
       */
      if (issueData.created_at !== issueData.updated_at) {
        /**
         * 更新日をEmbedフィールドに追加
         *
         * 【条件付きフィールド追加の意味】
         * - Issue作成後に編集があった場合のみ更新日を表示
         * - 不要な情報の削減とUIの簡潔性を保つ
         * - ユーザーにとって有用な情報のみを提示
         */
        embed.fields.push({
          name: 'Updated', // フィールド名「Updated」（更新日）
          value: updatedDate, // 日本語形式の更新日
          inline: true, // 横並び表示を有効
        });
      }

      // ==================================================
      // Embedメッセージの送信処理
      // ==================================================

      /**
       * 完成したEmbedをDiscordメッセージとして返信
       *
       * 【message.reply() とは？】
       * 元のメッセージに対する返信を送信する関数
       * 返信形式なので、元メッセージとの関連性が明確
       *
       * 【{ embeds: [embed] } の構造説明】
       * Discord.jsのメッセージオプション形式
       * - embeds: Embed配列を指定するプロパティ
       * - [embed]: 作成したembedオブジェクトを配列に格納
       *
       * 【なぜ配列形式？】
       * Discord APIは複数のEmbedを同時送信可能
       * 一つのメッセージに最大10個のEmbedを添付できる
       *
       * 【await の必要性】
       * Discord APIへの通信は時間がかかる非同期処理
       * 送信完了を待ってから次の処理に進む
       */
      await message.reply({ embeds: [embed] });

      /**
       * 送信成功をログに記録
       *
       * 【ログ記録の目的】
       * - 運用監視: システムの正常動作確認
       * - デバッグ: 問題発生時の追跡調査
       * - 統計: 利用状況の把握
       *
       * 【オプショナルチェーニング ?. の使用】
       * issueData.repository?.full_name
       * repositoryがnullの場合でもエラーにならず undefined を返す
       * 安全なプログラミングのベストプラクティス
       */
      logger.info(
        `Issue embed sent for #${issueData.number} in ${issueData.repository?.full_name}`
      );

      /**
       * エラーハンドリング（エラー処理）
       *
       * 【catch ブロックの役割】
       * sendIssueEmbed メソッド内で発生したエラーを捕捉
       * ログ出力後に上位レイヤーにエラーを再投げ
       *
       * 【throw error の意味】
       * キャッチしたエラーを呼び出し元に再度投げる
       * 上位メソッド（processIssuePattern）でエラー処理を継続
       */
    } catch (error) {
      // エラーをログに記録（デバッグ・監視用）
      logger.error('Error sending issue embed:', error);
      // エラーを上位レイヤーに再投げ（エラーチェーンの継続）
      throw error;
    }
  }

  // ==================================================
  // ユーティリティメソッド群
  // ==================================================

  /**
   * Issue の状態に応じた絵文字とテキストを取得
   *
   * 【このメソッドの目的】
   * GitHub Issue の状態を視覚的に分かりやすくする
   * Discord ユーザーが一目で状態を把握できるように
   *
   * 【private メソッドとは？】
   * クラス内部でのみ使用される関数
   * 外部から直接呼び出すことはできない
   *
   * 【戻り値の型指定 : string】
   * この関数は必ず文字列（string型）を返すことを明示
   * TypeScriptの型安全性を確保
   *
   * @param issue - GitHub Issue オブジェクト
   * @returns 状態を表す絵文字とテキストの組み合わせ
   */
  private getStatusEmoji(issue: GitHubIssue): string {
    /**
     * Issue 状態の判定とアイコン返却
     *
     * 【if-else if-else パターン】
     * 複数の条件を順番にチェックし、最初に一致した条件の処理を実行
     *
     * 【状態の優先順位】
     * 1. Closed（解決済み）: 最も重要な状態
     * 2. Draft（下書き）: 作業中の状態
     * 3. Open（未解決）: デフォルトの状態
     *
     * 【絵文字の選択理由】
     * 🔴 赤: 完了・終了を表す一般的な色
     * 🟡 黄: 注意・作業中を表す色
     * 🟢 緑: アクティブ・進行中を表す色
     */
    if (issue.state === 'closed') {
      return '🔴 Closed'; // 解決済み（赤丸）
    } else if (issue.draft) {
      return '🟡 Draft'; // 下書き（黄丸）
    } else {
      return '🟢 Open'; // 未解決（緑丸）
    }
  }

  /**
   * Issue 説明文を適切な長さに切り詰める
   *
   * 【このメソッドの必要性】
   * Discord Embed には文字数制限がある
   * 長すぎる説明文はレイアウトを崩す可能性
   * ユーザビリティ向上のため適切な長さに調整
   *
   * 【引数と戻り値】
   * @param description - 元の説明文（文字列）
   * @returns 切り詰められた説明文（文字列）
   */
  private truncateDescription(description: string): string {
    /**
     * 最大文字数制限の取得
     *
     * 【BOT_LIMITS とは？】
     * アプリケーション全体の制限値を定義した定数オブジェクト
     * 設定の一元管理とマジックナンバーの排除
     *
     * 【MAX_EMBED_DESCRIPTION_LENGTH とは？】
     * Discord Embed の説明文の最大文字数制限
     * 通常は 2048文字 または 4096文字 に設定
     *
     * 【const を使用する理由】
     * この値は関数内で変更されないため
     * 意図しない値の変更を防ぐ
     */
    const maxLength = BOT_LIMITS.MAX_EMBED_DESCRIPTION_LENGTH;

    /**
     * 文字数チェックと早期リターン
     *
     * 【早期リターンパターン】
     * 条件を満たす場合は即座に結果を返す
     * else ブロックを減らしてコードの可読性向上
     *
     * 【<= 演算子】
     * 「以下」を表す比較演算子
     * description.length が maxLength 以下の場合 true
     */
    if (description.length <= maxLength) {
      return description; // そのまま返却（切り詰め不要）
    }

    /**
     * 文字列の切り詰め処理
     *
     * 【substring() メソッド】
     * 文字列の指定範囲を抽出するメソッド
     * substring(開始位置, 終了位置)
     *
     * 【maxLength - 3 の計算理由】
     * 末尾に「...」（3文字）を追加するため
     * 全体の文字数が制限を超えないよう事前に調整
     *
     * 【+ '...' の意味】
     * 文字列連結演算子
     * 切り詰めた文字列の末尾に省略記号を追加
     * ユーザーに「続きがある」ことを視覚的に示す
     */
    return description.substring(0, maxLength - 3) + '...';
  }
}
