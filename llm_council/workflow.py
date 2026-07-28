from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass
from typing import Any, AsyncIterator, Callable, Optional

from .llm_client import LLMClient
from .prompts import PromptSet, load_prompt_set
from .schemas import ArchitectBlueprint, CriticBatchOutput
from .settings import DEFAULT_MODEL_MAP, PERSONA, Settings, get_settings
from .tracer import WorkflowTracer


UsageDict = dict[str, int]
CouncilEvent = dict[str, Any]
SCORE_METRICS = ("accuracy", "relevance", "completeness", "clarity", "practical_usefulness")
CONFIGURED_PHASE_TIMEOUT_SECONDS = 30.0


@dataclass(frozen=True)
class WorkflowRequest:
    query: str
    selected_agents: list[str]
    custom_api_key: str | None = None
    custom_model_map: dict[str, str] | None = None
    custom_agents: list[dict[str, str]] | None = None


def select_active_agents(selected_agents: list[str]) -> list[str]:
    return [agent for agent in selected_agents if agent in PERSONA]


def build_auto_win(agent_name: str) -> dict[str, Any]:
    return {
        "winner_id": agent_name,
        "rankings": [agent_name],
        "reasoning": "Solo execution - automatic winner.",
        "scores": {agent_name: 10},
        "flaws": {agent_name: "N/A"},
        "time_taken": 0.0,
        "model": "N/A",
        "usage": {"prompt": 0, "completion": 0, "total": 0},
    }


def fallback_architect_blueprint() -> dict[str, Any]:
    return {
        "structure": [
            "Open with the clearest answer.",
            "Support the answer with the strongest validated points.",
            "Close with a concise practical takeaway.",
        ],
        "tone_guidelines": "Clear, balanced, and trustworthy.",
        "missing_facts_to_add": [],
        "critique_integration": "Use only the strongest consistent claims and avoid unsupported detail.",
    }


