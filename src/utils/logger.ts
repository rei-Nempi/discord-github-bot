// ==================================================
// 外部ライブラリのインポート（外部から機能を借りてくる）
// ==================================================

// winston: Node.js用の高機能ログライブラリ
// - 複数のログレベル（info, warn, error など）をサポート
// - ファイル出力とコンソール出力の両方が可能
// - ログのローテーション機能（ファイルサイズ制限）
// - カスタマイズ可能なフォーマット機能
// - 本格的なアプリケーションで広く使用されている
import winston from 'winston';

// path: Node.js標準のパス操作ライブラリ
// - ファイルパスの結合（path.join）
// - OS間の互換性を保つ（Windows: \, macOS/Linux: /）
// - パスの正規化や解析機能
import path from 'path';

// ==================================================
// ログレベルの設定
// ==================================================

/**
 * アプリケーションのログレベルを環境変数から取得
 *
 * 【ログレベルとは？】
 * ログの重要度を表すレベル設定
 * - error: エラー情報のみ
 * - warn: 警告以上の情報
 * - info: 一般情報以上（デフォルト）
 * - debug: 詳細なデバッグ情報まで全て
 *
 * 【環境変数 LOG_LEVEL の活用】
 * 開発環境では 'debug'、本番環境では 'warn' など
 * 環境に応じてログの詳細度を調整可能
 *
 * 【|| 演算子（デフォルト値設定）】
 * 左側が falsy値（null, undefined, '' など）の場合、右側の値を使用
 * 環境変数が設定されていない場合は 'info' レベルをデフォルトとして使用
 */
const logLevel = process.env.LOG_LEVEL || 'info';

// ==================================================
// ログフォーマットの定義
// ==================================================

/**
 * ファイル出力用のログフォーマット設定
 *
 * 【winston.format.combine() とは？】
 * 複数のフォーマット処理を組み合わせる関数
 * パイプライン形式で順番に処理される
 *
 * 【各フォーマットの説明】
 * 1. timestamp: タイムスタンプを追加
 * 2. errors: エラーオブジェクトのスタックトレースを含める
 * 3. splat: printf形式の文字列補間をサポート
 * 4. json: 最終的にJSON形式で出力
 *
 * 【JSON形式の利点】
 * - 構造化されたデータ
 * - ログ解析ツールでの処理が容易
 * - 検索・フィルタリングが高速
 * - プログラムでの自動処理に適している
 */
const logFormat = winston.format.combine(
  /**
   * タイムスタンプの追加
   *
   * 【フォーマット 'YYYY-MM-DD HH:mm:ss' の意味】
   * - YYYY: 4桁の年（例: 2023）
   * - MM: 2桁の月（例: 12）
   * - DD: 2桁の日（例: 25）
   * - HH: 24時間形式の時（例: 15）
   * - mm: 分（例: 30）
   * - ss: 秒（例: 45）
   *
   * 【ISO形式を使わない理由】
   * 人間が読みやすく、ログファイルでの視認性を重視
   */
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),

  /**
   * エラースタックトレースの処理
   *
   * 【stack: true の意味】
   * JavaScript Errorオブジェクトのスタックトレース情報を
   * ログに含めるオプション
   *
   * 【スタックトレースとは？】
   * エラーが発生した関数の呼び出し履歴
   * どこでエラーが起きたかを特定するのに重要
   */
  winston.format.errors({ stack: true }),

  /**
   * 文字列補間のサポート
   *
   * 【splat() の機能】
   * printf形式の文字列補間をサポート
   * 例: logger.info('User %s logged in', username)
   * %s, %d, %j などのプレースホルダーが使用可能
   */
  winston.format.splat(),

  /**
   * JSON形式での出力
   *
   * 【JSON形式の構造例】
   * {
   *   "timestamp": "2023-12-25 15:30:45",
   *   "level": "info",
   *   "message": "User logged in",
   *   "service": "auth-service"
   * }
   */
  winston.format.json()
);

/**
 * コンソール出力用のログフォーマット設定
 *
 * 【ファイル出力との違い】
 * - カラー表示で見やすさを重視
 * - 一行形式で簡潔に表示
 * - 開発時の視認性を最優先
 */
