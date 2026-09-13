type RequestErrorInfo = {
  method?: string;
  path?: string;
};

type RequestErrorContext = {
  routePath?: string;
  routeType?: string;
  routerKind?: string;
  renderSource?: string;
  revalidateReason?: string;
};

type OtlpAttribute = {
  key: string;
  value: { stringValue: string };
};

function attribute(key: string, value: string | undefined): OtlpAttribute | null {
  if (!value) return null;
  return { key, value: { stringValue: value.slice(0, 256) } };
}

function collectorEndpoint() {
  const raw = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (!raw || !/^https?:\/\//.test(raw)) return null;
  return raw.replace(/\/$/, "");
}

export function register() {
  // Next.js calls register once per server process. Full automatic tracing can
  // later be enabled with an OTel SDK without changing this deployment contract.
}

export async function onRequestError(
  error: unknown,
  request: RequestErrorInfo,
  context: RequestErrorContext,
) {
  const endpoint = collectorEndpoint();
  if (!endpoint) return;

  const errorType = error instanceof Error ? error.name : "UnknownError";
  const attributes = [
    attribute("service.name", process.env.OTEL_SERVICE_NAME || "life-planning"),
    attribute("deployment.environment.name", process.env.NODE_ENV || "unknown"),
    attribute("service.version", process.env.APP_RELEASE || "unknown"),
    attribute("http.request.method", request.method),
    attribute("url.path", request.path),
    attribute("next.route_path", context.routePath),
    attribute("next.route_type", context.routeType),
    attribute("error.type", errorType),
  ].filter((item): item is OtlpAttribute => item !== null);

  const timeUnixNano = (BigInt(Date.now()) * 1_000_000n).toString();
  const body = {
    resourceLogs: [
      {
        resource: {
          attributes: attributes.slice(0, 3),
        },
        scopeLogs: [
          {
            scope: { name: "life-planning.next-request-errors" },
            logRecords: [
              {
                timeUnixNano,
                observedTimeUnixNano: timeUnixNano,
                severityNumber: 17,
                severityText: "ERROR",
                body: { stringValue: "next_request_error" },
                attributes: attributes.slice(3),
              },
            ],
          },
        ],
      },
    ],
  };

  try {
    await fetch(`${endpoint}/v1/logs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // Telemetry must never turn an application error into another user-facing error.
  }
}
