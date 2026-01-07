# The LLM Council

![The LLM Council](llm_council_hero_1766533132243.png)

## Overview
**The LLM Council** is a production-grade AI agent system simulating a high-stakes decision-making council. It orchestrates a swarm of autonomous AI agents—each with a distinct persona (e.g., The Academic, The Skeptic, The Futurist)—to analyze complex queries from divergent perspectives, debate the findings, and synthesize a comprehensive, collaborative verdict.

### Core Features
- **Multi-Agent Swarm**: Five distinct AI personas generate divergent perspectives on any topic.
- **Phased Debate Pipeline**:
  - **Phase 1 (Generators)**: Agents independently draft initial responses.
  - **Phase 2 (Critics)**: An impartial Judge reviews the drafts, scores them, and identifies specific flaws.
  - **Phase 3 (Architect)**: A Chief Architect synthesizes the best ideas into a "Blueprint" for the final answer.
  - **Phase 4 (Finalizer)**: A professional writer drafts the final, polished verdict based on the Blueprint.
- **Detailed Metrics**: Real-time tracking of **Time Taken**, **Token Usage** (Prompt/Completion/Total), and **Model ID** for every single agent and phase.
- **Live Configuration**: A comprehensive **`Config`** page allows you to override the OpenRouter API Key and assign specific Models to individual agents directly from the UI, persisted locally.
- **Session Mastery**:
  - **Persistence**: Sessions are automatically saved to your browser's local storage.
  - **History**: Review past debates or delete old mandates at any time.
  - **Exporting**: (Future) Export session logs for external analysis.
- **Headless & Robust**: The backend is designed for headless execution with fault tolerance—if one agent fails (e.g., rate limit), the council continues its work without crashing.
- **Full Trace Logging**: detailed Markdown logs are generated in `llm_council/logs/` for every session ensuring complete auditability.
- **Cyberpunk UI**: A dedicated "Mission Control" interface featuring dark/light modes, real-time streaming updates, and responsive visualizations.

## Architecture

The project is built as a modern Full-Stack application:

*   **Frontend**: [Next.js](https://nextjs.org/) (React 19)
    *   State Management: `Zustand` with LocalStorage persistence.
    *   Styling: `TailwindCSS` with custom CSS variables for theme switching.
    *   Streaming: Server-Sent Events (SSE) for real-time text generation.
*   **Backend**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.11+)
    *   Concurrency: `asyncio` for parallel agent execution.
    *   LLM Client: Custom wrapper around `openai-python` optimized for OpenRouter.
    *   Validation: `Pydantic` models for structured data handling.
    *   Tracing: Custom logging system for generating readable Markdown traces of every workflow step.

## Prerequisites
Before you begin, ensure you have the following installed:
- **Python 3.11+**: For the backend server.
- **Node.js 18+ & npm**: For the frontend web application.
- **An OpenRouter API Key**: This project uses [OpenRouter](https://openrouter.ai/) to access various LLMs (e.g., GPT-4o, Claude 3.5 Sonnet, Llama 3).

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd "LLM Council"
```

### 2. Backend Setup
The backend is a FastAPI server that manages the AI agents.
```bash
cd llm_council

# Create a virtual environment (recommended)
uv venv .venv
source .venv/bin/activate  # On Windows use: .venv\Scripts\activate

# Install dependencies
uv pip install -r requirements.txt
```

#### Configure Environment Variables
You **MUST** create a `.env` file in the `llm_council` folder to authenticate with OpenRouter.

1.  Create a file named `.env` inside the `llm_council` directory.
2.  Add your API key (and optionally toggle Mock Mode):

```env
# llm_council/.env
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
USE_MOCK_MODE=False
```

### 3. Frontend Setup
The frontend is a Next.js application.
```bash
# Open a new terminal tab and navigate to the web directory
cd web

# Install dependencies
npm install
```

## Running the Application

You need to run both the Backend (Python) and Frontend (Node.js) simultaneously.

### Terminal 1: Backend Server
```bash
cd llm_council
source .venv/bin/activate
python server.py
```
*The server will start on `http://localhost:8000`.*

### Terminal 2: Frontend Web App
```bash
cd web
npm run dev
```
*The web app will be available at `http://localhost:3000`.*

---

## Configuration & Usage

### 1. Customizing Models & Keys (New!)
You no longer need to edit code to change models.
- Navigate to the **Config** page (Gear icon in Sidebar).
- **API Key**: Enter a custom OpenRouter API Key to override the server default.
- **Model Overrides**: Select specific models for each agent (e.g., assign `gpt-4o` to The Academic and `claude-3-opus` to The Architect).
- Changes are saved automatically to your browser.

### 2. Running a Session
1.  Open `http://localhost:3000`.
2.  Select the **Agents** you want to summon (toggle them on/off in the top bar).
3.  Type your query into the input box (e.g., *"Is remote work bad for creativity?"*).
4.  Click **Summon Council** (or press Enter).
5.  Watch the debate unfold in real-time across four phases.

### 3. Monitoring Metrics
At the bottom of every phase (and the final summary), you can now see:
- **Time Taken**: How long each agent took to generate.
- **Model ID**: Which specific model was used.
- **Token Usage**: Detailed breakdown of input/output tokens.

### 4. Stopping a Session
If a session is taking too long or going off-track, simply click the **Stop** button (Red Square) to immediately halt the backend process and save the current state.

## Troubleshooting

### "422 Unprocessable Content" Error
This usually happens if a model doesn't support the requested parameters (like JSON mode).
- **Fix**: The system now automatically attempts to recover from this by stripping strict constraints and retrying. If it persists, try selecting a different model in the Config page.

### Blank UI / "The Council Speaks" Forever
- **Fix**: Ensure your backend and frontend are running. If you see this, refresh the page. This was a known issue with SSE parsing that has been patched.

---
*Built with Next.js, FastAPI, and OpenRouter.*
