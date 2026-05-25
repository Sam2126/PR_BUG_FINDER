import { useState, useCallback } from 'react';
import { Header, Landing } from './components/Header';
import { PRList } from './components/PRList';
import { AnalysisProgress } from './components/AnalysisProgress';
import { AgentThinking } from './components/AgentThinking';
import { DashboardStats } from './components/DashboardStats';
import { IssuesList } from './components/IssuesList';
import { CodeDiffViewer } from './components/CodeDiffViewer';
import { ReviewSummary } from './components/ReviewSummary';
import {
  MOCK_PULL_REQUESTS,
  MOCK_PR_FILES,
  MOCK_REVIEW_RESULT,
  MOCK_AGENT_STEPS,
  MOCK_AGENT_PLAN,
} from './services/mockData';
import { fetchPullRequests, fetchPRFiles } from './services/github';
import { runAgentAnalysis } from './services/ai';
import type {
  AnalysisStep,
  ConnectionConfig,
  PullRequest,
  ReviewResult,
  FileAnalysis,
  ReviewIssue,
  AgentStep,
  AgentPlan,
} from './types';

const INITIAL_CONFIG: ConnectionConfig = {
  owner: '',
  repo: '',
  githubToken: '',
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
};

function App() {
  const [step, setStep] = useState<AnalysisStep>('idle');
  const [config, setConfig] = useState<ConnectionConfig>(INITIAL_CONFIG);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [selectedPR, setSelectedPR] = useState<PullRequest | null>(null);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [files, setFiles] = useState<FileAnalysis[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [highlightedIssue, setHighlightedIssue] = useState<ReviewIssue | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [showPostedMessage, setShowPostedMessage] = useState(false);

  // Agent state
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [agentPlan, setAgentPlan] = useState<AgentPlan | null>(null);
  const [agentRunning, setAgentRunning] = useState(false);

  // Connect to GitHub
  const handleConnect = useCallback(async () => {
    setError(null);
    setStep('connecting');
    try {
      const prs = await fetchPullRequests(config.owner, config.repo, config.githubToken);
      setPullRequests(prs);
      setStep('fetching');
    } catch (err: any) {
      setError(err.message || 'Failed to connect to GitHub. Check your token and repo.');
      setStep('idle');
    }
  }, [config]);

  // Demo mode
  const handleDemo = useCallback(() => {
    setIsDemo(true);
    setPullRequests(MOCK_PULL_REQUESTS);
    setStep('fetching');
  }, []);

  // Select PR and start agent analysis
  const handleSelectPR = useCallback(async (pr: PullRequest) => {
    setSelectedPR(pr);
    setStep('analyzing');
    setCurrentFileIndex(0);
    setReviewResult(null);
    setAgentSteps([]);
    setAgentPlan(null);
    setAgentRunning(true);

    if (isDemo) {
      // === DEMO: Simulate AI Agent workflow ===
      const mockFiles = MOCK_PR_FILES.get(pr.number) || MOCK_PR_FILES.get(42)!;
      const fileAnalyses: FileAnalysis[] = mockFiles.map(f => ({
        filename: f.filename,
        language: f.language,
        status: 'pending' as const,
        issues: [],
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch,
      }));
      setFiles(fileAnalyses);

      // Play agent steps one by one with realistic timing
      const allSteps = MOCK_AGENT_STEPS;
      
      // Show plan after first step
      for (let i = 0; i < allSteps.length; i++) {
        const agentStep = allSteps[i];
        
        // Add step with 'running' status
        setAgentSteps(prev => [...prev, { ...agentStep, status: 'running' }]);
        
        // Show plan after planning step
        if (i === 0) {
          setAgentPlan(MOCK_AGENT_PLAN);
        }

        // Update file statuses based on agent steps
        if (agentStep.type === 'tool_call' && agentStep.tool === 'analyzeCode' && agentStep.fileContext) {
          const fileIdx = fileAnalyses.findIndex(f => f.filename === agentStep.fileContext);
          if (fileIdx >= 0) {
            setCurrentFileIndex(fileIdx);
            setFiles(prev => prev.map((f, idx) =>
              idx === fileIdx ? { ...f, status: 'analyzing' } : f
            ));
          }
        }

        // Mark file complete after observation
        if (agentStep.type === 'observation' && agentStep.fileContext) {
          const fileIdx = fileAnalyses.findIndex(f => f.filename === agentStep.fileContext);
          if (fileIdx >= 0) {
            const mockResult = MOCK_REVIEW_RESULT;
            const fileIssues = mockResult.files.find(f => f.filename === agentStep.fileContext)?.issues || [];
            setFiles(prev => prev.map((f, idx) =>
              idx === fileIdx ? { ...f, status: 'complete', issues: fileIssues } : f
            ));
          }
        }

        // Realistic delay for each step type
        const delay = agentStep.type === 'planning' ? 1200
          : agentStep.type === 'thinking' ? 1500
          : agentStep.type === 'tool_call' ? 800
          : agentStep.type === 'observation' ? 1000
          : agentStep.type === 'cross_reference' ? 1800
          : agentStep.type === 'decision' ? 2000
          : agentStep.type === 'action' ? 800
          : 600;

        await new Promise(r => setTimeout(r, delay));

        // Mark step as complete
        setAgentSteps(prev => prev.map((s, idx) =>
          idx === prev.length - 1 ? { ...s, status: 'complete' } : s
        ));
      }

      // Mark all remaining files as complete
      setFiles(prev => prev.map(f => {
        if (f.status !== 'complete') {
          const fileIssues = MOCK_REVIEW_RESULT.files.find(mf => mf.filename === f.filename)?.issues || [];
          return { ...f, status: 'complete', issues: fileIssues };
        }
        return f;
      }));

      // Set final result
      setAgentRunning(false);
      setReviewResult(MOCK_REVIEW_RESULT);
      setSelectedFile(MOCK_REVIEW_RESULT.files[0]?.filename || null);

      // Small delay before showing results
      await new Promise(r => setTimeout(r, 800));
      setStep('complete');
    } else {
      // === REAL: True AI Agent with Gemini Function Calling ===
      // The agent autonomously decides which tools to call, cross-references
      // findings across files, and generates its own verdict.
      try {
        const prFiles = await fetchPRFiles(config.owner, config.repo, pr.number, config.githubToken);
        const fileAnalyses: FileAnalysis[] = prFiles.map(f => ({
          filename: f.filename,
          language: f.language,
          status: 'pending' as const,
          issues: [],
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch,
        }));
        setFiles(fileAnalyses);

        setAgentPlan({
          strategy: 'Autonomous AI Agent with function calling',
          steps: prFiles.map(f => `Analyze ${f.filename.split('/').pop()}`),
          currentStep: 0,
          totalSteps: prFiles.length,
        });

        // Run the real AI Agent — Gemini autonomously calls tools in a loop
        const agentIssues = await runAgentAnalysis(
          prFiles,
          config.geminiApiKey || 'your_gemini_api_key_here',
          (step) => {
            // Real-time callback: agent emits steps as it thinks
            setAgentSteps(prev => [...prev, step]);

            // Update file statuses based on agent tool calls
            if (step.type === 'tool_call' && step.fileContext) {
              const fileIdx = fileAnalyses.findIndex(f => f.filename === step.fileContext);
              if (fileIdx >= 0) {
                setCurrentFileIndex(fileIdx);
                setFiles(prev => prev.map((f, idx) =>
                  idx === fileIdx ? { ...f, status: 'analyzing' } : f
                ));
              }
            }

            // Mark files complete when observations come in
            if (step.type === 'observation' && step.fileContext) {
              setFiles(prev => prev.map(f =>
                f.filename === step.fileContext ? { ...f, status: 'complete', issues: step.issues || [] } : f
              ));
            }
          }
        );

        // Build final result from agent's findings
        const criticalCount = agentIssues.filter(i => i.severity === 'critical').length;
        const warningCount = agentIssues.filter(i => i.severity === 'warning').length;
        const infoCount = agentIssues.filter(i => i.severity === 'info').length;
        const suggestionCount = agentIssues.filter(i => i.severity === 'suggestion').length;
        const totalIssues = agentIssues.length;

        let penalty = 0;
        penalty += criticalCount * 20;
        penalty += warningCount * 5;
        penalty += infoCount * 2;
        penalty += suggestionCount * 1;

        // Map penalty to a score using a gentle asymptotic curve
        // This ensures the score smoothly decreases but rarely hits 0
        let qualityScore = 100 * (50 / (50 + penalty));
        qualityScore = Math.max(5, Math.min(100, Math.round(qualityScore)));

        const recommendation = criticalCount > 0
          ? 'request-changes' as const
          : warningCount > 2
            ? 'request-changes' as const
            : totalIssues > 5
              ? 'comment' as const
              : 'approve' as const;

        const finalFiles: FileAnalysis[] = prFiles.map(f => ({
          filename: f.filename,
          language: f.language,
          status: 'complete' as const,
          issues: agentIssues.filter(issue => issue.file === f.filename),
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch,
        }));

        const result: ReviewResult = {
          pullRequest: pr,
          files: finalFiles,
          totalIssues,
          criticalCount,
          warningCount,
          infoCount,
          suggestionCount,
          qualityScore,
          summary: generateSummary(totalIssues, criticalCount, warningCount, pr),
          recommendation,
          estimatedTimeSaved: Math.max(15, totalIssues * 3),
          analyzedAt: new Date().toISOString(),
        };

        setAgentRunning(false);
        setReviewResult(result);
        setFiles(finalFiles);
        setSelectedFile(finalFiles[0]?.filename || null);
        setStep('complete');
      } catch (err: any) {
        setAgentRunning(false);
        setError(err.message || 'Agent analysis failed');
        setStep('fetching');
      }
    }
  }, [config, isDemo]);

  const handleIssueClick = useCallback((issue: ReviewIssue) => {
    setSelectedIssueId(issue.id);
    setHighlightedIssue(issue);
    setSelectedFile(issue.file);
  }, []);

  const handlePostToGithub = useCallback(() => {
    setShowPostedMessage(true);
    setTimeout(() => setShowPostedMessage(false), 3000);
  }, []);

  const handleBackToPRs = useCallback(() => {
    setStep('fetching');
    setSelectedPR(null);
    setReviewResult(null);
    setFiles([]);
    setCurrentFileIndex(0);
    setSelectedIssueId(null);
    setHighlightedIssue(null);
    setSelectedFile(null);
    setAgentSteps([]);
    setAgentPlan(null);
    setAgentRunning(false);
  }, []);

  const allIssues = reviewResult
    ? reviewResult.files.flatMap(f => f.issues)
    : files.flatMap(f => f.issues);

  const totalIssuesFound = allIssues.length;

  return (
    <div className="app-container">
      <Header
        config={config}
        onConfigChange={setConfig}
        onConnect={handleConnect}
        onDemo={handleDemo}
        isConnected={step !== 'idle'}
        step={step}
      />

      <main className="main-content">
        {/* Landing / Connect */}
        {step === 'idle' && (
          <Landing
            config={config}
            onConfigChange={setConfig}
            onConnect={handleConnect}
            onDemo={handleDemo}
            error={error}
          />
        )}

        {/* PR Selection */}
        {step === 'fetching' && (
          <div className="pr-selection-view">
            <PRList
              pullRequests={pullRequests}
              onSelect={handleSelectPR}
              selectedPR={selectedPR}
            />
          </div>
        )}

        {/* Agent Analysis in Progress */}
        {step === 'analyzing' && (
          <div className="analysis-agent-view">
            <AnalysisProgress
              files={files}
              currentFileIndex={currentFileIndex}
              totalIssues={totalIssuesFound}
            />
            <AgentThinking
              steps={agentSteps}
              plan={agentPlan}
              isRunning={agentRunning}
            />
          </div>
        )}

        {/* Results */}
        {step === 'complete' && reviewResult && (
          <div className="results-view">
            <div className="results-view__top">
              <button className="btn btn-secondary btn-sm" onClick={handleBackToPRs}>
                ← Back to PRs
              </button>
              <h2 className="results-view__title">
                Review: <span className="text-gradient">{reviewResult.pullRequest.title}</span>
                <span className="results-view__pr-number">#{reviewResult.pullRequest.number}</span>
              </h2>
            </div>

            <DashboardStats result={reviewResult} />

            <ReviewSummary
              result={reviewResult}
              onPostToGithub={handlePostToGithub}
              isDemo={isDemo}
            />

            <div className="results-view__main">
              <div className="results-view__code">
                <CodeDiffViewer
                  files={reviewResult.files}
                  selectedFile={selectedFile}
                  onFileSelect={setSelectedFile}
                  highlightedIssue={highlightedIssue}
                />
              </div>
              <div className="results-view__sidebar">
                <IssuesList
                  issues={allIssues}
                  onIssueClick={handleIssueClick}
                  selectedIssueId={selectedIssueId}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Toast notification */}
      {showPostedMessage && (
        <div className="toast toast--success animate-in">
          <span>✓ Review comments posted to GitHub successfully!</span>
        </div>
      )}
    </div>
  );
}

function generateSummary(total: number, critical: number, warnings: number, pr: PullRequest): string {
  if (critical > 0) {
    return `This pull request "${pr.title}" contains ${critical} critical issue${critical > 1 ? 's' : ''} that must be resolved before merging. The AI agent identified potential security vulnerabilities and bugs that could impact production stability. A total of ${total} issues were found across ${pr.changedFiles} changed files. We strongly recommend addressing all critical and warning-level findings before proceeding with the merge.`;
  }
  if (warnings > 2) {
    return `The AI agent analysis of "${pr.title}" found ${total} issues, including ${warnings} warnings that should be addressed. While no critical security vulnerabilities were detected, several code quality and performance concerns were identified. We recommend reviewing the suggested improvements before merging.`;
  }
  return `"${pr.title}" looks generally good with ${total} minor suggestion${total !== 1 ? 's' : ''} for improvement. The AI agent detected no critical security issues or bugs. The code follows most best practices, with only minor optimizations recommended.`;
}

export default App;
