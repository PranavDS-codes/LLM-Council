from __future__ import annotations

import types
import unittest
from unittest.mock import AsyncMock, patch

from llm_council.llm_client import LLMClient, StreamUpdate
from llm_council.settings import DEFAULT_MODEL_MAP, get_settings


class NvidiaNimTests(unittest.IsolatedAsyncioTestCase):
    def test_default_model_map_routes_generators_and_council_roles(self):
        self.assertEqual(
            {DEFAULT_MODEL_MAP[f"generator_{index}"] for index in range(1, 6)},
            {"openai/gpt-oss-20b"},
        )
        self.assertEqual(
            {DEFAULT_MODEL_MAP[role] for role in ("critic", "architect", "finalizer")},
            {"openai/gpt-oss-20b"},
        )

    def test_client_uses_nvidia_api_settings(self):
        with patch.dict(
            "os.environ",
            {
                "NVIDIA_API_KEY": "nvapi-server-key",
                "NVIDIA_API_BASE_URL": "https://example.nvidia.test/v1",
            },
            clear=False,
        ):
            settings = get_settings()

        with patch("llm_council.llm_client.AsyncOpenAI") as async_openai:
            LLMClient(settings=settings)

        async_openai.assert_called_once_with(
            api_key="nvapi-server-key",
            base_url="https://example.nvidia.test/v1",
        )

    async def test_connection_request_has_no_provider_specific_headers(self):
        client = LLMClient(api_key="nvapi-test-key", settings=get_settings())
        request = AsyncMock()
        request.return_value = types.SimpleNamespace()
        client.openai_client = types.SimpleNamespace(
            chat=types.SimpleNamespace(completions=types.SimpleNamespace(create=request)),
        )

        await client.check_connection("openai/gpt-oss-20b")

        self.assertEqual(request.await_args.kwargs["model"], "openai/gpt-oss-20b")
        self.assertNotIn("extra_headers", request.await_args.kwargs)
        self.assertEqual(request.await_args.kwargs["max_tokens"], 1)

    async def test_stream_generate_preserves_deltas_and_terminal_usage(self):
        client = LLMClient(api_key="nvapi-test-key", settings=get_settings())

        async def chunks():
            yield types.SimpleNamespace(
                choices=[types.SimpleNamespace(delta=types.SimpleNamespace(content="Hello "))],
                usage=None,
            )
            yield types.SimpleNamespace(
                choices=[types.SimpleNamespace(delta=types.SimpleNamespace(content="world"))],
                usage=None,
            )
            yield types.SimpleNamespace(
                choices=[],
                usage=types.SimpleNamespace(prompt_tokens=12, completion_tokens=4, total_tokens=16),
            )

        request = AsyncMock(return_value=chunks())
        client.openai_client = types.SimpleNamespace(
            chat=types.SimpleNamespace(completions=types.SimpleNamespace(create=request)),
        )

        updates = [update async for update in client.stream_generate("Hello", model="openai/gpt-oss-20b")]

        self.assertEqual("".join(update.delta for update in updates), "Hello world")
        self.assertEqual(updates[-1].usage, {"prompt": 12, "completion": 4, "total": 16})
        self.assertTrue(request.await_args.kwargs["stream"])
        self.assertNotIn("extra_headers", request.await_args.kwargs)

    async def test_stream_chat_preserves_reasoning_and_does_not_set_a_token_cap(self):
        client = LLMClient(api_key="nvapi-test-key", settings=get_settings())

        async def chunks():
            yield types.SimpleNamespace(
                choices=[types.SimpleNamespace(delta=types.SimpleNamespace(content=None, reasoning_content="Checking the report."))],
                usage=None,
            )
            yield types.SimpleNamespace(
                choices=[types.SimpleNamespace(delta=types.SimpleNamespace(content="Grounded answer.", reasoning_content=None))],
                usage=None,
            )
            yield types.SimpleNamespace(choices=[], usage=types.SimpleNamespace(prompt_tokens=8, completion_tokens=5, total_tokens=13))

        request = AsyncMock(return_value=chunks())
        client.openai_client = types.SimpleNamespace(chat=types.SimpleNamespace(completions=types.SimpleNamespace(create=request)))

        updates = [update async for update in client.stream_chat(
            [{"role": "system", "content": "Final report"}, {"role": "user", "content": "Explain it"}],
            model="openai/gpt-oss-20b",
        )]

        self.assertEqual("".join(update.reasoning for update in updates), "Checking the report.")
        self.assertEqual("".join(update.delta for update in updates), "Grounded answer.")
        self.assertEqual(request.await_args.kwargs["reasoning_effort"], "medium")
        self.assertNotIn("max_tokens", request.await_args.kwargs)

if __name__ == "__main__":
    unittest.main()
