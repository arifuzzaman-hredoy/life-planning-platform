#!/usr/bin/env python3
"""Deploy an already-built immutable Life Planning release.

This command deliberately does not upload source or build Docker images.
It is intended for fast, safe deployment retries after the exact Git SHA
has already passed Jenkins validation and remote image creation.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import shlex
import sys
import time

import paramiko


RELEASE_PATTERN = re.compile(r"[0-9a-f]{40}")
APPROVED_HOST = "198.54.121.88"


def load_credentials(path: Path) -> dict[str, str]:
    document = json.loads(
        path.read_text(
            encoding="utf-8-sig"
        )
    )

    required = {
        "host",
        "username",
        "password",
    }

    if not required.issubset(document):
        raise ValueError(
            "SSH credential file is incomplete"
        )

    credentials = {key: str(document[key]) for key in required}
    if credentials["host"] != APPROVED_HOST:
        raise ValueError("This deployment targets only the approved VPS")
    return credentials


def connect(
    credentials: dict[str, str],
    known_hosts: Path,
) -> paramiko.SSHClient:

    last_error: Exception | None = None

    for attempt in range(1, 4):

        client = paramiko.SSHClient()

        client.load_host_keys(
            str(
                known_hosts.resolve(
                    strict=True
                )
            )
        )

        client.set_missing_host_key_policy(
            paramiko.RejectPolicy()
        )

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

            if (
                transport is None
                or not transport.is_active()
            ):
                raise RuntimeError(
                    "SSH transport unavailable"
                )

            transport.set_keepalive(15)

            return client

        except Exception as error:

            last_error = error
            client.close()

            if attempt < 3:
                time.sleep(attempt)

    raise RuntimeError(
        "Pinned SSH connection failed"
    ) from last_error


def execute_remote(
    credentials: dict[str, str],
    known_hosts: Path,
    command: str,
) -> None:

    client = connect(
        credentials,
        known_hosts,
    )

    try:

        transport = client.get_transport()

        if transport is None:
            raise RuntimeError(
                "SSH transport unavailable"
            )

        channel = transport.open_session(
            timeout=30
        )

        channel.set_combine_stderr(True)

        channel.exec_command(
            "bash -lc "
            + shlex.quote(command)
        )

        with channel.makefile("rb") as stream:

            while True:

                chunk = stream.read(8192)

                if not chunk:
                    break

                if isinstance(chunk, bytes):
                    text = chunk.decode(
                        "utf-8",
                        errors="replace",
                    )
                else:
                    text = str(chunk)

                print(
                    text,
                    end="",
                    flush=True,
                )

        code = channel.recv_exit_status()

        if code != 0:
            raise RuntimeError(
                f"Remote deployment exited with code {code}"
            )

    finally:
        client.close()


def main() -> None:

    parser = argparse.ArgumentParser(
        description=__doc__
    )

    parser.add_argument(
        "--credentials-file",
        type=Path,
        required=True,
    )

    parser.add_argument(
        "--known-hosts",
        type=Path,
        required=True,
    )

    parser.add_argument(
        "--release",
        required=True,
    )

    args = parser.parse_args()

    if not RELEASE_PATTERN.fullmatch(
        args.release
    ):
        raise ValueError(
            "Release must be a full lowercase Git SHA"
        )

    credentials = load_credentials(
        args.credentials_file
    )

    known_hosts = args.known_hosts.resolve(
        strict=True
    )

    release_root = (
        "/opt/life-planning/releases/"
        + args.release
    )

    image = (
        "life-planning:"
        + args.release
    )

    migrator = (
        "life-planning-migrator:"
        + args.release
    )

    quoted_root = shlex.quote(
        release_root
    )

    quoted_image = shlex.quote(
        image
    )

    quoted_migrator = shlex.quote(
        migrator
    )

    command = f"""
set -euo pipefail

ROOT=/opt/life-planning
RELEASE_ROOT={quoted_root}
IMAGE={quoted_image}
MIGRATOR={quoted_migrator}

echo "============================================================"
echo "FAST DEPLOY-ONLY PRECHECK"
echo "============================================================"

test -d "$RELEASE_ROOT"
test -f "$RELEASE_ROOT/scripts/deploy.py"
test -f "$RELEASE_ROOT/scripts/operations.py"
test -f "$RELEASE_ROOT/scripts/observability_release.py"
test -f "$RELEASE_ROOT/scripts/release_manifest.py"
test -f "$RELEASE_ROOT/release-manifest.json"

docker image inspect \
  "$IMAGE" \
  >/dev/null

docker image inspect \
  "$MIGRATOR" \
  >/dev/null

python3 "$RELEASE_ROOT/scripts/release_manifest.py" verify \
  --release {shlex.quote(args.release)} \
  --source-archive "$RELEASE_ROOT/source.tar" \
  --manifest "$RELEASE_ROOT/release-manifest.json"

echo "Release source : PRESENT"
echo "Application    : PRESENT"
echo "Migrator       : PRESENT"

echo
echo "============================================================"
echo "OBSERVABILITY PREPARE"
echo "============================================================"

cd "$RELEASE_ROOT"

python3 scripts/observability_release.py \
  prepare \
  --root "$ROOT" \
  --source "$RELEASE_ROOT"

echo
echo "============================================================"
echo "APPLICATION DEPLOY"
echo "============================================================"

python3 scripts/deploy.py \
  --root "$ROOT" \
  --source "$RELEASE_ROOT" \
  --image "$IMAGE"

echo
echo "============================================================"
echo "PRODUCTION SMOKE"
echo "============================================================"

python3 scripts/operations.py \
  smoke \
  --url https://myplan.oxytumzone.com

echo
echo "============================================================"
echo "OBSERVABILITY ACTIVATE"
echo "============================================================"

python3 scripts/observability_release.py \
  activate \
  --root "$ROOT" \
  --source "$RELEASE_ROOT" \
  --image "$IMAGE"

echo
echo "============================================================"
echo "FAST DEPLOY-ONLY SUCCESS"
echo "============================================================"

docker inspect \
  life-planning-app \
  --format 'Application={{.Config.Image}} Status={{.State.Status}}'

echo "Release=$IMAGE"
echo "DockerBuild=SKIPPED"
echo "ApplicationTests=SKIPPED"
echo "Playwright=SKIPPED"
"""

    execute_remote(
        credentials,
        known_hosts,
        command,
    )


if __name__ == "__main__":

    try:

        main()

    except (
        ValueError,
        OSError,
        RuntimeError,
        paramiko.SSHException,
    ) as error:

        print(
            "Fast deployment failed "
            f"({type(error).__name__}). "
            "Credentials were not logged.",
            file=sys.stderr,
        )

        raise SystemExit(1)