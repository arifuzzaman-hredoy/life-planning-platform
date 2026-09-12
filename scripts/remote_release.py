#!/usr/bin/env python3
"""Upload a tracked, secret-free source release over pinned SSH and build on the VPS.

The target VPS allows the authenticated client reliably but may reset a Paramiko
transport when multiple SSH/SFTP channels are opened on one connection. Every
remote operation therefore uses a fresh, host-key-pinned SSH connection.

Requires Paramiko on the Jenkins agent. SSH credentials are a private JSON file
with host, username, and password fields. Host keys must already be verified.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import shlex
import subprocess
import tarfile
import tempfile
import sys
import time


APPROVED_HOST = "198.54.121.88"


def decode_channel_output(raw_output: object) -> str:
    if isinstance(raw_output, bytes):
        return raw_output.decode("utf-8", errors="replace")
    return str(raw_output)


def load_credentials(path: Path) -> dict[str, str]:
    credentials = json.loads(path.read_text(encoding="utf-8-sig"))
    required = {"host", "username", "password"}
    missing = required.difference(credentials)
    if missing:
        raise ValueError(f"Credential file is missing required keys: {sorted(missing)}")
    if credentials["host"] != APPROVED_HOST:
        raise ValueError("This deployment targets only the approved VPS")
    return credentials


def connect(credentials: dict[str, str], known_hosts: Path):
    try:
        import paramiko
    except ModuleNotFoundError as error:
        raise RuntimeError("Paramiko is required on the Jenkins agent") from error

    last_error: Exception | None = None
    for attempt in range(1, 4):
        client = paramiko.SSHClient()
        client.load_host_keys(str(known_hosts.resolve(strict=True)))
        client.set_missing_host_key_policy(paramiko.RejectPolicy())
        try:
            client.connect(
                credentials["host"],
                username=credentials["username"],
                password=credentials["password"],
                look_for_keys=False,
                allow_agent=False,
                timeout=20,
                banner_timeout=20,
                auth_timeout=20,
            )
            transport = client.get_transport()
            if transport is None or not transport.is_active():
                raise RuntimeError("SSH transport unavailable")
            transport.set_keepalive(15)
            return client
        except Exception as error:
            client.close()
            last_error = error
            if attempt == 3:
                break
            time.sleep(attempt)

    raise RuntimeError("Could not establish the pinned SSH connection") from last_error


def run_remote_once(
    credentials: dict[str, str],
    known_hosts: Path,
    command: str,
    *,
    timeout: int,
    stream: bool = False,
) -> str:
    client = connect(credentials, known_hosts)
    try:
        transport = client.get_transport()
        if transport is None:
            raise RuntimeError("SSH transport unavailable")

        channel = transport.open_session(timeout=30)
        channel.set_combine_stderr(True)
        channel.exec_command("sh -c " + shlex.quote(command))

        with channel.makefile("r") as output:
            decoded_output = decode_channel_output(output.read())

        lines = decoded_output.splitlines()

        if stream and decoded_output:
            print(
                decoded_output,
                end="" if decoded_output.endswith("\n") else "\n",
                flush=True,
            )

        code = channel.recv_exit_status()
        if code:
            tail = "\n".join(lines[-40:])
            raise RuntimeError(
                f"Remote command failed with exit code {code}"
                + (f"\n{tail}" if tail else "")
            )

        return decoded_output
    finally:
        client.close()


def upload_once(
    credentials: dict[str, str],
    known_hosts: Path,
    local_path: Path,
    remote_path: str,
) -> None:
    client = connect(credentials, known_hosts)
    try:
        with client.open_sftp() as sftp:
            sftp.put(str(local_path), remote_path)
    finally:
        client.close()


def verify_archive(archive: Path) -> None:
    with tarfile.open(archive) as packed:
        for member in packed.getmembers():
            parts = Path(member.name).parts
            sensitive = any(part.startswith(".env") and part != ".env.example" for part in parts)
            if (
                sensitive
                or member.issym()
                or member.islnk()
                or ".." in parts
                or member.name.startswith("/")
            ):
                raise ValueError("Release contains an unsafe or secret file path")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--credentials-file", type=Path, required=True)
    parser.add_argument("--known-hosts", type=Path, required=True)
    parser.add_argument("--source", type=Path, default=Path.cwd())
    parser.add_argument("--release", required=True)
    parser.add_argument("--deploy", action="store_true")
    args = parser.parse_args()

    if not re.fullmatch(r"[0-9a-f]{40}", args.release):
        raise ValueError("Release must be the full Git commit SHA")

    source = args.source.resolve(strict=True)
    actual = subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=source, text=True
    ).strip()
    if actual != args.release:
        raise ValueError("Requested release does not match the checkout")
    if subprocess.check_output(
        ["git", "status", "--porcelain"], cwd=source, text=True
    ).strip():
        raise ValueError("Commit changes before creating a release")

    credentials = load_credentials(args.credentials_file)
    known_hosts = args.known_hosts.resolve(strict=True)
    release_root = f"/opt/life-planning/releases/{args.release}"

    with tempfile.TemporaryDirectory(prefix="life-planning-release-") as temporary:
        archive = Path(temporary) / "source.tar"
        subprocess.run(
            [
                "git",
                "archive",
                "--format=tar",
                "--output",
                str(archive),
                args.release,
            ],
            cwd=source,
            check=True,
        )
        verify_archive(archive)

        run_remote_once(
            credentials,
            known_hosts,
            f"set -eu\nmkdir -p {shlex.quote(release_root)}",
            timeout=30,
        )

        remote_archive = release_root + "/source.tar"
        upload_once(credentials, known_hosts, archive, remote_archive)

        command = "set -eu\n"
        command += f"cd {shlex.quote(release_root)}\n"
        command += "tar --extract --file source.tar --no-same-owner\n"
        command += (
            "docker buildx inspect life-planning-builder >/dev/null 2>&1 || "
            "docker buildx create --name life-planning-builder "
            "--driver docker-container "
            "--driver-opt memory=2304m,memory-swap=2304m,"
            "cpu-quota=150000,cpu-period=100000\n"
        )
        command += (
            "trap 'docker buildx stop life-planning-builder >/dev/null 2>&1 || true' EXIT\n"
        )
        command += (
            "docker buildx build --builder life-planning-builder --load "
            "--target runner "
            f"--tag life-planning:{args.release} .\n"
        )
        command += (
            "docker buildx build --builder life-planning-builder --load "
            "--target migrator "
            f"--tag life-planning-migrator:{args.release} .\n"
        )
        command += "docker buildx stop life-planning-builder\n"

        if args.deploy:
            command += (
                "python3 scripts/observability_release.py prepare "
                "--root /opt/life-planning "
                f"--source {shlex.quote(release_root)}\n"
            )
            command += (
                "python3 scripts/deploy.py "
                "--root /opt/life-planning "
                f"--source {shlex.quote(release_root)} "
                f"--image life-planning:{args.release}\n"
            )
            command += (
                "python3 scripts/operations.py smoke "
                "--url https://myplan.oxytumzone.com\n"
            )
            command += (
                "python3 scripts/observability_release.py activate "
                "--root /opt/life-planning "
                f"--source {shlex.quote(release_root)} "
                f"--image life-planning:{args.release}\n"
            )

        run_remote_once(
            credentials,
            known_hosts,
            command,
            timeout=3600,
            stream=True,
        )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(
            f"Remote release failed ({type(error).__name__}). Credentials were not logged.",
            file=sys.stderr,
        )
        raise SystemExit(1)
