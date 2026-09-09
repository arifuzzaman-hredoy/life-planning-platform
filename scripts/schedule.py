#!/usr/bin/env python3
"""Run due in-app routines using the private project scheduler token."""
import argparse
import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, required=True)
    parser.add_argument("--url", default="http://127.0.0.1:3217")
    args = parser.parse_args()
    if args.url not in {"http://127.0.0.1:3217", "https://myplan.oxytumzone.com"}:
        raise ValueError("Only the project's approved application is allowed")
    values = {}
    for line in args.env_file.read_text(encoding="utf-8-sig").splitlines():
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    token = values.get("APP_CRON_SECRET", "")
    if len(token) < 32:
        raise ValueError("Scheduler token is missing")
    request = Request(args.url + "/api/internal/automations", data=b"{}", method="POST",
                      headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
    try:
        with urlopen(request, timeout=65) as response:
            result = json.load(response)
        print(json.dumps({"status": "ok", **result.get("data", {})}))
    except (HTTPError, URLError, TimeoutError):
        raise RuntimeError("Application scheduler request failed") from None


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print(json.dumps({"status": "error", "message": "Application scheduler request failed"}))
        raise SystemExit(1) from None
