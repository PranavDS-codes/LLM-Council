from __future__ import annotations

import json
import asyncio
from typing import Any, AsyncIterator, Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import APIStatusError, OpenAIError
from pydantic import BaseModel, Field, model_validator

from .llm_client import LLMClient
from .settings import DEFAULT_MODEL_MAP, PERSONA, get_settings
from .workflow import CouncilWorkflow, WorkflowRequest

settings = get_settings()
workflow = CouncilWorkflow(settings=settings)
app = FastAPI(title="LLM Council API")
SSE_HEARTBEAT_SECONDS = 10

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_allow_origins),
    allow_origin_regex=settings.cors_allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AgentDefinitionRequest(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=60)
    persona_instruction: str = Field(min_length=1, max_length=4000)
    model: str = Field(min_length=1, max_length=160)


class SummonRequest(BaseModel):
    query: str
    selected_agents: list[str]
    custom_api_key: Optional[str] = None
    custom_model_map: Optional[dict[str, str]] = None
    agents: Optional[list[AgentDefinitionRequest]] = Field(default=None, max_length=12)

    @model_validator(mode="after")
    def validate_agent_registry(self) -> "SummonRequest":
        if not self.agents:
            return self
        ids = [agent.id for agent in self.agents]
        names = [agent.name.casefold() for agent in self.agents]
        if len(ids) != len(set(ids)) or len(names) != len(set(names)):
            raise ValueError("Agent IDs and names must be unique")
        unknown = set(self.selected_agents) - set(ids)
        if unknown:
            raise ValueError("Selected agents must exist in the supplied agent registry")
        return self


class CheckModelRequest(BaseModel):
    model_id: str
    api_key: Optional[str] = None


class CheckCredentialsRequest(BaseModel):
    api_key: str


FOLLOW_UP_MODELS = {"openai/gpt-oss-20b", "openai/gpt-oss-120b"}


