from __future__ import annotations

import datetime
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from langsmith import Client
from langsmith.run_trees import RunTree


UsageDict = dict[str, int]


def _redact(value: Any) -> Any:
    """Keep application content while excluding credentials from all trace sinks."""
    if isinstance(value, dict):
        return {
            key: "[REDACTED]" if re.search(r"(?:api[_-]?key|authorization)", key, re.IGNORECASE) else _redact(item)
            for key, item in value.items()
            if key.casefold() not in {"reasoning", "reasoning_content", "thinking"}
        }
    if isinstance(value, list):
        return [_redact(item) for item in value]
    if isinstance(value, tuple):
        return tuple(_redact(item) for item in value)
    if isinstance(value, str):
        value = re.sub(r"nvapi-[A-Za-z0-9_-]+", "[REDACTED_NVIDIA_KEY]", value)
        return re.sub(r"lsv2_pt_[A-Za-z0-9_-]+", "[REDACTED_LANGSMITH_KEY]", value)
    return value


@dataclass
class TraceRun:
    tree: RunTree | None
    started_at: float
    first_delta_at: float | None = None
    closed: bool = False

    def mark_first_delta(self) -> None:
        if self.first_delta_at is None:
            self.first_delta_at = time.perf_counter()

    def finish(
        self,
        *,
        outputs: dict[str, Any] | None = None,
        usage: UsageDict | None = None,
        error: Exception | str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        if self.closed:
            return
        self.closed = True
        if self.tree is None:
            return
        timing = {"duration_seconds": round(time.perf_counter() - self.started_at, 4)}
        if self.first_delta_at is not None:
            timing["time_to_first_delta_seconds"] = round(self.first_delta_at - self.started_at, 4)
        run_metadata = {"timing": timing}
        if usage is not None:
            run_metadata["usage"] = _redact(usage)
        if metadata:
            run_metadata.update(_redact(metadata))
        try:
            self.tree.end(
                outputs=_redact(outputs or {}),
                error=_redact(str(error)) if error else None,
                metadata=run_metadata,
            )
            self.tree.patch()
        except Exception as exc:  # pragma: no cover - tracing must never break application work
            print(f"[WARNING] LangSmith trace finalization failed: {exc}")


class WorkflowTracer:
    """Writes optional local traces and a best-effort LangSmith parent/child run tree."""

    def __init__(
        self,
        enabled: bool = True,
        log_dir: str | Path = "logs",
        *,
        langsmith_tracing: bool = False,
        langsmith_api_key: str | None = None,
        langsmith_endpoint: str = "https://api.smith.langchain.com",
        langsmith_project: str = "llm-souncil-prod",
    ) -> None:
        self.enabled = enabled
        self.file = None
        self.filename = None
        self.root: TraceRun | None = None
        self.langsmith_project = langsmith_project
        self.langsmith_client: Client | None = None
        if langsmith_tracing and langsmith_api_key:
            try:
                self.langsmith_client = Client(api_url=langsmith_endpoint, api_key=langsmith_api_key)
            except Exception as exc:  # pragma: no cover - defensive configuration boundary
                print(f"[WARNING] LangSmith tracing disabled: {exc}")

        if not self.enabled:
            return
        log_path = Path(log_dir)
        log_path.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        self.filename = str(log_path / f"trace_{timestamp}.md")
        self.file = open(self.filename, "w", encoding="utf-8")
        self.file.write(f"# Flight Recorder Trace: {timestamp}\n\n")
        self.file.write("This file logs the entire lifecycle of the request.\n\n")
        self.file.flush()

    @property
    def langsmith_enabled(self) -> bool:
        return self.langsmith_client is not None

    def start_root(self, name: str, inputs: dict[str, Any], *, metadata: dict[str, Any] | None = None) -> TraceRun:
        if self.root is not None:
            return self.root
        self.root = self._start_run(name, "chain", inputs, metadata=metadata)
        return self.root

    def start_llm(self, name: str, inputs: dict[str, Any], *, metadata: dict[str, Any] | None = None) -> TraceRun:
        return self._start_run(name, "llm", inputs, metadata=metadata)

    def _start_run(
        self,
        name: str,
        run_type: str,
        inputs: dict[str, Any],
        *,
        metadata: dict[str, Any] | None,
    ) -> TraceRun:
        started_at = time.perf_counter()
        if self.langsmith_client is None:
            return TraceRun(None, started_at)
        try:
            if self.root is None:
                tree = RunTree(
                    name=name,
                    run_type=run_type,
                    inputs=_redact(inputs),
                    project_name=self.langsmith_project,
                    extra={"metadata": _redact(metadata or {})},
                    ls_client=self.langsmith_client,
                )
            else:
                tree = self.root.tree.create_child(  # type: ignore[union-attr]
                    name=name,
                    run_type=run_type,
                    inputs=_redact(inputs),
                    extra={"metadata": _redact(metadata or {})},
                )
            tree.post()
            return TraceRun(tree, started_at)
        except Exception as exc:  # pragma: no cover - tracing must never break application work
            print(f"[WARNING] LangSmith trace creation failed: {exc}")
            return TraceRun(None, started_at)

    def finish_root(
        self,
        *,
        outputs: dict[str, Any] | None = None,
        usage: UsageDict | None = None,
        error: Exception | str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        if self.root is not None:
            self.root.finish(outputs=outputs, usage=usage, error=error, metadata=metadata)

    def close_unfinished(self, reason: str) -> None:
        """Best-effort close for cancelled SSE streams and abandoned generators."""
        if self.root is not None and not self.root.closed:
            self.root.finish(error=reason)
        self.finalize()

    def log_step(self, phase_name: str, agent_tag: str, input_data: str, output_data: str) -> None:
        if not self.enabled or not self.file:
            return
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        entry = (
            f"## Phase: {phase_name}\n"
            f"**Timestamp:** {timestamp}\n"
            f"**Agent:** {agent_tag}\n\n"
            "### Inputs\n"
            f"```text\n{_redact(input_data)}\n```\n\n"
            "### Outputs\n"
            f"```json\n{_redact(output_data)}\n```\n"
            "---\n\n"
        )
        self.file.write(entry)
        self.file.flush()

    def finalize(self) -> str | None:
        if not self.enabled or not self.file:
            return self.filename
        self.file.write("\n# End of Trace\n")
        self.file.close()
        self.file = None
        return self.filename

    def __del__(self) -> None:  # pragma: no cover - last-resort cleanup for abandoned async streams
        try:
            self.close_unfinished("Council stream ended before completion.")
        except Exception:
            pass
