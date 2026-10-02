# parser/update_all.py
# -*- coding: utf-8 -*-
"""
Единая точка входа в пайплайн проекта «Правовая памятка РО».

Прогоняет шаги по порядку:
    1. run_raw.py       — собрать посты с форума (опционально)
    2. parse.py         — распарсить в data/*.json (+ diff + cache)
    3. check_penalties.py — валидация штрафов
    4. export_to_js.py  — выгрузить в site/js/data/*.js
    5. bump_cache_version — поднять CACHE_VERSION в site/sw.js

Останавливается при ошибке любого шага, чтобы не гнать дальше битые данные.

Использование:
    python update_all.py                 # всё, включая run_raw
    python update_all.py --skip-raw      # без сбора с форума
    python update_all.py --only ak       # только один документ
    python update_all.py --no-bump       # не трогать CACHE_VERSION
    python update_all.py --skip-check    # пропустить check_penalties
"""

import argparse
import pathlib
import re
import subprocess
import sys


HERE = pathlib.Path(__file__).parent
ROOT = HERE.parent
SW_FILE = ROOT / "site" / "sw.js"


# ============================================================
# Хелперы
# ============================================================

def run_step(name, args, cwd=HERE):
    """
    Запускает подпроцесс (python-скрипт), стримит stdout/stderr,
    возвращает True при коде 0.
    """
    print()
    print("=" * 60)
    print(f"▶  {name}")
    print("=" * 60)

    try:
        result = subprocess.run(
            [sys.executable] + args,
            cwd=str(cwd),
            check=False,
        )
    except FileNotFoundError as e:
        print(f"❌ Не удалось запустить: {e}")
        return False

    if result.returncode != 0:
        print()
        print(f"❌ Шаг «{name}» завершился с кодом {result.returncode}.")
        print("Пайплайн остановлен.")
        return False

    return True


def read_cache_version():
    """Читает CACHE_VERSION из site/sw.js. Возвращает строку 'v19' или None."""
    if not SW_FILE.exists():
        return None

    text = SW_FILE.read_text(encoding="utf-8")
    m = re.search(r"const\s+CACHE_VERSION\s*=\s*['\"]([^'\"]+)['\"]", text)
    return m.group(1) if m else None


def bump_cache_version():
    """
    Поднимает CACHE_VERSION в site/sw.js на 1.
    Возвращает (старая, новая) или (None, None), если не удалось.
    """
    if not SW_FILE.exists():
        print(f"⚠  Файл {SW_FILE} не найден, пропускаю bump.")
        return None, None

    text = SW_FILE.read_text(encoding="utf-8")
    m = re.search(r"(const\s+CACHE_VERSION\s*=\s*['\"])([^'\"]+)(['\"])", text)
    if not m:
        print(f"⚠  Не нашёл CACHE_VERSION в {SW_FILE}, пропускаю bump.")
        return None, None

    old_value = m.group(2)
    new_value = increment_version(old_value)

    new_text = text[:m.start(2)] + new_value + text[m.end(2):]
    SW_FILE.write_text(new_text, encoding="utf-8")

    print(f"✅ CACHE_VERSION: {old_value} → {new_value}")
    return old_value, new_value


def increment_version(v):
    """
    'v19'  → 'v20'
    'v1'   → 'v2'
    '1'    → '2'
    'abc'  → 'abc1'
    """
    m = re.match(r"^(.*?)(\d+)$", v)
    if not m:
        return v + "1"
    prefix, num = m.group(1), m.group(2)
    return f"{prefix}{int(num) + 1}"


# ============================================================
# Main
# ============================================================

def main():
    ap = argparse.ArgumentParser(description="Полный пайплайн проекта.")
    ap.add_argument("--only", type=str,
                    help="doc_id для одного документа (передаётся в run_raw и parse)")
    ap.add_argument("--skip-raw", action="store_true",
                    help="не запускать run_raw.py (использовать текущий raw/)")
    ap.add_argument("--skip-check", action="store_true",
                    help="не запускать check_penalties.py")
    ap.add_argument("--no-bump", action="store_true",
                    help="не поднимать CACHE_VERSION в site/sw.js")
    args = ap.parse_args()

    old_cache = read_cache_version()
    print(f"Пайплайн запущен. Текущий CACHE_VERSION: {old_cache or '—'}")

    # --- 1. run_raw ---
    if not args.skip_raw:
        cmd = ["run_raw.py", "--no-ask"]
        if args.only:
            cmd += ["--only", args.only]
        if not run_step("run_raw.py — сбор с форума", cmd):
            return 1
    else:
        print("\n▶  run_raw.py пропущен (--skip-raw).")

    # --- 2. parse ---
    cmd = ["parse.py"]
    if args.only:
        cmd += ["--only", args.only]
    if not run_step("parse.py — разбор в дерево", cmd):
        return 1

    # --- 3. check_penalties ---
    if not args.skip_check:
        if not run_step("check_penalties.py — валидация штрафов", ["check_penalties.py"]):
            return 1
    else:
        print("\n▶  check_penalties.py пропущен (--skip-check).")

    # --- 4. export_to_js ---
    if not run_step("export_to_js.py — выгрузка в JS", ["export_to_js.py"]):
        return 1

    # --- 5. bump CACHE_VERSION ---
    print()
    print("=" * 60)
    print("▶  bump CACHE_VERSION в site/sw.js")
    print("=" * 60)

    if args.no_bump:
        print("⏭  Пропущено (--no-bump). Не забудь поднять версию вручную!")
    else:
        new_cache = bump_cache_version()
        if new_cache[0] is None:
            print("⚠  CACHE_VERSION не изменён.")

    # --- Итог ---
    print()
    print("=" * 60)
    print("✅ Пайплайн завершён.")
    print("=" * 60)
    print()
    print("Что дальше:")
    print("  1. Проверь сайт в браузере (Ctrl+Shift+R дважды).")
    print("  2. git add data/ parser/cache/ parser/changelog.json site/js/data/ site/sw.js")
    print("     git commit -m \"Обновление данных\"")

    return 0


if __name__ == "__main__":
    sys.exit(main())