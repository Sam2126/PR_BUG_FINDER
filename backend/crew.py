"""
CrewAI Agent and Crew definitions for the CodeLens AI Agent.

3 specialized agents collaborate to review code:
1. Security Analyst - Finds security vulnerabilities  
2. Code Quality Agent - Finds bugs, performance issues, code smells
3. Lead Reviewer - Compiles findings into final verdict
"""

import os
from dotenv import load_dotenv
from crewai import Agent, Task, Crew, Process, LLM
from typing import List, Dict, Any, Callable, Optional
from tools import (
    GetFileListTool, GetFileDiffTool, SearchCodePatternTool, ReportIssueTool,
    set_pr_files, get_reported_issues, clear_reported_issues
)

# Load environment variables
load_dotenv()
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")


def create_crew(
    pr_files: List[Dict[str, Any]],
    api_key: str = '',
    pr_title: str = "",
    pr_number: int = 0,
    step_callback: Optional[Callable] = None,
):
    """
    Create a CrewAI crew with specialized code review agents.
    Returns the crew instance. Use get_reported_issues() after kickoff to get results.
    """
    # Use provided key or fall back to hardcoded Groq key
    key = api_key if api_key else GROQ_API_KEY
    
    # Set shared PR files data and clear previous issues
    set_pr_files(pr_files)
    clear_reported_issues()

    # ─── Configure Groq LLM (Llama 3.3 70B) ────────────────────────────────
    groq_llm = LLM(
        model="groq/llama-3.3-70b-versatile",
        api_key=key,
        temperature=0.3,
    )

    # ─── Create Tools ──────────────────────────────────────────────────────
    file_list_tool = GetFileListTool()
    file_diff_tool = GetFileDiffTool()
    search_tool = SearchCodePatternTool()
    report_tool = ReportIssueTool()

    # ─── Define Agents ─────────────────────────────────────────────────────

    security_analyst = Agent(
        role="Senior Security Researcher",
        goal=f"Find ALL security vulnerabilities in PR #{pr_number} '{pr_title}'. You MUST report every issue using the report_issue tool.",
        backstory="""You are a world-class security researcher with 15 years experience. 
        You have found critical CVEs in major projects. You ALWAYS find issues — no code 
        is perfect. Look for: SQL injection, XSS, hardcoded secrets/passwords, weak crypto, 
        insecure randomness, missing auth, SSRF, path traversal. 
        IMPORTANT: You MUST call report_issue for EVERY vulnerability found.""",
        llm=groq_llm,
        tools=[file_list_tool, file_diff_tool, search_tool, report_tool],
        verbose=True,
        allow_delegation=False,
        max_iter=15,
    )

    code_quality_agent = Agent(
        role="Senior Software Engineer",
        goal=f"Find ALL bugs, performance issues, and code smells in PR #{pr_number} '{pr_title}'. You MUST report every issue using the report_issue tool.",
        backstory="""You are a principal engineer at Google with deep expertise in performance, 
        architecture, and TypeScript/JavaScript. You ALWAYS find issues — no code is perfect.
        Look for: N+1 queries, memory leaks, missing error handling, dead code, unused imports, 
        magic numbers, poor naming, missing types, console.log in production, missing validation.
        IMPORTANT: You MUST call report_issue for EVERY issue found.""",
        llm=groq_llm,
        tools=[file_list_tool, file_diff_tool, report_tool],
        verbose=True,
        allow_delegation=False,
        max_iter=15,
    )

    lead_reviewer = Agent(
        role="Engineering Manager",
        goal="Compile all findings into a final code review verdict with a quality score.",
        backstory="""You are an engineering manager who has reviewed thousands of PRs. 
        You compile findings from the security analyst and code quality engineer. 
        Calculate quality score: start at 100, subtract 15 per critical, 8 per warning, 
        3 per info, 1 per suggestion. Return your verdict as JSON.""",
        llm=groq_llm,
        tools=[file_list_tool],
        verbose=True,
        allow_delegation=False,
        max_iter=5,
    )

    # ─── Define Tasks ──────────────────────────────────────────────────────

    file_names = [f["filename"] for f in pr_files]
    files_summary = "\n".join(f"  - {fn}" for fn in file_names)

    security_task = Task(
        description=f"""Security audit of PR #{pr_number}: "{pr_title}".

Files changed:
{files_summary}

INSTRUCTIONS:
1. Call get_file_list to see all files
2. Call get_file_diff for EACH file to read its code changes
3. Analyze the code for security vulnerabilities
4. For EVERY issue found, call report_issue with a JSON string like:
   {{"file": "path/file.ts", "line": 10, "severity": "critical", "category": "security", "title": "SQL Injection", "description": "User input directly in query", "suggestion": "Use parameterized queries"}}
5. Also use search_code_pattern to find hardcoded passwords or secrets

You MUST find and report at least some issues. No real-world code is perfect.""",
        agent=security_analyst,
        expected_output="List of security issues reported via report_issue tool.",
    )

    quality_task = Task(
        description=f"""Code quality review of PR #{pr_number}: "{pr_title}".

Files changed:
{files_summary}

INSTRUCTIONS:
1. Call get_file_list to see all files  
2. Call get_file_diff for EACH file
3. Look for: missing error handling, poor naming, magic numbers, missing types, console.log, unused variables, complex functions, missing input validation, performance issues
4. For EVERY issue, call report_issue with a JSON string like:
   {{"file": "path/file.ts", "line": 5, "severity": "warning", "category": "code-smell", "title": "Magic number", "description": "Unexplained number 42 in code", "suggestion": "Extract to named constant"}}

You MUST find and report issues. Every code change has room for improvement.""",
        agent=code_quality_agent,
        expected_output="List of code quality issues reported via report_issue tool.",
    )

    review_task = Task(
        description=f"""Final review verdict for PR #{pr_number}.

Compile findings and return ONLY this JSON:
{{
    "qualityScore": <number 0-100>,
    "verdict": "approve" or "request-changes" or "comment",
    "summary": "3-4 sentence summary",
    "totalIssues": <count>,
    "criticalCount": <count>,
    "warningCount": <count>
}}

Score: 100 - (15 × criticals) - (8 × warnings) - (3 × infos) - (1 × suggestions).
Any critical = "request-changes". More than 2 warnings = "request-changes".""",
        agent=lead_reviewer,
        expected_output="JSON with qualityScore, verdict, summary.",
        context=[security_task, quality_task],
    )

    # ─── Create the Crew ───────────────────────────────────────────────────

    crew = Crew(
        agents=[security_analyst, code_quality_agent, lead_reviewer],
        tasks=[security_task, quality_task, review_task],
        process=Process.sequential,
        verbose=True,
        step_callback=step_callback,
    )

    return crew
