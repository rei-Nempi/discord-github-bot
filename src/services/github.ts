// ==================================================
// 外部ライブラリのインポート（外部から機能を借りてくる）
// ==================================================

// @octokit/rest: GitHub API の公式TypeScript/JavaScriptクライアントライブラリ
// - Octokit: GitHub APIとの通信を簡単に行うためのクライアントクラス
// - REST API: GitHub の RESTful API にアクセスするための機能
// - 認証、レート制限、エラーハンドリングなどを自動で処理
// 例: Issue情報取得、リポジトリ情報取得、検索機能など
import { Octokit } from '@octokit/rest';

// ==================================================
// 自分で作ったファイルのインポート
// ==================================================

// ログ出力を管理するユーティリティ関数
// console.logより高機能で、ファイルに保存したりレベル分けができる
import { createLogger } from '../utils/logger';

// TypeScript型定義のインポート
// プログラミング初心者向け説明:
// - GitHubIssue: GitHub Issue情報の型定義
// - GitHubRepository: GitHub リポジトリ情報の型定義
// - IGitHubService: GitHub サービスのインターフェース（設計図）
// - RateLimitInfo: GitHub API レート制限情報の型定義
// - GitHubAPIError: GitHub API 関連エラーの型定義
import {
  GitHubIssue,
  GitHubRepository,
  IGitHubService,
  RateLimitInfo,
  GitHubAPIError,
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
 * 'github-service' は このファイルの識別名
 */
const logger = createLogger('github-service');

// ==================================================
// GitHub サービスクラスの定義
// ==================================================

/**
 * GitHub サービスクラス - GitHub API との通信を管理
 *
 * 【このクラスの役割】
 * 1. GitHub API への認証済みアクセス
 * 2. Issue情報の取得・検索
 * 3. リポジトリ情報の取得・検証
 * 4. レート制限の管理・監視
 * 5. API エラーの適切な処理とラッピング
 *
 * 【implements IGitHubService とは？】
 * IGitHubService インターフェース（設計図）の約束を守ることを宣言
 * 指定されたメソッドを必ず実装する必要がある
 *
 * 【GitHub API とは？】
 * GitHub が提供する RESTful API サービス
 * プログラムから GitHub の機能（Issue、Repository、User など）にアクセス可能
 * 認証トークンが必要で、レート制限がある
 *
 * 【export とは？】
 * このクラスを他のファイルから使えるように公開する
 * 他のファイルから import できるようになる
 *
 * 【class とは？】
 * オブジェクト指向プログラミングの基本概念
 * データ（プロパティ）と機能（メソッド）をまとめた設計図
 * 実際の道具（インスタンス）を作るための型枠
 */
export class GitHubService implements IGitHubService {
  /**
   * プライベートプロパティ（クラス内部でのみ使用）
   *
   * 【private とは？】
   * クラスの外部からは直接アクセスできない内部変数
   * データの安全性を保つためのカプセル化
   * 例: service.octokit = null のような変更を防ぐ
   */

  /**
   * Octokit インスタンス - GitHub API クライアント
   *
   * 【Octokit とは？】
   * GitHub が公式提供する JavaScript/TypeScript 用 API クライアント
   * - REST API への簡単なアクセス
   * - 自動認証処理
   * - レート制限の自動管理
   * - エラーレスポンスの標準化
   *
   * 【なぜ private？】
   * 外部から直接 API 操作されると、認証やログが統一されないため
   * このクラスのメソッド経由でのみアクセスを許可
   */
  private octokit: Octokit;

  /**
   * GitHub 認証トークン
   *
   * 【GitHub Token とは？】
   * GitHub API にアクセスするための認証情報
   * - Personal Access Token (PAT)
   * - GitHub Apps token
   * - OAuth token
   *
   * 【なぜ private で保存？】
   * セキュリティ上重要な情報のため、外部からの直接アクセスを防ぐ
   * トークンの漏洩を防ぐためのカプセル化
   */
  private token: string;

  /**
   * コンストラクタ - クラスのインスタンス作成時に実行される初期化処理
   *
   * 【コンストラクタとは？】
   * new GitHubService() でオブジェクトを作成する際に自動実行される関数
   * オブジェクトの初期設定を行う
   *
   * 【引数の型定義】
   * token?: string
   * - token: パラメータ名
   * - ?: オプショナル（省略可能）を示す
   * - string: 文字列型
   *
   * 【オプショナル引数の利点】
   * - new GitHubService() - 環境変数から自動取得
   * - new GitHubService('token') - 明示的にトークン指定
   * 両方の使い方に対応
   *
   * @param token - GitHub認証トークン（省略時は環境変数から取得）
   */
  constructor(token?: string) {
    /**
     * 認証トークンの取得と設定
     *
     * 【|| 演算子（論理OR）とは？】
     * 左側が falsy（null, undefined, ''など）の場合、右側の値を使用
     * 優先順位:
     * 1. 引数で渡されたtoken
     * 2. 環境変数 GITHUB_TOKEN
     * 3. 空文字列（最終フォールバック）
     *
     * 【環境変数とは？】
     * アプリケーションの設定値を外部ファイル（.env）に保存する仕組み
     * コードにトークンを直接書かないセキュリティベストプラクティス
     *
     * 【process.env.GITHUB_TOKEN とは？】
     * Node.js で環境変数にアクセスする方法
     * .env ファイルや OS の環境変数から値を取得
     */
    this.token = token || process.env.GITHUB_TOKEN || '';

    /**
     * トークンの存在確認
     *
     * 【バリデーション（検証）とは？】
     * 入力値が正しいかどうかをチェックすること
     * 不正な値でプログラムがエラーになるのを防ぐ
     *
     * 【! 演算子（論理NOT）とは？】
     * 値を反転させる演算子
     * !'' = true, !'token' = false
     * 空文字列の場合に true を返す
     *
     * 【throw new Error() とは？】
     * エラーオブジェクトを作成して例外を投げる
     * プログラムの実行を停止し、エラーメッセージを表示
     */
    if (!this.token) {
      throw new Error('GitHub token is required');
    }

    /**
     * Octokit クライアントの初期化
     *
     * 【new Octokit() とは？】
     * Octokit クラスから新しいインスタンスを作成
     * 設定オプションを指定してカスタマイズ可能
     */
    this.octokit = new Octokit({
      /**
       * auth: 認証情報の設定
       *
       * 【認証の重要性】
       * - API アクセス権限の確認
       * - レート制限の向上（5000 req/hour vs 60 req/hour）
       * - プライベートリポジトリへのアクセス
       */
      auth: this.token,

      /**
       * userAgent: ユーザーエージェント文字列
       *
       * 【User Agent とは？】
       * API呼び出し元を識別するための文字列
       * GitHub は統計やレート制限でこの情報を使用
       *
       * 【命名規則】
       * アプリケーション名/バージョン番号
       * GitHub が推奨する形式に準拠
       *
       * 【なぜ重要？】
       * - GitHub による API 使用統計
       * - 問題発生時の問い合わせで特定が容易
       * - レート制限の適切な適用
       */
      userAgent: 'discord-github-bot/1.0.0',

      /**
       * timeZone: タイムゾーンの設定
       *
       * 【タイムゾーンの影響】
       * GitHub API から返される日時情報の解釈
       * 主に検索クエリやフィルタリングで使用
       *
       * 【'Asia/Tokyo' の選択理由】
       * 日本のDiscordサーバーで使用されることを想定
       * 日本のユーザーにとって自然な時刻表示
       */
      timeZone: 'Asia/Tokyo',
    });

    /**
     * 初期化完了のログ出力
     *
     * 【なぜログ出力？】
     * - サービス初期化の成功確認
     * - デバッグ時の処理フロー把握
     * - 運用監視での状態確認
     *
     * 【セキュリティ考慮】
     * トークンの値は出力しない（漏洩防止）
     * 初期化成功の事実のみを記録
     */
    logger.info('GitHub service initialized');
  }

  // ==================================================
  // Issue 関連のメソッド群
  // ==================================================

  /**
   * GitHub Issue情報を取得
   *
   * 【このメソッドの役割】
   * 1. 指定されたIssueの詳細情報をGitHub APIから取得
   * 2. GitHub APIレスポンスを内部形式に変換
   * 3. エラーの適切な処理とカスタムエラーへの変換
   * 4. 取得プロセスのログ記録
   *
   * 【使用場面】
   * - Discord で #123 のようなIssue番号が言及された時
   * - 手動でIssue情報を確認したい時
   * - Issueの存在確認が必要な時
   *
   * 【引数の説明】
   * @param owner - リポジトリの所有者名（ユーザー名または組織名）
   * @param repo - リポジトリ名
   * @param issueNumber - Issue番号（1以上の整数）
   *
   * 【戻り値】
   * @returns Promise<GitHubIssue> - 内部形式に変換されたIssue情報
   *
   * 【GitHub API エンドポイント】
   * GET /repos/{owner}/{repo}/issues/{issue_number}
   *
   * 【async/await とは？】
   * 時間のかかる処理（API通信など）を扱うための仕組み
   * - async: この関数は非同期処理を含むことを宣言
   * - await: 処理の完了を待つキーワード
   *
   * 【Promise<GitHubIssue> とは？】
   * - Promise: 非同期処理の結果を表すオブジェクト
   * - GitHubIssue: 戻り値の型（Issue情報の構造体）
   * - つまり「非同期でGitHubIssue型を返す関数」という意味
   */
  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    /**
     * エラーハンドリング（エラー処理）のためのtry-catch文
     *
     * 【try-catch とは？】
     * エラーが発生する可能性のある処理を安全に実行する仕組み
     * - try: エラーが発生するかもしれない処理を書く
     * - catch: エラーが発生した場合の対処を書く
     *
     * 【API通信でのエラーハンドリングの重要性】
     * - ネットワークエラー
     * - 認証エラー
     * - レート制限エラー
     * - 存在しないリソースへのアクセス
     */
    try {
      /**
       * Issue取得開始のログ出力
       *
       * 【ログの重要性】
       * - API呼び出しの追跡
       * - デバッグ時の処理フロー確認
       * - 運用監視での異常検知
       *
       * 【テンプレートリテラル記法】
       * `文字列 ${変数} 文字列` でログメッセージを作成
       * owner/repo#issueNumber の GitHub標準形式で出力
       */
      logger.info(`Fetching issue: ${owner}/${repo}#${issueNumber}`);

      /**
       * GitHub API への Issue取得リクエスト
       *
       * 【this.octokit.rest.issues.get() とは？】
       * - this.octokit: 初期化済みのGitHub APIクライアント
       * - .rest: REST API アクセス用のインターフェース
       * - .issues: Issue関連のAPI群
       * - .get(): 特定のIssueを取得するメソッド
       *
       * 【await の必要性】
       * API通信は非同期処理（時間がかかる）のため、
       * 完了を待ってから次の処理に進む必要がある
       *
       * 【パラメータの説明】
       * - owner: リポジトリ所有者（例: 'microsoft'）
       * - repo: リポジトリ名（例: 'vscode'）
       * - issue_number: Issue番号（例: 123）
       */
      const response = await this.octokit.rest.issues.get({
        owner,
        repo,
        issue_number: issueNumber,
      });

      /**
       * APIレスポンスからデータ部分を抽出
       *
       * 【response.data とは？】
       * GitHub API のレスポンス構造:
       * {
       *   data: { ... Issue情報 ... },
       *   status: 200,
       *   headers: { ... },
       *   ...
       * }
       * data プロパティに実際のIssue情報が格納されている
       */
      const issue = response.data;

      /**
       * GitHub APIレスポンスを内部形式に変換
       *
       * 【なぜ変換が必要？】
       * 1. GitHub API の形式は複雑で、不要な情報も多い
       * 2. アプリケーション内で統一した形式を使用
       * 3. 将来的にGitHub以外のサービスにも対応可能
       * 4. 型安全性の確保（TypeScript）
       *
       * 【GitHubIssue型とは？】
       * このアプリケーション専用に定義されたIssue情報の型
       * 必要最小限の情報のみを含む
       */
      const result: GitHubIssue = {
        /**
         * 基本情報の設定
         *
         * 【各プロパティの説明】
         * - id: GitHub内でのユニークなIssue ID
         * - number: リポジトリ内でのIssue番号
         * - title: Issueのタイトル
         * - body: Issueの本文（null の可能性あり）
         */
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body || null,

        /**
         * 状態情報の設定
         *
         * 【as 'open' | 'closed' とは？】
         * TypeScriptの型アサーション（型の強制指定）
         * GitHub APIのstateは複数の値を取りうるが、
         * ここでは'open'または'closed'のみを想定
         *
         * 【|| false とは？】
         * draft プロパティが undefined の場合は false を使用
         * 古いIssueではdraftプロパティが存在しない場合がある
         */
        state: issue.state as 'open' | 'closed',
        draft: issue.draft || false,

        /**
         * ユーザー情報の設定
         *
         * 【?. オプショナルチェーニング とは？】
         * issue.user?.login
         * - issue.user が null/undefined でもエラーにならない
         * - null/undefined の場合は undefined を返す
         *
         * 【|| 'unknown' / || '' の意味】
         * undefined の場合のフォールバック値
         * - login: 'unknown'（不明なユーザー）
         * - avatar_url: ''（空文字列）
         */
        user: {
          login: issue.user?.login || 'unknown',
          avatar_url: issue.user?.avatar_url || '',
        },

        /**
         * ラベル情報の変換
         *
         * 【map() メソッド とは？】
         * 配列の各要素に対して関数を実行し、新しい配列を作成
         * ここでは各ラベルを統一形式に変換
         *
         * 【typeof label === 'string' とは？】
         * ラベルの形式チェック
         * GitHub APIではラベルが文字列またはオブジェクトの場合がある
         * - 文字列: ラベル名のみ
         * - オブジェクト: { name: '名前', color: '色' }
         *
         * 【三項演算子 ? : とは？】
         * 条件 ? 真の値 : 偽の値
         * if-else文をより簡潔に書く方法
         */
        labels: issue.labels.map((label: any) => ({
          name: typeof label === 'string' ? label : label.name,
          color: typeof label === 'string' ? '000000' : label.color,
        })),

        /**
         * 日時・統計情報の設定
         *
         * 【ISO 8601形式の日時】
         * GitHub APIは日時をISO 8601形式で返す
         * 例: '2023-12-25T10:30:00Z'
         * そのまま保存して、表示時に変換する方針
         */
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        comments: issue.comments,
        html_url: issue.html_url,

        /**
         * リポジトリ情報の再構築
         *
         * 【なぜ再構築？】
         * GitHub APIレスポンスには完全なリポジトリ情報が含まれるが、
         * このアプリケーションでは最小限の情報のみ必要
         *
         * 【テンプレートリテラル の使用】
         * `${owner}/${repo}` でfull_nameを構築
         * 例: 'microsoft/vscode'
         */
        repository: {
          name: repo,
          full_name: `${owner}/${repo}`,
          owner: {
            login: owner,
          },
        },
      };

      /**
       * 取得成功のログ出力
       *
       * 【成功ログの重要性】
       * - API呼び出しの成功確認
       * - パフォーマンス測定の基準点
       * - 運用監視での正常性確認
       */
      logger.info(`Successfully fetched issue: ${owner}/${repo}#${issueNumber}`);
      return result;
      /**
       * エラーハンドリング（例外処理）
       *
       * 【catch ブロックの役割】
       * try ブロック内で発生したエラーを捕捉し、適切に処理
       */
    } catch (error: any) {
      /**
       * エラーログの出力
       *
       * 【logger.error() とは？】
       * エラーレベルのログを出力する関数
       * 通常のinfoログより高い優先度で記録される
       *
       * 【error: any とは？】
       * TypeScriptの型指定
       * any型は「どんな型でも受け入れる」という意味
       * エラーオブジェクトは種類が多いため any を使用
       */
      logger.error(`Failed to fetch issue ${owner}/${repo}#${issueNumber}:`, error);

      /**
       * HTTPステータスコード別のエラー処理
       *
       * 【HTTPステータスコードとは？】
       * Web APIの応答結果を表す3桁の数字
       * - 200番台: 成功
       * - 400番台: クライアント側のエラー
       * - 500番台: サーバー側のエラー
       */

      /**
       * 404 Not Found エラーの処理
       *
       * 【404エラーとは？】
       * 要求されたリソース（Issue）が見つからない
       * - 存在しないIssue番号
       * - 存在しないリポジトリ
       * - アクセス権限がないIssue
       *
       * 【GitHubAPIError とは？】
       * GitHub API専用のカスタムエラークラス
       * 標準のErrorより詳細な情報を含む
       */
      if (error.status === 404) {
        throw new GitHubAPIError(`Issue #${issueNumber} not found in ${owner}/${repo}`, 404, {
          owner,
          repo,
          issueNumber,
        });

        /**
         * 403 Forbidden エラーの処理
         *
         * 【403エラーとは？】
         * サーバーがリクエストを理解したが、実行を拒否
         * - API レート制限の超過
         * - アクセス権限の不足
         * - プライベートリポジトリへの未認可アクセス
         *
         * 【レート制限とは？】
         * API使用回数の制限
         * - 未認証: 60回/時間
         * - 認証済み: 5000回/時間
         */
      } else if (error.status === 403) {
        throw new GitHubAPIError('GitHub API rate limit exceeded or access forbidden', 403, {
          owner,
          repo,
          issueNumber,
        });

        /**
         * 401 Unauthorized エラーの処理
         *
         * 【401エラーとは？】
         * 認証が必要だが、認証情報が無効または不足
         * - 無効なトークン
         * - 期限切れのトークン
         * - トークンの権限不足
         *
         * 【認証エラーの対処法】
         * 1. トークンの確認・更新
         * 2. トークンの権限設定確認
         * 3. 環境変数の設定確認
         */
      } else if (error.status === 401) {
        throw new GitHubAPIError('GitHub API authentication failed', 401, {
          owner,
          repo,
          issueNumber,
        });
      }

      /**
       * その他のエラーの処理
       *
       * 【包括的エラーハンドリング】
       * 上記以外の全てのエラーを処理
       * - ネットワークエラー
       * - タイムアウト
       * - 予期しないAPIエラー
       *
       * 【error.status || 500 とは？】
       * error.statusが存在しない場合は500（Internal Server Error）を使用
       * || 演算子によるフォールバック値の設定
       *
       * 【originalError の保存】
       * 元のエラーオブジェクトも保存してデバッグに活用
       */
      throw new GitHubAPIError(`Failed to fetch issue: ${error.message}`, error.status || 500, {
        owner,
        repo,
        issueNumber,
        originalError: error,
      });
    }
  }

  /**
   * GitHub Issue検索
   */
  async searchIssues(
    owner: string,
    repo: string,
    query: string,
    state: string = 'open'
  ): Promise<GitHubIssue[]> {
    try {
      logger.info(`Searching issues in ${owner}/${repo}: "${query}"`);

      const searchQuery = `repo:${owner}/${repo} ${query} state:${state}`;

      const response = await this.octokit.rest.search.issuesAndPullRequests({
        q: searchQuery,
        sort: 'updated',
        order: 'desc',
        per_page: 10,
      });

      const issues = response.data.items
        .filter((item) => !item.pull_request) // Pull requestを除外
        .map((issue) => ({
          id: issue.id,
          number: issue.number,
          title: issue.title,
          body: issue.body || null,
          state: issue.state as 'open' | 'closed',
          draft: issue.draft || false,
          user: {
            login: issue.user?.login || 'unknown',
            avatar_url: issue.user?.avatar_url || '',
          },
          labels: issue.labels.map((label: any) => ({
            name: typeof label === 'string' ? label : label.name,
            color: typeof label === 'string' ? '000000' : label.color,
          })),
          created_at: issue.created_at,
          updated_at: issue.updated_at,
          comments: issue.comments,
          html_url: issue.html_url,
          repository: {
            name: repo,
            full_name: `${owner}/${repo}`,
            owner: {
              login: owner,
            },
          },
        }));

      logger.info(`Found ${issues.length} issues for query: "${query}"`);
      return issues;
    } catch (error: any) {
      logger.error(`Failed to search issues in ${owner}/${repo}:`, error);

      throw new GitHubAPIError(`Failed to search issues: ${error.message}`, error.status || 500, {
        owner,
        repo,
        query,
        state,
        originalError: error,
      });
    }
  }

  /**
   * リポジトリの存在確認
   */
  async validateRepository(owner: string, repo: string): Promise<boolean> {
    try {
      logger.info(`Validating repository: ${owner}/${repo}`);

      await this.octokit.rest.repos.get({
        owner,
        repo,
      });

      logger.info(`Repository ${owner}/${repo} is valid`);
      return true;
    } catch (error: any) {
      logger.warn(`Repository validation failed for ${owner}/${repo}:`, error.message);

      if (error.status === 404) {
        return false;
      }

      // その他のエラーは例外として投げる
      throw new GitHubAPIError(
        `Failed to validate repository: ${error.message}`,
        error.status || 500,
        { owner, repo, originalError: error }
      );
    }
  }

  /**
   * リポジトリ情報を取得
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    try {
      logger.info(`Fetching repository: ${owner}/${repo}`);

      const response = await this.octokit.rest.repos.get({
        owner,
        repo,
      });

      const repository = response.data;

      const result: GitHubRepository = {
        id: repository.id,
        name: repository.name,
        full_name: repository.full_name,
        owner: {
          login: repository.owner.login,
        },
        html_url: repository.html_url,
        description: repository.description,
        private: repository.private,
      };

      logger.info(`Successfully fetched repository: ${owner}/${repo}`);
      return result;
    } catch (error: any) {
      logger.error(`Failed to fetch repository ${owner}/${repo}:`, error);

      throw new GitHubAPIError(
        `Failed to fetch repository: ${error.message}`,
        error.status || 500,
        { owner, repo, originalError: error }
      );
    }
  }

  /**
   * レート制限情報を取得
   */
  async getRateLimitInfo(): Promise<RateLimitInfo> {
    try {
      const response = await this.octokit.rest.rateLimit.get();
      const rateLimit = response.data.rate;

      const result: RateLimitInfo = {
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        reset_at: rateLimit.reset,
        resource: 'core',
      };

      logger.debug(`Rate limit info: ${result.remaining}/${result.limit}`);
      return result;
    } catch (error: any) {
      logger.error('Failed to get rate limit info:', error);

      throw new GitHubAPIError(
        `Failed to get rate limit info: ${error.message}`,
        error.status || 500,
        { originalError: error }
      );
    }
  }

  /**
   * レート制限チェック
   */
  async checkRateLimit(): Promise<boolean> {
    try {
      const rateLimitInfo = await this.getRateLimitInfo();

      const hasRemaining = rateLimitInfo.remaining > 0;
      const resetTime = new Date(rateLimitInfo.reset_at * 1000);

      if (!hasRemaining) {
        logger.warn(`GitHub API rate limit exceeded. Reset at: ${resetTime.toISOString()}`);
      }

      return hasRemaining;
    } catch (error) {
      logger.error('Failed to check rate limit:', error);
      return false;
    }
  }
}

// ==================================================
// ファイルの終了
// ==================================================

/**
 * github.ts ファイルの役割まとめ
 *
 * 【このファイルの重要性】
 * Discord ボットと GitHub API の橋渡し役を担う中核サービス
 * 外部 API との通信における「アダプターパターン」の実装例
 *
 * 【主要機能】
 * 1. GitHub API への認証済みアクセス
 * 2. Issue/Repository 情報の取得・検索
 * 3. レート制限の管理・監視
 * 4. API エラーの適切な処理・変換
 * 5. ログによる処理の追跡・監視
 *
 * 【設計のポイント】
 * - インターフェース実装による型安全性
 * - プライベートメンバーによるカプセル化
 * - 包括的なエラーハンドリング
 * - 詳細なログ記録
 * - データ変換による内部形式の統一
 *
 * 【プログラミング学習のポイント】
 * このファイルから学べる概念：
 * - 外部 API との通信パターン
 * - TypeScript の型システム活用
 * - エラーハンドリング設計
 * - オブジェクト指向プログラミング
 * - 非同期プログラミング（async/await）
 * - ログ管理とデバッグ手法
 * - 認証とセキュリティ考慮
 * - レート制限の管理手法
 */