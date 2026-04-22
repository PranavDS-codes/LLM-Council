from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Final

from dotenv import load_dotenv

PACKAGE_DIR = Path(__file__).resolve().parent

load_dotenv()
load_dotenv(PACKAGE_DIR / ".env")


def _env_flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_csv(name: str, default: tuple[str, ...]) -> tuple[str, ...]:
    raw = os.getenv(name)
    if raw is None:
        return default
    values = tuple(part.strip() for part in raw.split(",") if part.strip())
    return values or default


def _env_optional(name: str) -> str | None:
    raw = os.getenv(name)
    if raw is None:
        return None
    value = raw.strip()
    return value or None


PERSONA: Final[dict[str, dict[str, str]]] = {
    "The Academic": {
        "description": "You are a rigorous researcher. Focus on definitions, historical context, theoretical frameworks, and first principles. Cite logical fallacies if present. Use formal, precise language. Prioritize accuracy and depth over simplicity."
    },
    "The Layman": {
        "description": "You are a regular person who values common sense. You hate jargon. You want to know: 'How does this actually affect my daily life?' or 'What is the bottom line?' Use analogies, simple metaphors, and plain English. Be skeptical of over-complication."
    },
    "The Skeptic": {
        "description": "You are a critical thinker who looks for the catch. Question the premise of the query. Look for edge cases, security risks, potential downsides, and hidden costs. Assume that if something sounds too good to be true, it probably is. Focus on risk mitigation."
    },
    "The Futurist": {
        "description": "You are a visionary focused on the long-term horizon (5-50 years). Discuss trends, exponential technologies, and second-order effects. Ignore current constraints; focus on what is *possible*. Be optimistic but acknowledge disruptive potential."
    },
    "The Ethical Guardian": {
        "description": "You are a moral philosopher and safety advocate. Focus on societal impact, bias, fairness, environmental cost, and human well-being. Ask 'Should we do this?' rather than 'Can we do this?' Prioritize safety and responsibility above efficiency."
    },
}

DEFAULT_MODEL_MAP: Final[dict[str, str]] = {
    "generator_1": "nvidia/nemotron-nano-12b-v2-vl:free",
    "generator_2": "nvidia/nemotron-3-nano-30b-a3b:free",
    "generator_3": "z-ai/glm-4.5-air:free",
    "generator_4": "stepfun/step-3.5-flash:free",
    "generator_5": "qwen/qwen3-next-80b-a3b-instruct:free",
    "critic": "nvidia/nemotron-3-super-120b-a12b:free",
    "architect": "minimax/minimax-m2.5:free",
    "finalizer": "minimax/minimax-m2.5:free",
}


@dataclass(frozen=True)
class Settings:
    use_mock_mode: bool
    openrouter_api_key: str | None
    openrouter_base_url: str
    openrouter_site_url: str
    openrouter_app_name: str
    cors_allow_origins: tuple[str, ...]
    cors_allow_origin_regex: str | None
    enable_trace_logs: bool
    trace_log_dir: Path
    port: int
    reload: bool


def get_settings() -> Settings:
    return Settings(
        use_mock_mode=_env_flag("USE_MOCK_MODE", False),
        openrouter_api_key=os.getenv("OPENROUTER_API_KEY"),
        openrouter_base_url=os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
        openrouter_site_url=os.getenv("OPENROUTER_SITE_URL", "https://llm-council.local"),
        openrouter_app_name=os.getenv("OPENROUTER_APP_NAME", "LLM Council"),
        cors_allow_origins=_env_csv(
            "CORS_ALLOW_ORIGINS",
            ("http://localhost:3000", "http://127.0.0.1:3000"),
        ),
        cors_allow_origin_regex=_env_optional("CORS_ALLOW_ORIGIN_REGEX"),
        enable_trace_logs=_env_flag("ENABLE_TRACE_LOGS", False),
        trace_log_dir=Path(os.getenv("TRACE_LOG_DIR", str(PACKAGE_DIR / "logs"))),
        port=int(os.getenv("PORT", "8000")),
        reload=_env_flag("RELOAD", False),
    )
