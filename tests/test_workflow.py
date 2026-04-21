from __future__ import annotations

import asyncio
import json
import unittest
from pathlib import Path

from llm_council.prompts import load_prompt_set
from llm_council.settings import get_settings
from llm_council.workflow import CouncilWorkflow, WorkflowRequest, select_active_agents


class FakeClient:
    def __init__(self, responses):
        self.responses = list(responses)

    async def generate(self, *args, **kwargs):
        next_response = self.responses.pop(0)
        if isinstance(next_response, Exception):
            raise next_response
        return next_response


class WorkflowTests(unittest.IsolatedAsyncioTestCase):
    async def test_select_active_agents_filters_invalid_personas(self):
        self.assertEqual(
            select_active_agents(["The Academic", "Not Real", "The Skeptic"]),
            ["The Academic", "The Skeptic"],
        )

    async def test_load_prompt_set_reads_prompt_files(self):
        prompts = load_prompt_set()
        self.assertIn("persona_name", prompts.generator)
        self.assertIn("Chief Solutions Architect", prompts.architect)

    async def test_zero_valid_agents_emits_error_and_done(self):
        workflow = CouncilWorkflow(settings=get_settings())
        events = [event async for event in workflow.stream(WorkflowRequest(query="test", selected_agents=["Ghost"]))]  # noqa: E501
        self.assertEqual(events[0]["type"], "error")
        self.assertEqual(events[-1]["type"], "done")

    async def test_single_agent_path_auto_wins_critic_phase(self):
        fake_client = FakeClient(
            [
                ("Draft from The Academic", {"prompt": 10, "completion": 5, "total": 15}),
                (
                    json.dumps(
                        {
                            "structure": ["Intro", "Body", "Conclusion"],
                            "tone_guidelines": "Balanced",
                            "missing_facts_to_add": [],
                            "critique_integration": "Use the strongest points only.",
                        }
                    ),
                    {"prompt": 5, "completion": 5, "total": 10},
                ),
                ("Final answer", {"prompt": 4, "completion": 8, "total": 12}),
            ]
        )
        workflow = CouncilWorkflow(
            settings=get_settings(),
            client_factory=lambda **kwargs: fake_client,
        )

        events = [
            event
            async for event in workflow.stream(
                WorkflowRequest(query="Should we ship?", selected_agents=["The Academic"])
            )
        ]

        critic_event = next(event for event in events if event["type"] == "critic_result")
        self.assertEqual(critic_event["winner_id"], "The Academic")
        self.assertTrue(any(event["type"] == "finalizer_done" for event in events))

    async def test_generator_failure_emits_error(self):
        fake_client = FakeClient([RuntimeError("boom")])
        workflow = CouncilWorkflow(
            settings=get_settings(),
            client_factory=lambda **kwargs: fake_client,
        )

        events = [
            event
            async for event in workflow.stream(
                WorkflowRequest(query="Test", selected_agents=["The Academic"])
            )
        ]

        error_event = next(event for event in events if event["type"] == "error")
        self.assertIn("boom", error_event["message"])

    async def test_critic_parse_failure_emits_recoverable_error(self):
        fake_client = FakeClient(
            [
                ("A", {"prompt": 1, "completion": 1, "total": 2}),
                ("B", {"prompt": 1, "completion": 1, "total": 2}),
                ("not json", {"prompt": 1, "completion": 1, "total": 2}),
                (
                    json.dumps(
                        {
                            "structure": ["Intro"],
                            "tone_guidelines": "Calm",
                            "missing_facts_to_add": [],
                            "critique_integration": "Fallback",
                        }
                    ),
                    {"prompt": 1, "completion": 1, "total": 2},
                ),
                ("Final", {"prompt": 1, "completion": 1, "total": 2}),
            ]
        )
        workflow = CouncilWorkflow(
            settings=get_settings(),
            client_factory=lambda **kwargs: fake_client,
        )

        events = [
            event
            async for event in workflow.stream(
                WorkflowRequest(
                    query="Test",
                    selected_agents=["The Academic", "The Skeptic"],
                )
            )
        ]

        critic_error = next(
            event for event in events if event["type"] == "error" and event.get("phase") == "critic"
        )
        self.assertTrue(critic_error["recoverable"])
        self.assertTrue(any(event["type"] == "architect_result" for event in events))

    async def test_architect_parse_failure_uses_fallback_blueprint(self):
        fake_client = FakeClient(
            [
                ("A", {"prompt": 1, "completion": 1, "total": 2}),
                ("B", {"prompt": 1, "completion": 1, "total": 2}),
                (
                    json.dumps(
                        {
                            "winner_id": "The Academic",
                            "rankings": ["The Academic", "The Skeptic"],
                            "reasoning": "A wins",
                            "flaws": {"The Skeptic": "Too weak"},
                            "scores": {"The Academic": 9, "The Skeptic": 6},
                        }
                    ),
                    {"prompt": 1, "completion": 1, "total": 2},
                ),
                ("not json", {"prompt": 1, "completion": 1, "total": 2}),
                ("Final", {"prompt": 1, "completion": 1, "total": 2}),
            ]
        )
        workflow = CouncilWorkflow(
            settings=get_settings(),
            client_factory=lambda **kwargs: fake_client,
        )

        events = [
            event
            async for event in workflow.stream(
                WorkflowRequest(
                    query="Test",
                    selected_agents=["The Academic", "The Skeptic"],
                )
            )
        ]

        architect_error = next(
            event for event in events if event["type"] == "error" and event.get("phase") == "architect"
        )
        architect_result = next(event for event in events if event["type"] == "architect_result")
        self.assertTrue(architect_error["recoverable"])
        self.assertGreater(len(architect_result["structure"]), 0)


if __name__ == "__main__":
    unittest.main()
