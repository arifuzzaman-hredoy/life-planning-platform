# Backup and recovery

Create a restricted backup of only this application's schema:

```sh
python3 /opt/life-planning/tools/operations.py backup --env-file /opt/life-planning/shared/app.env --output /opt/life-planning/backups/database --docker
```

The script uses PostgreSQL17 clients, TLS hostname verification, a custom-format dump, archive-list verification, private permissions, and a SHA256 manifest. It passes credentials through child-process environment variables, not command arguments. A successful dump is not a proven restore; `restoreTested` initially remains false.

The production cron job runs this backup daily at 02:30 Asia/Dhaka. A restore drill recovered the first 27,068-byte archive into the separate `life_planning_restore` database: all 11 application/migration tables, the one owner account requiring a password change, and zero sample entries were verified. The original dump manifest is preserved unchanged; this document records that drill's separate verification. The restore database is private and is not used by the application.

After final verification and the owner's password change, a fresh direct-connection backup completed at `20260908T152550Z`: 27,607 bytes, with an archive check and SHA256 manifest. It contains the current owner account after test-account cleanup. The restore drill above describes the earlier recovery exercise; the fresh archive has not been restored over either database.

For a restore drill, provision a separate empty database and a private target environment file. Use `operations.py restore --archive DUMP --source-env SOURCE_ENV --target-env TARGET_ENV --confirm-empty-target --docker`. It rejects the source database, nonempty targets, and checksum mismatches. Restoration is one transaction, with no `DROP`, `--clean`, or data reset. Validate records and login before considering a recovered database usable.

## Application rollback

Each deployment saves previous Terraform files/state and image metadata under `backups/deployment-TIMESTAMP`. Older immutable Docker images remain available. To roll back, run `scripts/deploy.py` with the previous release source and previous image plus `--skip-migration`; verify readiness and HTTPS afterward. The deployment script attempts this automatically if an update fails readiness.

An application rollback does not undo database migrations. Use backward-compatible additive schema changes and retain data. For incompatible migrations, review a recovery plan before deployment. Never reset the Neon database to make an older application start.

Nginx configuration was archived before adding this project. Revert only the project vhost if necessary, test with `nginx -t`, then gracefully reload. A full global restore could overwrite other owners' newer changes and must not be used casually.

Keep an encrypted copy of selected backups on a separate storage service under the owner's control. Off-server backup storage is not configured automatically; this is a remaining operational choice, not a claim of geographically redundant recovery.
