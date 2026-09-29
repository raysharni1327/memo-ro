# parser/parse.py
# -*- coding: utf-8 -*-
"""
Парсер сырых данных raw/*.json → data/*.json в новом формате (дерево).

Использование:
    python parse.py                 # все документы
    python parse.py --only uk       # только один
    python parse.py --show uk       # напечатать дерево одного документа
    python parse.py --no-cache      # не писать в cache/ и changelog.json
"""

import json
import re
import argparse
import pathlib
from datetime import date


HERE = pathlib.Path(__file__).parent
RAW_DIR = HERE.parent / "raw"
DATA_DIR = HERE.parent / "data"
CACHE_DIR = HERE / "cache"
CHANGELOG_FILE = HERE / "changelog.json"
CONFIG_FILE = HERE / "config.json"

CHANGELOG_MAX = 500


# ============================================================
# Утилиты
# ============================================================
def load_json(path, default=None):
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return default if default is not None else {}

def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ============================================================
# Римские цифры
# ============================================================
ROMAN = {
    "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8,
    "IX": 9, "X": 10, "XI": 11, "XII": 12, "XIII": 13, "XIV": 14, "XV": 15,
    "XVI": 16, "XVII": 17, "XVIII": 18, "XIX": 19, "XX": 20, "XXI": 21,
    "XXII": 22, "XXIII": 23, "XXIV": 24, "XXV": 25,
}

def roman_to_int(s):
    return ROMAN.get(s.upper(), 0)


# ============================================================
# Penalty parser
# ============================================================
RE_SIGNATURE_CUT = re.compile(r"Нормативно-правовой акт подписан.*$", re.IGNORECASE | re.DOTALL)

RE_RANGE = re.compile(
    r"от\s+([\d\s]+?)\s*(?:руб[а-яё]*|₽)?\s+до\s+([\d\s]+?)(?=\s*(?:руб|₽|\.|,|;|$))",
    re.IGNORECASE
)

RE_UPTO = re.compile(
    r"до\s+([\d\s]+?)(?=\s*(?:руб|₽|\.|,|;|$))",
    re.IGNORECASE
)


def _to_int(s):
    return int(re.sub(r"\s+", "", s))


def extract_ranges(raw):
    ranges = []
    for m in RE_RANGE.finditer(raw):
        a, b = _to_int(m.group(1)), _to_int(m.group(2))
        if a > b:
            a, b = b, a
        ranges.append((a, b))
    return ranges


def extract_upto(raw):
    results = []
    for m in RE_UPTO.finditer(raw):
        prefix = raw[max(0, m.start() - 30):m.start()].lower()
        if "от" in prefix:
            continue
        results.append(_to_int(m.group(1)))
    return results


def clean_penalty_raw(raw):
    if not raw:
        return raw
    raw = RE_SIGNATURE_CUT.sub("", raw).strip()
    if "\n\n" in raw:
        raw = raw.split("\n\n")[0].strip()
    return raw


def parse_penalty(raw):
    raw = clean_penalty_raw(raw)
    result = {"raw": raw, "types": []}
    if not raw:
        return result

    text_lower = raw.lower()

    if "штраф" in text_lower:
        ranges = extract_ranges(raw)
        upto = extract_upto(raw)
        entry = {"type": "штраф", "currency": "RUB"}

        if ranges:
            from_val = min(r[0] for r in ranges)
            to_val = max(r[1] for r in ranges)
            if upto:
                to_val = max(to_val, max(upto))
            entry["from"] = from_val
            entry["to"] = to_val
        elif upto:
            entry["to"] = max(upto)

        result["types"].append(entry)

    m = re.search(r"арест[а-я]*\s+(?:до\s+)?(\d+)\s*(суток|сутки|дней|дня|месяц|месяцев)", text_lower)
    if m:
        result["types"].append({"type": "арест", "to": int(m.group(1)), "unit": m.group(2)})
    elif "арест" in text_lower:
        result["types"].append({"type": "арест"})

    m = re.search(r"(?:до\s+)?(\d+)\s*(месяц|месяцев|лет|года|год)\s+лишени[а-я]*\s+свобод", text_lower)
    if m:
        result["types"].append({"type": "лишение свободы", "to": int(m.group(1)), "unit": m.group(2)})

    m = re.search(r"лишени[а-я]*\s+(?:специального\s+)?права[^.]*?(?:до\s+)?(\d+)\s*(дней|дня|день|суток|месяц|месяцев)", text_lower)
    if m:
        result["types"].append({"type": "лишение права", "to": int(m.group(1)), "unit": m.group(2)})
    elif "лишени" in text_lower and "права" in text_lower:
        result["types"].append({"type": "лишение права"})

    if "конфискац" in text_lower:
        result["types"].append({"type": "конфискация"})

    if "обязательн" in text_lower and "работ" in text_lower:
        m = re.search(r"(\d+)\s*(час|часов|часа)", text_lower)
        entry = {"type": "обязательные работы"}
        if m:
            entry["to"] = int(m.group(1))
            entry["unit"] = m.group(2)
        result["types"].append(entry)

    if "предупрежден" in text_lower:
        result["types"].append({"type": "предупреждение"})

    if "приостановлен" in text_lower and "деятельност" in text_lower:
        m = re.search(r"(\d+)\s*(дней|дня|день|суток|месяц|месяцев)", text_lower)
        entry = {"type": "приостановление деятельности"}
        if m:
            entry["to"] = int(m.group(1))
            entry["unit"] = m.group(2)
        result["types"].append(entry)

    return result


