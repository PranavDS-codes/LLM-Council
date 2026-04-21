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

        active_agents = select_active_agents(request.selected_agents)
        if not active_agents:
            yield {"type": "error", "message": "No valid agents selected.", "phase": "generator", "recoverable": False}
            yield {"type": "done", "total_execution_time": 0.0, "total_tokens": total_tokens}
            return

        client = self.client_factory(
            api_key=request.custom_api_key or self.settings.openrouter_api_key,
            settings=self.settings,
        )
        tracer.log_step(
            "Initialization",
            "System",
            request.query,
            f"Workflow started. Agents: {active_agents}. Mock mode: {self.settings.use_mock_mode}",
        )

        responses: list[dict[str, str]] = []
        generator_tasks: list[tuple[str, asyncio.Task[tuple[str, UsageDict]], str, float]] = []

        for index, agent_name in enumerate(active_agents):
            persona_desc = PERSONA[agent_name]["description"]
            prompt = self.prompts.generator.format(
                persona_name=agent_name,
                persona_instruction=persona_desc,
                query=request.query,
            )
            model_id = self._model_for(f"generator_{index + 1}", DEFAULT_MODEL_MAP["generator_1"], request.custom_model_map)
            yield {"type": "generator_start", "agent": agent_name, "model": model_id}
            started_at = time.perf_counter()
            task = asyncio.create_task(client.generate(prompt, model=model_id))
            generator_tasks.append((agent_name, task, model_id, started_at))

        try:
            for agent_name, task, model_id, started_at in generator_tasks:
                try:
                    response_content, usage = await task
                    duration = time.perf_counter() - started_at
                    add_usage(usage)
                    tracer.log_step("Generators", f"Generator-{agent_name}", request.query, response_content)
                    responses.append({"persona": agent_name, "content": response_content})
                    yield {"type": "generator_chunk", "agent": agent_name, "chunk": response_content}
                    yield {
                        "type": "generator_done",
                        "agent": agent_name,
                        "time_taken": duration,
                        "model": model_id,
                        "usage": usage,
                    }
                except Exception as exc:  # pragma: no cover - defensive async boundary
                    yield {
                        "type": "error",
                        "message": f"Agent {agent_name} failed: {exc}",
                        "phase": "generator",
                        "agent": agent_name,
                        "recoverable": True,
                    }
        except asyncio.CancelledError:
            for _, task, _, _ in generator_tasks:
                task.cancel()
            raise

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
            for batch_index, batch in enumerate(self._chunk_responses(responses, size=3), start=1):
                formatted_text = self._format_responses_for_critic(batch)
                prompt = self.prompts.critic.format(query=request.query, formatted_responses=formatted_text)
                critic_model = self._model_for("critic", DEFAULT_MODEL_MAP["critic"], request.custom_model_map)

                started_at = time.perf_counter()
                critic_json_str, usage = await client.generate(prompt, schema=CriticOutput, model=critic_model)
                duration = time.perf_counter() - started_at
                add_usage(usage)
                tracer.log_step("Critics", f"Critic-Batch-{batch_index}", prompt, critic_json_str)

                try:
                    critic_data = json.loads(critic_json_str)
                except json.JSONDecodeError:
                    yield {
                        "type": "error",
                        "message": "Critic returned invalid JSON. Falling back to the first response in the batch.",
                        "phase": "critic",
                        "recoverable": True,
                    }
                    best_response_content = batch[0]["content"]
                    continue

                critic_data["time_taken"] = duration
                critic_data["model"] = critic_model
                critic_data["usage"] = usage
                critique_results.append(critic_data)
                best_response_content = self._winner_content(batch, critic_data.get("winner_id", ""))
                yield {"type": "critic_result", **critic_data}
        else:
            auto_win = build_auto_win(active_agents[0])
            critique_results.append(auto_win)
            tracer.log_step("Critics", "Auto-Critic", "Single Agent", json.dumps(auto_win))
            yield {"type": "critic_result", **auto_win}

        architect_prompt = self.prompts.architect.format(
            query=request.query,
            best_response=best_response_content,
            critiques=json.dumps(critique_results) if critique_results else "[]",
        )
        architect_model = self._model_for("architect", DEFAULT_MODEL_MAP["architect"], request.custom_model_map)
        started_at = time.perf_counter()
        architect_raw, architect_usage = await client.generate(
            architect_prompt,
            schema=ArchitectBlueprint,
            model=architect_model,
        )
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
        started_at = time.perf_counter()
        final_output, final_usage = await client.generate(finalizer_prompt, model=finalizer_model)
        final_duration = time.perf_counter() - started_at
        add_usage(final_usage)
        tracer.log_step("Finalizer", "Finalizer-Writer", finalizer_prompt, final_output)

        for index in range(0, len(final_output), 120):
            yield {"type": "finalizer_chunk", "chunk": final_output[index:index + 120]}

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

