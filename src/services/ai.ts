import type { PRFile, ReviewIssue, Severity, IssueCategory, AgentStep } from '../types/index';

// ─── Config ──────────────────────────────────────────────────────────────────

// TODO: Replace with your actual Groq API key or fetch securely from backend
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || 'your_groq_api_key_here';
const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const MAX_PATCH_CHARS = 1500; // Keep under TPM limit

export type AgentCallback = (step: AgentStep) => void;

// ─── Main Entry Point ────────────────────────────────────────────────────────

export async function runAgentAnalysis(
  files: PRFile[],
  _apiKey: string = GROQ_API_KEY,
  onStep: AgentCallback,
): Promise<ReviewIssue[]> {
  const apiKey = GROQ_API_KEY;
  const allIssues: ReviewIssue[] = [];
  let stepId = 0;

  const emit = (type: AgentStep['type'], title: string, content: string, extra?: Partial<AgentStep>) => {
    stepId++;
    onStep({
      id: `step-${stepId}`,
      type,
      title,
      content,
      timestamp: new Date().toISOString(),
      status: 'complete',
      ...extra,
    });
  };

  // Filter to analyzable code files with actual diffs
  const skipExts = new Set([
    'png','jpg','jpeg','gif','svg','ico','woff','woff2','ttf','eot',
    'lock','map','min.js','min.css','bundle.js',
  ]);
  const codeFiles = files.filter(f => {
    if (!f.patch || f.patch.trim().length === 0) return false;
    const ext = f.filename.split('.').pop()?.toLowerCase() ?? '';
    return !skipExts.has(ext);
  });

  if (codeFiles.length === 0) {
    emit('complete', 'No Code Files', 'No code files with diffs found in this PR.');
    return [];
  }

  emit('planning', '🤖 AI Agent Initialized',
    `Analyzing ${codeFiles.length} code file(s) with Groq AI (${GROQ_MODEL}). Each file will be reviewed for security, bugs, performance, and code quality.`);

  // Process files sequentially with delays to respect rate limits
  for (let i = 0; i < codeFiles.length; i++) {
    const file = codeFiles[i];
    const shortName = file.filename.split('/').pop() || file.filename;

    emit('tool_call', `📄 Analyzing: ${shortName}`,
      `Reviewing ${file.language} file for issues (${file.additions}+ ${file.deletions}-)...`,
      { tool: 'analyzeCode', fileContext: file.filename });

    // Retry up to 3 times with increasing backoff
    let issues: ReviewIssue[] = [];
    let succeeded = false;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        issues = await callGroq(file, apiKey);
        succeeded = true;
        break;
      } catch (err: any) {
        const msg = err?.message || String(err);
        console.error(`[CodeLens] Attempt ${attempt}/3 failed for ${file.filename}:`, msg);

        if (msg.includes('429') || msg.includes('rate') || msg.includes('limit')) {
          const waitSec = attempt * 15; // 15s, 30s, 45s
          emit('thinking', `⏳ Rate limited — waiting ${waitSec}s (attempt ${attempt}/3)`,
            'API rate limit hit. Backing off before retry...');
          await sleep(waitSec * 1000);
        } else {
          emit('error', `❌ Error: ${shortName}`, `Attempt ${attempt}: ${msg}`);
          break; // Non-rate-limit error, don't retry
        }
      }
    }

    if (succeeded) {
      allIssues.push(...issues);
      if (issues.length > 0) {
        const crits = issues.filter(i => i.severity === 'critical').length;
        const warns = issues.filter(i => i.severity === 'warning').length;
        const emoji = crits > 0 ? '🔴' : warns > 0 ? '🟡' : '🔵';
        emit('observation', `${emoji} Found ${issues.length} issue(s) in ${shortName}`,
          issues.map(i => `• [${i.severity.toUpperCase()}] ${i.title}`).join('\n'),
          { fileContext: file.filename, issuesFound: issues.length, issues });
      } else {
        emit('observation', `✅ ${shortName} — Clean`,
          'No significant issues found.',
          { fileContext: file.filename, issuesFound: 0, issues: [] });
      }
    }

    // Wait between files to stay under TPM limits
    if (i < codeFiles.length - 1) {
      await sleep(8000);
    }
  }

  // Final verdict
  const crits = allIssues.filter(i => i.severity === 'critical').length;
  const warns = allIssues.filter(i => i.severity === 'warning').length;
  const verdict = crits > 0 ? 'REQUEST CHANGES' : warns > 2 ? 'REQUEST CHANGES' : allIssues.length > 5 ? 'COMMENT' : 'APPROVE';

  emit('decision', `📋 Verdict: ${verdict}`,
    `Found ${allIssues.length} total issue(s): ${crits} critical, ${warns} warnings.`,
    { issuesFound: allIssues.length });

  emit('complete', '✅ Review Complete',
    `Analyzed ${codeFiles.length} files. Found ${allIssues.length} issues.`,
    { issuesFound: allIssues.length });

  return allIssues;
}


