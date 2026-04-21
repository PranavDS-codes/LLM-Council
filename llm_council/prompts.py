from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"


def load_prompt(filename: str) -> str:
    path = PROMPTS_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Prompt file not found at: {path}")
    return path.read_text(encoding="utf-8")


@dataclass(frozen=True)
class PromptSet:
    generator: str
    critic: str
    architect: str
    finalizer: str


@lru_cache(maxsize=1)
def load_prompt_set() -> PromptSet:
    return PromptSet(
        generator=load_prompt("1_generator.txt"),
        critic=load_prompt("2_critic.txt"),
        architect=load_prompt("3_architect.txt"),
        finalizer=load_prompt("4_finalizer.txt"),
    )

