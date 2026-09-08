# Operations

Read-only checks on the VPS:

```sh
docker ps --filter name=life-planning-app
docker logs --tail 100 life-planning-app
curl --fail http://127.0.0.1:3217/api/ready
python3 /opt/life-planning/tools/operations.py smoke --url https://myplan.oxytumzone.com
free -m
df -h /
nginx -t
```

Liveness `/api/health` checks the process. Readiness `/api/ready` checks the database. Both return limited JSON with no infrastructure secrets. Public access and errors use separate `life-planning` Nginx log files. Docker logs rotate at three 10 MiB files.

The installed `/etc/cron.d/life-planning` runs the Python HTTPS smoke check every five minutes, saving the latest result to `/opt/life-planning/state/health.jsonl`. It also runs a database backup daily at 02:30 Asia/Dhaka, the server's verified timezone. Both jobs use their own locks. The cron definition is in `infra/cron/life-planning`. Health failures are recorded locally; external alert delivery is not configured.

If readiness fails, verify Neon availability, TLS, and the runtime environment file without printing it. If the app is ready locally but unavailable publicly, test the project vhost and certificate. Do not restart unrelated containers, replace the global Nginx configuration, or change shared firewall policies.

Certificates are issued through the existing Certbot webroot flow. Keep `/.well-known/acme-challenge/` available on HTTP. Renewal requires a tested graceful Nginx reload after certificates change; inspect the project's deploy hook and Certbot timer. The certificate and private key stay under `/etc/letsencrypt`, never source control.

Backups and release images are intentionally retained; there is no broad deletion or Docker pruning. Monitor disk space and review retention with the owner before removing older recovery material. The original running-container and service inventory is saved under `/opt/life-planning/backups` for comparison.
