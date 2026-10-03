#!/usr/bin/env python3
"""
Генератор app_changelog.js из git-истории.

Читает коммиты после последнего опубликованного (по hash из app_changelog.js),
фильтрует по префиксам feat/fix/ui/perf, дописывает новые записи сверху,
проставляет текущую версию из VERSION.

Запуск:
    python parser/gen_app_changelog.py
    python parser/gen_app_changelog.py --dry-run
    python parser/gen_app_changelog.py --allow-same-version
"""

import argparse
import json
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

# === Пути (относительно корня проекта) ===
ROOT          = Path(__file__).resolve().parent.parent
VERSION_FILE  = ROOT / 'VERSION'
OUTPUT_FILE   = ROOT / 'site' / 'js' / 'data' / 'app_changelog.js'

# === Правила ===
# Префиксы, которые попадают в пользовательский changelog.
KEEP_PREFIXES = {
    'feat': 'new',
    'fix':  'fix',
    'ui':   'ui',
    'perf': 'perf',
}
# Префиксы, которые игнорируются молча.
IGNORE_PREFIXES = {'data', 'docs', 'chore', 'refactor', 'test', 'style', 'release'}

MAX_ENTRIES = 200  # сколько записей хранить в файле

# Формат: "feat: текст" или "feat(scope): текст"
RE_COMMIT = re.compile(r'^(?P<prefix>[a-z]+)(?:\([^)]+\))?:\s*(?P<text>.+)$')


def read_version() -> str:
    if not VERSION_FILE.exists():
        print(f'[!] Не найден файл {VERSION_FILE}', file=sys.stderr)
        sys.exit(1)
    v = VERSION_FILE.read_text(encoding='utf-8').strip()
    if not re.fullmatch(r'\d+\.\d+\.\d+', v):
        print(f'[!] VERSION должен быть в формате X.Y.Z, получено: {v!r}',
              file=sys.stderr)
        sys.exit(1)
    return v


def read_existing_entries() -> list:
    """Читает текущий app_changelog.js и возвращает список записей."""
    if not OUTPUT_FILE.exists():
        return []
    raw = OUTPUT_FILE.read_text(encoding='utf-8')
    m = re.search(r'window\.APP_CHANGELOG\s*=\s*(\[.*?\]);', raw, re.DOTALL)
    if not m:
        print(f'[!] Не удалось найти window.APP_CHANGELOG в {OUTPUT_FILE}',
              file=sys.stderr)
        return []
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError as e:
        print(f'[!] Битый JSON в {OUTPUT_FILE}: {e}', file=sys.stderr)
        return []


def last_hash(entries: list) -> str | None:
    """hash самой свежей записи (entries[0], если список свежие-сверху)."""
    for e in entries:
        h = e.get('hash')
        if h:
            return h
    return None


def git_log_since(since_hash: str | None) -> list:
    """Возвращает список (hash, subject) от since_hash (exclusive) до HEAD."""
    if since_hash:
        range_spec = f'{since_hash}..HEAD'
    else:
        range_spec = 'HEAD'

    try:
        out = subprocess.check_output(
            ['git', 'log', range_spec, '--pretty=format:%H|%s', '--reverse'],
            cwd=ROOT, text=True, stderr=subprocess.PIPE,
        )
    except subprocess.CalledProcessError as e:
        print(f'[!] git log упал: {e.stderr}', file=sys.stderr)
        sys.exit(1)

    result = []
    for line in out.splitlines():
        if '|' not in line:
            continue
        h, subject = line.split('|', 1)
        result.append((h.strip(), subject.strip()))
    return result


def parse_commit(subject: str):
    """Возвращает (kind, text) или None, если коммит игнорируется."""
    m = RE_COMMIT.match(subject)
    if not m:
        return None
    prefix = m.group('prefix').lower()
    text = m.group('text').strip()

    if prefix in IGNORE_PREFIXES:
        return None
    if prefix not in KEEP_PREFIXES:
        return None  # неизвестный префикс — молча пропускаем

    return KEEP_PREFIXES[prefix], text


def build_new_entries(commits: list, version: str) -> list:
    today = date.today().isoformat()
    entries = []
    for h, subject in commits:
        parsed = parse_commit(subject)
        if not parsed:
            continue
        kind, text = parsed
        entries.append({
            'version': version,
            'date': today,
            'kind': kind,
            'text': text,
            'hash': h[:7],
        })
    return entries


def write_entries(entries: list):
    entries = entries[:MAX_ENTRIES]
    payload = json.dumps(entries, ensure_ascii=False, indent=2)
    content = (
        '// Генерируется автоматически скриптом parser/gen_app_changelog.py.\n'
        '// Не редактировать вручную — при следующем запуске изменения будут\n'
        '// перезаписаны. Чтобы добавить запись вручную, сделайте коммит с\n'
        '// префиксом feat: / fix: / ui: / perf: и запустите скрипт.\n'
        f'window.APP_CHANGELOG = {payload};\n'
    )
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(content, encoding='utf-8')


def main():
    ap = argparse.ArgumentParser(description='Генератор app_changelog.js из git.')
    ap.add_argument('--dry-run', action='store_true',
                    help='Не писать файл, только показать, что будет добавлено.')
    ap.add_argument('--allow-same-version', action='store_true',
                    help='Разрешить выпуск записей с той же версией, что у предыдущих.')
    args = ap.parse_args()

    version = read_version()
    existing = read_existing_entries()

    # Проверка на смену версии.
    if existing and not args.allow_same_version:
        prev_versions = {e.get('version') for e in existing if e.get('version')}
        if prev_versions and version in prev_versions:
            print(f'[!] VERSION не изменился с прошлого релиза: {version}')
            print('    Обновите VERSION или запустите с --allow-same-version.')
            sys.exit(1)

    since = last_hash(existing)
    if since:
        print(f'[i] Читаю коммиты после {since}')
    else:
        print('[i] Читаю всю историю (первый запуск)')

    commits = git_log_since(since)
    new_entries = build_new_entries(commits, version)

    if not new_entries:
        print('[i] Нет коммитов с префиксами feat/fix/ui/perf — нечего добавлять.')
        return

    print(f'[i] Новых записей: {len(new_entries)}')
    for e in new_entries:
        print(f"    [{e['kind']:5}] {e['text']}")

    if args.dry_run:
        print('[i] --dry-run: файл не изменён.')
        return

    # Новые — сверху (свежие первыми).
    merged = new_entries[::-1] + existing
    write_entries(merged)
    print(f'[✓] Записано в {OUTPUT_FILE.relative_to(ROOT)}')


if __name__ == '__main__':
    main()