class FollowUpMessageRequest(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class FollowUpChatRequest(BaseModel):
    final_report: str = Field(min_length=1)
    messages: list[FollowUpMessageRequest]
    model: str
    custom_api_key: Optional[str] = None

    @model_validator(mode="after")
    def validate_conversation(self) -> "FollowUpChatRequest":
        if self.model not in FOLLOW_UP_MODELS:
            raise ValueError("Follow-up chat supports only openai/gpt-oss-20b and openai/gpt-oss-120b")
        if not self.messages or self.messages[-1].role != "user":
            raise ValueError("Follow-up chat must end with a user message")
        expected_role = "user"
        for message in self.messages:
            if message.role != expected_role:
                raise ValueError("Follow-up messages must alternate between user and assistant")
            expected_role = "assistant" if expected_role == "user" else "user"
        return self


def format_sse(event_type: str, data: dict[str, Any]) -> str:
    payload = dict(data)
    payload["type"] = event_type
    return f"event: {event_type}\ndata: {json.dumps(payload)}\n\n"


async def stream_workflow(request: SummonRequest) -> AsyncIterator[str]:
    event_iterator = workflow.stream(
        WorkflowRequest(
            query=request.query,
            selected_agents=request.selected_agents,
            custom_api_key=request.custom_api_key,
            custom_model_map=request.custom_model_map,
            custom_agents=[agent.model_dump() for agent in request.agents] if request.agents else None,
        )
    ).__aiter__()
    pending_event = asyncio.ensure_future(anext(event_iterator))
    try:
        while True:
            completed, _ = await asyncio.wait({pending_event}, timeout=SSE_HEARTBEAT_SECONDS)
            if not completed:
                # Keep Render and browser proxies from closing quiet streams while NIM reasons.
                yield ": keepalive\n\n"
                continue
            try:
                event = pending_event.result()
            except StopAsyncIteration:
                break
            event_type = event.get("type", "message")
            yield format_sse(event_type, event)
            pending_event = asyncio.ensure_future(anext(event_iterator))
    finally:
        if not pending_event.done():
            pending_event.cancel()
            await asyncio.gather(pending_event, return_exceptions=True)
        await event_iterator.aclose()


async def stream_follow_up_chat(request: FollowUpChatRequest) -> AsyncIterator[str]:
    """Stream a report-grounded conversation without exposing council internals as context."""
    client = LLMClient(api_key=request.custom_api_key, settings=settings)
    messages = [
        {
            "role": "system",
            "content": (
                "You are the council follow-up assistant. Answer using the final synthesized "
                "report below as your only council-source material. Do not claim access to "
                "generator drafts, peer reviews, scores, or the blueprint. If the report does "
                "not support an answer, say so clearly.\n\n"
                "FINAL SYNTHESIZED REPORT:\n"
                f"{request.final_report}"
            ),
        },
        *[message.model_dump() for message in request.messages],
    ]
    yield format_sse("chat_start", {"model": request.model})
    try:
        async for update in client.stream_chat(messages, model=request.model, reasoning_effort="medium"):
            if update.reasoning:
                yield format_sse("chat_reasoning_chunk", {"chunk": update.reasoning})
            if update.delta:
                yield format_sse("chat_content_chunk", {"chunk": update.delta})
            if update.usage is not None:
                yield format_sse("chat_done", {"model": request.model, "usage": update.usage})
    except Exception as exc:
        yield format_sse("chat_error", {"message": str(exc), "recoverable": True})


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/summon")
async def summon(request: SummonRequest) -> StreamingResponse:
    return StreamingResponse(
        stream_workflow(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/follow-up-chat")
async def follow_up_chat(request: FollowUpChatRequest) -> StreamingResponse:
    return StreamingResponse(
        stream_follow_up_chat(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/config-defaults")
async def get_config_defaults() -> dict[str, Any]:
    return {
        "model_map": DEFAULT_MODEL_MAP,
        "personas": list(PERSONA.keys()),
        "mock_mode": settings.use_mock_mode,
        "trace_logs_enabled": settings.enable_trace_logs,
    }


@app.post("/api/check-model")
async def check_model(request: CheckModelRequest) -> dict[str, Any]:
    if not request.model_id:
        raise HTTPException(status_code=400, detail="Model ID is empty")

    try:
        client = LLMClient(api_key=request.api_key, settings=settings)
        await client.check_connection(request.model_id)
        return {"valid": True, "message": "Model verified"}
    except OpenAIError as exc:
        raise HTTPException(
            status_code=503,
            detail="NVIDIA credentials are not configured on the server. Add NVIDIA_API_KEY in Render or provide a custom key in Config.",
        ) from exc
    except APIStatusError as exc:
        status = exc.status_code or 400
        error_body = exc.body or {}
        detail = error_body.get("error", {}).get("message", str(exc))
        raise HTTPException(status_code=status, detail=detail) from exc
    except Exception as exc:  # pragma: no cover - defensive API boundary
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.post("/api/check-credentials")
async def check_credentials(request: CheckCredentialsRequest) -> dict[str, Any]:
    if not request.api_key:
        raise HTTPException(status_code=400, detail="API Key is empty")

    test_model = DEFAULT_MODEL_MAP["generator_1"]

    try:
        client = LLMClient(api_key=request.api_key, settings=settings)
        await client.check_connection(test_model)
        return {"valid": True, "message": "Credentials verified"}
    except OpenAIError as exc:
        raise HTTPException(status_code=503, detail="Unable to initialize the NVIDIA client with this API key") from exc
    except APIStatusError as exc:
        status = exc.status_code or 400
        error_body = exc.body or {}
        detail = error_body.get("error", {}).get("message", str(exc))
        raise HTTPException(status_code=status, detail=detail) from exc
    except Exception as exc:  # pragma: no cover - defensive API boundary
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def run() -> None:
    import uvicorn

    uvicorn.run(
        "llm_council.server:app",
        host="0.0.0.0",
        port=settings.port,
        reload=settings.reload,
    )


if __name__ == "__main__":
    run()
