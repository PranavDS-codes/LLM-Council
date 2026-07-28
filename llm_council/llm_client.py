import asyncio
import json
import random
import re
from dataclasses import dataclass
from typing import AsyncIterator, Optional, Any

from openai import AsyncOpenAI, APIStatusError

from .settings import DEFAULT_MODEL_MAP, Settings, get_settings

UsageDict = dict[str, int]


@dataclass(frozen=True)
class StreamUpdate:
    """One upstream token delta or the terminal usage record for a request."""

    delta: str = ""
    reasoning: str = ""
    usage: UsageDict | None = None
    model: str | None = None

class LLMClient:
    def __init__(self, api_key: Optional[str] = None, settings: Optional[Settings] = None):
        self.settings = settings or get_settings()
        self.mock_mode = self.settings.use_mock_mode
        
        # Use a browser-provided NVIDIA key when available, otherwise use the server key.
        target_key = api_key if api_key else self.settings.nvidia_api_key
        
        self.openai_client = AsyncOpenAI(
            api_key=target_key,
            base_url=self.settings.nvidia_api_base_url,
        ) if not self.mock_mode else None
        
    async def generate(self, prompt: str, schema: Optional[Any] = None, model: Optional[str] = None):
        """
        Generates a response from the LLM. 
        Returns (content, usage_dict).
        """
        if self.mock_mode:
            return await self._mock_generate(prompt, schema)
        
        return await self._real_generate(prompt, schema, model)

    async def stream_generate(
        self,
        prompt: str,
        schema: Optional[Any] = None,
        model: Optional[str] = None,
        reasoning_effort: Optional[str] = None,
        include_reasoning: bool = False,
        fallback_model: Optional[str] = None,
        first_response_timeout_seconds: float | None = None,
    ) -> AsyncIterator[StreamUpdate]:
        """Yield true NVIDIA NIM deltas followed by terminal token usage."""
        if self.mock_mode:
            content, usage = await self._mock_generate(prompt, schema)
            for index in range(0, len(content), 48):
                await asyncio.sleep(0)
                yield StreamUpdate(delta=content[index:index + 48])
            yield StreamUpdate(usage=usage)
            return

        emitted_content = False
        try:
            async for update in self._stream_messages(
                [{"role": "user", "content": prompt}],
                schema=schema,
                model=model,
                reasoning_effort=reasoning_effort,
                include_reasoning=include_reasoning,
                first_response_timeout_seconds=first_response_timeout_seconds,
            ):
                emitted_content = emitted_content or bool(update.delta)
                yield update
        except RuntimeError:
            if not fallback_model or emitted_content or fallback_model == model:
                raise
            print(f"[WARNING] Falling back from {model} to {fallback_model} after no visible response.")
            async for update in self._stream_messages(
                [{"role": "user", "content": prompt}],
                schema=schema,
                model=fallback_model,
                reasoning_effort=reasoning_effort,
                include_reasoning=include_reasoning,
                first_response_timeout_seconds=first_response_timeout_seconds,
            ):
                yield update

    async def stream_chat(
        self,
        messages: list[dict[str, str]],
        model: str,
        reasoning_effort: str = "medium",
    ) -> AsyncIterator[StreamUpdate]:
        """Stream a follow-up conversation, including provider reasoning when supplied."""
        if self.mock_mode:
            yield StreamUpdate(reasoning="Reviewing the final council report before answering.")
            answer = f"Mock follow-up response to: {messages[-1]['content']}"
            for index in range(0, len(answer), 48):
                await asyncio.sleep(0)
                yield StreamUpdate(delta=answer[index:index + 48])
            yield StreamUpdate(usage={"prompt": 100, "completion": 50, "total": 150})
            return

        async for update in self._stream_messages(
            messages,
            model=model,
            reasoning_effort=reasoning_effort,
            include_reasoning=True,
        ):
            yield update

    async def stream_generate_race(
        self,
        prompt: str,
        schema: Optional[Any] = None,
        reasoning_effort: Optional[str] = None,
        models: tuple[str, str] = ("openai/gpt-oss-20b", "openai/gpt-oss-120b"),
        reasoning_efforts: dict[str, str] | None = None,
        include_reasoning: bool = False,
    ) -> AsyncIterator[StreamUpdate]:
        """Race two NIM models and keep the first one to emit answer content."""
        queue: asyncio.Queue[tuple[str, str, StreamUpdate | Exception | None]] = asyncio.Queue()

        async def pump(model: str) -> None:
            try:
                async for update in self.stream_generate(
                    prompt,
                    schema=schema,
                    model=model,
                    reasoning_effort=(reasoning_efforts or {}).get(model, reasoning_effort),
                    include_reasoning=include_reasoning,
                ):
                    await queue.put(("update", model, update))
            except Exception as exc:  # pragma: no cover - defensive async boundary
                await queue.put(("error", model, exc))
            finally:
                await queue.put(("done", model, None))

        tasks = {model: asyncio.create_task(pump(model)) for model in models}
        winner: str | None = None
        errors: list[Exception] = []
        remaining = len(tasks)
        try:
            while remaining:
                event_type, model, payload = await queue.get()
                if event_type == "done":
                    remaining -= 1
                    continue
                if event_type == "error":
                    errors.append(payload if isinstance(payload, Exception) else RuntimeError("Unknown NIM race failure"))
                    continue
                update = payload
                if not isinstance(update, StreamUpdate):
                    continue
                if winner is None:
                    # Reasoning alone is not enough to win: select the first usable answer stream.
                    if not update.delta:
                        if update.reasoning:
                            yield update
                        continue
                    winner = model
                    for candidate, task in tasks.items():
                        if candidate != winner:
                            task.cancel()
                if model == winner:
                    yield update

            if winner is None:
                details = "; ".join(str(error) for error in errors) or "both models completed without answer content"
                raise RuntimeError(f"NVIDIA NIM model race failed: {details}")
        finally:
            for task in tasks.values():
                if not task.done():
                    task.cancel()
            await asyncio.gather(*tasks.values(), return_exceptions=True)

    async def _stream_messages(
        self,
        messages: list[dict[str, str]],
        schema: Optional[Any] = None,
        model: Optional[str] = None,
        reasoning_effort: Optional[str] = None,
        include_reasoning: bool = False,
        first_response_timeout_seconds: float | None = None,
    ) -> AsyncIterator[StreamUpdate]:
        """Shared NVIDIA stream implementation for council work and follow-up chat."""

        target_model = model if model else DEFAULT_MODEL_MAP["generator_1"]
        kwargs: dict[str, Any] = {
            "model": target_model,
            "messages": messages,
            "stream": True,
            "stream_options": {"include_usage": True},
        }
        if reasoning_effort is not None:
            kwargs["reasoning_effort"] = reasoning_effort
        if schema:
            kwargs["response_format"] = {"type": "json_object"}
        timeout_seconds = first_response_timeout_seconds or self.settings.nvidia_first_response_timeout_seconds

        for attempt in range(4):
            emitted_content = False
            try:
                print("\n[DEBUG] Starting NVIDIA NIM stream:")
                print(f"Model: {target_model}")
                stream = await asyncio.wait_for(
                    self.openai_client.chat.completions.create(**kwargs),
                    timeout=timeout_seconds,
                )
                terminal_usage: UsageDict | None = None
                stream_iterator = stream.__aiter__()
                while True:
                    try:
                        chunk = await asyncio.wait_for(
                            anext(stream_iterator),
                            timeout=timeout_seconds,
                        ) if not emitted_content else await anext(stream_iterator)
                    except StopAsyncIteration:
                        break
                    if chunk.usage:
                        terminal_usage = {
                            "prompt": chunk.usage.prompt_tokens or 0,
                            "completion": chunk.usage.completion_tokens or 0,
                            "total": chunk.usage.total_tokens or 0,
                        }
                    if not chunk.choices:
                        continue
                    stream_delta = chunk.choices[0].delta
                    if include_reasoning:
                        # NVIDIA-compatible implementations use either field depending on runtime version.
                        reasoning = getattr(stream_delta, "reasoning_content", None) or getattr(stream_delta, "reasoning", None) or ""
                        if isinstance(reasoning, str) and reasoning:
                            yield StreamUpdate(reasoning=reasoning)
                    delta = stream_delta.content or ""
                    if delta:
                        emitted_content = True
                        yield StreamUpdate(delta=delta)
                yield StreamUpdate(usage=terminal_usage or {"prompt": 0, "completion": 0, "total": 0}, model=target_model)
                return
            except TimeoutError as exc:
                raise RuntimeError(
                    f"NVIDIA NIM did not produce a response from {target_model} within "
                    f"{timeout_seconds:.0f}s"
                ) from exc
            except APIStatusError as exc:
                print(f"[ERROR] NVIDIA NIM stream status error: {exc.status_code} - {exc}")
                if exc.status_code in [400, 422] and not emitted_content:
                    if "response_format" in kwargs:
                        print("[WARNING] Retrying NVIDIA NIM stream without response_format.")
                        del kwargs["response_format"]
                        continue
                    if "reasoning_effort" in kwargs:
                        # Preserve compatibility with custom NIM models that do not expose this control.
                        del kwargs["reasoning_effort"]
                        continue
                    if "stream_options" in kwargs:
                        # Some OpenAI-compatible NIM deployments omit usage support.
                        del kwargs["stream_options"]
                        continue
                retryable = exc.status_code in [429, 500, 502, 503, 504]
                if emitted_content or not retryable or attempt == 3:
                    raise RuntimeError(f"NVIDIA NIM stream failed: {exc}") from exc
            except Exception as exc:
                retryable = any(code in str(exc) for code in ("429", "500", "502", "503", "504"))
                if emitted_content or not retryable or attempt == 3:
                    raise RuntimeError(f"NVIDIA NIM stream failed: {exc}") from exc

            delay = 2 * (2 ** attempt) + (random.random() * 0.5)
            print(f"[WARNING] NVIDIA NIM stream retrying in {delay:.2f}s.")
            await asyncio.sleep(delay)

    async def _mock_generate(self, prompt: str, schema: Optional[Any] = None):
        await asyncio.sleep(0.5)
        
        usage = {"prompt": 100, "completion": 50, "total": 150}

        if "You are an impartial Senior Quality Assurance Judge" in prompt:
             agents = re.findall(r"--- RESPONSE ID: (.+?) ---", prompt)
             return json.dumps({
                "reviews": {agent: {"metric_scores": {"accuracy": 9, "relevance": 9, "completeness": 9, "clarity": 8, "practical_usefulness": 8}, "critique": "Strong overall response."} for agent in agents}
             }), usage
        elif "You are the Chief Solutions Architect" in prompt:
            return json.dumps({
                "structure": ["Introduction", "Analysis", "Conclusion"],
                "tone_guidelines": "Professional and objective",
                "missing_facts_to_add": ["Specific dates of events"],
                "critique_integration": "Incorporate feedback on brevity."
            }), usage
        elif "You are the Finalizer" in prompt:
            return "This is the final comprehensive answer generated by the Council.", usage
        else:
            return f"Mock Response to: {prompt[:50]}...", usage

    async def _real_generate(self, prompt: str, schema: Optional[Any] = None, model: Optional[str] = None):
        target_model = model if model else DEFAULT_MODEL_MAP["generator_1"]
        
        kwargs = {
            "model": target_model,
            "messages": [{"role": "user", "content": prompt}],
        }
        
        if schema:
            kwargs["response_format"] = {"type": "json_object"}
        
        max_retries = 3
        base_delay = 2
        
        for attempt in range(max_retries + 1):
            try:
                print("\n[DEBUG] Sending request to NVIDIA NIM:")
                print(f"Model: {kwargs.get('model')}")
                
                response = await self.openai_client.chat.completions.create(**kwargs)
                if not response or not response.choices:
                     raise ValueError("Received empty response or no choices from API")
                
                content = response.choices[0].message.content
                usage = {
                    "prompt": response.usage.prompt_tokens if response.usage else 0,
                    "completion": response.usage.completion_tokens if response.usage else 0,
                    "total": response.usage.total_tokens if response.usage else 0
                }
                return content, usage

            except APIStatusError as e:
                error_msg = str(e)
                print(f"[ERROR] API Status Error: {e.status_code} - {error_msg}")
                if hasattr(e, 'body'):
                    print(f"[ERROR BODY] {e.body}")

                # 422 FIX: If Unprocessable Content and we used json_object, try removing it.
                if e.status_code == 422 and "response_format" in kwargs:
                    print("[WARNING] 422 Unprocessable Content received. Retrying WITHOUT response_format constraint...")
                    del kwargs["response_format"]
                    continue

                if attempt == max_retries:
                    return f"Error calling NVIDIA NIM after {max_retries} retries: {error_msg}", {"prompt":0, "completion":0, "total":0}
                
                # Check for retryable codes
                # Note: 422 is usually permanent unless params change, so we only filtered it above.
                if e.status_code in [429, 500, 502, 503, 504]:
                     delay = base_delay * (2 ** attempt) + (random.random() * 0.5)
                     print(f"[Warning] Server error {e.status_code}. Retrying in {delay:.2f}s...")
                     await asyncio.sleep(delay)
                     continue
                
                # If not retryable or fixed
                return f"Error calling NVIDIA NIM: {error_msg}", {"prompt":0, "completion":0, "total":0}

            except Exception as e:
                error_msg = str(e)
                print(f"[ERROR] Generic API Call Failed: {error_msg}")
                if attempt == max_retries:
                    return f"Error calling NVIDIA NIM after {max_retries} retries: {error_msg}", {"prompt":0, "completion":0, "total":0}
                
                # Loose check for string-based errors (legacy or other libraries)
                if "429" in error_msg or "500" in error_msg or "503" in error_msg:
                    delay = base_delay * (2 ** attempt) + (random.random() * 0.5)
                    print(f"[Warning] Error encountered. Retrying in {delay:.2f}s...")
                    await asyncio.sleep(delay)
                    continue # Try again
                
                return f"Error calling NVIDIA NIM: {error_msg}", {"prompt":0, "completion":0, "total":0}

    async def check_connection(self, model: str) -> bool:
        """
        Validates the API connection and Model ID by making a minimal request.
        Raises specific exceptions on failure (handled by caller).
        """
        if self.mock_mode:
            await asyncio.sleep(0.5)
            # Simulate failure for specific mock models if needed, or always pass
            return True

        # Minimal generation request
        kwargs = {
            "model": model,
            "messages": [{"role": "user", "content": "Hi"}],
            # Keep connectivity checks inexpensive; this does not affect council responses.
            "max_tokens": 1,
        }
        
        # This will raise openai.APIStatusError if auth or model is invalid
        await self.openai_client.chat.completions.create(**kwargs)
        return True
