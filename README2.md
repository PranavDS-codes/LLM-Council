# LLM Council: Multi-Agent Consensus Engine

> [!NOTE]
> **Key Differentiator**: Unlike standard RAG or Chain-of-Thought systems, LLM Council enforces **adversarial consensus**. It spawns divergent AI personas (Skeptic, Academic, Futurist) to debate a query, ranks their outputs via an impartial Critic, and synthesizes a "Blueprint" before writing the final response. This reduces hallucination and bias by mimicking a human expert panel.

## 🧠 System Architecture & Determinisitic Control Flow

The "Brain" of the system relies on a **4-Phase Waterfall Pipeline** implemented in `main.py`. The control flow combines parallel execution for diversity with sequential bottlenecks for quality control.

### 1. Divergent Generation (Parallel Inference)
*   **Mechanism**: Uses `asyncio.create_task` to spawn 3-5 concurrent execution threads.
*   **Logic**: Each thread is initialized with a distinct system prompt (from `config.py`) representing a specific cognitive stance (e.g., "The Skeptic" vs "The Futurist").
*   **Model Routing**: Distinct personas are routed to specific models defined in `MODEL_MAP` (e.g., `nvidia/nemotron` for generators, `deepseek-r1t` for reasoning).

### 2. Adversarial Critique (Batch Processing)
*   **Input**: Raw text outputs from Phase 1.
*   **Logic**:
    1.  Responses are grouped into batches using a sliding window (`chunk_size=3`).
    2.  A specialized **Critic Agent** evaluates the batch.
    3.  **Structured Output**: The Critic *must* return valid JSON adhering to the `CriticOutput` schema (Rankings, Flaws, Scores).
*   **Agentic Logic**: The system parses the JSON to identify a `winner_id` and programmatically promotes the highest-scoring content to the next phase.

### 3. Architectural Synthesis (Planner)
*   **Input**: The "Winner" content from Phase 2 + Aggregated Critique JSONs.
*   **Mechanism**: The **Architect Agent** does not write the final answer. Instead, it generates a **Blueprint**.
*   **Schema**: `ArchitectBlueprint` containing:
    *   `structure`: Ordered headers.
    *   `missing_facts_to_add`: Data gaps identified in the critique.
    *   `tone_guidelines`: Style enforcement.

### 4. Final Finalization (Execution)
*   **Input**: Architect's Blueprint + Best Raw Context.
*   **Action**: A high-fidelity model (`deepseek-r1t2`) executes the instructions strictly adhering to the Blueprint to produce the final artifact.

---

## ⚙️ Data Engineering & Pipelines

### Data Ingestion & IO
*   **Entry**: CLI-based entry point accepting raw string queries.
*   **Transport**: Data flows in-memory as native Python dictionaries (`responses` list) between async tasks.

### Transformation Layer
*   **Normalization**: `format_responses_for_critic()` standardizes diverse model outputs into a unified text block for the Critic context window, preventing format-based bias.
*   **Serialization**: Heavy use of `Pydantic` models (`schemas.py`) to enforce type safety on LLM outputs. The system forces the LLM to "think in JSON."

### Persistence (Flight Recorder)
*   **Mechanism**: The system avoids traditional databases in favor of a **Trace Log** pattern.
*   **Implementation**: `tracer.py` writes a sequential Markdown log (`logs/trace_{timestamp}.md`) capturing every prompt, raw model output, and internal decision state.
*   **Significance**: Enables post-hoc debugging of the "chain of thought" without opaque binary blobs.

---

## 📦 Key Class Deep Dive

### 1. `LLMClient` (`llm_client.py`)
**Role**: The Gateway.
*   **Mechanism**: Wraps `AsyncOpenAI` with custom error handling and schema enforcement.
*   **Resilience**: Implements an **Exponential Backoff** strategy for HTTP 429/500/503 errors (`base_delay * 2^attempt`).
*   **Mock Mode**: Includes a deterministic `_mock_generate` path for unit testing logic without API costs.

### 2. `WorkflowTracer` (`tracer.py`)
**Role**: Observability Engine.
*   **Mechanism**: atomic file writes to generate human-readable audit trails.
*   **I/O**: Captures `input_data` (Prompts) and `output_data` (JSON/Text) at every `log_step`.

### 3. `CriticOutput` (`schemas.py`)
**Role**: Structured Reasoning.
*   **Mechanism**: A Pydantic model that forces the Critic model to quantize its evaluation.
*   **Fields**:
    *   `scores`: `Dict[str, int]` (Quantitative metric).
    *   `flaws`: `Dict[str, str]` (Qualitative feedback).
    *   `reasoning`: `str` (Chain of thought).

---

## 📊 Performance & Observability

| Metric | Implementation Details |
| :--- | :--- |
| **Latency** | Handled via `asyncio` concurrency in Phase 1 (Generators run in parallel, 3-5x speedup over sequential). |
| **Reliability** | `LLMClient` enforces `max_retries=3` on API calls. |
| **Auditability** | Full request lifecycles are persisted in `logs/` as `.md` files. |
| **Model Config** | Centralized `MODEL_MAP` in `config.py` allows hot-swapping inference backends per agent role. |

---

## 🚀 Quick Start (Backend)

To run the core consensus engine without the web interface:

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