def balanced_critic_batches(responses: list[dict[str, str]]) -> list[list[dict[str, str]]]:
    """Split drafts into balanced, ordered groups of no more than three."""
    critic_count = max(1, (len(responses) + 2) // 3)
    base_size, remainder = divmod(len(responses), critic_count)
    batches: list[list[dict[str, str]]] = []
    cursor = 0
    for index in range(critic_count):
        size = base_size + (1 if index < remainder else 0)
        batches.append(responses[cursor:cursor + size])
        cursor += size
    return batches


def parse_critic_batch(raw: str, expected_agents: set[str]) -> dict[str, dict[str, Any]]:
    payload = CriticBatchOutput.model_validate_json(raw)
    reviews: dict[str, dict[str, Any]] = {}
    for agent_name in expected_agents:
        review = payload.reviews.get(agent_name)
        if review is None or set(review.metric_scores) != set(SCORE_METRICS):
            raise ValueError(f"Critic omitted a complete scorecard for {agent_name}")
        scores = {metric: int(review.metric_scores[metric]) for metric in SCORE_METRICS}
        if any(score < 1 or score > 10 for score in scores.values()):
            raise ValueError(f"Critic returned an out-of-range score for {agent_name}")
        if not review.critique.strip():
            raise ValueError(f"Critic omitted a critique for {agent_name}")
        reviews[agent_name] = {"metric_scores": scores, "critique": review.critique.strip()}
    return reviews


def aggregate_critic_reviews(
    reviews: dict[str, dict[str, Any]],
    responses: list[dict[str, str]],
) -> dict[str, Any]:
    original_order = {response["persona"]: index for index, response in enumerate(responses)}
    scorecards = {
        agent: {
            **review,
            "average": round(sum(review["metric_scores"].values()) / len(SCORE_METRICS), 2),
        }
        for agent, review in reviews.items()
    }
    rankings = sorted(
        scorecards,
        key=lambda agent: (-scorecards[agent]["average"], -scorecards[agent]["metric_scores"]["accuracy"], original_order[agent]),
    )
    finalists = rankings[:2]
    return {
        "winner_id": " & ".join(finalists),
        "rankings": rankings,
        "reasoning": "Finalists are selected deterministically by five-metric average, accuracy, then generator order.",
        "flaws": {agent: scorecard["critique"] for agent, scorecard in scorecards.items()},
        "scores": {agent: scorecard["average"] for agent, scorecard in scorecards.items()},
        "scorecards": scorecards,
        "finalists": finalists,
    }


class CouncilWorkflow:
    def __init__(
        self,
        *,
        settings: Settings | None = None,
        prompts: PromptSet | None = None,
        client_factory: Callable[..., LLMClient] = LLMClient,
        tracer_factory: Callable[..., WorkflowTracer] = WorkflowTracer,
    ) -> None:
        self.settings = settings or get_settings()
        self.prompts = prompts or load_prompt_set()
        self.client_factory = client_factory
        self.tracer_factory = tracer_factory

    def _model_for(self, role: str, fallback: str, overrides: Optional[dict[str, str]]) -> str:
        if overrides and role in overrides and overrides[role]:
            return overrides[role]
        return DEFAULT_MODEL_MAP.get(role, fallback)

    @staticmethod
    def _configured_phase_model(role: str, overrides: Optional[dict[str, str]]) -> str | None:
        """Return an explicit model selection saved from Config."""
        if not overrides:
            return None
        value = overrides.get(role, "").strip()
        return value or None

    @staticmethod
    def _reasoning_effort_for(role: str) -> str:
        return {
            "critic": "high",
            "architect": "medium",
            "finalizer": "low",
        }.get(role, "low")

    def _phase_stream(
        self,
        client: LLMClient,
        prompt: str,
        schema: Any,
        role: str,
        overrides: Optional[dict[str, str]],
    ) -> tuple[str, AsyncIterator[Any]]:
        """Use one configured or default model; council phases never run a model race."""
        configured_model = self._configured_phase_model(role, overrides)
        model = configured_model or DEFAULT_MODEL_MAP[role]
        return model, client.stream_generate(
            prompt,
            schema=schema,
            model=model,
            reasoning_effort=self._reasoning_effort_for(role),
            include_reasoning=True,
            first_response_timeout_seconds=CONFIGURED_PHASE_TIMEOUT_SECONDS if configured_model else None,
        )

    def _new_tracer(self) -> WorkflowTracer:
        return self.tracer_factory(
            enabled=self.settings.enable_trace_logs,
            log_dir=self.settings.trace_log_dir,
        )

    async def stream(self, request: WorkflowRequest) -> AsyncIterator[CouncilEvent]:
        tracer = self._new_tracer()
        workflow_start = time.perf_counter()
        total_tokens: UsageDict = {"prompt": 0, "completion": 0, "total": 0}

        def add_usage(usage: UsageDict) -> None:
            total_tokens["prompt"] += usage.get("prompt", 0)
            total_tokens["completion"] += usage.get("completion", 0)
            total_tokens["total"] += usage.get("total", 0)

        if request.custom_agents:
            available_agents = {agent["id"]: agent for agent in request.custom_agents}
            active_agents = [available_agents[agent_id] for agent_id in request.selected_agents if agent_id in available_agents]
        else:
            active_agents = [
                {
                    "id": agent_name,
                    "name": agent_name,
                    "persona_instruction": PERSONA[agent_name]["description"],
                    "model": self._model_for(f"generator_{index + 1}", DEFAULT_MODEL_MAP["generator_1"], request.custom_model_map),
                }
                for index, agent_name in enumerate(select_active_agents(request.selected_agents))
            ]
        if not active_agents:
            yield {"type": "error", "message": "No valid agents selected.", "phase": "generator", "recoverable": False}
            yield {"type": "done", "total_execution_time": 0.0, "total_tokens": total_tokens}
            return

        if (
            self.client_factory is LLMClient
            and not self.settings.use_mock_mode
            and not (request.custom_api_key or self.settings.nvidia_api_key)
        ):
            yield {
                "type": "error",
                "message": "NVIDIA_API_KEY is not configured. Add an NVIDIA API key to .env or provide one in Config.",
                "phase": "generator",
                "recoverable": False,
            }
            tracer.finalize()
            yield {"type": "done", "total_execution_time": time.perf_counter() - workflow_start, "total_tokens": total_tokens}
            return

        client = self.client_factory(
            api_key=request.custom_api_key or self.settings.nvidia_api_key,
            settings=self.settings,
        )
        tracer.log_step(
            "Initialization",
            "System",
            request.query,
            f"Workflow started. Agents: {[agent['name'] for agent in active_agents]}. Mock mode: {self.settings.use_mock_mode}",
        )

        responses_by_agent: dict[str, str] = {}
        generator_tasks: list[asyncio.Task[None]] = []
        generator_queue: asyncio.Queue[tuple[str, str, Any]] = asyncio.Queue()

        for index, agent in enumerate(active_agents):
            agent_name = agent["name"]
            persona_desc = agent["persona_instruction"]
            prompt = self.prompts.generator.format(
                persona_name=agent_name,
                persona_instruction=persona_desc,
                query=request.query,
            )
            model_id = agent["model"]
            yield {"type": "generator_start", "agent": agent_name, "model": model_id}
            started_at = time.perf_counter()
            async def pump_generator(
                name: str = agent_name,
                model: str = model_id,
                started: float = started_at,
                generator_prompt: str = prompt,
            ) -> None:
                content = ""
                usage: UsageDict = {"prompt": 0, "completion": 0, "total": 0}
                try:
                    async for update in client.stream_generate(
                        generator_prompt,
                        model=model,
                        # Keep internal reasoning economical without imposing an output ceiling.
                        reasoning_effort="low",
                        include_reasoning=True,
                    ):
                        reasoning = getattr(update, "reasoning", "")
                        if reasoning:
                            await generator_queue.put(("thinking", name, reasoning))
                        if update.delta:
                            content += update.delta
                            await generator_queue.put(("chunk", name, update.delta))
                        if update.usage is not None:
                            usage = update.usage
                    if not content.strip():
                        raise RuntimeError("The model completed without visible answer text. Try running this agent again.")
                    await generator_queue.put(("thinking_done", name, None))
                    await generator_queue.put(("done", name, (content, usage, model, started)))
                except Exception as exc:  # pragma: no cover - defensive async boundary
                    await generator_queue.put(("thinking_done", name, None))
                    await generator_queue.put(("error", name, exc))

            generator_tasks.append(asyncio.create_task(pump_generator()))

        try:
            unfinished = len(generator_tasks)
            while unfinished:
                event_type, agent_name, payload = await generator_queue.get()
                if event_type == "chunk":
                    yield {"type": "generator_chunk", "agent": agent_name, "chunk": payload}
                elif event_type == "thinking":
                    yield {"type": "generator_thinking", "agent": agent_name, "chunk": payload}
                elif event_type == "thinking_done":
                    yield {"type": "generator_thinking_done", "agent": agent_name}
                elif event_type == "done":
                    response_content, usage, model_id, started_at = payload
                    duration = time.perf_counter() - started_at
                    add_usage(usage)
                    responses_by_agent[agent_name] = response_content
                    tracer.log_step("Generators", f"Generator-{agent_name}", request.query, response_content)
                    yield {
                        "type": "generator_done", "agent": agent_name, "time_taken": duration,
                        "model": model_id, "usage": usage,
                    }
                    unfinished -= 1
                else:
                    exc = payload
                    yield {
                        "type": "error",
                        "message": f"Agent {agent_name} failed: {exc}",
                        "phase": "generator",
                        "agent": agent_name,
                        "recoverable": True,
                    }
                    unfinished -= 1
        except asyncio.CancelledError:
            for task in generator_tasks:
                task.cancel()
            await asyncio.gather(*generator_tasks, return_exceptions=True)
            raise

        responses = [
            {"persona": agent_name, "content": responses_by_agent[agent_name]}
            for agent in active_agents
            if agent["name"] in responses_by_agent
            for agent_name in [agent["name"]]
        ]

        if not responses:
            yield {
                "type": "error",
                "message": "All generators failed before the council could produce a draft.",
                "phase": "generator",
                "recoverable": False,
            }
            tracer.finalize()
            yield {
                "type": "done",
                "total_execution_time": time.perf_counter() - workflow_start,
                "total_tokens": total_tokens,
            }
            return

        critic_model = self._configured_phase_model("critic", request.custom_model_map) or DEFAULT_MODEL_MAP["critic"]
        critic_batches = balanced_critic_batches(responses)
        critic_queue: asyncio.Queue[tuple[str, int, Any]] = asyncio.Queue()
        critic_tasks: list[asyncio.Task[None]] = []

        for batch_index, batch in enumerate(critic_batches, start=1):
            formatted_text = self._format_responses_for_critic(batch)
            prompt = self.prompts.critic.format(query=request.query, formatted_responses=formatted_text)
            yield {"type": "critic_start", "model": critic_model, "batch": batch_index, "total_batches": len(critic_batches)}

            async def pump_critic(
                index: int = batch_index,
                critic_prompt: str = prompt,
                critic_batch: list[dict[str, str]] = batch,
            ) -> None:
                chunks: list[str] = []
                usage: UsageDict = {"prompt": 0, "completion": 0, "total": 0}
                started = time.perf_counter()
                model_used = critic_model
                try:
                    _model_label, stream = self._phase_stream(
                        client, critic_prompt, CriticBatchOutput, "critic", request.custom_model_map,
                    )
                    async for update in stream:
                        if getattr(update, "model", None):
                            model_used = update.model
                        reasoning = getattr(update, "reasoning", "")
                        if reasoning:
                            await critic_queue.put(("thinking", index, reasoning))
                        if update.delta:
                            chunks.append(update.delta)
                            await critic_queue.put(("chunk", index, update.delta))
                        if update.usage is not None:
                            usage = update.usage
                    await critic_queue.put(("done", index, (critic_batch, critic_prompt, "".join(chunks), usage, started, model_used)))
                except Exception as exc:  # pragma: no cover - defensive async boundary
                    await critic_queue.put(("error", index, exc))

            critic_tasks.append(asyncio.create_task(pump_critic()))

        collected_reviews: dict[str, dict[str, Any]] = {}
        critic_usage: UsageDict = {"prompt": 0, "completion": 0, "total": 0}
        critic_time = 0.0
        critic_models_used: list[str] = []
        unfinished_critics = len(critic_tasks)
        try:
            while unfinished_critics:
                event_type, batch_index, payload = await critic_queue.get()
                if event_type == "chunk":
                    yield {"type": "critic_chunk", "batch": batch_index, "chunk": payload}
                    continue
                if event_type == "thinking":
                    yield {"type": "critic_thinking", "batch": batch_index, "chunk": payload}
                    continue
                if event_type == "error":
                    yield {"type": "error", "message": f"Critic {batch_index} failed: {payload}", "phase": "critic", "recoverable": True}
                    yield {"type": "critic_thinking_done", "batch": batch_index}
                    unfinished_critics -= 1
                    continue

                batch, prompt, critic_json, usage, started, model_used = payload
                duration = time.perf_counter() - started
                critic_time += duration
                critic_models_used.append(model_used)
                add_usage(usage)
                for key in critic_usage:
                    critic_usage[key] += usage.get(key, 0)
                tracer.log_step("Critics", f"Critic-Batch-{batch_index}", prompt, critic_json)
                try:
                    collected_reviews.update(parse_critic_batch(critic_json, {item["persona"] for item in batch}))
                except (ValueError, TypeError) as exc:
                    yield {"type": "error", "message": f"Critic {batch_index} returned invalid scorecards: {exc}", "phase": "critic", "recoverable": True}
                yield {"type": "critic_thinking_done", "batch": batch_index}
                unfinished_critics -= 1
        except asyncio.CancelledError:
            for task in critic_tasks:
                task.cancel()
            await asyncio.gather(*critic_tasks, return_exceptions=True)
            raise

        critic_data = aggregate_critic_reviews(collected_reviews, responses)
        finalists = critic_data["finalists"]
        if not finalists:
            finalists = [response["persona"] for response in responses[:2]]
            critic_data["finalists"] = finalists
            critic_data["winner_id"] = " & ".join(finalists)
            critic_data["reasoning"] = "No critic batch produced valid scorecards; finalists use generator order as a safe fallback."
            yield {"type": "error", "message": "No valid critic scorecards were available; using the first drafts as finalists.", "phase": "critic", "recoverable": True}
        critic_data["time_taken"] = critic_time
        critic_data["model"] = critic_models_used[0] if critic_models_used else critic_model
        critic_data["usage"] = critic_usage
        yield {"type": "critic_result", **critic_data}
        yield {"type": "critic_done"}

        finalist_responses = [response for response in responses if response["persona"] in finalists]
        finalist_context = self._format_finalists(finalist_responses, critic_data.get("scorecards", {}))

        architect_prompt = self.prompts.architect.format(
            query=request.query,
            finalist_responses=finalist_context,
            critiques=json.dumps(critic_data),
        )
        architect_model, architect_stream = self._phase_stream(
            client, architect_prompt, ArchitectBlueprint, "architect", request.custom_model_map,
        )
        yield {"type": "architect_start", "model": architect_model}
        started_at = time.perf_counter()
        architect_chunks: list[str] = []
        architect_usage: UsageDict = {"prompt": 0, "completion": 0, "total": 0}
        architect_model_used = architect_model
        async for update in architect_stream:
            if getattr(update, "model", None):
                architect_model_used = update.model
            reasoning = getattr(update, "reasoning", "")
            if reasoning:
                yield {"type": "architect_thinking", "chunk": reasoning}
            if update.delta:
                architect_chunks.append(update.delta)
                yield {"type": "architect_chunk", "chunk": update.delta}
            if update.usage is not None:
                architect_usage = update.usage
        yield {"type": "architect_thinking_done"}
        architect_raw = "".join(architect_chunks)
        architect_duration = time.perf_counter() - started_at
        add_usage(architect_usage)
        tracer.log_step("Architect", "Architect-Planner", architect_prompt, architect_raw)

        try:
            architect_data = json.loads(architect_raw)
        except json.JSONDecodeError:
            yield {
                "type": "error",
                "message": "Architect returned invalid JSON. Using a safe fallback blueprint.",
                "phase": "architect",
                "recoverable": True,
            }
            architect_data = fallback_architect_blueprint()
            architect_raw = json.dumps(architect_data)

        architect_data["time_taken"] = architect_duration
        architect_data["model"] = architect_model_used
        architect_data["usage"] = architect_usage
        yield {"type": "architect_result", **architect_data}

        finalizer_prompt = self.prompts.finalizer.format(
            query=request.query,
            blueprint=architect_raw,
            context=finalist_context,
        )
        finalizer_model, finalizer_stream = self._phase_stream(
            client, finalizer_prompt, None, "finalizer", request.custom_model_map,
        )
        yield {"type": "finalizer_start", "model": finalizer_model}
        started_at = time.perf_counter()
        final_chunks: list[str] = []
        final_usage: UsageDict = {"prompt": 0, "completion": 0, "total": 0}
        finalizer_model_used = finalizer_model
        async for update in finalizer_stream:
            if getattr(update, "model", None):
                finalizer_model_used = update.model
            reasoning = getattr(update, "reasoning", "")
            if reasoning:
                yield {"type": "finalizer_thinking", "chunk": reasoning}
            if update.delta:
                final_chunks.append(update.delta)
                yield {"type": "finalizer_chunk", "chunk": update.delta}
            if update.usage is not None:
                final_usage = update.usage
        yield {"type": "finalizer_thinking_done"}
        final_output = "".join(final_chunks)
        final_duration = time.perf_counter() - started_at
        add_usage(final_usage)
        tracer.log_step("Finalizer", "Finalizer-Writer", finalizer_prompt, final_output)

        yield {
            "type": "finalizer_done",
            "time_taken": final_duration,
            "model": finalizer_model_used,
            "usage": final_usage,
        }

        tracer.finalize()
        yield {
            "type": "done",
            "total_execution_time": time.perf_counter() - workflow_start,
            "total_tokens": total_tokens,
        }

    @staticmethod
    def _chunk_responses(responses: list[dict[str, str]], *, size: int) -> list[list[dict[str, str]]]:
        return [responses[index:index + size] for index in range(0, len(responses), size)]

    @staticmethod
    def _format_responses_for_critic(responses: list[dict[str, str]]) -> str:
        formatted = []
        for response in responses:
            formatted.append(f"--- RESPONSE ID: {response['persona']} ---\n{response['content']}\n")
        return "\n".join(formatted)

    @staticmethod
    def _format_finalists(
        responses: list[dict[str, str]],
        scorecards: dict[str, dict[str, Any]],
    ) -> str:
        formatted = []
        for response in responses:
            agent = response["persona"]
            formatted.append(
                f"--- FINALIST: {agent} ---\n"
                f"SCORECARD: {json.dumps(scorecards.get(agent, {}))}\n"
                f"DRAFT:\n{response['content']}\n"
            )
        return "\n".join(formatted)

    @staticmethod
    def _winner_content(batch: list[dict[str, str]], winner_id: str) -> str:
        for response in batch:
            if response["persona"] in winner_id:
                return response["content"]
        return batch[0]["content"]
