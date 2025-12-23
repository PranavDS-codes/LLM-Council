LLM Council Web App - Walkthrough
This guide explains how to set up and run the full-stack LLM Council application.

Prerequisites
Python 3.9+
Node.js 18+ (verified 20+)
1. Backend Setup (FastAPI & uv)
The backend handles the agent coordination. We use uv for blazing fast package management.

Navigate to the python directory:
cd llm_council
Create a virtual environment (optional but recommended):
uv venv
source .venv/bin/activate
Install dependencies:
uv pip install -r requirements.txt
Run the server:
# Normal Mode (requires API Keys in .env)
python server.py
# OR Mock Mode (for UI testing without credits)
export USE_MOCK_MODE=True && python server.py
The server will start at http://localhost:8000.
2. Frontend Setup (Next.js)
The frontend provides the "Mission Control" interface.

Navigate to the web directory:
cd web
Install dependencies:
npm install
Run the development server:
npm run dev
The app will be available at http://localhost:3000.
3. Usage Guide
Mission Control
Agent Selector: Toggle the 5 agents (Academic, Layman, Skeptic, Futurist, Guardian) to customize the council.
Query Input: Type your question and hit Enter or the Arrow button.
Execution Phases
The Council Speaks: Watch as multiple agents draft answers in parallel (simulated or real). Switch tabs to read them.
Peer Review: The Critic analyzes the responses and picks a winner based on logic and depth.
The Blueprint: The Architect synthesizes the best ideas into a structured plan.
The Verdict: The Finalizer writes the cohesive final document.
Troubleshooting
CORS Errors: Ensure the backend is running on port 8000.
Missing Prompts: Run the server from llm_council/ directory so it can find prompts/.
Mock Mode: If no API keys are set, Mock Mode will auto-engage or error. Explicitly setting USE_MOCK_MODE=True is safer for UI dev.