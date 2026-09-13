# DevSecOps + SRE completion map

This repository contains the code for the remaining maturity roadmap. Activation is deliberately separated from code completion so a shared production VPS is not modified by simply merging infrastructure definitions.

| Phase                  | Code delivered                                                       | Activation policy                                              |
| ---------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------- |
| 2 Security gates       | Gitleaks, Semgrep, Trivy, SBOM, signed GHCR release, ZAP             | CI gates after validation; DAST staging-only                   |
| 3 Secrets              | env validator, staging/prod examples, proxy requirement              | Rotate real credentials privately before production promotion  |
| 4 Isolation            | independent staging Terraform/Nginx/env                              | Requires separate staging DB/DNS/certificate                   |
| 5 Kubernetes/Helm      | restricted raw manifests + Helm chart                                | Future dedicated cluster; do not install on current shared VPS |
| 6 GitOps               | Argo CD staging auto-sync, production manual sync                    | Requires cluster + Argo CD                                     |
| 7 Progressive delivery | Canary and blue/green Argo Rollouts examples                         | Requires Argo Rollouts and two services                        |
| 8 SRE                  | Alertmanager, SLO recording/alert rules, Loki, Tempo, OTLP collector | Expanded SRE compose is optional and capacity-gated            |
| 9 Reliability          | DR readiness script, restore runbook, staging-only k6                | Restore and load tests must use isolated targets               |
| 10 Portfolio           | architecture, security, SLO/DR and promotion runbooks                | Evidence must reflect measured results, not planned claims     |

## Safety boundary

The current Docker/Terraform production path remains authoritative until the future cluster is provisioned. `infra/observability/sre/compose.yaml`, `infra/staging`, `infra/helm`, `infra/argocd`, and `infra/rollouts` are not automatically activated by the existing production release script.
