"""Run the existing local apps with one configuration source; never print secrets."""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]


def configuration():
    if os.name == 'nt':
        path = Path(os.environ['APPDATA']) / 'Microsoft/UserSecrets/legalservice-local-development/secrets.json'
    else:
        path = Path.home() / '.microsoft/usersecrets/legalservice-local-development/secrets.json'
    values = json.loads(path.read_text(encoding='utf-8-sig')) if path.exists() else {}

    def get(key):
        if key.replace(':', '__') in os.environ:
            return os.environ[key.replace(':', '__')]
        if key in values:
            return values[key]
        current = values
        for part in key.split(':'):
            current = current.get(part, {}) if isinstance(current, dict) else {}
        return current if isinstance(current, str) else ''

    return get


def main():
    get = configuration()
    required = ['ConnectionStrings:DefaultConnection', 'Jwt:Key', 'Ai:InternalKey']
    if any(not get(key) for key in required):
        raise SystemExit('Configure the database, JWT key and AI internal key in .NET User Secrets first. See docs/member1/README.md.')
    python = ROOT / 'ai-service/.venv' / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    if not python.exists():
        raise SystemExit('Install the existing ai-service virtual environment first.')
    api_env = os.environ.copy()
    for key in required:
        api_env[key.replace(':', '__')] = get(key)
    api_env['Ai__BaseUrl'] = 'http://127.0.0.1:8002/'
    ai_env = os.environ.copy()
    ai_env['AI_INTERNAL_KEY'] = get('Ai:InternalKey')
    ai_env['PLATFORM_API_BASE_URL'] = 'http://localhost:5295/api/'
    frontend_env = os.environ.copy()
    frontend_env['VITE_API_URL'] = 'http://localhost:5295'
    frontend_env['VITE_API_BASE_URL'] = 'http://localhost:5295/api'
    commands = [
        ('API', ['dotnet', 'run', '--no-restore', '--launch-profile', 'http', '--urls', 'http://localhost:5295'], ROOT / 'backend/LegalService.API', api_env),
        ('recommendation service', [str(python), '-m', 'uvicorn', 'lawyer_recommendation.app:app', '--host', '127.0.0.1', '--port', '8002'], ROOT / 'ai-service', ai_env),
        ('frontend', ['npm.cmd' if os.name == 'nt' else 'npm', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], ROOT / 'frontend', frontend_env),
    ]
    processes = []
    def stop(*_):
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, stop)
    try:
        for name, command, cwd, env in commands:
            processes.append((name, subprocess.Popen(command, cwd=cwd, env=env, start_new_session=os.name != 'nt')))
        print('Starting Member 1: frontend 5173, API 5295, internal AI 8002. Ctrl+C stops all three.', flush=True)
        while True:
            for name, process in processes:
                if process.poll() is not None:
                    raise SystemExit(f'{name} stopped (exit {process.returncode}). Check its preceding logs and port availability.')
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        for _, process in processes:
            try:
                if os.name != 'nt':
                    os.killpg(process.pid, signal.SIGTERM)
                elif process.poll() is None:
                    process.terminate()
            except ProcessLookupError:
                pass
        for _, process in processes:
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                if os.name != 'nt':
                    os.killpg(process.pid, signal.SIGKILL)
                else:
                    process.kill()
                process.wait()


if __name__ == '__main__':
    main()
