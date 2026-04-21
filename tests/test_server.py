from __future__ import annotations

import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from llm_council import server


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
            response = self.client.post("/api/check-model", json={"model_id": "demo/model"})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["valid"])

    def test_check_credentials_maps_unexpected_errors(self):
        with patch.object(
            server.LLMClient,
            "check_connection",
            new=AsyncMock(side_effect=RuntimeError("network unavailable")),
        ):
            response = self.client.post("/api/check-credentials", json={"api_key": "demo"})
        self.assertEqual(response.status_code, 500)
        self.assertIn("network unavailable", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