# ============================================================
# Хелперы для узлов
# ============================================================
def make_node(type_, number="", title="", text="", children=None):
    node = {"type": type_}
    if number:
        node["number"] = str(number)
    if title:
        node["title"] = title
    if text:
        node["text"] = text
    if children is not None:
        node["children"] = children
    return node


def append_paragraph(article, number, text):
    text = (text or "").strip()
    number = (number or "").strip()
    if not text and not number:
        return
    article.setdefault("children", []).append(
        make_node("paragraph", number=number, text=text)
    )


RE_ARTICLE_FULL = re.compile(
    r"^Статья\s+([\d.]+)\s*(?:\(([^)]+)\))?\s*(.*)$",
    re.IGNORECASE
)
RE_PRIORITY = re.compile(
    r"^Приоритет\s+розыска\s*-?\s*(\d)\s*$",
    re.IGNORECASE
)


def new_article(doc_id, raw_title_line):
    m = RE_ARTICLE_FULL.match(raw_title_line.strip())
    if not m:
        return None

    number = m.group(1).strip().rstrip(".")
    marks_str = (m.group(2) or "").strip()
    title = (m.group(3) or "").strip()

    marks = []
    if marks_str:
        marks = [p.strip() for p in marks_str.split("/") if p.strip()]

    art = {
        "type": "article",
        "number": number,
        "title": title,
        "children": [],
    }
    if marks:
        art["meta"] = {"marks": marks}
    return art


