# Disaster recovery runbook

## Objectives

- RPO target: no more than 24 hours while daily backups are the only automated backup schedule.
- RTO target: 60 minutes for an operator-led restore. This remains a target until a timed drill proves it.

## Drill

Use a separate empty database and a separate target environment file. Verify the dump checksum and archive listing, restore with `scripts/operations.py restore`, run migrations only if the restored release requires them, verify owner/login/workspace data, then record start/end time and evidence. Never restore over production as a drill.

Run `scripts/dr_readiness.py --backup-dir <private-backup-dir>` as a read-only backup freshness check. Keep at least one encrypted off-host copy under the owner's control before claiming geographic redundancy.
