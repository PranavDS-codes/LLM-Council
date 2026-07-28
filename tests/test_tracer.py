from __future__ import annotations

import unittest
from unittest.mock import patch

from llm_council.tracer import WorkflowTracer


class FakeRunTree:
    created: list["FakeRunTree"] = []

    def __init__(self, **kwargs):
        self.kwargs = kwargs
        self.children: list[FakeRunTree] = []
        self.posted = False
        self.ended = None
        self.patched = False
        FakeRunTree.created.append(self)

    def create_child(self, **kwargs):
        child = FakeRunTree(**kwargs)
        self.children.append(child)
        return child

    def post(self):
        self.posted = True

    def end(self, **kwargs):
        self.ended = kwargs

    def patch(self):
        self.patched = True


class TracerTests(unittest.TestCase):
    def setUp(self):
        FakeRunTree.created.clear()

    def test_disabled_langsmith_tracer_creates_no_client_or_runs(self):
        with patch("llm_council.tracer.Client") as client:
            tracer = WorkflowTracer(enabled=False, langsmith_tracing=False)
            root = tracer.start_root("Council Meeting", {"query": "test"})
            root.finish(outputs={"final_report": "done"})

        client.assert_not_called()
        self.assertIsNone(root.tree)

    def test_langsmith_trace_keeps_visible_content_and_redacts_keys(self):
        with patch("llm_council.tracer.Client", return_value=object()) as client, patch(
            "llm_council.tracer.RunTree", FakeRunTree,
        ):
            tracer = WorkflowTracer(
                enabled=False,
                langsmith_tracing=True,
                langsmith_api_key="lsv2_pt_actual-key",
                langsmith_project="llm-souncil-prod",
            )
            root = tracer.start_root(
                "Council Meeting",
                {"query": "How does tracing work?", "custom_api_key": "nvapi-secret-key"},
            )
            child = tracer.start_llm(
                "Generator: The Academic",
                {"prompt": "Answer this", "authorization": "Bearer lsv2_pt_secret"},
                metadata={"model": "openai/gpt-oss-20b"},
            )
            child.mark_first_delta()
            child.finish(
                outputs={"visible_output": "A visible answer", "reasoning": "must not be supplied by callers"},
                usage={"prompt": 4, "completion": 6, "total": 10},
            )
            tracer.finish_root(outputs={"final_report": "A visible answer"}, usage={"prompt": 4, "completion": 6, "total": 10})

        client.assert_called_once()
        self.assertEqual(len(FakeRunTree.created), 2)
        root_tree, child_tree = FakeRunTree.created
        self.assertEqual(root_tree.kwargs["project_name"], "llm-souncil-prod")
        self.assertEqual(root_tree.kwargs["inputs"]["query"], "How does tracing work?")
        self.assertEqual(root_tree.kwargs["inputs"]["custom_api_key"], "[REDACTED]")
        self.assertEqual(child_tree.kwargs["inputs"]["authorization"], "[REDACTED]")
        self.assertTrue(root_tree.posted and child_tree.posted)
        self.assertTrue(root_tree.patched and child_tree.patched)
        self.assertEqual(child_tree.ended["outputs"]["visible_output"], "A visible answer")
        self.assertNotIn("reasoning", child_tree.ended["outputs"])
        self.assertEqual(child_tree.ended["metadata"]["usage"]["total"], 10)
        self.assertIn("duration_seconds", child_tree.ended["metadata"]["timing"])
        self.assertIn("time_to_first_delta_seconds", child_tree.ended["metadata"]["timing"])


if __name__ == "__main__":
    unittest.main()