const consoleFormat = winston.format.combine(
  /**
   * カラー表示の有効化
   *
   * 【colorize() の効果】
   * ログレベルに応じて色分け表示
   * - error: 赤色
   * - warn: 黄色
   * - info: 緑色
   * - debug: 白色
   *
   * 【開発時の利便性】
   * エラーや警告が視覚的に区別しやすく
   * ターミナルでの作業効率が向上
   */
  winston.format.colorize(),

  // タイムスタンプ追加（ファイル出力と同じ形式）
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),

  /**
   * カスタム出力フォーマットの定義
   *
   * 【printf() メソッド】
   * 自由な形式でログメッセージを整形
   *
   * 【分割代入 { timestamp, level, message, ...meta }】
   * ログオブジェクトから必要なプロパティを取得
   * ...meta は残りの全プロパティを含むオブジェクト
   *
   * 【三項演算子 ? : の使用】
   * metaオブジェクトに追加情報がある場合のみJSON形式で表示
   * Object.keys(meta).length ? JSON.stringify(meta) : ''
   *
   * 【テンプレートリテラル記法】
   * `${変数}` でログメッセージを構築
   * 例: "2023-12-25 15:30:45 [info]: User logged in"
   */
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    // 追加のメタデータがある場合はJSON文字列に変換、なければ空文字
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    // タイムスタンプ、レベル、メッセージ、メタデータを組み合わせて一行形式で出力
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// ==================================================
// ロガー作成関数
// ==================================================

/**
 * 指定された名前でWinstonロガーを作成する関数
 *
 * 【この関数の目的】
 * アプリケーション全体で統一されたログ設定を提供
 * 各モジュールが独自のロガーを持ちつつ、設定は統一
 *
 * 【export function とは？】
 * この関数を他のファイルから使えるように公開
 * import { createLogger } from './logger' で使用可能
 *
 * 【引数と戻り値の型指定】
 * @param name - ログに含めるサービス名（例: 'messageHandler'）
 * @returns winston.Logger - 設定済みのWinstonロガーオブジェクト
 *
 * 【TypeScriptの型指定の利点】
 * - 引数の型チェック（文字列以外は受け付けない）
 * - 戻り値の型保証（winston.Loggerメソッドが使用可能）
 * - 開発時の自動補完とエラー検出
 */
