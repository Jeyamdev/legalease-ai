"""Opt-in checks against the running development stack; credentials stay local."""
import argparse
import importlib.util
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('member1_local', ROOT / 'scripts/start-member1-local.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('check', choices=['backend', 'browser', 'auth'])
    args = parser.parse_args()
    get = module.configuration()
    env = os.environ.copy()
    if args.check == 'backend':
        value = get('ConnectionStrings:DefaultConnection')
        if not value:
            raise SystemExit('Configure the approved development database in User Secrets first.')
        env['MEMBER1_TEST_POSTGRES'] = value
        command = ['dotnet', 'test', 'backend/LegalService.API.Tests/LegalService.API.Tests.csproj']
        cwd = ROOT
    else:
        for key, name in [('Member1Demo:AdminEmail', 'MEMBER1_ADMIN_EMAIL'), ('Member1Demo:AdminPassword', 'MEMBER1_ADMIN_PASSWORD')]:
            env[name] = env.get(name) or get(key)
            if not env[name]:
                raise SystemExit('Configure demo Admin credentials locally first; see docs/member1/README.md.')
        command = ['node', 'integration/auth-live.mjs' if args.check == 'auth' else 'integration/member1-live.mjs']
        cwd = ROOT / 'frontend'
    result = subprocess.run(command, cwd=cwd, env=env, capture_output=True, text=True)
    output = result.stdout + result.stderr
    for key in ['ConnectionStrings:DefaultConnection', 'Jwt:Key', 'Ai:InternalKey', 'Member1Demo:AdminPassword']:
        value = get(key)
        if value:
            output = output.replace(value, '[REDACTED]')
    for key in ['MEMBER1_ADMIN_PASSWORD', 'MEMBER1_TEST_POSTGRES']:
        if env.get(key):
            output = output.replace(env[key], '[REDACTED]')
    print(output, end='')
    raise SystemExit(result.returncode)


if __name__ == '__main__':
    main()
