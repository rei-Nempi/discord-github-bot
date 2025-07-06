// ==================================================
// 外部ライブラリのインポート（外部から機能を借りてくる）
// ==================================================

// discord.js: Discord APIを簡単に使うためのライブラリ
// - Events: Discord.jsで使用できるイベント名の定数定義
//   例: Events.InteractionCreate = 'interactionCreate'
// - Interaction: ユーザーがBotと対話する際の情報を含むオブジェクト
//   例: スラッシュコマンド、ボタンクリック、セレクトメニュー選択など
import { Events, Interaction } from 'discord.js';

// ==================================================
// 自分で作ったファイルのインポート
// ==================================================

// ログ出力を管理するユーティリティ関数
// console.logより高機能で、ファイルに保存したりレベル分けができる
import { createLogger } from '../utils/logger';

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
 * 'interactionCreate' は このファイルの識別名
 */
const logger = createLogger('interactionCreate');

// ==================================================
// インタラクションイベントハンドラーの定義
// ==================================================

/**
 * インタラクション作成イベントの設定
 *
 * 【インタラクションとは？】
 * ユーザーがBotと対話する操作全般を指す
 * - スラッシュコマンド（/send #123）
 * - ボタンクリック（「詳細を見る」ボタンなど）
 * - セレクトメニュー選択（「リポジトリを選択」など）
 * - モーダル入力（フォーム入力）
 *
 * 【このイベントの役割】
 * Discord上でユーザーがBotに対して何らかの操作を行った際に
 * 自動的に実行される処理を定義する
 *
 * 【export default とは？】
 * このファイルのメイン機能を外部から使えるように公開する書き方
 * 他のファイルから require() や import でこのイベントハンドラーを読み込める
 */
