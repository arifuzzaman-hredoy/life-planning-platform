"""Regression tests for observability activation readiness."""
import json
from unittest.mock import patch
import unittest

import observability_release


class ObservabilityReadinessTests(unittest.TestCase):
    def test_prometheus_query_retries_until_latest_sample_is_healthy(self):
        responses = [
            json.dumps({"data": {"result": []}}),
            json.dumps({"data": {"result": [{"value": [1, "0"]}]}}),
            json.dumps({"data": {"result": [{"value": [2, "1"]}]}}),
        ]
        with (
            patch.object(observability_release, "http_text", side_effect=responses) as request,
            patch.object(observability_release.time, "sleep") as sleep,
        ):
            observability_release.verify_prometheus_query(
                'up{job="life-planning"}', attempts=3, delay=0.01
            )

        self.assertEqual(request.call_count, 3)
        self.assertEqual(sleep.call_count, 2)

    def test_prometheus_query_fails_closed_after_retry_budget(self):
        unhealthy = json.dumps({"data": {"result": [{"value": [1, "0"]}]}})
        with (
            patch.object(observability_release, "http_text", return_value=unhealthy),
            patch.object(observability_release.time, "sleep") as sleep,
        ):
            with self.assertRaisesRegex(RuntimeError, "did not become healthy"):
                observability_release.verify_prometheus_query(
                    "life_planning_database_ready", attempts=2, delay=0.01
                )

        self.assertEqual(sleep.call_count, 1)


if __name__ == "__main__":
    unittest.main()
