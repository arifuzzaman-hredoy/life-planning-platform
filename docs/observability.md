# Observability

## Phase 1A: metrics foundation

This phase adds a private Prometheus scrape endpoint and an isolated Prometheus/Grafana stack. It deliberately does not expose Prometheus or Grafana on the public Nginx virtual host. Both UIs bind only to VPS loopback and should be reached through an SSH tunnel.

The application exposes `/api/metrics` only when a valid `METRICS_TOKEN` bearer token is supplied. Nginx explicitly returns 404 for the public `/api/metrics` path. Prometheus reaches the application directly through the existing `life-planning` Docker network and reads the bearer token from a read-only file.

Metrics include:

- application and database readiness;
- database readiness query duration;
- Node.js uptime, memory and CPU counters;
- the immutable application image/release label;
- authenticated API request counts by bounded route group, method and status;
- authenticated API request latency histogram.

The route label is intentionally grouped rather than using raw request URLs, preventing IDs and other high-cardinality values from becoming Prometheus labels.

## Production preparation

Do not place secret values in the repository. On the VPS, create one random value and use the same value for both the application environment and Prometheus bearer-token file:

```sh
set -eu
umask 077
TOKEN="$(openssl rand -hex 32)"
printf '%s\n' "$TOKEN" > /opt/life-planning/shared/metrics.token
if grep -q '^METRICS_TOKEN=' /opt/life-planning/shared/app.env; then
  sed -i "s/^METRICS_TOKEN=.*/METRICS_TOKEN=$TOKEN/" /opt/life-planning/shared/app.env
else
  printf '\nMETRICS_TOKEN=%s\n' "$TOKEN" >> /opt/life-planning/shared/app.env
fi
unset TOKEN
chmod 600 /opt/life-planning/shared/metrics.token /opt/life-planning/shared/app.env
```

Create `/opt/life-planning/shared/observability.env` from `infra/observability/observability.env.example` and set a unique Grafana password. Keep it mode `0600`.

Copy the committed `infra/observability` directory to `/opt/life-planning/observability`, then validate before starting it:

```sh
cd /opt/life-planning/observability
docker compose --env-file /opt/life-planning/shared/observability.env config --quiet
docker compose --env-file /opt/life-planning/shared/observability.env pull
docker compose --env-file /opt/life-planning/shared/observability.env up -d
docker compose --env-file /opt/life-planning/shared/observability.env ps
```

The application container must be recreated after `METRICS_TOKEN` is added to `app.env`, because Node reads the env file at process start. Use the existing verified Jenkins release/deploy path; do not manually replace the production application container.

## Access

Prometheus binds to `127.0.0.1:9097` and Grafana to `127.0.0.1:3300` on the VPS. Example tunnels from the operator machine:

```sh
ssh -L 3300:127.0.0.1:3300 -L 9097:127.0.0.1:9097 YOUR_VPS_USER@YOUR_VPS_HOST
```

Then browse to `http://127.0.0.1:3300`. The provisioned `Life Planning — Production Overview` dashboard should appear automatically.

## Resource policy

This VPS already runs other workloads. Phase 1A therefore caps each observability service at 384 MiB and 0.35 CPU, retains only seven days or 512 MiB of Prometheus data, rotates Docker logs, and does not install Kubernetes. If the host shows memory pressure after deployment, stop the observability Compose project rather than changing unrelated containers.

## Verification

Run these checks from the VPS after the application and observability stack are up:

```sh
curl -fsS http://127.0.0.1:9097/-/ready
curl -fsS http://127.0.0.1:3300/api/health
curl -fsS https://myplan.oxytumzone.com/api/metrics -o /dev/null -w '%{http_code}\n'
docker compose --env-file /opt/life-planning/shared/observability.env -f /opt/life-planning/observability/compose.yaml ps
```

The public metrics request must return `404`. In Prometheus, `up{job="life-planning"}` must be `1` and `life_planning_database_ready` must be `1`.

## Scope boundary

Phase 1A is metrics only. Centralized logs, tracing, alert routing, SLOs and external notification channels are intentionally deferred to later phases so each layer can be validated independently.

See `docs/DEVSECOPS_SRE_ROADMAP.md` for the staged DevSecOps/SRE/Kubernetes maturity plan and activation boundaries.
