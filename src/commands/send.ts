// ==================================================
// 外部ライブラリのインポート（外部から機能を借りてくる）
// ==================================================

// discord.js: Discord APIを簡単に使うためのライブラリ
// - SlashCommandBuilder: スラッシュコマンドの設定を作るためのクラス
//   例: /send のようなコマンドの名前、説明、オプションを定義
// - ChatInputCommandInteraction: ユーザーがスラッシュコマンドを実行したときの情報
//   例: どのユーザーが、どのサーバーで、どんなオプションでコマンドを実行したか
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

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

// Discord チャンネルに通知を送るためのユーティリティクラス
// Issue情報を見やすいメッセージ形式でDiscordに投稿する
import { ChannelNotifier } from '../utils/channelNotifier';

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
 * 'send-command' は このファイルの識別名
 */
const logger = createLogger('send-command');

// ==================================================
// スラッシュコマンドの定義と実装
// ==================================================

/**
 * /sendコマンドの定義
 *
 * 【スラッシュコマンドとは？】
 * Discord上で「/コマンド名」で実行できる機能
 * 例: /send #123 → Issue情報を送信
 *
 * 【このコマンドの機能】
 * 1. ユーザーからIssue番号を受け取る
 * 2. GitHub APIからIssue情報を取得
 * 3. 指定されたチャンネルに整形したメッセージを送信
 *
 * 【export default とは？】
 * このファイルのメイン機能を外部から使えるように公開する書き方
 * 他のファイルから require() や import でこのコマンドを読み込める
 */