export function createLogger(name: string): winston.Logger {
  /**
   * Winstonロガーのメイン設定
   *
   * 【winston.createLogger() の役割】
   * Winstonライブラリの中心となるロガーオブジェクトを作成
   * 全体的な設定とトランスポート（出力先）を統合管理
   */
  const logger = winston.createLogger({
    /**
     * ログレベルの設定
     *
     * 【level プロパティ】
     * このロガーが出力する最低ログレベルを指定
     * 設定したレベル以上の重要度のログのみが出力される
     *
     * 【logLevel変数の参照】
     * 前述で定義した環境変数ベースのログレベル設定を使用
     * 開発・本番環境で動的にレベルを変更可能
     */
    level: logLevel,

    /**
     * ログフォーマットの適用
     *
     * 【format プロパティ】
     * ログメッセージの出力形式を指定
     * 前述で定義したlogFormat（JSON形式）を適用
     *
     * 【統一されたフォーマットの利点】
     * - 全てのログが同じ構造
     * - ログ解析ツールでの処理が容易
     * - 検索・フィルタリングの効率化
     */
    format: logFormat,

    /**
     * デフォルトメタデータの設定
     *
     * 【defaultMeta プロパティ】
     * 全てのログメッセージに自動的に追加される情報
     *
     * 【{ service: name } の意味】
     * service フィールドに引数で受け取った name を設定
     * 例: createLogger('messageHandler') → { service: 'messageHandler' }
     *
     * 【サービス名の重要性】
     * - 大規模アプリケーションでのログ識別
     * - 問題箇所の迅速な特定
     * - モジュール別のログ分析
     */
    defaultMeta: { service: name },

    /**
     * トランスポート（出力先）の設定
     *
     * 【transports配列とは？】
     * ログの出力先を複数指定できる配列
     * 同じログを複数の場所に同時出力可能
     *
     * 【2つのファイル出力の使い分け】
     * 1. error.log: エラーログのみ（問題調査用）
     * 2. combined.log: 全レベルのログ（全体把握用）
     */
    transports: [
      /**
       * エラー専用ログファイルの設定
       *
       * 【winston.transports.File の設定項目】
       */
      new winston.transports.File({
        /**
         * ファイルパスの指定
         *
         * 【path.join() の使用理由】
         * OS間でのパス形式の違いを自動解決
         * Windows: logs\error.log
         * macOS/Linux: logs/error.log
         *
         * 【'logs' ディレクトリ】
         * アプリケーションルートからの相対パス
         * ログファイル専用のディレクトリ
         */
        filename: path.join('logs', 'error.log'),

        /**
         * 出力レベルの制限
         *
         * 【level: 'error' の意味】
         * このファイルにはerrorレベルのログのみ出力
         * 重要なエラー情報を分離して管理
         *
         * 【エラーログ分離の利点】
         * - 問題発生時の迅速な調査
         * - 重要な情報の見落とし防止
         * - ログファイルサイズの適切な管理
         */
        level: 'error',

        /**
         * ファイルサイズ制限
         *
         * 【maxsize: 5242880 の計算】
         * 5242880バイト = 5 * 1024 * 1024 = 5MB
         *
         * 【サイズ制限の必要性】
         * - ディスク容量の保護
         * - ログファイルの読み込み速度維持
         * - システムパフォーマンスの保護
         */
        maxsize: 5242880, // 5MB

        /**
         * ローテーションファイル数
         *
         * 【maxFiles: 5 の意味】
         * 最大5つの古いログファイルを保持
         * error.log, error.log.1, error.log.2, ..., error.log.4
         *
         * 【ログローテーションの仕組み】
         * 1. error.logが5MBに達する
         * 2. error.logをerror.log.1にリネーム
         * 3. 新しいerror.logを作成
         * 4. 最古のファイル（error.log.5）は削除
         */
        maxFiles: 5,
      }),

      /**
       * 全ログ用ファイルの設定
       *
       * 【combined.log の役割】
       * info, warn, error 全レベルのログを統合保存
       * アプリケーション全体の動作履歴を記録
       */
      new winston.transports.File({
        // 統合ログファイルのパス
        filename: path.join('logs', 'combined.log'),
        // ファイルサイズ制限（エラーログと同じ5MB）
        maxsize: 5242880, // 5MB
        // ローテーションファイル数（エラーログと同じ5ファイル）
        maxFiles: 5,
        // level指定なし = 全レベルのログを出力
      }),
    ],
  });

  // ==================================================
  // 開発環境でのコンソール出力追加
  // ==================================================

  /**
   * 非本番環境でのコンソール出力の追加
   *
   * 【条件分岐の理由】
   * 本番環境ではコンソール出力を無効にしてパフォーマンス向上
   * 開発環境では即座にログを確認できるようコンソールにも出力
   *
   * 【process.env.NODE_ENV とは？】
   * Node.jsアプリケーションの実行環境を示す環境変数
   * - 'production': 本番環境
   * - 'development': 開発環境
   * - 'test': テスト環境
   *
   * 【!== 'production' の判定】
   * 本番環境以外（開発・テスト環境）でコンソール出力を有効化
   * 安全性を重視し、明示的に本番環境のみを除外
   */
  if (process.env.NODE_ENV !== 'production') {
    /**
     * コンソールトランスポートの動的追加
     *
     * 【logger.add() メソッド】
     * 既存のロガーに新しいトランスポート（出力先）を追加
     * 実行時に出力先を動的に変更可能
     *
     * 【winston.transports.Console】
     * 標準出力（ターミナル・コンソール）への出力を担当
     * 開発時のリアルタイムログ監視に最適
     */
    logger.add(
      new winston.transports.Console({
        /**
         * コンソール専用フォーマットの適用
         *
         * 【consoleFormat の特徴】
         * - カラー表示でレベルを色分け
         * - 一行形式で簡潔に表示
         * - 開発時の視認性を最優先
         *
         * 【ファイル出力との使い分け】
         * - ファイル: JSON形式、機械処理に適した構造化データ
         * - コンソール: テキスト形式、人間の読みやすさを優先
         */
        format: consoleFormat,
      })
    );
  }

  /**
   * 設定完了後のロガーオブジェクトを返却
   *
   * 【戻り値の意味】
   * 完全に設定されたWinstonロガーオブジェクト
   * 呼び出し元で logger.info(), logger.error() などが使用可能
   *
   * 【使用例】
   * const logger = createLogger('myService');
   * logger.info('Application started');
   * logger.error('Database connection failed', error);
   */
  return logger;
}
