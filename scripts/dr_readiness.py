#!/usr/bin/env python3
"""Read-only DR readiness checks for Life Planning backup artifacts."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backup-dir", type=Path, required=True)
    parser.add_argument("--max-age-hours", type=float, default=30.0)
    args = parser.parse_args()
    directory = args.backup_dir.resolve(strict=True)
    manifests = sorted(directory.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not manifests:
        raise SystemExit("No backup manifest found")
    manifest = manifests[0]
    document = json.loads(manifest.read_text(encoding="utf-8"))
    age = (datetime.now(timezone.utc).timestamp() - manifest.stat().st_mtime) / 3600
    if age > args.max_age_hours:
        raise SystemExit(f"Latest backup manifest is too old ({age:.1f}h)")
    if not document.get("sha256"):
        raise SystemExit("Latest backup manifest has no SHA256")
    print(f"DRReadiness=PASS BackupManifest={manifest.name} AgeHours={age:.1f}")


if __name__ == "__main__":
    main()