# ============================================================
# Парсер типа A
# ============================================================
def parse_type_a(lines, doc_id):
    nodes = []
    current_part = None
    current_section = None
    current_chapter = None
    current_article = None
    preamble_lines = []

    re_part = re.compile(r"^(ОБЩАЯ ЧАСТЬ|ОСОБЕННАЯ ЧАСТЬ)\s*$", re.IGNORECASE)
    re_section = re.compile(r"^Раздел\s+([IVXLC]+|\d+)\.?\s*(.*)$", re.IGNORECASE)
    re_chapter = re.compile(r"^Глава\s+([IVXLC]+|\d+)\.\s*(.+)$", re.IGNORECASE)
    re_article = re.compile(r"^Статья\s+[\d.]+", re.IGNORECASE)
    re_paragraph = re.compile(r"^(?:ч\.?\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?))\.?\s+(.+)$")
    re_subparagraph = re.compile(r"^(?:(\d+)[\)\.]|([а-яё])[\)\.])\s+(.+)$", re.IGNORECASE)
    re_note = re.compile(r"^Примечани[ея]\s*\d*\s*:\s*(.+)$", re.IGNORECASE)

    for line in lines:
        line = line.strip()
        if not line:
            continue

        m = re_part.match(line)
        if m:
            current_part = make_node("part", title=m.group(1), children=[])
            nodes.append(current_part)
            current_section = None
            current_chapter = None
            current_article = None
            continue

        m = re_section.match(line)
        if m:
            sec = make_node("section", number=m.group(1), title=(m.group(2) or "").strip(), children=[])
            if current_part:
                current_part.setdefault("children", []).append(sec)
            else:
                nodes.append(sec)
            current_section = sec
            current_chapter = None
            current_article = None
            continue

        m = re_chapter.match(line)
        if m:
            ch = make_node("chapter", number=m.group(1), title=m.group(2).strip(), children=[])
            if current_section:
                current_section.setdefault("children", []).append(ch)
            elif current_part:
                current_part.setdefault("children", []).append(ch)
            else:
                nodes.append(ch)
            current_chapter = ch
            current_article = None
            continue

        if re_article.match(line):
            art = new_article(doc_id, line)
            if art is None:
                continue
            target = current_chapter or current_section or current_part
            if target:
                target.setdefault("children", []).append(art)
            else:
                nodes.append(art)
            current_article = art
            continue

        m = RE_PRIORITY.match(line)
        if m and current_article is not None:
            current_article.setdefault("meta", {})["priorityStars"] = int(m.group(1))
            continue

        m = re_note.match(line)
        if m and current_article is not None:
            current_article["children"].append(
                make_node("note", text=m.group(1).strip())
            )
            continue

        m = re_paragraph.match(line)
        if m and current_article is not None:
            num = m.group(1) or m.group(2)
            text = m.group(3).strip()
            append_paragraph(current_article, num, text)
            continue

        m = re_subparagraph.match(line)
        if m and current_article is not None:
            num = m.group(1) or m.group(2)
            text = m.group(3).strip()
            children = current_article["children"]
            if children and children[-1]["type"] == "paragraph":
                children[-1].setdefault("children", []).append(
                    make_node("subparagraph", number=num, text=text)
                )
            else:
                children.append(make_node("subparagraph", number=num, text=text))
            continue

        if current_article is not None:
            children = current_article["children"]
            if children and children[-1]["type"] in ("paragraph", "subparagraph"):
                prev = children[-1].get("text", "")
                children[-1]["text"] = (prev + " " + line).strip()
            else:
                append_paragraph(current_article, "", line)
        else:
            preamble_lines.append(line)

    return nodes, preamble_lines


# ============================================================
# Парсер типа B (ПДД)
# ============================================================
def parse_type_b(lines, doc_id):
    nodes = []
    current_section = None
    current_subsection = None
    current_point = None
    preamble_lines = []
    in_signature = False

    re_section = re.compile(r"^Раздел\s+([IVXLC]+|\d+)\.\s*(.+)$", re.IGNORECASE)
    re_subsection = re.compile(r"^(\d+)\.\s+([А-ЯA-Z].+)$")
    re_point = re.compile(r"^(?:Пункт\s+)?(\d+)\.(\d+)\.\s+(.+)$", re.IGNORECASE)
    re_subparagraph = re.compile(r"^(\d+)\)\s+(.+)$")
    re_signature = re.compile(r"^Нормативно-правовой акт подписан", re.IGNORECASE)

    for line in lines:
        line = line.strip()
        if not line:
            continue

        if re_signature.match(line):
            in_signature = True
        if in_signature:
            continue

        m = re_section.match(line)
        if m:
            sec = make_node("section", number=m.group(1), title=m.group(2).strip(), children=[])
            nodes.append(sec)
            current_section = sec
            current_subsection = None
            current_point = None
            continue

        if re_point.match(line):
            m = re_point.match(line)
            num = m.group(1) + "." + m.group(2)
            text = m.group(3).strip()
            art = {
                "type": "article",
                "number": num,
                "title": text[:80] + ("…" if len(text) > 80 else ""),
                "children": [{"type": "paragraph", "text": text}],
            }
            target = current_subsection or current_section
            if target:
                target.setdefault("children", []).append(art)
            else:
                nodes.append(art)
            current_point = art
            continue

        m = re_subsection.match(line)
        if m:
            sub = make_node("chapter", number=m.group(1), title=m.group(2).strip(), children=[])
            if current_section:
                current_section.setdefault("children", []).append(sub)
            else:
                nodes.append(sub)
            current_subsection = sub
            current_point = None
            continue

        m = re_subparagraph.match(line)
        if m and current_point is not None:
            num = m.group(1)
            text = m.group(2).strip()
            children = current_point["children"]
            if children and children[-1]["type"] == "paragraph":
                children[-1].setdefault("children", []).append(
                    make_node("subparagraph", number=num, text=text)
                )
            else:
                children.append(make_node("subparagraph", number=num, text=text))
            continue

        if current_point:
            children = current_point["children"]
            if children:
                prev = children[-1].get("text", "")
                children[-1]["text"] = (prev + " " + line).strip()
        else:
            preamble_lines.append(line)

    return nodes, preamble_lines


