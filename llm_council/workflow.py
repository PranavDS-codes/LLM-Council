from __future__ import annotations

import asyncio
import json
import time
from dataclasses import dataclass
from typing import Any, AsyncIterator, Callable, Optional

from .llm_client import LLMClient
from .prompts import PromptSet, load_prompt_set
from .schemas import ArchitectBlueprint, CriticOutput
from .settings import DEFAULT_MODEL_MAP, PERSONA, Settings, get_settings
from .tracer import WorkflowTracer


UsageDict = dict[str, int]
CouncilEvent = dict[str, Any]


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
                    ):
                        if update.delta:
                            content += update.delta
                            await generator_queue.put(("chunk", name, update.delta))
                        if update.usage is not None:
                            usage = update.usage
                    if not content.strip():
                        raise RuntimeError("The model completed without visible answer text. Try running this agent again.")
                    await generator_queue.put(("done", name, (content, usage, model, started)))
                except Exception as exc:  # pragma: no cover - defensive async boundary
                    await generator_queue.put(("error", name, exc))

            generator_tasks.append(asyncio.create_task(pump_generator()))

        try:
            unfinished = len(generator_tasks)
            while unfinished:
                event_type, agent_name, payload = await generator_queue.get()
                if event_type == "chunk":
                    yield {"type": "generator_chunk", "agent": agent_name, "chunk": payload}
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

        critique_results: list[dict[str, Any]] = []
        best_response_content = responses[0]["content"]

        if len(active_agents) > 1:
            # A single critic sees every draft, so it can select one council-wide winner.
            formatted_text = self._format_responses_for_critic(responses)
            prompt = self.prompts.critic.format(query=request.query, formatted_responses=formatted_text)
            critic_model = self._model_for("critic", DEFAULT_MODEL_MAP["critic"], request.custom_model_map)

            yield {"type": "critic_start", "model": critic_model, "batch": 1, "total_batches": 1}
            started_at = time.perf_counter()
            critic_chunks: list[str] = []
            usage: UsageDict = {"prompt": 0, "completion": 0, "total": 0}
            async for update in client.stream_generate(prompt, schema=CriticOutput, model=critic_model):
                if update.delta:
                    critic_chunks.append(update.delta)
                    yield {"type": "critic_chunk", "chunk": update.delta}
                if update.usage is not None:
                    usage = update.usage
            critic_json_str = "".join(critic_chunks)
            duration = time.perf_counter() - started_at
            add_usage(usage)
            tracer.log_step("Critics", "Critic-All-Responses", prompt, critic_json_str)

            try:
                critic_data = json.loads(critic_json_str)
            except json.JSONDecodeError:
                yield {
                    "type": "error",
                    "message": "Critic returned invalid JSON. Falling back to the first response.",
                    "phase": "critic",
                    "recoverable": True,
                }
            else:
                critic_data["time_taken"] = duration
                critic_data["model"] = critic_model
                critic_data["usage"] = usage
                critique_results.append(critic_data)
                best_response_content = self._winner_content(responses, critic_data.get("winner_id", ""))
                yield {"type": "critic_result", **critic_data}
            yield {"type": "critic_done"}
        else:
            auto_win = build_auto_win(active_agents[0]["name"])
            critique_results.append(auto_win)
            tracer.log_step("Critics", "Auto-Critic", "Single Agent", json.dumps(auto_win))
            yield {"type": "critic_result", **auto_win}
            yield {"type": "critic_done"}

        architect_prompt = self.prompts.architect.format(
            query=request.query,
            best_response=best_response_content,
            critiques=json.dumps(critique_results) if critique_results else "[]",
        )
        architect_model = self._model_for("architect", DEFAULT_MODEL_MAP["architect"], request.custom_model_map)
        yield {"type": "architect_start", "model": architect_model}
        started_at = time.perf_counter()
        architect_chunks: list[str] = []
        architect_usage: UsageDict = {"prompt": 0, "completion": 0, "total": 0}
        async for update in client.stream_generate(architect_prompt, schema=ArchitectBlueprint, model=architect_model):
            if update.delta:
                architect_chunks.append(update.delta)
                yield {"type": "architect_chunk", "chunk": update.delta}
            if update.usage is not None:
                architect_usage = update.usage
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
        architect_data["model"] = architect_model
        architect_data["usage"] = architect_usage
        yield {"type": "architect_result", **architect_data}

        finalizer_prompt = self.prompts.finalizer.format(
            query=request.query,
            blueprint=architect_raw,
            context=best_response_content,
        )
        finalizer_model = self._model_for("finalizer", DEFAULT_MODEL_MAP["finalizer"], request.custom_model_map)
        yield {"type": "finalizer_start", "model": finalizer_model}
        started_at = time.perf_counter()
        final_chunks: list[str] = []
        final_usage: UsageDict = {"prompt": 0, "completion": 0, "total": 0}
        async for update in client.stream_generate(finalizer_prompt, model=finalizer_model):
            if update.delta:
                final_chunks.append(update.delta)
                yield {"type": "finalizer_chunk", "chunk": update.delta}
            if update.usage is not None:
                final_usage = update.usage
        final_output = "".join(final_chunks)
        final_duration = time.perf_counter() - started_at
        add_usage(final_usage)
        tracer.log_step("Finalizer", "Finalizer-Writer", finalizer_prompt, final_output)

        yield {
            "type": "finalizer_done",
            "time_taken": final_duration,
            "model": finalizer_model,
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
    def _winner_content(batch: list[dict[str, str]], winner_id: str) -> str:
        for response in batch:
            if response["persona"] in winner_id:
                return response["content"]
        return batch[0]["content"]
