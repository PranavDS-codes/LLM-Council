from __future__ import annotations

import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from openai import OpenAIError

from llm_council import server
from llm_council.llm_client import StreamUpdate


class ServerTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(server.app)

    def test_config_defaults_returns_personas_and_models(self):
        response = self.client.get("/api/config-defaults")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("model_map", payload)
        self.assertIn("personas", payload)

    def test_check_model_returns_success_when_connection_passes(self):
        with patch.object(server.LLMClient, "check_connection", new=AsyncMock(return_value=True)):
            response = self.client.post(
                "/api/check-model",
                json={"model_id": "demo/model", "api_key": "nvapi-test-key"},
            )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["valid"])

    def test_check_model_reports_missing_server_credentials_clearly(self):
        with patch.object(server, "LLMClient", side_effect=OpenAIError("Missing credentials")):
            response = self.client.post("/api/check-model", json={"model_id": "openai/gpt-oss-20b"})
        self.assertEqual(response.status_code, 503)
        self.assertIn("NVIDIA credentials", response.json()["detail"])

    def test_check_credentials_maps_unexpected_errors(self):
        with patch.object(
            server.LLMClient,
            "check_connection",
            new=AsyncMock(side_effect=RuntimeError("network unavailable")),
        ):
            response = self.client.post("/api/check-credentials", json={"api_key": "demo"})
        self.assertEqual(response.status_code, 500)
        self.assertIn("network unavailable", response.json()["detail"])

    def test_summon_rejects_duplicate_or_unknown_custom_agents(self):
        response = self.client.post(
            "/api/summon",
            json={
                "query": "Test",
                "selected_agents": ["missing"],
                "agents": [{"id": "agent-1", "name": "Custom", "persona_instruction": "Be concise.", "model": "openai/gpt-oss-20b"}],
            },
        )
        self.assertEqual(response.status_code, 422)

    def test_follow_up_chat_restricts_models_and_context_to_final_report_and_chat(self):
        seen_messages = []

        async def fake_stream_chat(_client, messages, model, reasoning_effort):
            seen_messages.extend(messages)
            self.assertEqual(model, "openai/gpt-oss-20b")
            self.assertEqual(reasoning_effort, "medium")
            yield StreamUpdate(reasoning="Reviewing")
            yield StreamUpdate(delta="Answer")
            yield StreamUpdate(usage={"prompt": 3, "completion": 2, "total": 5})

        with patch.object(server.LLMClient, "stream_chat", new=fake_stream_chat):
            response = self.client.post("/api/follow-up-chat", json={
                "final_report": "Final consensus only.",
                "messages": [
                    {"role": "user", "content": "What is the conclusion?"},
                    {"role": "assistant", "content": "It is cautious."},
                    {"role": "user", "content": "Why?"},
                ],
                "model": "openai/gpt-oss-20b",
            })

        self.assertEqual(response.status_code, 200)
        self.assertIn("event: chat_reasoning_chunk", response.text)
        self.assertIn("event: chat_content_chunk", response.text)
        self.assertIn("event: chat_done", response.text)
        self.assertIn("Final consensus only.", seen_messages[0]["content"])
        self.assertNotIn("DRAFT_SECRET", seen_messages[0]["content"])
        self.assertEqual([message["role"] for message in seen_messages[1:]], ["user", "assistant", "user"])

        invalid = self.client.post("/api/follow-up-chat", json={
            "final_report": "Final consensus only.",
            "messages": [{"role": "user", "content": "Hello"}],
            "model": "nvidia/unsupported",
        })
        self.assertEqual(invalid.status_code, 422)

    def test_summon_stream_sends_keepalives_while_waiting_for_workflow_events(self):
        async def delayed_events(_request):
            await asyncio.sleep(0.02)
            yield {"type": "done", "total_execution_time": 0, "total_tokens": {"prompt": 0, "completion": 0, "total": 0}}

        async def collect() -> list[str]:
            messages = []
            request = server.SummonRequest(query="Test", selected_agents=["The Academic"])
            with patch.object(server.workflow, "stream", side_effect=delayed_events), patch.object(server, "SSE_HEARTBEAT_SECONDS", 0.001):
                async for message in server.stream_workflow(request):
                    messages.append(message)
            return messages

        messages = asyncio.run(collect())
        self.assertTrue(any(message.startswith(": keepalive") for message in messages))
        self.assertTrue(any("event: done" in message for message in messages))


if __name__ == "__main__":
    unittest.main()
