# LLM Council: Multi-Agent Consensus Engine

> [!NOTE]
> **Core Concept**: The LLM Council is not just a chatbot—it is an **Adversarial Consensus Engine**. By spawning divergent AI personas (Skeptic, Academic, Futurist) to debate a query, verifying outputs via an impartial Critic, and synthesizing a "Blueprint" before final drafting, it mimics a human expert panel to reduce hallucination and bias.

## 🧠 System Architecture & Determinisitic Control Flow

The system employs a **Retrieval-Augmented Generation (RAG) independent** approach, relying purely on the cognitive latency of diverse foundational models. The "Brain" operates on a **4-Phase Waterfall Pipeline** implemented in `server.py` and `main.py`, combining parallel asynchronous execution with sequential quality gates.

### 1. Divergent Generation (Parallel Inference)
*   **Concurrency**: Uses `asyncio.create_task` to spawn concurrent execution threads for selected agents.
*   **Persona Injection**: Each thread constructs a context window using a distinct system prompt from `config.py` (e.g., "The Skeptic" vs "The Futurist").
*   **Model Routing**: Inference is routed to specific models defined in `MODEL_MAP`. This allows hybrid architectures (e.g., using `llama-3` for creative generation and `gpt-4o` for logic).

### 2. Adversarial Critique (Batch Processing)
*   **Input**: Raw text outputs from Phase 1.
*   **Batching Logic**: Responses are processed in sliding windows (`chunk_size=3`) to fit within the Critic's context window.
*   **Structured Enforcement**: The Critic Agent is constrained to return a valid JSON object adhering to the `CriticOutput` schema.
*   **Selection Algorithm**: The system programmatically parses the JSON to extract a `winner_id` and quantitative scores, promoting the highest-quality content to the synthesis phase.

### 3. Architectural Synthesis (Planner)
*   **Mechanism**: The **Architect Agent** does not write final prose. It generates a **Blueprint** (Schema: `ArchitectBlueprint`).
*   **Refinement**: It explicitly requests `missing_facts_to_add` based on the Critic's feedback, effectively performing a self-correction loop before the final generation.

### 4. Finalization (Execution)
*   **Action**: A high-fidelity model executes the Architect's Blueprint.
*   **Streaming**: The output is token-streamed via Server-Sent Events (SSE) to the consumer.

---

## ⚙️ AI/ML Engineering

### 1. Robust Error Handling & Recovery
The system implements a multi-layered defense against LLM instability:
*   **422 Recovery Strategy**: If a model rejects a request (e.g., due to unsupported `response_format`), the `LLMClient` automatically catches the `APIStatusError`, strips the constraint, and retries the request transparently.
*   **Fault Tolerance**: The Generator phase is wrapped in individual `try/catch` blocks. A failure in one agent (e.g., timeout) logs the error but does **not** crash the entire pipeline, ensuring partial results are still delivered.

### 2. Structured Outputs (Pydantic Integration)
Instead of parsing Regex from raw text, the system uses `Pydantic` models to define expected LLM outputs:
*   `CriticOutput`: Enforces `scores` (int) and `flaws` (string) fields.
*   `ArchitectBlueprint`: Enforces `structure` (list) and `tone_guidelines` (string).
This forces the LLM to "think" in structured data, significantly reducing format errors.

### 3. Trace Logging (The "Flight Recorder")
*   **Pattern**: Immutable Audit Logs.
*   **Implementation**: `tracer.py` writes a sequential Markdown log (`logs/trace_{timestamp}.md`) capturing every prompt, raw model output (`temperature`, `tokens`), and internal decision state.
*   **Utility**: Enables post-hoc analysis of "Chain of Thought" reasoning failures.

---

## 📊 Technical Metrics & Performance

The backend is instrumented to capture high-resolution telemetry for every request:

| Metric | Definition | Implementation |
| :--- | :--- | :--- |
| **Time to First Token (TTFT)** | Latency from request start to first byte received. | Measured via `time.perf_counter()` in `server.py` yield loops. |
| **Total Latency** | End-to-end execution time per agent. | Aggregated in `MetricData` objects passed via SSE. |
| **Token Usage** | Precise count of Prompt vs. Completion tokens. | Extracted directly from OpenRouter API `usage` headers. |
| **Model Throughput** | Comparison of model generation speeds. | Logged alongside model IDs (e.g., `nvidia/nemotron` vs `deepseek-r1t`). |

---

## 📦 Key Class Deep Dive

### 1. `LLMClient` (`llm_client.py`)
**Role**: The Gateway.
*   **Mechanism**: Wraps `AsyncOpenAI` with custom retry logic and schema enforcement.
*   **Resilience**: Implements an **Exponential Backoff** strategy for HTTP 429/500/503 errors (`base_delay * 2^attempt`).
*   **Mock Mode**: Determining logic (`_mock_generate`) allows for unit testing the orchestration logic without incurring API costs.

### 2. `WorkflowTracer` (`tracer.py`)
**Role**: Observability Engine.
*   **Mechanism**: Atomic file writes to generate human-readable audit trails.
*   **I/O**: Captures `input_data` (Prompts) and `output_data` (JSON/Text) at every `log_step`.

### 3. `Server` (`server.py`)
**Role**: Orchestrator.
*   **Protocol**: Server-Sent Events (SSE).
*   **Event Schema**:
    *   `type`: Event identifier (e.g., `generator_chunk`, `critic_result`).
    *   `data`: JSON payload containing content and metrics.
    *   `retry`: Connection reconnection strategy.

---

## 🚀 Quick Start (Headless)

To run the core consensus engine directly:

1.  **Environment Setup**:
    ```bash
    # Ensure OPENROUTER_API_KEY is set in .env
    pip install -r requirements.txt
    ```

2.  **Run Inference Pipeline**:
    ```bash
    python llm_council/main.py
    ```

3.  **Inspect Traces**:
    ```bash
    # View the decision logic of the last run
    cat llm_council/logs/trace_*.md
    ```
