# SLO and alerting runbook

The current SLI is based on authenticated API metrics, not every public page request. Do not describe it as whole-site availability.

Initial service objectives for measurement:

- authenticated API availability target: 99.9% over 30 days;
- p95 authenticated API latency target: below 1.5 seconds during normal traffic;
- database readiness: 1 continuously except planned maintenance.

The Prometheus rules provide short-window alerts for target down, DB readiness, >5% 5xx ratio and p95 >1.5s. Alertmanager ships with a null receiver intentionally. Configure an operator-owned notifier privately before claiming external paging.
