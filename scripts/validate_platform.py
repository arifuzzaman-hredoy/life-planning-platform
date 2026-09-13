#!/usr/bin/env python3
"""Dependency-free static validation for DevSecOps/SRE platform configuration."""
from __future__ import annotations

import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

PLATFORM_FILES = [
    ".github/workflows/security.yml",
    ".github/workflows/supply-chain.yml",
    ".github/workflows/dast.yml",
    ".github/workflows/load-test.yml",
    "infra/observability/sre/compose.yaml",
    "infra/observability/sre/prometheus/prometheus.yml",
    "infra/observability/sre/prometheus/rules/life-planning.rules.yml",
    "infra/observability/sre/alertmanager/alertmanager.yml",
    "infra/observability/sre/loki/config.yml",
    "infra/observability/sre/tempo/config.yml",
    "infra/observability/sre/otel/config.yml",
    "infra/argocd/staging-application.yaml",
    "infra/argocd/production-application.yaml",
    "infra/rollouts/canary.yaml",
    "infra/rollouts/bluegreen.yaml",
    "infra/rollouts/services.yaml",
    "infra/kubernetes/deployment.yaml",
    "infra/kubernetes/networkpolicy.yaml",
    "infra/kubernetes/pdb.yaml",
    "infra/kubernetes/hpa.yaml",
    "infra/helm/life-planning/Chart.yaml",
    "infra/helm/life-planning/values.yaml",
    "infra/helm/life-planning/values-staging.yaml",
]

# Compatibility alias used by the unit test and older local tooling.
YAML_FILES = PLATFORM_FILES


def read_required(rel: str) -> str:
    path = ROOT / rel
    if not path.is_file():
        raise SystemExit(f"Missing platform file: {rel}")
    text = path.read_text(encoding="utf-8")
    if not text.strip():
        raise SystemExit(f"Empty platform file: {rel}")
    if "\t" in text:
        raise SystemExit(f"Tab indentation is not allowed in platform YAML: {rel}")
    if "\x00" in text:
        raise SystemExit(f"NUL byte is not allowed in platform file: {rel}")
    return text


def require_markers(rel: str, markers: tuple[str, ...]) -> None:
    text = read_required(rel)
    for marker in markers:
        if marker not in text:
            raise SystemExit(f"{rel} missing required marker: {marker}")


def main() -> None:
    for rel in PLATFORM_FILES:
        read_required(rel)

    json.loads(
        (ROOT / "infra/observability/sre/grafana/dashboards/slo.json").read_text(
            encoding="utf-8"
        )
    )

    require_markers(
        ".github/workflows/security.yml",
        ("Gitleaks", "Semgrep", "Trivy", "anchore/syft", "--exit-code 1"),
    )
    require_markers(
        ".github/workflows/supply-chain.yml",
        (
            "Cosign",
            "cosign sign",
            "cosign attest",
            "release_sha",
            "Require successful CI and security runs for exact SHA",
        ),
    )
    require_markers(
        ".github/workflows/ci.yml",
        ("Validate Helm chart rendering", "alpine/helm:3.18.4", "validate_env.py"),
    )
    require_markers(
        ".github/workflows/dast.yml",
        ("OWASP ZAP", "Production DAST is blocked by policy"),
    )
    require_markers(
        ".github/workflows/load-test.yml",
        ("Staging load test", "Production load testing is blocked by policy"),
    )
    require_markers(
        "infra/observability/sre/prometheus/rules/life-planning.rules.yml",
        (
            "life_planning:sli_availability:ratio_rate5m",
            "LifePlanningTargetDown",
            "LifePlanningDatabaseNotReady",
        ),
    )

    prod_argocd = read_required("infra/argocd/production-application.yaml")
    if re.search(r"(?m)^\s+automated:\s*$", prod_argocd):
        raise SystemExit("Production Argo CD must not enable automated sync")

    staging_argocd = read_required("infra/argocd/staging-application.yaml")
    if not re.search(r"(?m)^\s+automated:\s*$", staging_argocd):
        raise SystemExit("Staging Argo CD is expected to enable automated sync")

    for rel in ("tests/load/smoke.js", "tests/load/steady.js"):
        if "Production load testing is blocked" not in read_required(rel):
            raise SystemExit(f"Production load guard missing in {rel}")

    helm_values = read_required("infra/helm/life-planning/values.yaml")
    if "tag: replace-with-immutable-sha" not in helm_values:
        raise SystemExit("Helm production values must not contain a mutable release tag")

    print("PlatformValidation=PASS")


if __name__ == "__main__":
    main()
