# parser/export_to_js.py
# -*- coding: utf-8 -*-
"""
Конвертер data/*.json → site/js/data/*.js.

Читает:  ../data/<doc_id>.json
Пишет:   ../site/js/data/<doc_id>.js
         ../site/js/data/_manifest.js
         ../site/js/data/changelog.js

Использование:
    python export_to_js.py
"""

import json
import pathlib


HERE = pathlib.Path(__file__).parent
DATA_DIR = HERE.parent / "data"
OUT_DIR = HERE.parent / "site" / "js" / "data"
CHANGELOG_FILE = HERE / "changelog.json"


DOC_IDS = [
    "ak", "pdd", "pk", "uk",
    "advocacy", "business", "courts", "duma", "emergency", "ethics",
    "government", "ministries", "parties", "secret", "service", "territories",
    "tk", "constitution", "fso", "weapons", "vs", "fsb",
    "police", "gibdd", "sk", "prosecutor", "health", "immunity",
]


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    manifest = {}

    for doc_id in DOC_IDS:
        src = DATA_DIR / f"{doc_id}.json"
        if not src.exists():
            print(f"⚠️  Пропуск {doc_id}: файл {src} не найден")
            continue

        with open(src, "r", encoding="utf-8") as f:
            data = json.load(f)

        var_name = doc_id.upper() + "_DATA"

        out = OUT_DIR / f"{doc_id}.js"
        with open(out, "w", encoding="utf-8") as f:
            f.write(f"window.{var_name} = ")
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
            f.write(";\n")

        def count_nodes(nodes):
            c = 0
            for n in nodes:
                c += 1
                if "children" in n:
                    c += count_nodes(n["children"])
            return c

        node_count = count_nodes(data.get("nodes", []))

        manifest[doc_id] = {
            "title": data.get("title", ""),
            "full_title": data.get("full_title", ""),
            "revision": data.get("revision", ""),
            "node_count": node_count,
        }

        print(f"  ✅ {doc_id:<14} → {out.name}  ({node_count} узлов)")

    # Манифест
    manifest_path = OUT_DIR / "_manifest.js"
    with open(manifest_path, "w", encoding="utf-8") as f:
        f.write("window.DOC_MANIFEST = ")
        json.dump(manifest, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    # Changelog
    changelog_path = OUT_DIR / "changelog.js"
    changelog_data = {"entries": []}
    if CHANGELOG_FILE.exists():
        with open(CHANGELOG_FILE, "r", encoding="utf-8") as f:
            changelog_data = json.load(f)

    entries = changelog_data.get("entries", [])

    with open(changelog_path, "w", encoding="utf-8") as f:
        f.write("window.CHANGELOG = ")
        json.dump(entries, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    print(f"\nВсего документов: {len(manifest)}")
    print(f"Манифест: {manifest_path}")
    print(f"Changelog: {changelog_path} ({len(entries)} записей)")


if __name__ == "__main__":
    main()