# ============================================================
# Парсер типа C (Этика)
# ============================================================
def parse_type_c(lines, doc_id):
    nodes = []
    current_section = None
    current_article = None

    re_section = re.compile(r"^Раздел\s+([IVXLC]+|\d+)\.\s*(.+)$", re.IGNORECASE)
    re_article = re.compile(r"^Статья\s+([\d.]+?)\.?\s*(.*)$", re.IGNORECASE)
    re_sub_letter = re.compile(r"^([а-яё])[\)\.]\s+(.+)$", re.IGNORECASE)
    re_sub_dotted = re.compile(r"^(\d+\.\d+)\.?\s+(.+)$")

    for line in lines:
        line = line.strip()
        if not line:
            continue

        m = re_section.match(line)
        if m:
            sec = make_node("section", number=m.group(1), title=m.group(2).strip(), children=[])
            nodes.append(sec)
            current_section = sec
            current_article = None
            continue

        m = re_article.match(line)
        if m:
            num = m.group(1).rstrip(".")
            title_or_text = m.group(2).strip()
            art = {
                "type": "article",
                "number": num,
                "title": title_or_text[:120] + ("…" if len(title_or_text) > 120 else ""),
                "children": [],
            }
            if len(title_or_text) > 80:
                art["children"].append(make_node("paragraph", text=title_or_text))
            if current_section:
                current_section["children"].append(art)
            else:
                nodes.append(art)
            current_article = art
            continue

        m = re_sub_dotted.match(line)
        if m and current_article is not None:
            current_article["children"].append(
                make_node("paragraph", number=m.group(1), text=m.group(2).strip())
            )
            continue

        m = re_sub_letter.match(line)
        if m and current_article is not None:
            children = current_article["children"]
            if children and children[-1]["type"] == "paragraph":
                children[-1].setdefault("children", []).append(
                    make_node("subparagraph", number=m.group(1), text=m.group(2).strip())
                )
            else:
                children.append(
                    make_node("subparagraph", number=m.group(1), text=m.group(2).strip())
                )
            continue

        if current_article is not None:
            children = current_article["children"]
            if children:
                prev = children[-1].get("text", "")
                children[-1]["text"] = (prev + " " + line).strip()
            else:
                children.append(make_node("paragraph", text=line))

    return nodes, []


# ============================================================
# Парсер типа D (Конституция)
# ============================================================
def parse_type_d(lines, doc_id):
    nodes = []
    preamble_lines = []
    signature_lines = []
    current_chapter = None
    current_article = None
    in_preamble = False
    in_toc = False
    in_signature = False
    toc_passed = False

    re_preamble = re.compile(r"^Преамбула\s*$", re.IGNORECASE)
    re_toc = re.compile(r"^СОДЕРЖАНИЕ\s*$", re.IGNORECASE)
    re_chapter = re.compile(r"^Глава\s+([IVXLC]+|\d+)\.\s*(.+)$", re.IGNORECASE)
    re_article = re.compile(r"^Статья\s+[\d.]+", re.IGNORECASE)
    re_paragraph = re.compile(r"^(\d+)\.\s+(.+)$")
    re_signature = re.compile(r"^Нормативно-правовой акт подписан", re.IGNORECASE)

    for line in lines:
        line = line.strip()
        if not line:
            continue

        if re_signature.match(line):
            in_signature = True
        if in_signature:
            signature_lines.append(line)
            continue

        if re_preamble.match(line):
            in_preamble = True
            continue
        if in_preamble and re_toc.match(line):
            in_preamble = False
            in_toc = True
            continue
        if in_preamble:
            preamble_lines.append(line)
            continue

        if in_toc:
            if re_chapter.match(line):
                in_toc = False
                toc_passed = True
            else:
                continue

        m = re_chapter.match(line)
        if m:
            ch = make_node("chapter", number=m.group(1), title=m.group(2).strip(), children=[])
            nodes.append(ch)
            current_chapter = ch
            current_article = None
            continue

        if re_article.match(line) and current_chapter is not None:
            art = new_article(doc_id, line)
            if art:
                current_chapter["children"].append(art)
                current_article = art
            continue

        m = re_paragraph.match(line)
        if m and current_article is not None:
            append_paragraph(current_article, m.group(1), m.group(2))
            continue

        if current_article is not None:
            children = current_article["children"]
            if children:
                prev = children[-1].get("text", "")
                children[-1]["text"] = (prev + " " + line).strip()
            else:
                append_paragraph(current_article, "", line)

    signature = " ".join(signature_lines).strip()
    return nodes, preamble_lines, signature


