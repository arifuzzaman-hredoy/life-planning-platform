# Security release runbook

1. Application CI and `DevSecOps security` must pass for the exact SHA.
2. Jenkins `VALIDATE` records the exact SHA once.
3. Jenkins `BUILD` creates the application and migrator images once. A second build of the same SHA is rejected rather than overwriting immutable tags.
4. The VPS release manifest binds the Git archive SHA256 to the two Docker image IDs.
5. `DEPLOY` verifies that manifest before migrations or container replacement.
6. Signed GHCR images are a separate supply-chain path for future Kubernetes releases; production Docker-on-VPS does not pretend those signatures cover locally built images.

Never suppress a Gitleaks/Semgrep/Trivy result without a documented reason and expiry. Never place the Jenkins SSH credential, database URL or Grafana password in GitHub repository variables.
