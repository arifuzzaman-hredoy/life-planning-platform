#!/usr/bin/env python3
"""Readiness checks, scoped PostgreSQL backups, and non-destructive restore drills.

Requires Python 3.11+. Database commands need Docker or PostgreSQL 17+ clients.
Secrets are read from an environment file and passed as child-process environment,
never as shell command arguments. No dependency installation or data pruning occurs.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from urllib.parse import parse_qs, unquote, urlsplit
from urllib.request import Request, urlopen


def env_file(path: Path) -> dict[str, str]:
    values = {}
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, separator, value = line.partition("=")
        if not separator or not key.replace("_", "").isalnum():
            raise ValueError("Invalid environment-file entry")
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        values[key] = value
    return values


def postgres_environment(path: Path, allow_local: bool) -> dict[str, str]:
    values = env_file(path)
    parsed = urlsplit(values.get("BACKUP_DATABASE_URL") or values["DATABASE_URL"])
    if parsed.scheme not in {"postgres", "postgresql"} or not parsed.hostname:
        raise ValueError("A PostgreSQL connection URL is required")
    local = parsed.hostname in {"127.0.0.1", "localhost", "::1"}
    params = parse_qs(parsed.query)
    return {
        "PGHOST": parsed.hostname.replace("-pooler.", ".", 1) if parsed.hostname.endswith(".neon.tech") else parsed.hostname,
        "PGPORT": str(parsed.port or 5432),
        "PGDATABASE": unquote(parsed.path.lstrip("/")),
        "PGUSER": unquote(parsed.username or ""),
        "PGPASSWORD": unquote(parsed.password or ""),
        "PGSSLMODE": "disable" if local and allow_local else "verify-full",
        "PGSSLROOTCERT": values.get("PGSSLROOTCERT", "system"),
        "PGCHANNELBINDING": params.get("channel_binding", ["prefer"])[0],
        "PGCONNECT_TIMEOUT": "15",
        "PGAPPNAME": "life-planning-backup",
    }


def pg_command(tool: str, args: list[str], environment: dict[str, str], docker: bool,
               mount: Path | None = None) -> subprocess.CompletedProcess:
    command = [tool, *args]
    child_environment = dict(environment)
    if docker:
        command = ["docker", "run", "--rm", "--network", "host", "--memory", "256m",
                   "--cpus", "0.5", "--read-only", "--cap-drop", "ALL",
                   "--security-opt", "no-new-privileges:true", "--tmpfs", "/tmp:size=32m"]
        certificate = Path(environment.get("PGSSLROOTCERT", "system"))
        if str(certificate) == "system":
            certificate = Path("/etc/ssl/certs/ca-certificates.crt")
        if not certificate.is_file():
            raise ValueError("Provide PGSSLROOTCERT as a readable host CA bundle for Docker backups")
        command += ["--mount", f"type=bind,src={certificate.resolve()},dst=/run/pg-root-ca.pem,readonly"]
        child_environment["PGSSLROOTCERT"] = "/run/pg-root-ca.pem"
        for key in child_environment:
            command += ["--env", key]
        if mount:
            command += ["--mount", f"type=bind,src={mount.resolve()},dst=/backup"]
        command += ["postgres:17-bookworm", tool, *args]
    result = subprocess.run(command, env={**os.environ, **child_environment}, capture_output=True,
                            text=True, timeout=1800, check=False)
    if result.returncode:
        # Connection errors can contain credentials. Keep external tool output private.
        raise RuntimeError(f"{tool} failed with exit code {result.returncode}; verify access and PostgreSQL client version")
    return result


def backup(args: argparse.Namespace) -> None:
    directory = args.output.resolve()
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(directory, 0o700)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    destination = directory / f"life-planning-{stamp}.dump"
    if destination.exists():
        raise ValueError("Backup already exists; no file was overwritten")
    temporary = destination.with_suffix(".partial")
    with temporary.open("x"):
        pass
    os.chmod(temporary, 0o600)
    target = f"/backup/{temporary.name}" if args.docker else str(temporary)
    environment = postgres_environment(args.env_file, args.allow_local)
    pg_command("pg_dump", ["--format=custom", "--schema=life_planning", "--no-owner", "--no-acl",
                          "--lock-wait-timeout=30s", "--file", target], environment, args.docker, directory)
    pg_command("pg_restore", ["--list", target], environment, args.docker, directory)
    temporary.rename(destination)
    with destination.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    manifest = destination.with_suffix(".json")
    manifest.write_text(json.dumps({"file": destination.name, "sha256": digest,
                        "bytes": destination.stat().st_size, "schema": "life_planning",
                        "createdAt": stamp, "restoreTested": False}, indent=2) + "\n", encoding="utf-8")
    os.chmod(manifest, 0o600)
    print(json.dumps({"status": "backed_up", "file": str(destination), "bytes": destination.stat().st_size}))


def restore(args: argparse.Namespace) -> None:
    archive = args.archive.resolve(strict=True)
    manifest = json.loads(archive.with_suffix(".json").read_text(encoding="utf-8"))
    with archive.open("rb") as stream:
        digest = hashlib.file_digest(stream, "sha256").hexdigest()
    if digest != manifest["sha256"]:
        raise ValueError("Backup checksum mismatch")
    target = postgres_environment(args.target_env, args.allow_local)
    source = postgres_environment(args.source_env, args.allow_local)
    if (target["PGHOST"], target["PGPORT"], target["PGDATABASE"]) == (source["PGHOST"], source["PGPORT"], source["PGDATABASE"]):
        raise ValueError("Restore drills must target a different database")
    if not args.confirm_empty_target:
        raise ValueError("Use --confirm-empty-target after verifying the destination is a disposable empty database")
    # No --clean or DROP. Existing objects cause failure, with atomic rollback.
    location = f"/backup/{archive.name}" if args.docker else str(archive)
    result = pg_command("psql", ["--no-psqlrc", "--tuples-only", "--no-align", "--command",
                        "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema');"],
                        target, args.docker)
    if result.stdout.strip() != "0":
        raise ValueError("Restore destination contains tables; nothing was restored")
    pg_command("pg_restore", ["--exit-on-error", "--single-transaction", "--no-owner", "--no-acl",
                            "--dbname", target["PGDATABASE"], location], target, args.docker, archive.parent)
    print(json.dumps({"status": "restored_to_empty_database", "archive": archive.name}))


def smoke(args: argparse.Namespace) -> None:
    base = args.url.rstrip("/")
    if not base.startswith("https://") and not base.startswith(("http://127.0.0.1:", "http://localhost:")):
        raise ValueError("Use HTTPS for public URLs")
    for route in ("/api/health", "/api/ready", "/login"):
        started = time.monotonic()
        request = Request(base + route, headers={"User-Agent": "life-planning-healthcheck/1.0"})
        with urlopen(request, timeout=20) as response:
            if response.status != 200:
                raise RuntimeError(f"Unexpected response for {route}")
            body = response.read(1024 * 1024)
            if route.startswith("/api/"):
                document = json.loads(body)
                if document.get("data", {}).get("status") not in {"ok", "ready"}:
                    raise RuntimeError(f"Unexpected health payload for {route}")
            elif b"password" not in body.lower():
                raise RuntimeError("Login page does not contain a password field")
            print(json.dumps({"path": route, "status": response.status,
                             "durationMs": round((time.monotonic() - started) * 1000)}))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    check = sub.add_parser("smoke", help="Check HTTPS, liveness, database readiness, and login rendering")
    check.add_argument("--url", required=True)
    check.set_defaults(handler=smoke)
    dump = sub.add_parser("backup", help="Write a private backup of only the life_planning schema")
    dump.add_argument("--env-file", type=Path, required=True)
    dump.add_argument("--output", type=Path, required=True)
    dump.add_argument("--docker", action="store_true")
    dump.add_argument("--allow-local", action="store_true", help="Allow non-TLS loopback development database")
    dump.set_defaults(handler=backup)
    drill = sub.add_parser("restore", help="Restore only to a verified empty, different database")
    drill.add_argument("--archive", type=Path, required=True)
    drill.add_argument("--source-env", type=Path, required=True)
    drill.add_argument("--target-env", type=Path, required=True)
    drill.add_argument("--confirm-empty-target", action="store_true")
    drill.add_argument("--docker", action="store_true")
    drill.add_argument("--allow-local", action="store_true")
    drill.set_defaults(handler=restore)
    args = parser.parse_args()
    try:
        args.handler(args)
        return 0
    except (KeyError, ValueError, OSError, RuntimeError, subprocess.SubprocessError) as error:
        # Deliberately do not print exception text from external libraries or URL parsers.
        print(f"Operation failed ({type(error).__name__}). No secrets were logged.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