export default {
  /**
   * イベント名の指定
   *
   * 【Events.InteractionCreate とは？】
   * Discord.jsが定義するイベント名の定数
   * 実際の値は 'interactionCreate' という文字列
   *
   * 【なぜ定数を使うの？】
   * - タイポ（入力ミス）の防止
   * - コードエディタの自動補完機能が使える
   * - イベント名が変更された場合の対応が楽
   */
  name: Events.InteractionCreate,
  /**
   * インタラクションの処理
   *
   * 【この関数の役割】
   * ユーザーがBotに対してインタラクション（操作）を行った際に自動実行される
   * 操作の種類を判別し、それぞれに適した処理を実行する
   *
   * 【async/await とは？】
   * 時間のかかる処理（Discord APIへの返信など）を扱うための仕組み
   * - async: この関数は非同期処理を含むことを宣言
   * - await: 処理の完了を待つキーワード
   *
   * 【Interaction とは？】
   * ユーザーの操作情報が詰まったオブジェクト
   * - どのユーザーが操作したか
   * - どのサーバー・チャンネルで操作したか
   * - どんな操作を行ったか（コマンド名、パラメータなど）
   * - 返信を送るためのメソッド
   *
   * @param interaction - インタラクションオブジェクト
   */
  async execute(interaction: Interaction) {
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
       * スラッシュコマンドの処理
       *
       * 【isChatInputCommand() とは？】
       * インタラクションがスラッシュコマンド（/コマンド名）かどうかを判定する関数
       * 戻り値: true（スラッシュコマンド）/ false（その他の操作）
       *
       * 【なぜ判定が必要？】
       * インタラクションには複数の種類があるため：
       * - スラッシュコマンド（/send #123）
       * - ボタンクリック
       * - セレクトメニュー選択など
       * それぞれ異なる処理が必要
       */
      if (interaction.isChatInputCommand()) {
        /**
         * コマンドコレクションから該当コマンドを取得
         *
         * 【interaction.client とは？】
         * Discord APIと通信するためのクライアントオブジェクト
         * Botの各種機能や設定にアクセスできる
         *
         * 【(client as any) とは？】
         * TypeScriptの型チェックを一時的に無効にするため
         * Clientクラスには標準でcommandsプロパティがないが、
         * カスタムプロパティとして追加している
         *
         * 【.commands.get() とは？】
         * index.tsで登録したコマンドコレクションから、
         * 指定された名前のコマンドオブジェクトを取得
         *
         * 【interaction.commandName とは？】
         * ユーザーが実行したコマンドの名前
         * 例: /send を実行した場合 → 'send'
         */
        const command = (interaction.client as any).commands.get(interaction.commandName);

        /**
         * コマンドの存在確認
         *
         * 【なぜこのチェックが必要？】
         * - ユーザーが削除されたコマンドを実行した場合
         * - コマンドの登録に失敗した場合
         * - Discord側とBotの同期が取れていない場合
         *
         * これらの状況でエラーが発生するのを防ぐ
         */
        if (!command) {
          logger.warn(`Unknown command: ${interaction.commandName}`);
          return; // 関数の実行を終了（以降の処理をスキップ）
        }

        /**
         * コマンド実行のログ出力
         *
         * 【ログに記録する情報】
         * - コマンド名: どのコマンドが実行されたか
         * - ユーザー名: 誰が実行したか
         *
         * 【なぜログが重要？】
         * - デバッグ: プログラムの動作を追跡
         * - 監視: どんな処理が実行されているかを記録
         * - セキュリティ: 不正な操作の検出
         */
        logger.info(`Command executed: ${interaction.commandName} by ${interaction.user.username}`);

        /**
         * コマンドの実行処理
         *
         * 【二重のtry-catch構造】
         * 外側: インタラクション全体のエラー処理
         * 内側: 個別コマンドのエラー処理
         *
         * より細かいエラーハンドリングが可能
         */
        try {
          /**
           * 実際のコマンド処理を実行
           *
           * 【command.execute() とは？】
           * 各コマンドファイル（例: send.ts）で定義された
           * execute関数を呼び出す
           */
          await command.execute(interaction);
        } catch (error) {
          /**
           * コマンド実行エラーの処理
           *
           * 【エラーログの出力】
           * どのコマンドで、どんなエラーが発生したかを記録
           * デバッグやトラブルシューティングで重要
           */
          logger.error(`Command execution failed: ${interaction.commandName}`, error);

          const errorMessage = 'コマンドの実行中にエラーが発生しました。';

          /**
           * インタラクションの状態に応じて適切な返信方法を選択
           *
           * 【Discord インタラクションの状態】
           * - replied: 既に返信済み
           * - deferred: 処理中表示を送信済み（editReplyで更新可能）
           * - 未返信: まだ何も返信していない
           *
           * 【なぜ状態確認が必要？】
           * Discordの制限により、1つのインタラクションに対して
           * 初回返信は1回のみ。2回目以降はfollowUpを使用する必要がある
           *
           * 【ephemeral: true とは？】
           * エラーメッセージをコマンド実行者にだけ見える形で送信
           * 他のユーザーには見えない（プライベートメッセージ）
           */
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
          } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
          }
        }
      } else if (interaction.isButton()) {
        /**
         * ボタンインタラクションの処理
         *
         * 【ボタンインタラクションとは？】
         * Discordメッセージに添付されたボタンがクリックされた時の操作
         * 例: 「詳細を見る」「削除」「承認」などのボタン
         *
         * 【isButton() とは？】
         * インタラクションがボタンクリックかどうかを判定する関数
         */
        /**
         * ボタン操作のログ出力
         *
         * 【customId とは？】
         * ボタン作成時に設定する識別子
         * どのボタンがクリックされたかを判別するために使用
         * 例: 'delete_issue', 'approve_request' など
         */
        logger.info(`Button interaction: ${interaction.customId} by ${interaction.user.username}`);

        /**
         * ボタンの処理は将来的に実装予定
         *
         * 【現在の実装状況】
         * このBotは現在スラッシュコマンド（/send）のみに対応
         * ボタン機能は今後の拡張で実装予定
         */
        await interaction.reply({ content: 'ボタン機能は現在開発中です。', ephemeral: true });
      } else if (interaction.isStringSelectMenu()) {
        /**
         * セレクトメニューの処理
         *
         * 【セレクトメニューとは？】
         * ドロップダウン形式で選択肢を表示するUI要素
         * 例: 「リポジトリを選択」「ラベルを選択」など
         *
         * 【isStringSelectMenu() とは？】
         * インタラクションが文字列型セレクトメニューの選択かどうかを判定
         * 他にもUserSelectMenu（ユーザー選択）、RoleSelectMenu（ロール選択）などがある
         */
        /**
         * セレクトメニュー操作のログ出力
         *
         * 【customId の用途】
         * セレクトメニュー作成時に設定する識別子
         * どのセレクトメニューで選択が行われたかを判別
         */
        logger.info(
          `Select menu interaction: ${interaction.customId} by ${interaction.user.username}`
        );

        /**
         * セレクトメニューの処理は将来的に実装予定
         *
         * 【将来の実装案】
         * - リポジトリ選択メニュー
         * - Issue状態フィルター
         * - ラベル選択など
         */
        await interaction.reply({
          content: 'セレクトメニュー機能は現在開発中です。',
          ephemeral: true,
        });
      }

      /**
       * イベントハンドラー全体のエラー処理
       *
       * 【このcatchブロックの役割】
       * try内の全処理で発生したエラーをキャッチ
       * 個別コマンドのエラー処理では対応できない
       * より深刻なエラーに対する最後の砦
       */
    } catch (error) {
      /**
       * エラーログの出力
       *
       * 【重要性】
       * インタラクション処理全体のエラーは
       * Botの動作に大きな影響を与える可能性があるため
       * 必ずログに記録して原因を追跡できるようにする
       */
      logger.error('Error processing interaction:', error);

      /**
       * エラーメッセージをユーザーに送信
       *
       * 【三重のエラーハンドリング】
       * 1. 個別コマンドのエラー処理
       * 2. インタラクション全体のエラー処理（ここ）
       * 3. エラーメッセージ送信のエラー処理（さらに内側）
       *
       * 【なぜこれほど複雑？】
       * Discord APIとの通信は失敗する可能性があるため
       * どんな状況でもBotがクラッシュしないよう多重に保護
       */
      try {
        const errorMessage = 'インタラクションの処理中にエラーが発生しました。';

        /**
         * 返信可能なインタラクションの場合のみエラーメッセージを送信
         *
         * 【返信可能なインタラクションの種類】
         * - スラッシュコマンド: /send などのコマンド
         * - ボタン: クリック可能なボタン
         * - セレクトメニュー: 選択肢のドロップダウン
         *
         * 【なぜ種類を限定？】
         * 一部のインタラクション（モーダルなど）は
         * 異なる返信方法が必要な場合があるため
         */
        if (
          interaction.isChatInputCommand() ||
          interaction.isButton() ||
          interaction.isStringSelectMenu()
        ) {
          /**
           * インタラクション状態に応じた適切な返信方法の選択
           *
           * 【Discord API の制限】
           * - 初回返信: reply() のみ使用可能
           * - 2回目以降: followUp() のみ使用可能
           * - 処理中表示後: editReply() で更新可能
           */
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
          } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
          }
        }
      } catch (replyError) {
        /**
         * エラーメッセージの送信に失敗した場合
         *
         * 【最後の手段】
         * エラーメッセージの送信すら失敗した場合、
         * ログに記録するしかできない
         * 例: Discordサーバーダウン、権限不足など
         */
        logger.error('Failed to send error reply:', replyError);
      }
    }
  },
};

// ==================================================
// ファイルの終了
// ==================================================
