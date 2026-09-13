#!/usr/bin/env python3
"""Validate Life Planning environment files without printing secret values."""
from __future__ import annotations

import argparse
from pathlib import Path
import re
import stat
import sys

REQUIRED = {
    "DATABASE_URL",
    "APP_URL",
    "SESSION_SECRET",
    "METRICS_TOKEN",
}
SECRET_NAMES = {
    "DATABASE_URL",
    "DIRECT_DATABASE_URL",
    "SESSION_SECRET",
    "AI_ENCRYPTION_KEY",
    "APP_CRON_SECRET",
    "METRICS_TOKEN",
}
PLACEHOLDER_MARKERS = (
    "replace-with",
    "example.com",
    "local-development-only",
    "ci-only-",
)


def parse_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for number, raw in enumerate(path.read_text(encoding="utf-8-sig").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            raise ValueError(f"Invalid environment line {number}")
        name, value = line.split("=", 1)
        name = name.strip()
        if not re.fullmatch(r"[A-Z][A-Z0-9_]*", name):
            raise ValueError(f"Invalid environment key on line {number}")
        if name in values:
            raise ValueError(f"Duplicate environment key: {name}")
        values[name] = value.strip()
    return values


def validate(path: Path, production: bool) -> list[str]:
    values = parse_env(path)
    errors: list[str] = []
    missing = sorted(REQUIRED.difference(values))
    if missing:
        errors.append("Missing required keys: " + ", ".join(missing))
    for name in sorted(SECRET_NAMES.intersection(values)):
        value = values[name]
        if not value:
            errors.append(f"{name} must not be empty")
        if production and any(marker in value.lower() for marker in PLACEHOLDER_MARKERS):
            errors.append(f"{name} still contains a placeholder value")
    if production:
        app_url = values.get("APP_URL", "")
        if not app_url.startswith("https://"):
            errors.append("APP_URL must use HTTPS in production")
        for name in ("SESSION_SECRET", "METRICS_TOKEN"):
            if name in values and len(values[name]) < 32:
                errors.append(f"{name} must be at least 32 characters")
        if values.get("TRUST_PROXY") != "true":
            errors.append("TRUST_PROXY=true is required behind the production reverse proxy")
        if sys.platform != "win32":
            mode = stat.S_IMODE(path.stat().st_mode)
            if mode & 0o077:
                errors.append("Production env file must not be group/world readable")
    return errors


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("env_file", type=Path)
    parser.add_argument("--production", action="store_true")
    args = parser.parse_args()
    path = args.env_file.resolve(strict=True)
    errors = validate(path, args.production)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
    print(f"Environment validation passed ({len(parse_env(path))} keys; values not printed).")


if __name__ == "__main__":
    main()
