# Target architecture

```mermaid
flowchart LR
  Dev[Developer] --> Git[GitHub]
  Git --> CI[Application CI]
  Git --> Sec[DevSecOps security]
  Sec --> SC[SBOM + signed GHCR release]
  CI --> Jenkins[Jenkins release controller]
  Jenkins --> Build[Immutable VPS images + release manifest]
  Build --> Stage[Staging]
  Stage --> DAST[ZAP + k6]
  Stage --> Prod[Production promotion]
  Prod --> Metrics[Prometheus]
  Metrics --> Alerts[Alertmanager]
  Prod --> OTLP[OpenTelemetry]
  OTLP --> Loki[Loki]
  OTLP --> Tempo[Tempo]
  Metrics --> Grafana[Grafana]
  Loki --> Grafana
  Tempo --> Grafana
  Git -. future .-> Argo[Argo CD]
  Argo -. future .-> K8s[Kubernetes + Helm + Rollouts]
```

Current production remains Docker/Terraform/Nginx on the shared VPS. The future Kubernetes path is code-complete infrastructure definition, not an assertion that a cluster is already running.
