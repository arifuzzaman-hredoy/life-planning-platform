#!/usr/bin/env python3
"""Deploy only the life-planning Docker resources. Run on the authorized VPS."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
from urllib.request import urlopen


def execute(command: list[str], capture: bool = False) -> str:
    result = subprocess.run(command, check=True, text=True, capture_output=capture)
    return result.stdout if capture else ""


def verify_plan(document: dict) -> None:
    allowed = {"docker_container.app", "docker_network.app"}
    for change in document.get("resource_changes", []):
        actions = change["change"]["actions"]
        if actions == ["no-op"]:
            continue
        if change["address"] not in allowed:
            raise ValueError("Plan touches resources outside this application")
        if change["address"] == "docker_network.app" and "delete" in actions:
            raise ValueError("The shared application network must not be destroyed")


def ready() -> bool:
    for _ in range(30):
        try:
            with urlopen("http://127.0.0.1:3217/api/ready", timeout=5) as response:
                if response.status == 200:
                    return True
        except OSError:
            pass
        time.sleep(2)
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("/opt/life-planning"))
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--image", required=True)
    parser.add_argument("--skip-migration", action="store_true", help="Use only for rollback to a previously deployed image")
    args = parser.parse_args()
    if os.name != "posix" or args.root.resolve() != Path("/opt/life-planning"):
        raise ValueError("Deployment root must be /opt/life-planning on Linux")
    if not re.fullmatch(r"life-planning:[a-zA-Z0-9][a-zA-Z0-9_.-]+", args.image) or args.image.endswith(":latest"):
        raise ValueError("A versioned project image is required")
    root = args.root.resolve()
    source = args.source.resolve(strict=True)
    environment = root / "shared/app.env"
    if not environment.is_file():
        raise ValueError("Provision the private app environment before deployment")
    terraform = root / "tools/terraform"
    if not terraform.is_file():
        raise ValueError("Install verified Terraform under the project tools directory")
    state = root / "terraform"
    state.mkdir(mode=0o700, exist_ok=True)
    os.chmod(state, 0o700)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    history = root / "backups" / f"deployment-{stamp}"
    history.mkdir(parents=True, mode=0o700)
    for existing in state.iterdir():
        if existing.is_file() and (existing.suffix == ".tf" or existing.name in {"terraform.tfstate", ".terraform.lock.hcl"}):
            shutil.copy2(existing, history / existing.name)
    old_image = None
    old = subprocess.run(["docker", "inspect", "life-planning-app", "--format", "{{.Config.Image}}"],
                         text=True, capture_output=True, check=False)
    if old.returncode == 0:
        old_image = old.stdout.strip()
    execute(["docker", "image", "inspect", args.image], capture=True)
    for config in (source / "infra/terraform").glob("*.tf"):
        shutil.copy2(config, state / config.name)
    lock = source / "infra/terraform/.terraform.lock.hcl"
    if lock.is_file():
        shutil.copy2(lock, state / lock.name)
    prefix = [str(terraform), f"-chdir={state}"]
    execute([*prefix, "init", "-input=false"])
    execute([*prefix, "validate"])
    plan = state / "release.tfplan"
    execute([*prefix, "plan", "-input=false", f"-var=image={args.image}", f"-out={plan}"])
    verify_plan(json.loads(execute([*prefix, "show", "-json", str(plan)], capture=True)))
    if not args.skip_migration:
        migrator = args.image.replace("life-planning:", "life-planning-migrator:", 1)
        execute(["docker", "run", "--rm", "--memory=384m", "--cpus=0.5", "--user=1001:1001",
                 "--read-only", "--tmpfs=/tmp:size=64m", "--cap-drop=ALL",
                 "--security-opt=no-new-privileges:true", "--env=HOME=/tmp",
                 "--mount", f"type=bind,src={environment},dst=/run/secrets/app.env,readonly",
                 migrator, "node", "--env-file=/run/secrets/app.env", "node_modules/prisma/build/index.js", "migrate", "deploy"])
    try:
        execute([*prefix, "apply", "-input=false", str(plan)])
        if not ready():
            raise RuntimeError("Application database readiness failed")
    except (RuntimeError, subprocess.CalledProcessError):
        if old_image and old_image != args.image:
            rollback = state / "rollback.tfplan"
            execute([*prefix, "plan", "-input=false", f"-var=image={old_image}", f"-out={rollback}"])
            verify_plan(json.loads(execute([*prefix, "show", "-json", str(rollback)], capture=True)))
            execute([*prefix, "apply", "-input=false", str(rollback)])
            if not ready():
                raise RuntimeError("Rollback needs operator attention")
        raise
    (history / "release.json").write_text(json.dumps({"image": args.image, "previousImage": old_image,
                                         "deployedAt": stamp, "ready": True}, indent=2) + "\n")
    print(json.dumps({"status": "deployed", "image": args.image, "ready": True}))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, RuntimeError, subprocess.SubprocessError) as error:
        print(f"Deployment failed ({type(error).__name__}). Check the private deployment log.", file=sys.stderr)
        raise SystemExit(1)
