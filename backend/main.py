"""
FastAPI Backend Server for CodeLens AI Agent.

This server exposes a /api/review endpoint that:
1. Receives PR files from the React frontend
2. Creates a CrewAI crew with 3 specialized AI agents
3. Runs the agents using Gemini 2.0 Flash
4. Streams agent reasoning steps back via Server-Sent Events (SSE)

The agents are REAL AI agents (CrewAI framework) — they autonomously
decide which tools to call, reason about the code, and collaborate
to produce a comprehensive review.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import asyncio
import json
import time
import threading
import queue
import traceback

from crew import create_crew
from tools import get_reported_issues

app = FastAPI(
    title="CodeLens AI Agent API",
    description="AI Agent backend powered by CrewAI + Gemini 2.0 Flash",
    version="1.0.0",
)

# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request / Response Models ────────────────────────────────────────────────

class PRFileInput(BaseModel):
    filename: str
    patch: str
    language: str = "unknown"
    status: str = "modified"
    additions: int = 0
    deletions: int = 0


class ReviewRequest(BaseModel):
    files: List[PRFileInput]
    geminiApiKey: str = ""
    prTitle: str = ""
    prNumber: int = 0
    owner: str = ""
    repo: str = ""


# ─── Root Page ────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    from fastapi.responses import HTMLResponse
    return HTMLResponse("""
    <!DOCTYPE html>
    <html><head>
    <title>CodeLens AI Agent — Backend</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #06060f; color: #e8e8f0; font-family: 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
      .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 48px; max-width: 600px; text-align: center; }
      h1 { font-size: 2rem; margin-bottom: 8px; }
      .gradient { background: linear-gradient(135deg, #00d4ff, #8b5cf6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      .sub { color: #8888a8; margin-bottom: 32px; font-size: 0.95rem; }
      .badge { display: inline-block; background: rgba(0,212,255,0.1); color: #00d4ff; border: 1px solid rgba(0,212,255,0.3); padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; margin-bottom: 24px; }
      .agents { text-align: left; margin-bottom: 24px; }
      .agent { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: rgba(255,255,255,0.02); border-radius: 10px; margin-bottom: 8px; border-left: 3px solid #00d4ff; }
      .agent:nth-child(2) { border-left-color: #8b5cf6; }
      .agent:nth-child(3) { border-left-color: #10b981; }
      .agent .role { font-weight: 700; font-size: 0.9rem; }
      .agent .desc { color: #8888a8; font-size: 0.75rem; }
      .status { display: flex; align-items: center; gap: 8px; justify-content: center; color: #10b981; font-weight: 600; }
      .dot { width: 10px; height: 10px; background: #10b981; border-radius: 50%; animation: pulse 1.5s infinite; }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      .info { color: #55556a; font-size: 0.8rem; margin-top: 16px; }
      a { color: #00d4ff; }
    </style>
    </head><body>
    <div class="card">
      <h1><span class="gradient">CodeLens</span> AI</h1>
      <p class="sub">Multi-Agent Code Review System</p>
      <div class="badge">🤖 CrewAI + Gemini 2.0 Flash</div>
      <div class="agents">
        <div class="agent"><div><div class="role">🔒 Security Analyst</div><div class="desc">Senior Security Researcher — finds vulnerabilities, hardcoded secrets, weak crypto</div></div></div>
        <div class="agent"><div><div class="role">⚡ Code Quality Agent</div><div class="desc">Senior Software Engineer — finds bugs, N+1 queries, code smells, performance issues</div></div></div>
        <div class="agent"><div><div class="role">📋 Lead Reviewer</div><div class="desc">Engineering Manager — compiles findings, assigns quality score, makes verdict</div></div></div>
      </div>
      <div class="status"><div class="dot"></div> Backend Running</div>
      <p class="info">Open the frontend at <a href="http://localhost:5173">localhost:5173</a> to start reviewing PRs</p>
    </div>
    </body></html>
    """)


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "agent_framework": "CrewAI",
        "llm": "Groq Llama 3.3 70B",
        "agents": [
            "Security Analyst (Senior Security Researcher)",
            "Code Quality Agent (Senior Software Engineer)",
            "Lead Reviewer (Engineering Manager)",
        ],
    }


# ─── Main Review Endpoint (SSE) ──────────────────────────────────────────────

@app.post("/api/review")
async def review_pr(request: ReviewRequest):
    """
    Run the CrewAI agent crew to review a PR.
    Returns Server-Sent Events (SSE) stream with agent steps in real-time.
    """
    step_queue: queue.Queue = queue.Queue()
    result_holder = {"result": None, "error": None, "issues": []}

    def step_callback(step_output):
        """Called by CrewAI on each agent reasoning step."""
        try:
            # Extract agent info from the step
            agent_name = "Agent"
            step_type = "thinking"
            content = str(step_output)

            # Parse CrewAI step output
            if hasattr(step_output, "agent"):
                agent_name = step_output.agent
            if hasattr(step_output, "output"):
                content = str(step_output.output)

            # Detect step type from content
            content_lower = content.lower()
            if "report_issue" in content_lower or "reported" in content_lower:
                step_type = "observation"
            elif "search_code_pattern" in content_lower or "cross-reference" in content_lower:
                step_type = "cross_reference"
            elif "get_file_diff" in content_lower or "get_file_list" in content_lower:
                step_type = "tool_call"
            elif "verdict" in content_lower or "quality score" in content_lower or "request-changes" in content_lower:
                step_type = "decision"
            elif "analyze" in content_lower or "scanning" in content_lower:
                step_type = "tool_call"

            # Determine title based on agent role
            title = f"{agent_name}: Reasoning"
            if "Security" in str(agent_name):
                title = "🔒 Security Analyst: " + content[:60]
            elif "Software" in str(agent_name) or "Quality" in str(agent_name):
                title = "⚡ Code Quality Agent: " + content[:60]
            elif "Manager" in str(agent_name) or "Lead" in str(agent_name):
                title = "📋 Lead Reviewer: " + content[:60]

            step_data = {
                "id": f"crew-step-{int(time.time() * 1000)}",
                "type": step_type,
                "title": title[:120],
                "content": content[:500],
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "status": "complete",
                "tool": None,
                "fileContext": None,
            }

            # Try to extract tool and file info
            if "get_file_diff" in content:
                step_data["tool"] = "get_file_diff"
            elif "search_code_pattern" in content:
                step_data["tool"] = "search_code_pattern"
            elif "report_issue" in content:
                step_data["tool"] = "report_issue"

            step_queue.put(("step", step_data))
        except Exception as e:
            step_queue.put(("step", {
                "id": f"crew-err-{int(time.time() * 1000)}",
                "type": "thinking",
                "title": f"Agent Processing...",
                "content": str(e)[:200],
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "status": "complete",
            }))

    def run_crew():
        """Run the CrewAI crew in a background thread."""
        try:
            pr_files = [f.model_dump() for f in request.files]

            # Emit planning step
            step_queue.put(("step", {
                "id": "crew-plan",
                "type": "planning",
                "title": "Initializing CrewAI Agent Crew",
                "content": f"Creating 3 specialized AI agents (Security Analyst, Code Quality Engineer, Lead Reviewer) to analyze PR #{request.prNumber}: \"{request.prTitle}\". Using Gemini 2.0 Flash as the reasoning engine. Agents will autonomously decide which tools to use.",
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "status": "complete",
            }))

            # Create the crew
            crew = create_crew(
                pr_files=pr_files,
                api_key=request.geminiApiKey,
                pr_title=request.prTitle,
                pr_number=request.prNumber,
                step_callback=step_callback,
            )

            step_queue.put(("step", {
                "id": "crew-start",
                "type": "action",
                "title": "Crew Kickoff — Agents Starting Work",
                "content": "Security Analyst agent begins first. It will analyze each file for vulnerabilities, then hand off to the Code Quality agent, and finally the Lead Reviewer will compile the verdict.",
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "status": "complete",
            }))

            # Run the crew (this blocks until all agents finish)
            result = crew.kickoff()

            # Collect reported issues from shared state
            issues = get_reported_issues()
            print(f"[CrewAI] Crew finished. {len(issues)} issues collected from shared state.")

            # Try to parse the lead reviewer's verdict
            verdict = None
            try:
                result_text = str(result)
                json_start = result_text.find("{")
                json_end = result_text.rfind("}") + 1
                if json_start >= 0 and json_end > json_start:
                    verdict = json.loads(result_text[json_start:json_end])
            except Exception:
                pass

            result_holder["result"] = verdict
            result_holder["issues"] = issues

            # Emit completion
            step_queue.put(("step", {
                "id": "crew-complete",
                "type": "complete",
                "title": "CrewAI Agent Review Complete",
                "content": f"All 3 agents finished. Found {len(issues)} issues. The Lead Reviewer has compiled the final verdict.",
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "status": "complete",
                "issuesFound": len(issues),
            }))

            step_queue.put(("done", {"issues": issues, "verdict": verdict}))

        except Exception as e:
            traceback.print_exc()
            step_queue.put(("step", {
                "id": "crew-error",
                "type": "error",
                "title": "Agent Error",
                "content": f"CrewAI execution failed: {str(e)[:300]}",
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "status": "error",
            }))
            step_queue.put(("done", {"issues": result_holder["issues"], "verdict": None, "error": str(e)}))

    # Start crew in background thread
    thread = threading.Thread(target=run_crew, daemon=True)
    thread.start()

    # SSE generator — streams agent steps to frontend
    async def event_generator():
        while True:
            try:
                # Non-blocking check of the queue
                try:
                    event_type, data = step_queue.get_nowait()
                except queue.Empty:
                    await asyncio.sleep(0.3)
                    continue

                if event_type == "step":
                    yield {
                        "event": "agent_step",
                        "data": json.dumps(data),
                    }
                elif event_type == "done":
                    yield {
                        "event": "review_complete",
                        "data": json.dumps(data, default=str),
                    }
                    break

            except asyncio.CancelledError:
                break
            except Exception as e:
                yield {
                    "event": "error",
                    "data": json.dumps({"error": str(e)}),
                }
                break

    return EventSourceResponse(event_generator())


# ─── Simple (non-streaming) review endpoint ──────────────────────────────────

@app.post("/api/review/simple")
async def review_pr_simple(request: ReviewRequest):
    """Non-streaming version for simpler clients."""
    pr_files = [f.model_dump() for f in request.files]

    crew = create_crew(
        pr_files=pr_files,
        gemini_api_key=request.geminiApiKey,
        pr_title=request.prTitle,
        pr_number=request.prNumber,
    )

    result = crew.kickoff()
    issues = get_reported_issues()

    return {
        "issues": issues,
        "result": str(result),
        "agentFramework": "CrewAI",
        "agents": ["Security Analyst", "Code Quality Agent", "Lead Reviewer"],
    }


if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("  CodeLens AI Agent Backend")
    print("  Framework: CrewAI + Gemini 2.0 Flash")
    print("  Agents: Security Analyst, Code Quality, Lead Reviewer")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
