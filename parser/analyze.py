# parser/analyze.py
# -*- coding: utf-8 -*-
"""
Анализ сырых данных из raw/*.json.
Показывает, какие структуры текста есть в каждом документе:
  - какие обозначения глав ("Глава 1." / "Глава I." / "Раздел I.")
  - какие обозначения статей ("Статья 1." / "Статья 1.1" / "Статья I.")
  - есть ли "Раздел", "Часть", "СОДЕРЖАНИЕ", "Преамбула"
  - сколько постов и общий объём
Ничего не парсит в структуру — просто даёт обзор.
"""

import json
import re
import pathlib
from collections import Counter, defaultdict


HERE = pathlib.Path(__file__).parent
RAW_DIR = HERE.parent / "raw"


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def analyze_text(text):
    """Возвращает счётчики по типам структурных элементов в тексте."""
    stats = {
        "chapters_arabic": 0,      # Глава 1. …
        "chapters_roman": 0,       # Глава I. …
        "chapters_other": 0,       # Глава что-то ещё
        "articles_dotted": 0,      # Статья 1.1. …
        "articles_simple": 0,      # Статья 1. …
        "articles_other": 0,       # Статья что-то ещё
        "sections": 0,             # Раздел I / Раздел 1
        "parts_upper": 0,          # ОБЩАЯ ЧАСТЬ / ОСОБЕННАЯ ЧАСТЬ
        "has_toc": False,          # СОДЕРЖАНИЕ
        "has_preamble": False,     # Преамбула
        "has_penalty_lines": 0,    # "Наказание: …"
        "parts_numbered": 0,       # "1. текст"
        "parts_ch": 0,             # "ч. 1 текст"
        "parts_dash": 0,           # "- текст"
    }

    lines = text.split("\n")

    re_ch_arab = re.compile(r"^\s*Глава\s+\d+\.", re.IGNORECASE)
    re_ch_roman = re.compile(r"^\s*Глава\s+[IVXLC]+\.", re.IGNORECASE)
    re_ch_any = re.compile(r"^\s*Глава\s+", re.IGNORECASE)

    re_ar_dotted = re.compile(r"^\s*Статья\s+\d+\.\d+", re.IGNORECASE)
    re_ar_simple = re.compile(r"^\s*Статья\s+\d+\.?\s", re.IGNORECASE)
    re_ar_any = re.compile(r"^\s*Статья\s+", re.IGNORECASE)

    re_section = re.compile(r"^\s*Раздел\s+", re.IGNORECASE)
    re_part_upper = re.compile(r"^\s*(ОБЩАЯ ЧАСТЬ|ОСОБЕННАЯ ЧАСТЬ)\s*$", re.IGNORECASE)
    re_toc = re.compile(r"^\s*СОДЕРЖАНИЕ\s*$", re.IGNORECASE)
    re_preamble = re.compile(r"^\s*Преамбула\s*$", re.IGNORECASE)
    re_penalty = re.compile(r"^\s*Наказание\s*:", re.IGNORECASE)
    re_part_num = re.compile(r"^\s*\d+\.\s+\S")
    re_part_ch = re.compile(r"^\s*ч\.\s*\d+", re.IGNORECASE)
    re_part_dash = re.compile(r"^\s*[-\u2014]\s+\S")

    for line in lines:
        if re_ch_arab.match(line):
            stats["chapters_arabic"] += 1
        elif re_ch_roman.match(line):
            stats["chapters_roman"] += 1
        elif re_ch_any.match(line):
            stats["chapters_other"] += 1

        if re_ar_dotted.match(line):
            stats["articles_dotted"] += 1
        elif re_ar_simple.match(line):
            stats["articles_simple"] += 1
        elif re_ar_any.match(line):
            stats["articles_other"] += 1

        if re_section.match(line):
            stats["sections"] += 1
        if re_part_upper.match(line):
            stats["parts_upper"] += 1
        if re_toc.match(line):
            stats["has_toc"] = True
        if re_preamble.match(line):
            stats["has_preamble"] = True
        if re_penalty.match(line):
            stats["has_penalty_lines"] += 1
        if re_part_num.match(line):
            stats["parts_numbered"] += 1
        if re_part_ch.match(line):
            stats["parts_ch"] += 1
        if re_part_dash.match(line):
            stats["parts_dash"] += 1

    return stats