// ─── Review Prompt ───────────────────────────────────────────────────────────

const REVIEW_PROMPT = `You are an expert code reviewer. Analyze this code diff carefully and find ALL issues.

Be thorough! No real code is perfect. You MUST find at least 2 issues per file. Look for:

SECURITY: SQL injection, XSS, hardcoded secrets/passwords, weak crypto, missing auth, SSRF
BUGS: Null refs, unhandled errors, race conditions, off-by-one, type mismatches, logic errors  
PERFORMANCE: N+1 queries, memory leaks, blocking ops, missing caching
CODE SMELLS: Magic numbers, poor naming, deep nesting, missing error handling, dead code, missing types
BEST PRACTICES: console.log in production, missing input validation, missing tests, poor error messages

Return a JSON object: {"issues": [...]}
Each issue: {"file":"filename","line":number,"severity":"critical"|"warning"|"info"|"suggestion","category":"security"|"bug"|"performance"|"code-smell"|"best-practice","title":"short title","description":"explanation","suggestion":"fix","codeSnippet":"bad code","fixedCode":"good code"}

RULES: Return ONLY valid JSON. Find at least 2 real issues. Be specific with line numbers from + lines in the diff.`;


// ─── Core Groq API Call ──────────────────────────────────────────────────────

async function callGroq(file: PRFile, apiKey: string): Promise<ReviewIssue[]> {
  // Truncate large patches to stay under token limits
  let patch = file.patch;
  if (patch.length > MAX_PATCH_CHARS) {
    patch = patch.slice(0, MAX_PATCH_CHARS) + '\n... [truncated, ' + (file.patch.length - MAX_PATCH_CHARS) + ' more chars]';
  }

  const prompt = `Review this diff for ${file.filename} (${file.language}):\n\n\`\`\`diff\n${patch}\n\`\`\`\n\nFind all issues. Return JSON with "issues" array.`;

  console.log(`[CodeLens] Calling Groq (${GROQ_MODEL}) for ${file.filename} (${patch.length} chars)...`);

  const res = await fetch(GROQ_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: REVIEW_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[CodeLens] Groq ${res.status}:`, errText.slice(0, 300));
    throw new Error(`Groq API error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const rawText = data?.choices?.[0]?.message?.content ?? '';

  console.log(`[CodeLens] Groq response (${rawText.length} chars): ${rawText.slice(0, 120)}...`);

  if (!rawText.trim()) return [];

  const parsed = parseJSON(rawText);
  console.log(`[CodeLens] Parsed ${parsed.length} issues from ${file.filename}`);

  return parsed.map((item, idx) => normalize(item, file.filename, idx));
}


// ─── JSON Parsing ────────────────────────────────────────────────────────────

function parseJSON(raw: string): any[] {
  const text = raw.trim();

  try {
    const obj = JSON.parse(text);
    if (obj && Array.isArray(obj.issues)) return obj.issues;
    if (Array.isArray(obj)) return obj;
    // Look for any array property
    for (const key of Object.keys(obj)) {
      if (Array.isArray(obj[key])) return obj[key];
    }
    return [];
  } catch {
    // Try extracting array
    const s = text.indexOf('[');
    const e = text.lastIndexOf(']');
    if (s !== -1 && e > s) {
      try { 
        const arr = JSON.parse(text.slice(s, e + 1));
        return Array.isArray(arr) ? arr : [];
      } catch {}
    }
    console.error('[CodeLens] JSON parse failed:', text.slice(0, 200));
    return [];
  }
}


// ─── Normalize Issue ─────────────────────────────────────────────────────────

const SEVERITIES: Severity[] = ['critical', 'warning', 'info', 'suggestion'];
const CATEGORIES: IssueCategory[] = ['bug', 'security', 'performance', 'code-smell', 'best-practice'];

function normalize(raw: any, filename: string, idx: number): ReviewIssue {
  return {
    id: `issue-${filename.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}-${idx}`,
    file: typeof raw.file === 'string' ? raw.file : filename,
    line: typeof raw.line === 'number' && raw.line > 0 ? raw.line : 1,
    endLine: typeof raw.endLine === 'number' ? raw.endLine : undefined,
    severity: SEVERITIES.includes(raw.severity) ? raw.severity : 'info',
    category: CATEGORIES.includes(raw.category) ? raw.category : 'best-practice',
    title: typeof raw.title === 'string' ? raw.title.slice(0, 120) : 'Issue found',
    description: typeof raw.description === 'string' ? raw.description : '',
    suggestion: typeof raw.suggestion === 'string' ? raw.suggestion : '',
    codeSnippet: typeof raw.codeSnippet === 'string' ? raw.codeSnippet : undefined,
    fixedCode: typeof raw.fixedCode === 'string' ? raw.fixedCode : undefined,
  };
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
