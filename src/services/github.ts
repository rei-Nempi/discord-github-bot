import { Octokit } from '@octokit/rest';
import { createLogger } from '../utils/logger.js';
import { 
  GitHubIssue, 
  GitHubRepository, 
  IGitHubService, 
  RateLimitInfo,
  GitHubAPIError
} from '../types/index.js';

const logger = createLogger('github-service');

export class GitHubService implements IGitHubService {
  private octokit: Octokit;
  private token: string;

  constructor(token?: string) {
    this.token = token || process.env.GITHUB_TOKEN || '';
    
    if (!this.token) {
      throw new Error('GitHub token is required');
    }

    this.octokit = new Octokit({
      auth: this.token,
      userAgent: 'discord-github-bot/1.0.0',
      timeZone: 'Asia/Tokyo'
    });

    logger.info('GitHub service initialized');
  }

  /**
   * GitHub Issue情報を取得
   */
  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    try {
      logger.info(`Fetching issue: ${owner}/${repo}#${issueNumber}`);

      const response = await this.octokit.rest.issues.get({
        owner,
        repo,
        issue_number: issueNumber
      });

      const issue = response.data;

      // GitHub APIレスポンスを内部形式に変換
      const result: GitHubIssue = {
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body || null,
        state: issue.state as 'open' | 'closed',
        draft: issue.draft || false,
        user: {
          login: issue.user?.login || 'unknown',
          avatar_url: issue.user?.avatar_url || ''
        },
        labels: issue.labels.map((label: any) => ({
          name: typeof label === 'string' ? label : label.name,
          color: typeof label === 'string' ? '000000' : label.color
        })),
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        comments: issue.comments,
        html_url: issue.html_url,
        repository: {
          name: repo,
          full_name: `${owner}/${repo}`,
          owner: {
            login: owner
          }
        }
      };

      logger.info(`Successfully fetched issue: ${owner}/${repo}#${issueNumber}`);
      return result;

    } catch (error: any) {
      logger.error(`Failed to fetch issue ${owner}/${repo}#${issueNumber}:`, error);

      if (error.status === 404) {
        throw new GitHubAPIError(
          `Issue #${issueNumber} not found in ${owner}/${repo}`,
          404,
          { owner, repo, issueNumber }
        );
      } else if (error.status === 403) {
        throw new GitHubAPIError(
          'GitHub API rate limit exceeded or access forbidden',
          403,
          { owner, repo, issueNumber }
        );
      } else if (error.status === 401) {
        throw new GitHubAPIError(
          'GitHub API authentication failed',
          401,
          { owner, repo, issueNumber }
        );
      }

      throw new GitHubAPIError(
        `Failed to fetch issue: ${error.message}`,
        error.status || 500,
        { owner, repo, issueNumber, originalError: error }
      );
    }
  }

  /**
   * GitHub Issue検索
   */
  async searchIssues(owner: string, repo: string, query: string, state: string = 'open'): Promise<GitHubIssue[]> {
    try {
      logger.info(`Searching issues in ${owner}/${repo}: "${query}"`);

      const searchQuery = `repo:${owner}/${repo} ${query} state:${state}`;

      const response = await this.octokit.rest.search.issuesAndPullRequests({
        q: searchQuery,
        sort: 'updated',
        order: 'desc',
        per_page: 10
      });

      const issues = response.data.items
        .filter(item => !item.pull_request) // Pull requestを除外
        .map(issue => ({
          id: issue.id,
          number: issue.number,
          title: issue.title,
          body: issue.body || null,
          state: issue.state as 'open' | 'closed',
          draft: issue.draft || false,
          user: {
            login: issue.user?.login || 'unknown',
            avatar_url: issue.user?.avatar_url || ''
          },
          labels: issue.labels.map((label: any) => ({
            name: typeof label === 'string' ? label : label.name,
            color: typeof label === 'string' ? '000000' : label.color
          })),
          created_at: issue.created_at,
          updated_at: issue.updated_at,
          comments: issue.comments,
          html_url: issue.html_url,
          repository: {
            name: repo,
            full_name: `${owner}/${repo}`,
            owner: {
              login: owner
            }
          }
        }));

      logger.info(`Found ${issues.length} issues for query: "${query}"`);
      return issues;

    } catch (error: any) {
      logger.error(`Failed to search issues in ${owner}/${repo}:`, error);

      throw new GitHubAPIError(
        `Failed to search issues: ${error.message}`,
        error.status || 500,
        { owner, repo, query, state, originalError: error }
      );
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
        repo
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
        repo
      });

      const repository = response.data;

      const result: GitHubRepository = {
        id: repository.id,
        name: repository.name,
        full_name: repository.full_name,
        owner: {
          login: repository.owner.login
        },
        html_url: repository.html_url,
        description: repository.description,
        private: repository.private
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
        resource: 'core'
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