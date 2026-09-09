"""Regression coverage for every user-controlled field sent to HASA."""
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("harness_agent", Path(__file__).with_name("agent.py"))
agent = importlib.util.module_from_spec(spec)
spec.loader.exec_module(agent)

class HasaEgressTests(unittest.TestCase):
    def test_request_filename_and_evidence_are_masked(self):
        source = "test@example.org 010-1234-5678 900101-1234567"
        captured = []
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return b'{"choices":[{"message":{"content":"review"}}]}'
        def record(request, **kwargs):
            captured.append(json.loads(request.data))
            return Response()
        evidence = [{"file": source + ".txt", "line": 1, "text": source}]
        config = {"hasa_api_key":"test-key", "hasa_model":"test-model", "hasa_base_url":"https://example.invalid/v1"}
        with patch.object(agent.urlrequest, "urlopen", side_effect=record):
            summary, error = agent.call_hasa(source, evidence, config)
        self.assertEqual(summary, "review")
        self.assertIsNone(error)
        content = captured[0]["messages"][1]["content"]
        for raw in source.split(): self.assertNotIn(raw, content)
        for marker in ["[EMAIL]", "[PHONE]", "[ID]"]: self.assertEqual(content.count(marker), 3)
        self.assertEqual(evidence[0]["text"], source)

    def test_no_key_does_not_send(self):
        with patch.object(agent.urlrequest, "urlopen") as send:
            self.assertEqual(agent.call_hasa("task", [], {"hasa_api_key":""}), (None, None))
            send.assert_not_called()

if __name__ == "__main__": unittest.main()