def main():
    if not RAW_DIR.exists():
        print(f"❌ Нет папки {RAW_DIR}")
        return

    files = sorted(RAW_DIR.glob("*.json"))
    if not files:
        print(f"❌ Нет *.json в {RAW_DIR}")
        return

    print(f"Найдено {len(files)} файлов.\n")

    results = []
    for f in files:
        data = load_json(f)
        tid = data.get("thread_id", "?")
        doc_id = data.get("doc_id", "—")
        title = data.get("thread_title", "")[:50]
        posts = data.get("posts", [])
        full_text = "\n".join(p.get("text", "") for p in posts)
        total_chars = len(full_text)

        stats = analyze_text(full_text)

        results.append({
            "file": f.name,
            "tid": tid,
            "doc_id": doc_id,
            "title": title,
            "posts": len(posts),
            "chars": total_chars,
            "stats": stats,
        })

    # ---- Сводная таблица ----
    print("=" * 130)
    print(f"{'doc_id':<14} {'tid':<6} {'ch':>4} {'a.dotted':>9} {'a.simple':>9} "
          f"{'sec':>4} {'part':>5} {'#p':>4} {'p.n':>5} {'p.ch':>5} "
          f"{'pen':>4} {'toc':>4} {'pre':>4} {'chars':>7}")
    print("=" * 130)

    for r in results:
        s = r["stats"]
        print(f"{r['doc_id']:<14} {r['tid']:<6} "
              f"{s['chapters_arabic']+s['chapters_roman']+s['chapters_other']:>4} "
              f"{s['articles_dotted']:>9} {s['articles_simple']:>9} "
              f"{s['sections']:>4} {s['parts_upper']:>5} "
              f"{r['posts']:>4} {s['parts_numbered']:>5} {s['parts_ch']:>5} "
              f"{s['has_penalty_lines']:>4} "
              f"{'Y' if s['has_toc'] else '.':>4} "
              f"{'Y' if s['has_preamble'] else '.':>4} "
              f"{r['chars']:>7}")

    print("=" * 130)
    print()
    print("Легенда:")
    print("  ch        — всего 'Глава …' (арабские+римские+прочие)")
    print("  a.dotted  — 'Статья X.Y'  (1.1, 14.2)")
    print("  a.simple  — 'Статья X'    (1, 2, 14)")
    print("  sec       — 'Раздел …'")
    print("  part      — 'ОБЩАЯ ЧАСТЬ' / 'ОСОБЕННАЯ ЧАСТЬ'")
    print("  #p        — количество постов в теме")
    print("  p.n       — пункты '1. текст'")
    print("  p.ch      — пункты 'ч. 1 текст'")
    print("  pen       — строки 'Наказание: …'")
    print("  toc       — есть ли 'СОДЕРЖАНИЕ'")
    print("  pre       — есть ли 'Преамбула'")
    print()

    # ---- Группировка по типам ----
    print("=" * 80)
    print("ТИПЫ ДОКУМЕНТОВ")
    print("=" * 80)

    groups = defaultdict(list)
    for r in results:
        s = r["stats"]
        ch_total = s["chapters_arabic"] + s["chapters_roman"] + s["chapters_other"]
        ar_total = s["articles_dotted"] + s["articles_simple"] + s["articles_other"]

        if ch_total == 0 and ar_total == 0:
            g = "БЕЗ СТРУКТУРЫ (нет глав и статей)"
        elif s["chapters_arabic"] > 0 and s["chapters_roman"] == 0:
            g = "Арабские главы (Глава 1.)"
        elif s["chapters_roman"] > 0 and s["chapters_arabic"] == 0:
            g = "Римские главы (Глава I.)"
        elif ch_total > 0:
            g = "Смешанные главы"
        else:
            g = "Только статьи (без глав)"

        groups[g].append(r)

    for g, items in groups.items():
        print(f"\n[{g}] — {len(items)} документов:")
        for r in items:
            s = r["stats"]
            ch = s["chapters_arabic"] + s["chapters_roman"] + s["chapters_other"]
            ar = s["articles_dotted"] + s["articles_simple"] + s["articles_other"]
            print(f"  • {r['doc_id']:<14} {r['title'][:60]}")
            print(f"      постов={r['posts']}, chars={r['chars']}, "
                  f"глав={ch}, статей={ar}, "
                  f"араб={s['chapters_arabic']}, рим={s['chapters_roman']}, "
                  f"разделов={s['sections']}, ЧАСТЬ={s['parts_upper']}, "
                  f"пунктов={s['parts_numbered']+s['parts_ch']}, "
                  f"Наказание={s['has_penalty_lines']}"
                  + (", СОДЕРЖАНИЕ" if s["has_toc"] else "")
                  + (", Преамбула" if s["has_preamble"] else ""))

    # ---- Сохраняем отчёт ----
    out = HERE / "analyze_report.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\nПолный отчёт сохранён: {out}")


if __name__ == "__main__":
    main()