export default {
  /**
   * コマンドのメタデータとオプションを定義
   *
   * 【SlashCommandBuilder とは？】
   * スラッシュコマンドの設定を作るためのクラス
   * - コマンド名、説明文
   * - オプション（パラメータ）の定義
   * - 必須/任意の設定
   *
   * 【addStringOption とは？】
   * 文字列型のオプション（入力パラメータ）を追加する関数
   * ユーザーがコマンド実行時に入力する値を定義
   */
  data: new SlashCommandBuilder()
    // コマンド名を設定（Discord上で /send として表示される）
    .setName('send')
    // コマンドの説明文（ユーザーがコマンド入力時に表示される）
    .setDescription('指定チャンネルにIssue情報を送信（例: /send #123）')

    // 第1オプション: Issue番号（必須）
    .addStringOption(
      (option) =>
        option
          .setName('number') // オプション名
          .setDescription('Issue番号（#123 または 123）') // オプションの説明
          .setRequired(true) // 必須パラメータ（ユーザーは必ず入力しなければならない）
    )

    // 第2オプション: リポジトリ名（任意）
    .addStringOption(
      (option) =>
        option
          .setName('repo') // オプション名
          .setDescription('リポジトリ（省略可: デフォルト microsoft/vscode）') // オプションの説明
          .setRequired(false) // オプションパラメータ（省略可能）
    ),

  /**
   * コマンドの実行処理
   *
   * 【この関数の役割】
   * ユーザーが /send コマンドを実行したときに呼び出される
   * Issue情報を取得してDiscordチャンネルに送信する
   *
   * 【async/await とは？】
   * 時間のかかる処理（API通信など）を扱うための仕組み
   * - async: この関数は非同期処理を含むことを宣言
   * - await: 処理の完了を待つキーワード
   *
   * 【ChatInputCommandInteraction とは？】
   * ユーザーがスラッシュコマンドを実行したときの情報が入ったオブジェクト
   * - どのユーザーが実行したか
   * - どのサーバー・チャンネルで実行したか
   * - どんなオプション（パラメータ）を入力したか
   * - 返信を送るためのメソッド
   *
   * @param interaction - コマンドのインタラクションオブジェクト
   */
  async execute(interaction: ChatInputCommandInteraction) {
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
       * 初期レスポンス（処理中表示）を送信
       *
       * 【deferReply とは？】
       * 「処理中です...」のような一時的な返信を送る関数
       * GitHub APIからの応答など時間がかかる処理の前に送信
       *
       * 【ephemeral: true とは？】
       * 返信をコマンド実行者にだけ見える形で送信する設定
       * 他のユーザーには見えない（プライベートメッセージ）
       */
      await interaction.deferReply({ ephemeral: true });

      /**
       * ユーザーが入力したパラメータを取得
       *
       * 【interaction.options.get() とは？】
       * スラッシュコマンドで入力されたオプション値を取得する関数
       * 'number' は先ほど定義したオプション名
       *
       * 【?.value とは？】
       * オプショナルチェーニング記法
       * オプションが存在しない場合でもエラーにならず undefined を返す
       *
       * 【as string とは？】
       * TypeScriptの型アサーション（型の強制指定）
       * この値は string型だと明示的に指定
       */
      const issueInput = interaction.options.get('number')?.value as string;

      /**
       * リポジトリ名の取得（オプション、省略時はデフォルト値を使用）
       *
       * 【|| 演算子 とは？】
       * OR演算子。左側が false/null/undefined の場合、右側の値を使用
       * 優先順位:
       * 1. ユーザーが入力したrepoオプション
       * 2. 環境変数 DEFAULT_REPOSITORY
       * 3. 固定値 'microsoft/vscode'
       */
      const repository =
        (interaction.options.get('repo')?.value as string) ||
        process.env.DEFAULT_REPOSITORY ||
        'microsoft/vscode';

      /**
       * 環境変数から送信先チャンネルIDを取得
       *
       * 【環境変数とは？】
       * アプリケーションの設定値を外部ファイル（.env）に保存する仕組み
       *
       * 【TARGET_CHANNEL_ID とは？】
       * Issue情報を送信する先のDiscordチャンネルのID
       * 例: '1391283438224539658'
       *
       * 【なぜ環境変数を使うの？】
       * - セキュリティ: IDをコードに直接書かない
       * - 柔軟性: 環境（開発・本番）ごとに異なるチャンネルを設定可能
       */
      const targetChannelId = process.env.TARGET_CHANNEL_ID;

      /**
       * Issue番号を解析（#123 または 123 の形式を受け付ける）
       *
       * 【let vs const の違い】
       * - let: 値を後で変更可能な変数
       * - const: 値を変更できない定数
       *
       * 【正規表現 /^#/ とは？】
       * ^ : 文字列の開始位置
       * # : ハッシュ記号そのもの
       * つまり「文字列の最初にあるハッシュ記号」を意味
       *
       * 【replace() とは？】
       * 文字列の置換を行う関数
       * ここでは先頭の#記号を空文字（''）で置き換え = 削除
       *
       * 【parseInt() とは？】
       * 文字列を数値に変換する関数
       * 第2引数の10は「10進数」を意味
       */
      let issueNumber: number;
      const cleanInput = issueInput.replace(/^#/, ''); // 先頭の#記号を除去
      issueNumber = parseInt(cleanInput, 10);

      /**
       * 入力値のバリデーション（検証）
       *
       * 【バリデーションとは？】
       * ユーザーの入力が正しいかどうかをチェックすること
       * 不正な値でプログラムがエラーになるのを防ぐ
       *
       * 【isNaN() とは？】
       * "is Not a Number" の略
       * 値が数値でない場合に true を返す関数
       *
       * 【|| 演算子（論理OR）とは？】
       * 左側または右側のどちらかが true の場合に true を返す
       * ここでは「数値でない」または「1未満」の場合にエラー
       *
       * 【editReply() とは？】
       * 先ほどのdeferReply()で送信した「処理中」メッセージを更新する関数
       *
       * 【return とは？】
       * 関数の実行を終了し、呼び出し元に戻る
       * ここではエラーメッセージを表示して処理を中断
       */
      if (isNaN(issueNumber) || issueNumber < 1) {
        await interaction.editReply(
          '❌ 有効なIssue番号を入力してください（例: #123 または 123）。'
        );
        return;
      }

      /**
       * 送信先チャンネルが設定されているか確認
       *
       * 【! 演算子（論理NOT）とは？】
       * 値を反転させる演算子
       * !true = false, !false = true
       * ここでは「targetChannelIdが設定されていない」をチェック
       *
       * 【なぜこのチェックが必要？】
       * 環境変数が設定されていない場合、
       * 後でDiscordチャンネルにアクセスしようとしてエラーになるのを防ぐ
       */
      if (!targetChannelId) {
        await interaction.editReply(
          '❌ 送信先チャンネルが設定されていません。管理者にお問い合わせください。'
        );
        return;
      }

      /**
       * リポジトリ名を owner/repo 形式から分離
       *
       * 【配列の分割代入 とは？】
       * 配列の要素を個別の変数に一度に代入する書き方
       *
       * 【split('/') とは？】
       * 文字列を指定した文字（ここでは'/'）で分割して配列にする関数
       * 例: 'microsoft/vscode' → ['microsoft', 'vscode']
       *
       * 【なぜ分離が必要？】
       * GitHub APIは owner（所有者）と repo（リポジトリ名）を
       * 別々のパラメータとして要求するため
       *
       * 【|| 演算子の使い方】
       * ここでは「ownerが空」または「repoが空」の場合にエラー
       */
      const [owner, repo] = repository.split('/');
      if (!owner || !repo) {
        await interaction.editReply('❌ リポジトリは "owner/repo" の形式で指定してください。');
        return;
      }

      /**
       * ログ出力（処理の記録）
       *
       * 【テンプレートリテラル（バッククォート記法）とは？】
       * `文字列の中に${変数}を埋め込む` 書き方
       * 従来の文字列連結より読みやすく、間違いが少ない
       *
       * 【なぜログを出力するの？】
       * - デバッグ: プログラムの動作を追跡
       * - 監視: どんな処理が実行されているかを記録
       * - トラブルシューティング: 問題発生時の原因調査
       */
      logger.info(
        `Send command: Issue #${issueNumber} from ${repository} to channel ${targetChannelId}`
      );

      /**
       * GitHubサービスとキャッシュサービスを初期化
       *
       * 【new キーワード とは？】
       * クラスからオブジェクト（インスタンス）を作成するキーワード
       * 設計図（クラス）から実際の道具（オブジェクト）を作る
       *
       * 【GitHubService とは？】
       * GitHub APIと通信するための機能をまとめたクラス
       * Issue情報の取得、認証処理などを担当
       *
       * 【getCacheService() とは？】
       * キャッシュサービスのインスタンスを取得する関数
       * 同じデータを何度も取得しないよう、一時的に保存する機能
       *
       * 【なぜキャッシュが必要？】
       * - API制限の回避: GitHub APIには使用回数制限がある
       * - 高速化: 一度取得したデータは素早く再利用
       * - ユーザー体験向上: 応答時間の短縮
       */
      const githubService = new GitHubService();
      const cacheService = getCacheService();

      /**
       * Issue情報を取得（キャッシュ優先）
       *
       * 【キャッシュファーストパターン とは？】
       * 1. まずキャッシュ（高速）をチェック
       * 2. なければAPI（時間かかる）から取得
       * 3. 取得したデータをキャッシュに保存（次回用）
       *
       * 【await キーワード とは？】
       * 非同期処理の完了を待つキーワード
       * API通信など時間がかかる処理で使用
       *
       * 【なぜこの順序？】
       * キャッシュの方がGitHub APIより圧倒的に高速
       * API制限も回避できる
       */
      // まずキャッシュからIssue情報を検索
      let issue = await cacheService.getIssue(owner, repo, issueNumber);

      if (!issue) {
        // キャッシュにない場合、GitHub APIから取得
        issue = await githubService.getIssue(owner, repo, issueNumber);
        // 取得したデータをキャッシュに保存（次回の高速化のため）
        await cacheService.setIssue(owner, repo, issueNumber, issue);
      }

      /**
       * 指定チャンネルにIssue情報を送信
       *
       * 【ChannelNotifier とは？】
       * Discord チャンネルに通知を送るためのクラス
       * Issue情報を見やすいEmbed形式で整形・送信
       *
       * 【interaction.client とは？】
       * Discord APIと通信するためのクライアントオブジェクト
       * チャンネルへのメッセージ送信などに必要
       *
       * 【sendIssueToChannel() とは？】
       * Issue情報を指定チャンネルに送信するメソッド
       * - タイトル、本文、状態、ラベルなどを整形
       * - Discord Embed形式で見やすく表示
       */
      const notifier = new ChannelNotifier(interaction.client);
      await notifier.sendIssueToChannel(targetChannelId, issue);

      /**
       * ユーザーに成功メッセージを返信
       *
       * 【なぜ成功メッセージが必要？】
       * ユーザーが操作の完了を確認できるように
       * Issue情報は別チャンネルに送信されるため、
       * コマンド実行者には直接見えない
       */
      await interaction.editReply(
        `✅ Issue #${issueNumber} の情報を指定チャンネルに送信しました。`
      );

      // 処理成功をログに記録（運用・監視のため）
      logger.info(`Successfully sent Issue #${issueNumber} to channel ${targetChannelId}`);

      /**
       * エラーハンドリング（エラー処理）
       *
       * 【catch ブロック とは？】
       * try ブロック内でエラーが発生した場合に実行される処理
       *
       * 【error: any とは？】
       * TypeScriptの型指定
       * any型は「どんな型でも受け入れる」という意味
       * エラーオブジェクトは種類が多いため any を使用
       */
    } catch (error: any) {
      // エラーをログに記録（デバッグ・監視のため）
      logger.error('Send command failed:', error);

      /**
       * エラーの種類に応じたユーザーフレンドリーなメッセージを作成
       *
       * 【なぜエラーメッセージを分岐？】
       * - 技術的エラーをそのまま表示すると分かりにくい
       * - ユーザーが対処法を理解できるメッセージに変換
       * - 状況に応じた適切なガイダンスを提供
       */
      let errorMessage = '❌ Issue情報の送信に失敗しました。';

      /**
       * HTTPステータスコードによる分岐
       *
       * 【HTTPステータスコードとは？】
       * Web APIの応答結果を表す3桁の数字
       * - 404: Not Found（見つからない）
       * - 403: Forbidden（権限なし）
       * - 200: OK（成功）など
       */
      if (error.status === 404) {
        errorMessage = '❌ 指定されたIssueが見つかりません。';
      } else if (error.status === 403) {
        errorMessage = '❌ GitHub API の制限に達しているか、アクセス権限がありません。';
      } else if (error.message.includes('Missing Permissions')) {
        errorMessage = '❌ 指定チャンネルに投稿する権限がありません。';
      } else if (error.message.includes('Channel') && error.message.includes('not')) {
        errorMessage = '❌ 指定チャンネルにアクセスできません。';
      }

      /**
       * エラーメッセージをユーザーに返信
       *
       * 【二重エラーハンドリング とは？】
       * エラーメッセージの送信自体が失敗する可能性もあるため、
       * さらにtry-catchで囲んで安全性を確保
       */
      try {
        await interaction.editReply(errorMessage);
      } catch (replyError) {
        // エラーメッセージの送信に失敗した場合もログに記録
        logger.error('Failed to send error reply:', replyError);
      }
    }
  },
};
