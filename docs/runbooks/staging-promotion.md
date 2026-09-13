# Staging and promotion runbook

Staging must use a separate database, environment file, container/network, loopback port, DNS name and TLS certificate. Never point staging at the production database.

Promotion order:

1. exact commit passes application CI and security CI;
2. immutable image is built;
3. staging deploys the same immutable image;
4. run smoke, ZAP baseline and the selected k6 profile against staging;
5. review migrations for backward compatibility;
6. promote the exact image identity to production;
7. verify readiness, application smoke, metrics and alerts;
8. retain the previous immutable image for rollback.

Production Argo CD automation is intentionally disabled. A future cluster promotion should be a reviewed Git change followed by a manual production sync.