# ============================================================
# Определение типа
# ============================================================
def detect_type(doc_id, full_text):
    lines = full_text.split("\n")
    has_chapter_roman = any(re.match(r"^Глава\s+[IVXLC]+\.", l.strip()) for l in lines)
    has_chapter_arab = any(re.match(r"^Глава\s+\d+\.", l.strip()) for l in lines)
    has_section = any(re.match(r"^Раздел\s+", l.strip(), re.IGNORECASE) for l in lines)
    has_article = any(re.match(r"^Статья\s+[\d.]+", l.strip(), re.IGNORECASE) for l in lines)

    if doc_id == "constitution":
        return "D"
    if doc_id == "pdd":
        return "B"
    if doc_id == "ethics":
        return "C"
    if not has_chapter_roman and not has_chapter_arab and has_article and has_section:
        return "C"
    return "A"


# ============================================================
# Постобработка
# ============================================================
def cleanup_nodes(nodes):
    cleaned = []
    for n in nodes:
        if "children" in n:
            n["children"] = cleanup_nodes(n["children"])
        if n.get("type") in ("paragraph", "subparagraph", "note"):
            if not n.get("text", "").strip():
                continue
        if n.get("type") in ("chapter", "section", "part"):
            if not n.get("children"):
                continue
        cleaned.append(n)
    return cleaned


# ============================================================
# Извлечение penalty
# ============================================================
def walk_extract_penalty(node):
    if node.get("type") == "article":
        penalty_texts = []
        for child in node.get("children", []):
            if "text" in child and re.search(r"Наказание\s*:", child["text"], re.IGNORECASE):
                m = re.search(r"Наказание\s*:\s*(.+)", child["text"], re.IGNORECASE)
                if m:
                    penalty_texts.append(m.group(1).strip())
                    child["text"] = re.sub(r"Наказание\s*:.*", "", child["text"], flags=re.IGNORECASE).strip()
        if penalty_texts:
            node["penalty"] = parse_penalty(" ".join(penalty_texts))
    for child in node.get("children", []):
        walk_extract_penalty(child)


# ============================================================
# Главная функция парсинга
# ============================================================
def parse_document(raw_data, config=None):
    doc_id = raw_data.get("doc_id", "")
    thread_title = raw_data.get("thread_title", "")
    thread_url = raw_data.get("thread_url", "")
    revision = raw_data.get("revision", "")
    first_post_id = raw_data.get("first_post_id", "")

    title = ""
    if config:
        title = config.get("titles", {}).get(doc_id, "")

    full_text = "\n".join(p.get("text", "") for p in raw_data.get("posts", []))
    lines = full_text.split("\n")

    dtype = detect_type(doc_id, full_text)

    signature = ""
    if dtype == "A":
        nodes, preamble_lines = parse_type_a(lines, doc_id)
    elif dtype == "B":
        nodes, preamble_lines = parse_type_b(lines, doc_id)
    elif dtype == "C":
        nodes, preamble_lines = parse_type_c(lines, doc_id)
    elif dtype == "D":
        nodes, preamble_lines, signature = parse_type_d(lines, doc_id)
    else:
        nodes, preamble_lines = [], []

    if not signature:
        for i, line in enumerate(lines):
            if line.strip().startswith("Нормативно-правовой акт подписан"):
                signature = " ".join(l.strip() for l in lines[i:] if l.strip())
                break

    for n in nodes:
        walk_extract_penalty(n)

    nodes = cleanup_nodes(nodes)

    doc = {
        "id": doc_id,
        "title": title,
        "full_title": thread_title,
        "revision": revision,
        "source_url": thread_url,
        "post_id": first_post_id,
        "preamble": " ".join(preamble_lines).strip() if preamble_lines else "",
        "signature": signature,
        "type_detected": dtype,
        "nodes": nodes,
    }
    return doc


