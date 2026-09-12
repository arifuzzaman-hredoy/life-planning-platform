#!/usr/bin/env python3
"""Prepare and activate Life Planning's production observability stack.

Runs only on the authorized Linux VPS as root. It modifies only Life Planning
files, the Life Planning Nginx vhost, and the Life Planning observability
Compose project. Secrets are generated locally on the VPS and never printed.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import stat
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen


APPROVED_ROOT = Path("/opt/life-planning")
NGINX_MARKER = "    location = /api/metrics { return 404; }\n"
OBSERVABILITY_PROJECT = "life-planning-observability"


def execute(command: list[str], *, capture: bool = False) -> str:
    result = subprocess.run(
        command,
        check=True,
        text=True,
        capture_output=capture,
    )
    return result.stdout if capture else ""


def atomic_write(
    path: Path,
    content: str,
    *,
    mode: int,
    uid: int | None = None,
    gid: int | None = None,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, mode)
        if uid is not None and gid is not None:
            os.chown(temporary, uid, gid)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def token(root: Path) -> tuple[Path, str]:
    shared = root / "shared"
    shared.mkdir(mode=0o700, exist_ok=True)
    token_path = shared / "metrics.token"

    if token_path.is_file():
        value = token_path.read_text(encoding="utf-8").strip()
        if len(value) < 32:
            raise ValueError("Existing metrics token is too short")
        os.chmod(token_path, 0o644)
        return token_path, value

    value = secrets.token_hex(32)
    atomic_write(token_path, value + "\n", mode=0o644)
    return token_path, value


def update_app_environment(root: Path, metrics_token: str) -> None:
    environment = root / "shared" / "app.env"
    if not environment.is_file():
        raise ValueError("Provision the private app environment before observability")

    metadata = environment.stat()
    original = environment.read_text(encoding="utf-8")
    lines = [
        line
        for line in original.splitlines()
        if not line.startswith("METRICS_TOKEN=")
    ]
    lines.append(f"METRICS_TOKEN={metrics_token}")
    updated = "\n".join(lines).rstrip("\n") + "\n"

    if updated == original:
        return

    atomic_write(
        environment,
        updated,
        mode=stat.S_IMODE(metadata.st_mode),
        uid=metadata.st_uid,
        gid=metadata.st_gid,
    )


def ensure_observability_environment(root: Path, token_path: Path) -> Path:
    environment = root / "shared" / "observability.env"

    if environment.is_file():
        values: dict[str, str] = {}
        for line in environment.read_text(encoding="utf-8").splitlines():
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key] = value

        required = {
            "LIFE_PLANNING_METRICS_TOKEN_FILE",
            "GRAFANA_ADMIN_USER",
            "GRAFANA_ADMIN_PASSWORD",
        }
        if not required.issubset(values):
            raise ValueError("Existing observability environment is incomplete")
        if len(values["GRAFANA_ADMIN_PASSWORD"]) < 32:
            raise ValueError("Existing Grafana admin password is too short")
        if values["LIFE_PLANNING_METRICS_TOKEN_FILE"] != str(token_path):
            raise ValueError("Observability token path does not match the managed token")
        os.chmod(environment, 0o600)
        return environment

    password = secrets.token_hex(32)
    content = (
        f"LIFE_PLANNING_METRICS_TOKEN_FILE={token_path}\n"
        "GRAFANA_ADMIN_USER=life-planning-admin\n"
        f"GRAFANA_ADMIN_PASSWORD={password}\n"
    )
    atomic_write(environment, content, mode=0o600)
    return environment


def deploy_observability_files(root: Path, source: Path) -> Path:
    source_observability = source / "infra" / "observability"
    if not (source_observability / "compose.yaml").is_file():
        raise ValueError("Release is missing the observability Compose configuration")

    destination = root / "observability"
    backups = root / "backups"
    backups.mkdir(parents=True, exist_ok=True)

    staging = root / f".observability-staging-{os.getpid()}"
    shutil.rmtree(staging, ignore_errors=True)
    shutil.copytree(source_observability, staging)

    if destination.exists():
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        backup = backups / f"observability-{stamp}"
        shutil.move(destination, backup)

    os.replace(staging, destination)
    return destination / "compose.yaml"


def find_nginx_vhost() -> Path:
    matches: list[Path] = []
    for directory in (Path("/etc/nginx/sites-enabled"), Path("/etc/nginx/conf.d")):
        if not directory.exists():
            continue
        for candidate in directory.iterdir():
            try:
                if not (candidate.is_file() or candidate.is_symlink()):
                    continue
                text = candidate.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            if "server_name myplan.oxytumzone.com;" in text:
                matches.append(candidate.resolve())

    unique = list(dict.fromkeys(matches))
    if len(unique) != 1:
        raise ValueError(
            f"Expected exactly one Life Planning Nginx vhost, found {len(unique)}"
        )
    return unique[0]


def install_nginx_defense(root: Path, source: Path) -> bool:
    desired_path = source / "infra" / "nginx" / "myplan.oxytumzone.com.conf"
    if not desired_path.is_file():
        raise ValueError("Release is missing the Life Planning Nginx configuration")

    desired = desired_path.read_text(encoding="utf-8")
    if desired.count(NGINX_MARKER) != 1:
        raise ValueError("Release Nginx configuration has an unexpected metrics policy")

    legacy = desired.replace(NGINX_MARKER, "", 1)
    target = find_nginx_vhost()
    current = target.read_text(encoding="utf-8")

    if current == desired:
        return False
    if current != legacy:
        raise ValueError(
            "Live Nginx vhost differs from both the approved previous and desired configuration"
        )

    metadata = target.stat()
    backups = root / "backups"
    backups.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = backups / f"nginx-observability-{stamp}.conf"
    shutil.copy2(target, backup)

    try:
        atomic_write(
            target,
            desired,
            mode=stat.S_IMODE(metadata.st_mode),
            uid=metadata.st_uid,
            gid=metadata.st_gid,
        )
        execute(["nginx", "-t"])
    except Exception:
        shutil.copy2(backup, target)
        execute(["nginx", "-t"])
        raise

    execute(["systemctl", "reload", "nginx"])
    return True


def compose_command(root: Path, environment: Path, *args: str) -> list[str]:
    return [
        "docker",
        "compose",
        "--project-name",
        OBSERVABILITY_PROJECT,
        "--env-file",
        str(environment),
        "-f",
        str(root / "observability" / "compose.yaml"),
        *args,
    ]


def http_status(url: str, headers: dict[str, str] | None = None) -> int:
    request = Request(url, headers=headers or {})
    try:
        with urlopen(request, timeout=10) as response:
            return response.status
    except HTTPError as error:
        return error.code


def http_text(url: str, headers: dict[str, str] | None = None) -> str:
    request = Request(url, headers=headers or {})
    with urlopen(request, timeout=10) as response:
        if response.status != 200:
            raise RuntimeError(f"Unexpected HTTP status {response.status} from {url}")
        return response.read().decode("utf-8")


def wait_for(url: str, attempts: int = 40, delay: float = 3.0) -> None:
    for _ in range(attempts):
        try:
            if http_status(url) == 200:
                return
        except OSError:
            pass
        time.sleep(delay)
    raise RuntimeError(f"Endpoint did not become ready: {url}")


def available_memory_kib() -> int:
    for line in Path("/proc/meminfo").read_text(encoding="utf-8").splitlines():
        if line.startswith("MemAvailable:"):
            return int(line.split()[1])
    raise RuntimeError("Could not read MemAvailable")


def verify_prometheus_query(query: str) -> None:
    from urllib.parse import urlencode

    body = http_text(
        "http://127.0.0.1:9097/api/v1/query?" + urlencode({"query": query})
    )
    document = json.loads(body)
    result = document.get("data", {}).get("result", [])
    if not result:
        raise RuntimeError(f"Prometheus query returned no data: {query}")
    if not any(float(item["value"][1]) == 1 for item in result):
        raise RuntimeError(f"Prometheus query is not healthy: {query}")


def prepare(root: Path, source: Path) -> None:
    token_path, metrics_token = token(root)
    update_app_environment(root, metrics_token)
    environment = ensure_observability_environment(root, token_path)
    compose = deploy_observability_files(root, source)
    nginx_changed = install_nginx_defense(root, source)

    execute(compose_command(root, environment, "config", "--quiet"))

    print(
        json.dumps(
            {
                "status": "prepared",
                "compose": str(compose),
                "nginxUpdated": nginx_changed,
                "metricsTokenInstalled": True,
                "grafanaCredentialInstalled": True,
            }
        )
    )


def activate(root: Path, source: Path, image: str) -> None:
    if not re.fullmatch(r"life-planning:[0-9a-f]{40}", image):
        raise ValueError("Activation requires an immutable Life Planning image")

    environment = root / "shared" / "observability.env"
    token_path = root / "shared" / "metrics.token"
    if not environment.is_file() or not token_path.is_file():
        raise ValueError("Run observability preparation before activation")

    current_image = execute(
        ["docker", "inspect", "life-planning-app", "--format", "{{.Config.Image}}"],
        capture=True,
    ).strip()
    if current_image != image:
        raise RuntimeError(
            f"Application image mismatch: expected {image}, got {current_image}"
        )

    if http_status("http://127.0.0.1:3217/api/health") != 200:
        raise RuntimeError("Application health check failed")
    if http_status("http://127.0.0.1:3217/api/ready") != 200:
        raise RuntimeError("Application database readiness failed")
    if http_status("https://myplan.oxytumzone.com/api/metrics") != 404:
        raise RuntimeError("Public metrics endpoint is not blocked")

    metrics_token = token_path.read_text(encoding="utf-8").strip()
    metrics = http_text(
        "http://127.0.0.1:3217/api/metrics",
        headers={"Authorization": f"Bearer {metrics_token}"},
    )
    if "life_planning_database_ready 1" not in metrics:
        raise RuntimeError("Private database readiness metric is not healthy")
    if f'release="{image}"' not in metrics:
        raise RuntimeError("Private metrics report the wrong application release")

    if available_memory_kib() < 1_048_576:
        raise RuntimeError("Less than 1 GiB RAM is available for observability startup")
    if shutil.disk_usage(root).free < 2 * 1024 * 1024 * 1024:
        raise RuntimeError("Less than 2 GiB disk space is available for observability")

    command = compose_command(root, environment)
    started = False
    try:
        execute([*command, "config", "--quiet"])
        execute([*command, "pull"])
        execute([*command, "up", "-d"])
        started = True

        wait_for("http://127.0.0.1:9097/-/ready")
        wait_for("http://127.0.0.1:3300/api/health")

        verify_prometheus_query('up{job="life-planning"}')
        verify_prometheus_query("life_planning_database_ready")

        print(execute([*command, "ps"], capture=True), end="")
        print(
            json.dumps(
                {
                    "status": "active",
                    "image": image,
                    "publicMetricsStatus": 404,
                    "privateMetricsReady": True,
                    "prometheusReady": True,
                    "grafanaReady": True,
                    "databaseMetricReady": True,
                }
            )
        )
    except Exception:
        if started:
            subprocess.run([*command, "down"], check=False)
        raise


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["prepare", "activate"])
    parser.add_argument("--root", type=Path, default=APPROVED_ROOT)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--image")
    args = parser.parse_args()

    root = args.root.resolve()
    source = args.source.resolve(strict=True)

    if os.name != "posix" or root != APPROVED_ROOT:
        raise ValueError("Observability deployment must run on /opt/life-planning on Linux")
    if os.geteuid() != 0:
        raise PermissionError("Observability deployment requires root on the authorized VPS")

    if args.action == "prepare":
        prepare(root, source)
        return

    if not args.image:
        raise ValueError("--image is required for activation")
    activate(root, source, args.image)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, RuntimeError, subprocess.SubprocessError) as error:
        print(
            f"Observability release failed ({type(error).__name__}). "
            "Secrets were not logged.",
            file=sys.stderr,
        )
        raise SystemExit(1)
