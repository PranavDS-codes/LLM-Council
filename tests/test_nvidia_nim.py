from __future__ import annotations

import types
import unittest
from unittest.mock import AsyncMock, patch

from llm_council.llm_client import LLMClient
from llm_council.settings import DEFAULT_MODEL_MAP, get_settings


class NvidiaNimTests(unittest.IsolatedAsyncioTestCase):
    def test_default_model_map_routes_generators_and_council_roles(self):
        self.assertEqual(
            {DEFAULT_MODEL_MAP[f"generator_{index}"] for index in range(1, 6)},
            {"openai/gpt-oss-20b"},
        )
        self.assertEqual(
            {DEFAULT_MODEL_MAP[role] for role in ("critic", "architect", "finalizer")},
            {"openai/gpt-oss-120b"},
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


if __name__ == "__main__":
    unittest.main()