# ============================================================
# Diff: сравнение двух версий документа
# ============================================================

def _collect_articles(nodes):
    """Собирает плоский dict {number: article_node} по всему дереву."""
    out = {}
    def walk(items):
        for n in items:
            if n.get("type") == "article":
                num = n.get("number", "")
                if num:
                    out[num] = n
            if "children" in n:
                walk(n["children"])
    walk(nodes)
    return out


def _article_signature(article):
    """Хеш-подпись статьи: title + penalty.raw + склеенный текст пунктов."""
    title = article.get("title", "") or ""
    penalty = article.get("penalty", {}) or {}
    penalty_raw = penalty.get("raw", "") or ""

    texts = []
    def walk(items):
        for n in items:
            if "text" in n:
                texts.append(n["text"])
            if "children" in n:
                walk(n["children"])
    walk(article.get("children", []))

    return title + "||" + penalty_raw + "||" + " ".join(texts)


def diff_documents(old_doc, new_doc):
    """
    Сравнивает два документа (старый и новый).
    Возвращает список записей changelog.
    old_doc может быть None — тогда это первый прогон, изменений нет.
    """
    if old_doc is None:
        return []

    doc_id = new_doc.get("id", "")
    today = date.today().isoformat()
    changes = []

    # 1. Обновление редакции (общее для всего документа)
    old_rev = (old_doc.get("revision", "") or "").strip()
    new_rev = (new_doc.get("revision", "") or "").strip()
    revision_changed = (old_rev != new_rev)

    # 2. Сравнение статей
    old_articles = _collect_articles(old_doc.get("nodes", []))
    new_articles = _collect_articles(new_doc.get("nodes", []))

    old_nums = set(old_articles.keys())
    new_nums = set(new_articles.keys())

    added = new_nums - old_nums
    removed = old_nums - new_nums
    common = old_nums & new_nums

    for num in sorted(added, key=_num_key):
        changes.append({
            "date": today,
            "doc_id": doc_id,
            "article": num,
            "kind": "article_added",
            "text": "Добавлена статья"
        })

    for num in sorted(removed, key=_num_key):
        changes.append({
            "date": today,
            "doc_id": doc_id,
            "article": num,
            "kind": "article_removed",
            "text": "Статья удалена"
        })

    for num in sorted(common, key=_num_key):
        old_a = old_articles[num]
        new_a = new_articles[num]

        old_title = (old_a.get("title", "") or "").strip()
        new_title = (new_a.get("title", "") or "").strip()

        old_pen = (old_a.get("penalty") or {}).get("raw", "") or ""
        new_pen = (new_a.get("penalty") or {}).get("raw", "") or ""

        if old_title != new_title and old_pen == new_pen:
            changes.append({
                "date": today,
                "doc_id": doc_id,
                "article": num,
                "kind": "title_changed",
                "text": "Изменён заголовок"
            })
        elif old_pen != new_pen:
            changes.append({
                "date": today,
                "doc_id": doc_id,
                "article": num,
                "kind": "penalty_changed",
                "text": "Изменено наказание"
            })
        elif _article_signature(old_a) != _article_signature(new_a):
            changes.append({
                "date": today,
                "doc_id": doc_id,
                "article": num,
                "kind": "text_changed",
                "text": "Изменён текст статьи"
            })

    # 3. Если revisions поменялась, но никаких постатейных изменений не нашли —
    #    пишем общую запись
    if revision_changed and not changes:
        changes.append({
            "date": today,
            "doc_id": doc_id,
            "article": None,
            "kind": "revision_changed",
            "text": f"Обновлена редакция: {old_rev} → {new_rev}"
        })

    return changes


def _num_key(num):
    """Ключ сортировки номеров статей: '14.3' → (14, 3)."""
    try:
        parts = [int(p) for p in str(num).split(".")]
        return tuple(parts)
    except Exception:
        return (0,)


def append_changelog(new_entries):
    """Добавляет записи в parser/changelog.json, обрезает до CHANGELOG_MAX."""
    if not new_entries:
        return

    data = load_json(CHANGELOG_FILE, {"entries": []})
    if not isinstance(data, dict):
        data = {"entries": []}
    entries = data.get("entries", [])

    # новые записи — в начало (самые свежие сверху)
    entries = new_entries + entries

    # обрезаем
    if len(entries) > CHANGELOG_MAX:
        entries = entries[:CHANGELOG_MAX]

    data["entries"] = entries
    save_json(CHANGELOG_FILE, data)


