const HISTOGRAM_BUCKETS_SECONDS = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] as const;

type HttpSample = {
  count: number;
  durationSum: number;
  bucketCounts: number[];
};

type MetricsState = {
  http: Map<string, HttpSample>;
};

type MetricsGlobal = typeof globalThis & {
  __lifePlanningMetrics?: MetricsState;
};

const metricsGlobal = globalThis as MetricsGlobal;
const state =
  metricsGlobal.__lifePlanningMetrics ??
  (metricsGlobal.__lifePlanningMetrics = {
    http: new Map<string, HttpSample>(),
  });

function escapeLabel(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll('"', '\\"');
}

function requestGroup(url: string) {
  const pathname = new URL(url).pathname;
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "api") return "/other";
  if (parts.length <= 2) return `/${parts.join("/")}`;
  const depth = parts[1] === "auth" || parts[1] === "ai" ? 3 : 2;
  return `/${parts.slice(0, depth).join("/")}`;
}

function metricKey(method: string, route: string, status: number) {
  return `${method}\u0000${route}\u0000${status}`;
}

export function observeHttpRequest(
  request: Request,
  responseStatus: number,
  durationSeconds: number,
) {
  const method = request.method.toUpperCase();
  const route = requestGroup(request.url);
  const key = metricKey(method, route, responseStatus);
  const sample =
    state.http.get(key) ??
    ({
      count: 0,
      durationSum: 0,
      bucketCounts: HISTOGRAM_BUCKETS_SECONDS.map(() => 0),
    } satisfies HttpSample);
  sample.count += 1;
  sample.durationSum += Math.max(durationSeconds, 0);
  for (let index = 0; index < HISTOGRAM_BUCKETS_SECONDS.length; index += 1) {
    if (durationSeconds <= HISTOGRAM_BUCKETS_SECONDS[index]) sample.bucketCounts[index] += 1;
  }
  state.http.set(key, sample);
}

export type RuntimeMetricInput = {
  databaseReady: boolean;
  databaseCheckDurationSeconds: number;
  release?: string;
};

function labels(method: string, route: string, status: string) {
  return `method="${escapeLabel(method)}",route="${escapeLabel(route)}",status="${escapeLabel(status)}"`;
}

export function renderPrometheusMetrics(input: RuntimeMetricInput) {
  const lines: string[] = [];
  const memory = process.memoryUsage();
  const cpu = process.cpuUsage();
  const uptimeSeconds = process.uptime();
  const release = input.release?.trim() || "unknown";

  lines.push(
    "# HELP life_planning_build_info Static build and runtime information.",
    "# TYPE life_planning_build_info gauge",
    `life_planning_build_info{release="${escapeLabel(release)}",node_version="${escapeLabel(process.version)}"} 1`,
    "# HELP life_planning_process_uptime_seconds Process uptime in seconds.",
    "# TYPE life_planning_process_uptime_seconds gauge",
    `life_planning_process_uptime_seconds ${uptimeSeconds}`,
    "# HELP life_planning_process_resident_memory_bytes Resident memory used by the Node.js process.",
    "# TYPE life_planning_process_resident_memory_bytes gauge",
    `life_planning_process_resident_memory_bytes ${memory.rss}`,
    "# HELP life_planning_process_heap_used_bytes V8 heap currently in use.",
    "# TYPE life_planning_process_heap_used_bytes gauge",
    `life_planning_process_heap_used_bytes ${memory.heapUsed}`,
    "# HELP life_planning_process_heap_total_bytes Total V8 heap allocated.",
    "# TYPE life_planning_process_heap_total_bytes gauge",
    `life_planning_process_heap_total_bytes ${memory.heapTotal}`,
    "# HELP life_planning_process_external_memory_bytes Memory used by C++ objects bound to JavaScript.",
    "# TYPE life_planning_process_external_memory_bytes gauge",
    `life_planning_process_external_memory_bytes ${memory.external}`,
    "# HELP life_planning_process_cpu_user_seconds_total User CPU time consumed by this process.",
    "# TYPE life_planning_process_cpu_user_seconds_total counter",
    `life_planning_process_cpu_user_seconds_total ${cpu.user / 1_000_000}`,
    "# HELP life_planning_process_cpu_system_seconds_total System CPU time consumed by this process.",
    "# TYPE life_planning_process_cpu_system_seconds_total counter",
    `life_planning_process_cpu_system_seconds_total ${cpu.system / 1_000_000}`,
    "# HELP life_planning_database_ready Whether the application database readiness check succeeded.",
    "# TYPE life_planning_database_ready gauge",
    `life_planning_database_ready ${input.databaseReady ? 1 : 0}`,
    "# HELP life_planning_database_check_duration_seconds Duration of the database readiness query.",
    "# TYPE life_planning_database_check_duration_seconds gauge",
    `life_planning_database_check_duration_seconds ${Math.max(input.databaseCheckDurationSeconds, 0)}`,
    "# HELP life_planning_http_requests_total Authenticated application API requests handled by status.",
    "# TYPE life_planning_http_requests_total counter",
  );

  const entries = [...state.http.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [key, sample] of entries) {
    const [method, route, status] = key.split("\u0000");
    lines.push(
      `life_planning_http_requests_total{${labels(method, route, status)}} ${sample.count}`,
    );
  }

  lines.push(
    "# HELP life_planning_http_request_duration_seconds Authenticated application API request duration.",
    "# TYPE life_planning_http_request_duration_seconds histogram",
  );
  for (const [key, sample] of entries) {
    const [method, route, status] = key.split("\u0000");
    const base = labels(method, route, status);
    for (let index = 0; index < HISTOGRAM_BUCKETS_SECONDS.length; index += 1) {
      lines.push(
        `life_planning_http_request_duration_seconds_bucket{${base},le="${HISTOGRAM_BUCKETS_SECONDS[index]}"} ${sample.bucketCounts[index]}`,
      );
    }
    lines.push(
      `life_planning_http_request_duration_seconds_bucket{${base},le="+Inf"} ${sample.count}`,
      `life_planning_http_request_duration_seconds_sum{${base}} ${sample.durationSum}`,
      `life_planning_http_request_duration_seconds_count{${base}} ${sample.count}`,
    );
  }

  return `${lines.join("\n")}\n`;
}

export function resetMetricsForTests() {
  state.http.clear();
}
