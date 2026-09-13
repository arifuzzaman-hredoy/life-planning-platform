#!/usr/bin/env python3
"""Create and verify an immutable VPS release manifest."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

SHA = re.compile(r"[0-9a-f]{40}")


def image_id(image: str) -> str:
    value = subprocess.check_output(
        ["docker", "image", "inspect", "--format", "{{.Id}}", image], text=True
    ).strip()
    if not value.startswith("sha256:"):
        raise ValueError("Docker image ID is not a sha256 digest")
    return value


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def create(args: argparse.Namespace) -> None:
    if not SHA.fullmatch(args.release):
        raise ValueError("Release must be a full Git SHA")
    archive = args.source_archive.resolve(strict=True)
    document = {
        "schemaVersion": 1,
        "release": args.release,
        "sourceArchiveSha256": sha256(archive),
        "applicationImage": args.app_image,
        "applicationImageId": image_id(args.app_image),
        "migratorImage": args.migrator_image,
        "migratorImageId": image_id(args.migrator_image),
    }
    args.output.write_text(json.dumps(document, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def verify(args: argparse.Namespace) -> None:
    manifest = json.loads(args.manifest.resolve(strict=True).read_text(encoding="utf-8"))
    if manifest.get("schemaVersion") != 1:
        raise ValueError("Unsupported release manifest schema")
    if manifest.get("release") != args.release:
        raise ValueError("Release manifest SHA mismatch")
    if manifest.get("applicationImage") != f"life-planning:{args.release}":
        raise ValueError("Application image tag mismatch")
    if manifest.get("migratorImage") != f"life-planning-migrator:{args.release}":
        raise ValueError("Migrator image tag mismatch")
    if image_id(manifest["applicationImage"]) != manifest.get("applicationImageId"):
        raise ValueError("Application image ID changed after immutable build")
    if image_id(manifest["migratorImage"]) != manifest.get("migratorImageId"):
        raise ValueError("Migrator image ID changed after immutable build")
    archive = args.source_archive.resolve(strict=True)
    if sha256(archive) != manifest.get("sourceArchiveSha256"):
        raise ValueError("Source archive digest mismatch")
    print("ReleaseManifest=VERIFIED")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    create_parser = sub.add_parser("create")
    create_parser.add_argument("--release", required=True)
    create_parser.add_argument("--source-archive", type=Path, required=True)
    create_parser.add_argument("--app-image", required=True)
    create_parser.add_argument("--migrator-image", required=True)
    create_parser.add_argument("--output", type=Path, required=True)
    create_parser.set_defaults(func=create)
    verify_parser = sub.add_parser("verify")
    verify_parser.add_argument("--release", required=True)
    verify_parser.add_argument("--source-archive", type=Path, required=True)
    verify_parser.add_argument("--manifest", type=Path, required=True)
    verify_parser.set_defaults(func=verify)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