# ============================================================
# Печать дерева
# ============================================================
def print_tree(nodes, indent=0):
    for n in nodes:
        prefix = "  " * indent
        t = n.get("type", "?")
        num = n.get("number", "")
        title = n.get("title", "")
        text = n.get("text", "")[:50]
        meta = n.get("meta", {})
        pen = n.get("penalty", {})
        marker = t
        if num:
            marker += f" {num}"
        if title:
            marker += f": {title[:55]}"
        elif text:
            marker += f" — {text}"
        if meta:
            marker += f"  {meta}"
        if pen:
            marker += f"  penalty={pen.get('raw','')[:40]}"
        safe = marker.encode("utf-8", "replace").decode("utf-8", "replace")
        print(f"{prefix}{safe}")
        if "children" in n:
            print_tree(n["children"], indent + 1)


# ============================================================
# Main
# ============================================================
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", type=str)
    ap.add_argument("--show", type=str)
    ap.add_argument("--no-cache", action="store_true",
                    help="не писать в cache/ и не обновлять changelog.json")
    args = ap.parse_args()

    if not RAW_DIR.exists():
        print(f"❌ Нет папки {RAW_DIR}")
        return

    config = load_json(CONFIG_FILE, {})

    files = sorted(RAW_DIR.glob("*.json"))
    if args.only:
        files = [f for f in files if load_json(f).get("doc_id") == args.only]

    if args.show:
        target = None
        for f in RAW_DIR.glob("*.json"):
            if load_json(f).get("doc_id") == args.show:
                target = f
                break
        if not target:
            print(f"❌ Не найден документ {args.show}")
            return
        raw = load_json(target)
        doc = parse_document(raw, config)
        print(f"=== {doc['id']} — {doc['full_title']} (тип {doc['type_detected']}) ===\n")
        if doc["preamble"]:
            print(f"PREAMBLE: {doc['preamble'][:200]}…\n")
        print_tree(doc["nodes"])
        if doc["signature"]:
            print(f"\nSIGNATURE: {doc['signature'][:200]}")
        return

    print(f"Найдено {len(files)} файлов.\n")

    total_changes = 0

    for f in files:
        raw = load_json(f)
        doc = parse_document(raw, config)

        doc_id = doc["id"]
        out_path = DATA_DIR / f"{doc_id}.json"
        cache_path = CACHE_DIR / f"{doc_id}.json"

        # 1. Читаем старое состояние из кэша (если есть)
        old_doc = None
        if not args.no_cache and cache_path.exists():
            old_doc = load_json(cache_path)

        # 2. Сравниваем
        changes = diff_documents(old_doc, doc)
        total_changes += len(changes)

        # 3. Сохраняем новый data/<doc_id>.json
        save_json(out_path, doc)

        # 4. Обновляем кэш и changelog
        if not args.no_cache:
            save_json(cache_path, doc)
            append_changelog(changes)

        def count(nodes):
            c = {"article": 0, "paragraph": 0, "chapter": 0, "section": 0, "part": 0, "note": 0, "subparagraph": 0}
            for n in nodes:
                t = n.get("type")
                if t in c:
                    c[t] += 1
                if "children" in n:
                    sub = count(n["children"])
                    for k in c:
                        c[k] += sub[k]
            return c

        stats = count(doc["nodes"])
        suffix = f"  изменений: {len(changes)}" if changes else ""
        print(f"  {doc_id:<14} [{doc['type_detected']}]  "
              f"частей={stats['part']}, разделов={stats['section']}, "
              f"глав={stats['chapter']}, статей={stats['article']}, "
              f"пунктов={stats['paragraph']}, примечаний={stats['note']}{suffix}")

    print(f"\nФайлы сохранены в: {DATA_DIR}")

    if not args.no_cache:
        print(f"Кэш сохранён в: {CACHE_DIR}")
        if total_changes:
            print(f"Всего новых записей в changelog: {total_changes}")
            print(f"Changelog: {CHANGELOG_FILE}")
        else:
            print(f"Changelog: {CHANGELOG_FILE} (без изменений)")


if __name__ == "__main__":
    main()