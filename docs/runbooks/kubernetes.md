# Kubernetes / GitOps runbook

The Kubernetes, Helm, Argo CD and Argo Rollouts definitions are future infrastructure for a dedicated cluster. They must not be installed on the existing shared 6 GB VPS simply to satisfy a portfolio checklist.

Prerequisites: dedicated cluster capacity, ingress controller, cert-manager or equivalent TLS process, metrics-server for HPA, private secret management, Argo CD, and optionally Argo Rollouts. Create `life-planning-secrets` with an `app.env` key outside Git. Use an immutable signed GHCR digest/tag. Render Helm and run policy/IaC scans before sync.

Staging may use automated Argo CD sync. Production remains manual promotion. Canary/blue-green examples require corresponding stable/canary or active/preview Services before use.

Progressive-delivery examples use `infra/rollouts/services.yaml` for the stable/canary and active/preview Service contracts required by Argo Rollouts.
