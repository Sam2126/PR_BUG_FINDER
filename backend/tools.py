"""
Custom tools for CrewAI agents.
These tools give agents the ability to interact with PR code diffs.

IMPORTANT: We use a module-level shared list for reported issues because
CrewAI may internally clone tool instances. Using instance variables
would lose the reported data.
"""

from crewai.tools import BaseTool
from pydantic import Field
from typing import List, Dict, Any, ClassVar
import json
import threading

# ─── Shared State ─────────────────────────────────────────────────────────────
# Module-level shared storage that persists across tool copies.
# Protected by a lock for thread safety.

_issues_lock = threading.Lock()
_reported_issues: List[Dict[str, Any]] = []
_pr_files_store: List[Dict[str, Any]] = []


def set_pr_files(files: List[Dict[str, Any]]):
    """Set the PR files data for tools to access."""
    global _pr_files_store
    _pr_files_store = files


def get_reported_issues() -> List[Dict[str, Any]]:
    """Get all reported issues (thread-safe)."""
    with _issues_lock:
        return list(_reported_issues)


def clear_reported_issues():
    """Clear reported issues for a new review session."""
    global _reported_issues
    with _issues_lock:
        _reported_issues = []


class GetFileListTool(BaseTool):
    """Returns the list of changed files in the PR."""
    name: str = "get_file_list"
    description: str = "Get the list of all changed files in the pull request with filename, language, additions, and deletions count."

    def _run(self, **kwargs) -> str:
        result = []
        for f in _pr_files_store:
            result.append({
                "filename": f["filename"],
                "language": f.get("language", "unknown"),
                "additions": f.get("additions", 0),
                "deletions": f.get("deletions", 0),
            })
        return json.dumps(result, indent=2)


class GetFileDiffTool(BaseTool):
    """Returns the code diff/patch for a specific file."""
    name: str = "get_file_diff"
    description: str = "Get the unified diff (code changes) for a specific file. Pass the filename as input."

    def _run(self, filename: str = "", **kwargs) -> str:
        # Handle case where CrewAI passes args differently
        if not filename and kwargs:
            filename = str(list(kwargs.values())[0]) if kwargs else ""
        
        filename = filename.strip().strip('"').strip("'")
        
        for f in _pr_files_store:
            if f["filename"] == filename or f["filename"].endswith(filename):
                patch = f.get("patch", "No patch available")
                return f"File: {f['filename']}\nLanguage: {f.get('language', 'unknown')}\nAdditions: {f.get('additions', 0)}\nDeletions: {f.get('deletions', 0)}\n\nDiff:\n{patch}"
        
        # Try partial match
        for f in _pr_files_store:
            if filename.lower() in f["filename"].lower():
                patch = f.get("patch", "No patch available")
                return f"File: {f['filename']}\nLanguage: {f.get('language', 'unknown')}\n\nDiff:\n{patch}"
        
        available = [f["filename"] for f in _pr_files_store]
        return f"File '{filename}' not found. Available files: {available}"


class SearchCodePatternTool(BaseTool):
    """Searches for a pattern across all files in the PR."""
    name: str = "search_code_pattern"
    description: str = "Search for a text pattern (like hardcoded secrets, passwords, API keys) across ALL changed files. Pass the search pattern as input."

    def _run(self, pattern: str = "", **kwargs) -> str:
        if not pattern and kwargs:
            pattern = str(list(kwargs.values())[0]) if kwargs else ""
        
        pattern = pattern.strip().strip('"').strip("'")
        matches = []
        
        for f in _pr_files_store:
            patch = f.get("patch", "")
            if pattern.lower() in patch.lower():
                lines = patch.split("\n")
                for i, line in enumerate(lines):
                    if pattern.lower() in line.lower() and line.startswith("+"):
                        matches.append({
                            "file": f["filename"],
                            "line_in_diff": i + 1,
                            "content": line.strip()[:200],
                        })
        
        if matches:
            return f"Found '{pattern}' in {len(matches)} location(s):\n{json.dumps(matches, indent=2)}"
        return f"Pattern '{pattern}' NOT found in any file."


class ReportIssueTool(BaseTool):
    """Reports a code review issue found by the agent."""
    name: str = "report_issue"
    description: str = """Report a code review issue you found. Pass a JSON string with these fields:
{
    "file": "path/to/file.ts",
    "line": 42,
    "severity": "critical" or "warning" or "info" or "suggestion",
    "category": "security" or "bug" or "performance" or "code-smell" or "best-practice",
    "title": "Short descriptive title",
    "description": "2-3 sentence explanation of the problem and its impact",
    "suggestion": "How to fix it",
    "codeSnippet": "the problematic code (optional)",
    "fixedCode": "the corrected code (optional)"
}"""

    def _run(self, issue_json: str = "", **kwargs) -> str:
        global _reported_issues
        
        if not issue_json and kwargs:
            issue_json = str(list(kwargs.values())[0]) if kwargs else ""
        
        try:
            # Try to parse as JSON
            issue = json.loads(issue_json)
            
            # Validate and set defaults
            for key, default_val in [
                ("file", "unknown"),
                ("line", 1),
                ("severity", "info"),
                ("category", "best-practice"),
                ("title", "Untitled Issue"),
                ("description", ""),
                ("suggestion", ""),
            ]:
                if not issue.get(key) or (isinstance(issue.get(key), str) and not issue.get(key).strip()):
                    issue[key] = default_val
            
            with _issues_lock:
                _reported_issues.append(issue)
                count = len(_reported_issues)
            
            return f"✅ Issue #{count} recorded: [{issue['severity'].upper()}] {issue['title']} in {issue['file']}:{issue['line']}"
        
        except json.JSONDecodeError:
            # If not valid JSON, try to extract info from the text
            issue = {
                "file": "unknown",
                "line": 1,
                "severity": "info",
                "category": "best-practice",
                "title": issue_json[:60] if issue_json else "Agent finding",
                "description": issue_json or str(kwargs),
                "suggestion": "Review this finding manually.",
            }
            
            with _issues_lock:
                _reported_issues.append(issue)
                count = len(_reported_issues)
            
            return f"✅ Issue #{count} recorded from text: {issue['title']}"
