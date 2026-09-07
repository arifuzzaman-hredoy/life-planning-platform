#!/usr/bin/env python3
"""Run the production build and browser tests on a dedicated local CI port."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import subprocess
import time
from urllib.request import urlopen
from operations import env_file


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env-file', type=Path, required=True)
    parser.add_argument('--port', type=int, default=3317)
    args = parser.parse_args()
    if args.port < 1024 or args.port > 65535:
        raise ValueError('Use an unprivileged local port')
    base = f'http://127.0.0.1:{args.port}'
    environment = {**os.environ, **env_file(args.env_file), 'APP_URL': base,
                   'E2E_BASE_URL': base, 'RUN_E2E_TESTS': 'true',
                   'NEXT_TELEMETRY_DISABLED': '1'}
    Path('artifacts').mkdir(exist_ok=True)
    with Path('artifacts/e2e-server.log').open('w', encoding='utf-8') as log:
        process = subprocess.Popen(['node', 'node_modules/next/dist/bin/next', 'start',
                                    '--hostname', '127.0.0.1', '--port', str(args.port)],
                                   env={**environment, 'NODE_ENV': 'production'},
                                   stdout=log, stderr=subprocess.STDOUT)
        try:
            for _ in range(40):
                if process.poll() is not None:
                    raise RuntimeError('CI application process exited before readiness')
                try:
                    with urlopen(base + '/api/ready', timeout=3) as response:
                        if response.status == 200:
                            break
                except OSError:
                    pass
                time.sleep(1)
            else:
                raise RuntimeError('CI application did not become ready')
            result = subprocess.run(['node', 'node_modules/@playwright/test/cli.js', 'test'],
                                    env=environment, check=False)
            print(json.dumps({'browserChecksExitCode': result.returncode}))
            return result.returncode
        finally:
            process.terminate()
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=10)


if __name__ == '__main__':
    raise SystemExit(main())
