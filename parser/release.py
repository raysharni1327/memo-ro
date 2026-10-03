#!/usr/bin/env python3
"""
Релиз приложения: обновляет VERSION, генерирует app_changelog.js,
коммитит изменения, опционально ставит тег и пушит.

Запуск из корня проекта:
    python parser/release.py 1.2.0
    python parser/release.py 1.2.0 --tag
    python parser/release.py 1.2.0 --tag --push
    python parser/release.py 1.2.0 --dry-run
    python parser/release.py 1.2.0 --yes      # без подтверждения
"""

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT         = Path(__file__).resolve().parent.parent
VERSION_FILE = ROOT / 'VERSION'
CHANGELOG_JS = ROOT / 'site' / 'js' / 'data' / 'app_changelog.js'
GEN_SCRIPT   = ROOT / 'parser' / 'gen_app_changelog.py'

RE_VERSION = re.compile(r'^\d+\.\d+\.\d+$')


# === Вспомогательное ===

def run(cmd, check=True, capture=False):
    """Запускает команду в ROOT. Возвращает CompletedProcess или падает."""
    env = os.environ.copy()
    env['LC_ALL'] = 'C.UTF-8'
    env['LANG'] = 'C.UTF-8'
    env['PYTHONIOENCODING'] = 'utf-8'

    result = subprocess.run(
        cmd, cwd=ROOT, env=env,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
        check=False,
    )
    if check and result.returncode != 0:
        stderr = ''
        if capture and result.stderr:
            stderr = result.stderr.decode('utf-8', errors='replace')
        print(f'[!] Команда упала (code {result.returncode}): {" ".join(cmd)}',
              file=sys.stderr)
        if stderr:
            print(stderr, file=sys.stderr)
        sys.exit(1)
    return result


def run_capture(cmd):
    """Запускает и возвращает stdout как строку UTF-8."""
    r = run(cmd, capture=True)
    return r.stdout.decode('utf-8', errors='replace')


def read_current_version():
    if not VERSION_FILE.exists():
        print(f'[!] Не найден {VERSION_FILE}', file=sys.stderr)
        sys.exit(1)
    v = VERSION_FILE.read_text(encoding='utf-8').strip()
    if not RE_VERSION.match(v):
        print(f'[!] VERSION не в формате X.Y.Z: {v!r}', file=sys.stderr)
        sys.exit(1)
    return v


def parse_version(s):
    if not RE_VERSION.match(s):
        print(f'[!] Версия должна быть в формате X.Y.Z, получено: {s!r}',
              file=sys.stderr)
        sys.exit(1)
    return tuple(int(x) for x in s.split('.'))


def working_tree_is_dirty():
    out = run_capture(['git', 'status', '--porcelain'])
    return bool(out.strip())


def count_changelog_entries():
    """Возвращает число записей в app_changelog.js (грубо, по 'hash':)."""
    if not CHANGELOG_JS.exists():
        return 0
    text = CHANGELOG_JS.read_text(encoding='utf-8')
    return text.count('"hash"')


def count_user_commits_since_last_release():
    """
    Сколько коммитов с префиксами feat/fix/ui/perf после последнего release-коммита.
    """
    out = run_capture([
        'git', 'log',
        '--pretty=format:%s',
        '--grep=^release:',
        '-n', '1',
    ]).strip()

    # Найти hash последнего release-коммита.
    release_hash_out = run_capture([
        'git', 'log', '--pretty=format:%H|%s',
    ])
    release_hash = None
    for line in release_hash_out.splitlines():
        if '|' not in line:
            continue
        h, s = line.split('|', 1)
        if s.startswith('release:'):
            release_hash = h.strip()
            break

    if release_hash:
        range_spec = f'{release_hash}..HEAD'
    else:
        range_spec = 'HEAD'

    log = run_capture(['git', 'log', range_spec, '--pretty=format:%s'])
    patterns = ('feat:', 'fix:', 'ui:', 'perf:')
    count = 0
    for line in log.splitlines():
        if line.startswith(patterns):
            count += 1
    return count


# === Основной сценарий ===

