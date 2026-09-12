import { beforeEach, describe, expect, it } from "vitest";
import {
  observeHttpRequest,
  renderPrometheusMetrics,
  resetMetricsForTests,
} from "../../src/lib/metrics";

beforeEach(() => resetMetricsForTests());

describe("Prometheus metrics", () => {
  it("groups request paths so record IDs never become metric labels", () => {
    observeHttpRequest(
      new Request("https://example.test/api/entries/private-record-id", { method: "PATCH" }),
      200,
      0.12,
    );
    const output = renderPrometheusMetrics({
      databaseReady: true,
      databaseCheckDurationSeconds: 0.01,
      release: "life-planning:test-release",
    });
    expect(output).toContain(
      'life_planning_http_requests_total{method="PATCH",route="/api/entries",status="200"} 1',
    );
    expect(output).not.toContain("private-record-id");
  });

  it("emits cumulative latency buckets and runtime health metrics", () => {
    const request = new Request("https://example.test/api/ai/threads/thread-id", {
      method: "GET",
    });
    observeHttpRequest(request, 503, 0.08);
    observeHttpRequest(request, 200, 0.4);
    const output = renderPrometheusMetrics({
      databaseReady: false,
      databaseCheckDurationSeconds: 0.2,
    });
    expect(output).toContain("life_planning_database_ready 0");
    expect(output).toContain(
      'life_planning_http_request_duration_seconds_bucket{method="GET",route="/api/ai/threads",status="503",le="0.1"} 1',
    );
    expect(output).toContain(
      'life_planning_http_request_duration_seconds_bucket{method="GET",route="/api/ai/threads",status="200",le="0.25"} 0',
    );
    expect(output).toContain("life_planning_process_resident_memory_bytes");
  });
});
