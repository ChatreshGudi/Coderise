"""Offline checks for preventing unsupported or incomplete extraction acceptance."""
import copy
import sys
import unittest
import contextlib
import io
import json
import tempfile
from unittest.mock import patch
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from extract_techniques import digest, validate_extraction, accept_response, main


class ExtractionChecks(unittest.TestCase):
    def setUp(self):
        self.source = "Find the minimum number of edges on a path in an unweighted graph."
        self.output = {
            "status": "proposed", "task_summary": "Find an unweighted shortest path.",
            "techniques": [{"name": "Breadth-first search", "justification": "Explore vertices by distance.",
                            "evidence": "unweighted graph"}],
            "observations": ["Each traversed edge costs one."],
            "prerequisites": ["Graph traversal"], "time_complexity": "O(V+E)",
            "limitations": [],
        }

    def test_accepts_grounded_output_but_rejects_invented_evidence(self):
        validate_extraction(self.output, self.source)
        self.output["techniques"][0]["evidence"] = "All edge weights are negative."
        with self.assertRaisesRegex(ValueError, "literal substring"):
            validate_extraction(self.output, self.source)

    def test_abstention_requires_an_explanation(self):
        self.output.update(status="uncertain", techniques=[])
        with self.assertRaisesRegex(ValueError, "limitations"):
            validate_extraction(self.output, self.source)
        self.output["limitations"] = ["The graph constraints are missing."]
        validate_extraction(self.output, self.source)

    def test_json_escaped_math_is_grounded_in_original_field_text(self):
        evidence = r"n \leq 100"
        self.output["techniques"][0]["evidence"] = evidence
        validate_extraction(self.output, json.dumps({"description": "Constraint: " + evidence}))
        self.output["techniques"][0]["evidence"] = "description"
        with self.assertRaises(ValueError):
            validate_extraction(self.output, json.dumps({"description": "Constraint: " + evidence}))

    def test_parseable_but_token_limited_response_is_not_accepted(self):
        row = {"response": {"done": True, "done_reason": "length", "message": {
            "content": json.dumps(self.output)}}}
        accept_response(row, self.source)
        self.assertFalse(row["valid"])
        self.assertIn("token-limited", row["error"])
        row["response"]["done_reason"] = "stop"
        accept_response(row, self.source)
        self.assertTrue(row["valid"])
        self.assertNotIn("error", row)

    def test_incomplete_or_unexpected_output_is_rejected(self):
        for key in self.output:
            incomplete = copy.deepcopy(self.output)
            del incomplete[key]
            with self.assertRaises(ValueError):
                validate_extraction(incomplete, self.source)
        self.output["confidence"] = 1.0
        with self.assertRaises(ValueError):
            validate_extraction(self.output, self.source)

    def test_cache_fingerprint_is_order_invariant_and_content_sensitive(self):
        self.assertEqual(digest({"a": 1, "b": 2}), digest({"b": 2, "a": 1}))
        self.assertNotEqual(digest({"prompt": "v1"}), digest({"prompt": "v2"}))

    def test_resume_skips_completed_calls_and_model_change_invalidates_cache(self):
        manifest = {"size": 1, "problems": [{"key": "1/A", "name": "Fixture", "rating": 800,
                    "tags": ["graphs"], "source": json.dumps({"description": self.source}), "source_hash": digest(self.source),
                    "content_hash": "original"}]}
        calls = []
        model_digest = ["first"]

        def fake_api(base, route, payload=None):
            if route == "tags":
                return {"models": [{"name": "fixture", "digest": model_digest[0]}]}
            if route == "chat":
                calls.append(payload)
                return {"done": True, "done_reason": "stop", "message": {
                    "content": json.dumps(self.output)}}
            return {}

        with tempfile.TemporaryDirectory() as folder, patch("extract_techniques.make_sample", return_value=manifest), \
                patch("extract_techniques.api", side_effect=fake_api), \
                patch.object(sys, "argv", ["extract", "--models", "fixture", "--size", "1", "--folder", folder]), \
                contextlib.redirect_stdout(io.StringIO()):
            main()
            main()
            self.assertEqual(len(calls), 1)
            model_digest[0] = "updated-model"
            main()
            self.assertEqual(len(calls), 2)


if __name__ == "__main__":
    unittest.main()
