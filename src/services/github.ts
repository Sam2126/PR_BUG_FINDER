import type { PullRequest, PRFile, ReviewIssue } from '../types/index';
import { getLanguageFromFilename } from './mockData';

const GITHUB_API = 'https://api.github.com';

/**
 * Build standard headers for GitHub API requests.
 */
function githubHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

// ─── Fetch open pull requests ────────────────────────────────────────────────────

export async function fetchPullRequests(
  owner: string,
  repo: string,
  token: string,
): Promise<PullRequest[]> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/pulls?state=open&sort=updated&direction=desc&per_page=20`;

  const response = await fetch(url, { headers: githubHeaders(token) });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${body}`);
  }

  const data: any[] = await response.json();

  // The /pulls list endpoint does NOT include additions/deletions/changed_files.
  // We need to fetch each PR individually to get those stats.
  const prs: PullRequest[] = await Promise.all(
    data.map(async (pr) => {
      // Fetch individual PR details to get file counts
      let additions = 0;
      let deletions = 0;
      let changedFiles = 0;

      try {
        const detailUrl = `${GITHUB_API}/repos/${owner}/${repo}/pulls/${pr.number}`;
        const detailRes = await fetch(detailUrl, { headers: githubHeaders(token) });
        if (detailRes.ok) {
          const detail = await detailRes.json();
          additions = detail.additions ?? 0;
          deletions = detail.deletions ?? 0;
          changedFiles = detail.changed_files ?? 0;
        }
      } catch {
        // If individual fetch fails, continue with zeros
      }

      return {
        number: pr.number,
        title: pr.title,
        author: pr.user?.login ?? 'unknown',
        authorAvatar: pr.user?.avatar_url ?? '',
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
        additions,
        deletions,
        changedFiles,
        branch: pr.head?.ref ?? '',
        baseBranch: pr.base?.ref ?? 'main',
        description: pr.body ?? '',
        labels: (pr.labels ?? []).map((l: any) => l.name),
      };
    })
  );

  return prs;
}

// ─── Fetch files changed in a pull request ───────────────────────────────────────

export async function fetchPRFiles(
  owner: string,
  repo: string,
  prNumber: number,
  token: string,
): Promise<PRFile[]> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`;

  const response = await fetch(url, { headers: githubHeaders(token) });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${body}`);
  }

  const data: any[] = await response.json();

  return data.map((file) => ({
    filename: file.filename,
    status: mapFileStatus(file.status),
    additions: file.additions ?? 0,
    deletions: file.deletions ?? 0,
    patch: file.patch ?? '',
    language: getLanguageFromFilename(file.filename),
  }));
}

/**
 * Map GitHub file status strings to our narrower union type.
 */
function mapFileStatus(status: string): PRFile['status'] {
  switch (status) {
    case 'added':
      return 'added';
    case 'removed':
      return 'removed';
    case 'renamed':
      return 'renamed';
    case 'modified':
    case 'changed':
    default:
      return 'modified';
  }
}

// ─── Post review comments back to GitHub ─────────────────────────────────────────

export async function postReviewComments(
  owner: string,
  repo: string,
  prNumber: number,
  token: string,
  issues: ReviewIssue[],
): Promise<boolean> {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/pulls/${prNumber}/reviews`;

  // Build inline comments from issues
  const comments = issues
    .filter((issue) => issue.file && issue.line > 0)
    .map((issue) => ({
      path: issue.file,
      line: issue.line,
      body: formatReviewComment(issue),
    }));

  const body = {
    event: 'COMMENT',
    body: buildReviewSummary(issues),
    comments,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: githubHeaders(token),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Failed to post review: ${response.status}`, errorBody);
    return false;
  }

  return true;
}

// ─── Formatting helpers ──────────────────────────────────────────────────────────

function severityEmoji(severity: string): string {
  switch (severity) {
    case 'critical':
      return '🔴';
    case 'warning':
      return '🟡';
    case 'info':
      return '🔵';
    case 'suggestion':
      return '💡';
    default:
      return '⚪';
  }
}

function formatReviewComment(issue: ReviewIssue): string {
  let comment = `${severityEmoji(issue.severity)} **${issue.severity.toUpperCase()}** — ${issue.title}\n\n`;
  comment += `${issue.description}\n\n`;

  if (issue.suggestion) {
    comment += `**Suggestion:** ${issue.suggestion}\n\n`;
  }

  if (issue.fixedCode) {
    comment += `**Suggested fix:**\n\`\`\`suggestion\n${issue.fixedCode}\n\`\`\`\n`;
  }

  return comment;
}

function buildReviewSummary(issues: ReviewIssue[]): string {
  const critical = issues.filter((i) => i.severity === 'critical').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const info = issues.filter((i) => i.severity === 'info').length;
  const suggestions = issues.filter((i) => i.severity === 'suggestion').length;

  let summary = `## 🔍 CodeLens AI Review\n\n`;
  summary += `Found **${issues.length}** issues across the changed files:\n\n`;
  summary += `| Severity | Count |\n|----------|-------|\n`;

  if (critical > 0) summary += `| 🔴 Critical | ${critical} |\n`;
  if (warnings > 0) summary += `| 🟡 Warning | ${warnings} |\n`;
  if (info > 0) summary += `| 🔵 Info | ${info} |\n`;
  if (suggestions > 0) summary += `| 💡 Suggestion | ${suggestions} |\n`;

  summary += `\n---\n*Powered by CodeLens AI*`;

  return summary;
}
