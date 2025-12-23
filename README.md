# The LLM Council

![The LLM Council](file:///Users/pranavpant/Desktop/code%20/LLM%20Council/llm_council_hero_1766533132243.png)

## Overview
**The LLM Council** is a Full-Stack AI Application that simulates a high-stakes decision-making council. It deploys a swarm of autonomous AI agents—each with a distinct persona (e.g., The Academic, The Skeptic, The Futurist)—to analyze your query from multiple angles, debate the findings, and synthesize a comprehensive verdict.

### Core Features
- **Multi-Agent Swarm**: Five distinct AI personas generate divergent perspectives on any topic.
- **Phased Debate Pipeline**:
  - **Phase 1 (Generators)**: Agents independently draft initial responses.
  - **Phase 2 (Critics)**: An impartial Judge reviews the drafts, scores them, and identifies specific flaws.
  - **Phase 3 (Architect)**: A Chief Architect synthesizes the best ideas into a "Blueprint" for the final answer.
  - **Phase 4 (Finalizer)**: A professional writer drafts the final, polished verdict based on the Blueprint.
- **Session Mastery**: Save, restore, and delete past council sessions individually.
- **Full Trace Logging**: Every council session is logged in detail to `llm_council/logs/` for audit and analysis.
- **Cyberpunk UI**: A "Mission Control" style interface with real-time streaming updates.

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
2.  Add your API key using the variable name `OPENROUTER_API_KEY`:

```env
# llm_council/.env
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
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

## Configuration Guide

### Changing Agent Models
You can customize which specific LLM powers each agent or phase by editing the `config.py` file.

1. Open `llm_council/config.py`.
2. Locate the `MODEL_MAP` dictionary.
3. Update the value for any key (`generator_1`, `critic`, `finalizer`, etc.) to your desired OpenRouter model ID.

**Example `config.py`:**
```python
MODEL_MAP = {
    # Generators (The Agents)
    "generator_1": "openai/gpt-4o",          # The Academic
    "generator_2": "anthropic/claude-3-5-sonnet", # The Layman
    "generator_3": "google/gemini-flash-1.5", # The Skeptic
    # ...
    
    # Workflow Roles
    "critic": "openai/gpt-4o",               # The Judge
    "architect": "anthropic/claude-3-haiku", # The Planner
    "finalizer": "openai/gpt-4o"             # The Writer
}
```

### Mock Mode
To save costs during UI testing, you can enable "Mock Mode" which simulates AI responses without making API calls.
In your `.env` file, add:
```env
USE_MOCK_MODE=True
```
Set it to `False` (or remove the line) to use real AI models.

## Usage
1.  Open `http://localhost:3000`.
2.  Select the **Agents** you want to summon (all are selected by default).
3.  Type your query into the input box (e.g., *"Is remote work bad for creativity?"*).
4.  Click **Summon Council**.
5.  Watch the debate unfold in real-time across four tabs:
    - **Generators**: See individual agent opinions.
    - **Critic**: View the Judge's winner and specific flaws for each agent.
    - **Architect**: See the synthesized plan.
    - **Verdict**: Read the final cohesive response.
6.  **History**: Your session saves automatically. Click previous sessions in the sidebar to review them, or click the Trash icon to delete them.

---
*Built with Next.js, FastAPI, and OpenRouter.*
