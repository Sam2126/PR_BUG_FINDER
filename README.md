<div align="center">
  <img src="public/favicon.svg" alt="PR Bug Finder Logo" width="120" />
  <h1>PR BUG FINDER 🚀</h1>
  <p><strong>AI-Powered Autonomous Pull Request Reviewer & Code Quality Analyzer</strong></p>
  
  <p>
    <a href="https://reactjs.org/"><img src="https://img.shields.io/badge/React-18-blue.svg?style=flat-square&logo=react" alt="React" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.0-blue.svg?style=flat-square&logo=typescript" alt="TypeScript" /></a>
    <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite-5.0-646CFF.svg?style=flat-square&logo=vite" alt="Vite" /></a>
    <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-0.109-009688.svg?style=flat-square&logo=fastapi" alt="FastAPI" /></a>
    <a href="https://crewai.com/"><img src="https://img.shields.io/badge/CrewAI-Agents-FF4B4B.svg?style=flat-square" alt="CrewAI" /></a>
  </p>
</div>

<hr />

## 🌟 Overview

**PR BUG FINDER** is a next-generation code review tool that leverages advanced AI agents to autonomously scan, review, and evaluate GitHub Pull Requests. By simulating human reasoning processes, it analyzes code diffs to find critical security vulnerabilities, bugs, code smells, and performance bottlenecks before they merge into production.

The platform provides a beautiful, modern dashboard where you can watch the AI analyze files in real-time, view detailed issue metrics, and explore a rich code-diff viewer with inline AI suggestions.

## ✨ Features

- 🤖 **Autonomous AI Agents:** Powered by `CrewAI` and `Groq`, the backend agents autonomously decide which files to read, analyze context, and report issues.
- ⚡ **Real-Time Analysis UI:** Watch the AI think! See live updates as the agent streams its thought process, tool invocations, and findings.
- 📊 **Smart Code Quality Scoring:** Calculates an intelligent, curve-based score out of 100 to assess the overall health of the PR.
- 🔍 **Rich Code Diff Viewer:** Beautiful syntax-highlighted diff viewer that embeds AI findings and suggested fixes right next to the problematic code.
- 🎨 **Glassmorphism Design:** A stunning, premium dark-mode interface built with custom CSS for a state-of-the-art user experience.
- 🛡️ **Comprehensive Issue Tracking:** Categorizes issues into Critical, Warning, Info, and Suggestion severities across Security, Performance, and Best Practices.

## 🛠️ Tech Stack

### Frontend
- **React 18** & **TypeScript**
- **Vite** for blazing fast builds
- **Lucide React** for beautiful iconography
- Custom Vanilla CSS (Glassmorphism & Micro-animations)

### Backend
- **Python** & **FastAPI**
- **CrewAI** (Agentic Framework)
- **Groq** (Ultra-fast LLM Inference)
- **GitHub API** integration

---

## 🚀 Getting Started

Follow these instructions to set up the project locally.

### 1. Clone the repository

```bash
git clone https://github.com/Sam2126/PR_BUG_FINDER.git
cd PR_BUG_FINDER
```

### 2. Set up the Backend

Navigate to the `backend` directory and install the Python dependencies.

```bash
cd backend
python -m venv venv

# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

Create a `.env` file in the `backend` directory:
```env
# backend/.env
GROQ_API_KEY=your_groq_api_key_here
GITHUB_TOKEN=your_github_personal_access_token
```

Start the FastAPI server:
```bash
python main.py
```
*(The backend runs on `http://localhost:8000`)*

### 3. Set up the Frontend

Open a new terminal and navigate to the project root.

```bash
npm install
```

Create a `.env` file in the root directory:
```env
# .env
VITE_GROQ_API_KEY=your_groq_api_key_here
```

Start the Vite development server:
```bash
npm run dev
```
*(The frontend runs on `http://localhost:5173`)*

---

## 🎯 How It Works

1. **Submit a PR:** Enter the repository owner, name, and PR number in the frontend dashboard.
2. **Fetch Diffs:** The system connects to the GitHub API, retrieves the PR diffs, and prepares them for the agent.
3. **Agentic Review:** CrewAI assigns roles (e.g., Senior Code Reviewer) to the LLM, which autonomously iterates over the files, calling tools to investigate code snippets.
4. **Live Streaming:** As the AI thinks and finds issues, the frontend dynamically updates the progress bars, file statuses, and the issue tracker.
5. **Final Verdict:** The system generates a final code quality score and determines whether to Approve or Request Changes.

## 📝 License

This project is licensed under the MIT License.