def main():
    ap = argparse.ArgumentParser(
        description='Релиз приложения: VERSION + app_changelog.js + commit.'
    )
    ap.add_argument('version', help='Целевая версия, например 1.2.0')
    ap.add_argument('--tag', action='store_true',
                    help='Поставить git-тег vX.Y.Z после коммита.')
    ap.add_argument('--push', action='store_true',
                    help='Запушить коммит (и тег) в origin.')
    ap.add_argument('--dry-run', action='store_true',
                    help='Не менять файлы, не коммитить — только показать план.')
    ap.add_argument('--yes', action='store_true',
                    help='Не спрашивать подтверждение.')
    args = ap.parse_args()

    # 1. Проверка версии
    current = read_current_version()
    new_tup = parse_version(args.version)
    cur_tup = parse_version(current)
    if new_tup <= cur_tup:
        print(f'[!] Новая версия {args.version} не больше текущей {current}.',
              file=sys.stderr)
        sys.exit(1)

    # 2. Проверка рабочего дерева
    if working_tree_is_dirty() and not args.dry_run:
        print('[!] Рабочее дерево грязное. Сначала закоммитьте изменения:',
              file=sys.stderr)
        print(run_capture(['git', 'status', '--short']), file=sys.stderr)
        sys.exit(1)

    # 3. Сколько пользовательских коммитов накопилось
    user_commits = count_user_commits_since_last_release()
    entries_before = count_changelog_entries()

    # 4. Показываем план
    print()
    print(f'  Текущая версия:    {current}')
    print(f'  Новая версия:      {args.version}')
    print(f'  Пользовательских коммитов с последнего релиза: {user_commits}')
    print(f'  Записей в app_changelog.js сейчас:             {entries_before}')
    print(f'  Тег v{args.version}: {"да" if args.tag else "нет"}')
    print(f'  Push:              {"да" if args.push else "нет"}')
    print()

    if user_commits == 0:
        print('[i] Внимание: с прошлого релиза нет коммитов с префиксами')
        print('    feat/fix/ui/perf. В app_changelog.js новых записей не появится.')
        print()

    if args.dry_run:
        print('[i] --dry-run: ничего не изменено.')
        return

    # 5. Подтверждение
    if not args.yes:
        answer = input(f'Выпустить релиз v{args.version}? [y/N] ').strip().lower()
        if answer not in ('y', 'yes', 'д', 'да'):
            print('[i] Отменено.')
            return

    # 6. Обновляем VERSION
    VERSION_FILE.write_text(args.version, encoding='utf-8')
    print(f'[✓] VERSION → {args.version}')

    # 7. Запускаем генератор changelog
    print('[i] Запускаю gen_app_changelog.py...')
    r = subprocess.run(
        [sys.executable, str(GEN_SCRIPT)],
        cwd=ROOT,
    )
    if r.returncode != 0:
        # Откатываем VERSION, чтобы не оставлять полу-релиз.
        VERSION_FILE.write_text(current, encoding='utf-8')
        print(f'[!] Генератор упал, VERSION откачен к {current}.', file=sys.stderr)
        sys.exit(1)

    entries_after = count_changelog_entries()
    added = entries_after - entries_before
    if added > 0:
        print(f'[✓] app_changelog.js: +{added} записей (всего {entries_after})')
    else:
        print('[i] app_changelog.js: новых записей нет.')

    # 8. Git add + commit
    run(['git', 'add', 'VERSION', 'site/js/data/app_changelog.js'])
    run(['git', 'commit', '-m', f'release: v{args.version}'])
    print(f'[✓] Закоммичено: release: v{args.version}')

    # 9. Тег
    if args.tag:
        tag_name = f'v{args.version}'
        # Если тег уже существует — упадём, это ок.
        run(['git', 'tag', tag_name])
        print(f'[✓] Поставлен тег {tag_name}')

    # 10. Push
    if args.push:
        run(['git', 'push'])
        if args.tag:
            run(['git', 'push', 'origin', f'v{args.version}'])
        print('[✓] Запушено в origin')

    print()
    print(f'Релиз v{args.version} готов.')


if __name__ == '__main__':
    main()