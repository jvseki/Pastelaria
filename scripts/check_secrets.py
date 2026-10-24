"""Verificação local/CI de padrões conhecidos; nunca imprime valores secretos.

python scripts/check_secrets.py [--history]
Não substitui um scanner especializado nem a revogação de credenciais.
"""
import re
import subprocess
import sys
from pathlib import PurePosixPath

PATTERNS = {
    "token administrativo literal": re.compile(rb'(?:ADMIN_TOKEN\s*[:=]\s*["\']?|ADMIN_TOKEN\s*:\s*str\s*=\s*["\'])([A-Za-z0-9_-]{25,})'),
    "token GitHub": re.compile(rb'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})'),
    "chave privada": re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    "credencial Mercado Pago": re.compile(rb'(?:APP_USR|TEST)-\d{8,}-[A-Za-z0-9-]{25,}'),
    "chave Google API": re.compile(rb'AIza[A-Za-z0-9_-]{30,}'),
}


def git(*args):
    return subprocess.check_output(['git', *args], stderr=subprocess.DEVNULL)


def scan_data(path, data, revision='working-tree'):
    findings = []
    for number, line in enumerate(data.splitlines(), 1):
        for label, pattern in PATTERNS.items():
            if pattern.search(line):
                findings.append(f'{revision}:{path}:{number}: {label} (valor oculto)')
    return findings


def prohibited(path):
    name = PurePosixPath(path).name
    return (name == '.env' or (name.startswith('.env.') and not name.endswith('.example'))
            or name.endswith(('.db', '.sqlite', '.sqlite3', '.pem', '.key'))
            or name.startswith(('client_secret', 'service-account', 'credentials')))


def main():
    findings = []
    if '--history' in sys.argv:
        seen = set()
        for record in git('rev-list', '--objects', '--all').decode().splitlines():
            parts = record.split(' ', 1)
            if len(parts) != 2:
                continue
            oid, path = parts
            if oid in seen or git('cat-file', '-t', oid).strip() != b'blob':
                continue
            seen.add(oid)
            if prohibited(path):
                findings.append(f'{oid[:12]}:{path}: arquivo sensível no histórico')
            if int(git('cat-file', '-s', oid)) <= 2_000_000:
                findings += scan_data(path, git('cat-file', '-p', oid), oid[:12])
    else:
        from pathlib import Path
        for path in git('ls-files', '-z').decode().split('\0'):
            if not path:
                continue
            if prohibited(path):
                findings.append(f'{path}: arquivo sensível versionado')
            file = Path(path)
            if file.exists() and file.stat().st_size <= 2_000_000:
                findings += scan_data(path, file.read_bytes())
    for finding in findings:
        print(finding)
    print(f'{len(findings)} ocorrência(s). Valores de credenciais não foram exibidos.')
    return bool(findings)


if __name__ == '__main__':
    sys.exit(main())
