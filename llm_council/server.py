from __future__ import annotations

import json
from typing import Any, AsyncIterator, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from openai import APIStatusError
from pydantic import BaseModel

from .llm_client import LLMClient
from .settings import DEFAULT_MODEL_MAP, PERSONA, get_settings
from .workflow import CouncilWorkflow, WorkflowRequest

settings = get_settings()
workflow = CouncilWorkflow(settings=settings)
app = FastAPI(title="LLM Council API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_allow_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SummonRequest(BaseModel):
    query: str
    selected_agents: list[str]
    custom_api_key: Optional[str] = None
    custom_model_map: Optional[dict[str, str]] = None


class CheckModelRequest(BaseModel):
    model_id: str
    api_key: Optional[str] = None


class CheckCredentialsRequest(BaseModel):
    api_key: str


def format_sse(event_type: str, data: dict[str, Any]) -> str:
    payload = dict(data)
    payload["type"] = event_type
    return f"event: {event_type}\ndata: {json.dumps(payload)}\n\n"


async def stream_workflow(request: SummonRequest) -> AsyncIterator[str]:
    async for event in workflow.stream(
        WorkflowRequest(
            query=request.query,
            selected_agents=request.selected_agents,
            custom_api_key=request.custom_api_key,
            custom_model_map=request.custom_model_map,
        )
    ):
        event_type = event.get("type", "message")
        yield format_sse(event_type, event)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/summon")
async def summon(request: SummonRequest) -> StreamingResponse:
    return StreamingResponse(stream_workflow(request), media_type="text/event-stream")


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

    client = LLMClient(api_key=request.api_key, settings=settings)
    try:
        await client.check_connection(request.model_id)
        return {"valid": True, "message": "Model verified"}
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

    client = LLMClient(api_key=request.api_key, settings=settings)
    test_model = DEFAULT_MODEL_MAP["generator_1"]

    try:
        await client.check_connection(test_model)
        return {"valid": True, "message": "Credentials verified"}
    except APIStatusError as exc:
        status = exc.status_code or 400
        error_body = exc.body or {}
        detail = error_body.get("error", {}).get("message", str(exc))
        raise HTTPException(status_code=status, detail=detail) from exc
    except Exception as exc:  # pragma: no cover - defensive API boundary
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def run() -> None:
    import uvicorn

    uvicorn.run("llm_council.server:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    run()
