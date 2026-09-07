#!/usr/bin/env python3
"""Upload a tracked, secret-free source release over pinned SSH and build on the VPS.

Requires Paramiko installed on the Jenkins agent. SSH credentials are a private JSON
file with host, username, and password fields. Host keys must already be verified.
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


def main() -> None:
    import paramiko
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
    actual = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=source, text=True).strip()
    if actual != args.release:
        raise ValueError("Requested release does not match the checkout")
    if subprocess.check_output(["git", "status", "--porcelain"], cwd=source, text=True).strip():
        raise ValueError("Commit changes before creating a release")
    credentials = json.loads(args.credentials_file.read_text(encoding="utf-8-sig"))
    if credentials["host"] != "198.54.121.88":
        raise ValueError("This deployment targets only the approved VPS")
    client = paramiko.SSHClient()
    client.load_host_keys(str(args.known_hosts.resolve(strict=True)))
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
    client.connect(credentials["host"], username=credentials["username"], password=credentials["password"],
                   look_for_keys=False, allow_agent=False, timeout=20)
    release_root = f"/opt/life-planning/releases/{args.release}"
    try:
        with tempfile.TemporaryDirectory(prefix="life-planning-release-") as temporary:
            archive = Path(temporary) / "source.tar"
            subprocess.run(["git", "archive", "--format=tar", "--output", str(archive), args.release], cwd=source, check=True)
            with tarfile.open(archive) as packed:
                for member in packed.getmembers():
                    parts = Path(member.name).parts
                    sensitive = any(part.startswith(".env") and part != ".env.example" for part in parts)
                    if sensitive or member.issym() or member.islnk() or ".." in parts or member.name.startswith("/"):
                        raise ValueError("Release contains an unsafe or secret file path")
            transport = client.get_transport()
            if transport is None:
                raise RuntimeError("SSH transport unavailable")
            stdin, stdout, stderr = client.exec_command(f"mkdir -p {shlex.quote(release_root)}", timeout=30)
            if stdout.channel.recv_exit_status():
                raise RuntimeError("Could not create project release directory")
            remote_archive = release_root + "/source.tar"
            with client.open_sftp() as sftp:
                sftp.put(str(archive), remote_archive)
            command = "set -eu\n" + f"cd {shlex.quote(release_root)}\n"
            command += "tar --extract --file source.tar --no-same-owner\n"
            command += "docker buildx inspect life-planning-builder >/dev/null 2>&1 || docker buildx create --name life-planning-builder --driver docker-container --driver-opt memory=2304m,memory-swap=2304m,cpu-quota=150000,cpu-period=100000\n"
            command += "trap 'docker buildx stop life-planning-builder >/dev/null 2>&1 || true' EXIT\n"
            command += f"docker buildx build --builder life-planning-builder --load --target runner --tag life-planning:{args.release} .\n"
            command += f"docker buildx build --builder life-planning-builder --load --target migrator --tag life-planning-migrator:{args.release} .\n"
            command += "docker buildx stop life-planning-builder\n"
            if args.deploy:
                command += f"python3 scripts/deploy.py --root /opt/life-planning --source {shlex.quote(release_root)} --image life-planning:{args.release}\n"
                command += "python3 scripts/operations.py smoke --url https://myplan.oxytumzone.com\n"
            channel = transport.open_session(timeout=30)
            channel.set_combine_stderr(True)
            channel.exec_command("sh -c " + shlex.quote(command))
            with channel.makefile("r") as output:
                for line in output:
                    print(line.rstrip(), flush=True)
            code = channel.recv_exit_status()
            if code:
                raise RuntimeError(f"Remote build/deployment failed with exit code {code}")
    finally:
        client.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Remote release failed ({type(error).__name__}). Credentials were not logged.", file=sys.stderr)
        raise SystemExit(1)
