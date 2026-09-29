# parser/check_penalties.py
# -*- coding: utf-8 -*-
"""
Проверка data/*.json на проблемы с penalty:
  - инверсии from > to
  - «от X до Y» в raw, но без from/to в types
  - «от X» без to, «до Y» без from (подозрительно для диапазона)

Использование:
    python check_penalties.py
"""

import json
import re
import pathlib


HERE = pathlib.Path(__file__).parent
DATA_DIR = HERE.parent / "data"

RE_HAS_RANGE = re.compile(
    r"от\s+[\d\s]+\s*(?:руб[а-яё]*)?\s*до\s+[\d\s]+",
    re.IGNORECASE
)


def walk_articles(nodes, path=""):
    for n in nodes:
        if n.get("type") == "article":
            yield n, path
        if "children" in n:
            yield from walk_articles(n["children"], path)


def check_file(path):
    with open(path, "r", encoding="utf-8") as f:
        doc = json.load(f)

    doc_id = doc.get("id", path.stem)
    issues = []

    for art, _ in walk_articles(doc.get("nodes", [])):
        pen = art.get("penalty")
        if not pen:
            continue
        raw = pen.get("raw", "") or ""
        types = pen.get("types", []) or []

        fine = next((t for t in types if t.get("type") == "штраф"), None)

        if fine:
            fr, to = fine.get("from"), fine.get("to")
            # Инверсия
            if fr and to and fr > to:
                issues.append(("ИНВЕРСИЯ", art["number"], f"from={fr} > to={to}", raw[:100]))
            # Есть диапазон в raw, но нет обеих границ
            if RE_HAS_RANGE.search(raw):
                if not fr or not to:
                    issues.append(("ПРОПУЩЕН ДИАПАЗОН", art["number"], f"from={fr}, to={to}", raw[:100]))
        # Штраф упомянут, но объект пустой (ни from, ни to)
        elif "штраф" in raw.lower():
            issues.append(("ШТРАФ БЕЗ СУММ", art["number"], "нет types[штраф]", raw[:100]))

    return doc_id, issues


def main():
    files = sorted(DATA_DIR.glob("*.json"))
    if not files:
        print(f"❌ Нет файлов в {DATA_DIR}")
        return

    total_issues = 0
    for f in files:
        doc_id, issues = check_file(f)
        if issues:
            print(f"\n=== {doc_id} ({f.name}) ===")
            for kind, num, detail, raw in issues:
                print(f"  [{kind}] ст. {num}: {detail}")
                print(f"      raw: {raw}")
            total_issues += len(issues)

    print()
    if total_issues == 0:
        print("✅ Проблем не найдено.")
    else:
        print(f"⚠️  Всего проблем: {total_issues}")


if __name__ == "__main__":
    main()