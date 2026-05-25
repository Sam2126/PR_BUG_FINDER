export type Severity = 'critical' | 'warning' | 'info' | 'suggestion';
export type IssueCategory = 'bug' | 'security' | 'performance' | 'code-smell' | 'best-practice';
export type AnalysisStep = 'idle' | 'connecting' | 'fetching' | 'analyzing' | 'complete';

export interface PullRequest {
  number: number;
  title: string;
  author: string;
  authorAvatar: string;
  createdAt: string;
  updatedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  branch: string;
  baseBranch: string;
  description: string;
  labels: string[];
}

export interface PRFile {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  patch: string;
  language: string;
}

export interface ReviewIssue {
  id: string;
  file: string;
  line: number;
  endLine?: number;
  severity: Severity;
  category: IssueCategory;
  title: string;
  description: string;
  suggestion: string;
  codeSnippet?: string;
  fixedCode?: string;
}

export interface FileAnalysis {
  filename: string;
  language: string;
  status: 'pending' | 'analyzing' | 'complete' | 'error';
  issues: ReviewIssue[];
  additions: number;
  deletions: number;
  patch: string;
}

export interface ReviewResult {
  pullRequest: PullRequest;
  files: FileAnalysis[];
  totalIssues: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  suggestionCount: number;
  qualityScore: number;
  summary: string;
  recommendation: 'approve' | 'request-changes' | 'comment';
  estimatedTimeSaved: number; // minutes
  analyzedAt: string;
}

export interface ConnectionConfig {
  owner: string;
  repo: string;
  githubToken: string;
  geminiApiKey: string;
}

export interface AppState {
  step: AnalysisStep;
  config: ConnectionConfig;
  pullRequests: PullRequest[];
  selectedPR: PullRequest | null;
  reviewResult: ReviewResult | null;
  currentFileIndex: number;
  error: string | null;
  isDemo: boolean;
}

// ─── AI Agent Types ──────────────────────────────────────────────────────────

export type AgentStepType = 'planning' | 'thinking' | 'tool_call' | 'observation' | 'cross_reference' | 'decision' | 'action' | 'complete' | 'error';

export interface AgentStep {
  id: string;
  type: AgentStepType;
  title: string;
  content: string;
  timestamp: string;
  status: 'running' | 'complete' | 'error';
  tool?: string;
  toolInput?: string;
  toolOutput?: string;
  duration?: number;
  fileContext?: string;
  issuesFound?: number;
  issues?: ReviewIssue[];
}

export interface AgentPlan {
  strategy: string;
  steps: string[];
  currentStep: number;
  totalSteps: number;
}

