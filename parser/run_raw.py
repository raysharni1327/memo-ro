# parser/run_raw.py
# -*- coding: utf-8 -*-
"""
Сбор СЫРЫХ данных из Законодательной базы forum.russia.online.

Что делает:
  1. Логинится через сохранённую сессию (storage_state.json).
  2. Открывает раздел "Законодательная база" (1604).
  3. Собирает список всех тем.
  4. Для каждой темы тянет ВСЕ посты (не только первый).
  5. Сохраняет в raw/<thread_id>.json и raw/<thread_id>.txt.
  6. Ничего не парсит, не улучшает, не пишет в основной проект.

Использование:
    python run_raw.py               # все темы раздела
    python run_raw.py --only 4930   # только одна тема по thread_id
    python run_raw.py --no-ask      # без подтверждений
"""

import json
import re
import argparse
import pathlib
from playwright.sync_api import sync_playwright


# ============================================================
# Пути
# ============================================================
HERE = pathlib.Path(__file__).parent
STATE_FILE = HERE / "storage_state.json"
CONFIG_FILE = HERE / "config.json"
RAW_DIR = HERE.parent / "raw"

FORUM_SECTION = "https://forum.russia.online/forums/zakonodatel-naya-baza.1604/"


# ============================================================
# Утилиты
# ============================================================
def load_json(path, default=None):
    if path.exists():
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return default if default is not None else {}

def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def safe_filename(name):
    """Убирает из имени файла всё, что не нужно."""
    return re.sub(r"[^\w\-]+", "_", name, flags=re.UNICODE).strip("_")[:80] or "doc"


# ============================================================
# Сбор тем
# ============================================================
def collect_threads(page):
    threads = []
    page.goto(FORUM_SECTION, wait_until="domcontentloaded")
    page.wait_for_timeout(1500)

    while True:
        items = page.query_selector_all("div.structItem-title a")
        for a in items:
            href = a.get_attribute("href")
            title = a.inner_text().strip()
            if href and "/threads/" in href:
                url = "https://forum.russia.online" + href if href.startswith("/") else href
                if not any(t["url"] == url for t in threads):
                    threads.append({"url": url, "title": title})

        next_btn = page.query_selector("a.pageNav-jump--next")
        if not next_btn:
            break
        next_btn.click()
        page.wait_for_timeout(1500)

    return threads


# ============================================================
# Сбор всех постов одной темы
# ============================================================
def collect_all_posts(page, url):
    """
    Открывает тему и собирает ВСЕ посты подряд.
    Возвращает список постов с метаданными.
    """
    page.goto(url, wait_until="domcontentloaded")
    page.wait_for_timeout(1500)

    # Все посты темы (в XenForo обычно article.message или .js-post)
    articles = page.query_selector_all("article.message")
    if not articles:
        articles = page.query_selector_all(".js-post")

    posts = []
    for art in articles:
        # post_id
        post_id = art.get_attribute("data-content") or ""
        if not post_id:
            id_attr = art.get_attribute("id") or ""
            m = re.search(r"js-post-(\d+)", id_attr)
            if m:
                post_id = "post-" + m.group(1)

        # автор
        author_el = art.query_selector(".message-name")
        author = author_el.inner_text().strip() if author_el else (art.get_attribute("data-author") or "")

        # дата поста
        date_el = art.query_selector(".message-attribution-main time")
        date = ""
        if date_el:
            dt = date_el.get_attribute("datetime") or ""
            m = re.match(r"(\d{4})-(\d{2})-(\d{2})", dt)
            if m:
                date = f"{m.group(3)}.{m.group(2)}.{m.group(1)}"
            else:
                date = date_el.inner_text().strip()

        # дата последнего редактирования
        last_edit = ""
        le = art.query_selector(".message-lastEdit")
        if le:
            m = re.search(r"(\d{2}\.\d{2}\.\d{4})", le.inner_text())
            if m:
                last_edit = m.group(1)

        # текст
        body = art.query_selector(".message-body .bbWrapper")
        text = body.inner_text() if body else ""

        posts.append({
            "post_id": post_id,
            "author": author,
            "date": date,
            "last_edit": last_edit,
            "text": text,
        })

    return posts


# ============================================================
# Сохранение
# ============================================================
def save_raw(thread_id, doc_id, thread_title, thread_url, posts, revision):
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    # --- JSON ---
    data = {
        "thread_id": thread_id,
        "thread_url": thread_url,
        "doc_id": doc_id,
        "thread_title": thread_title,
        "revision": revision,
        "post_count": len(posts),
        "first_post_id": posts[0]["post_id"] if posts else "",
        "posts": posts,
    }
    json_path = RAW_DIR / f"{thread_id}.json"
    save_json(json_path, data)

    # --- TXT (для просмотра глазами) ---
    txt_path = RAW_DIR / f"{thread_id}.txt"
    lines = []
    lines.append("=" * 80)
    lines.append(f"THREAD ID:    {thread_id}")
    lines.append(f"DOC ID:       {doc_id}")
    lines.append(f"TITLE:        {thread_title}")
    lines.append(f"URL:          {thread_url}")
    lines.append(f"REVISION:     {revision}")
    lines.append(f"POSTS:        {len(posts)}")
    lines.append("=" * 80)
    lines.append("")

    for i, p in enumerate(posts, 1):
        lines.append("")
        lines.append("-" * 80)
        lines.append(f"# ПОСТ {i}/{len(posts)}  |  {p['post_id']}  |  {p['author']}  |  {p['date']}")
        if p["last_edit"]:
            lines.append(f"# Последнее редактирование: {p['last_edit']}")
        lines.append("-" * 80)
        lines.append("")
        lines.append(p["text"])
        lines.append("")

    txt_path.write_text("\n".join(lines), encoding="utf-8")

    return json_path, txt_path


# ============================================================
# Основной сценарий
# ============================================================
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", type=str, help="только одна тема по thread_id")
    ap.add_argument("--no-ask", action="store_true")
    args = ap.parse_args()

    if not STATE_FILE.exists():
        print(f"❌ Нет {STATE_FILE}. Скопируй его из старого parser/.")
        return
    if not CONFIG_FILE.exists():
        print(f"❌ Нет {CONFIG_FILE}. Скопируй его из старого parser/.")
        return

    config = load_json(CONFIG_FILE)
    threads_map = config.get("threads", {})
    titles = config.get("titles", {})

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(storage_state=str(STATE_FILE))
        page = context.new_page()

        print("Загружаю список тем раздела...")
        threads = collect_threads(page)
        print(f"Найдено тем: {len(threads)}\n")

        if args.only:
            threads = [t for t in threads if t["url"].rstrip("/").split(".")[-1] == args.only]
            if not threads:
                print(f"⚠️  Тема {args.only} не найдена в разделе.")
                return

        print(f"Будут собраны {len(threads)} тем:")
        for i, t in enumerate(threads, 1):
            tid = t["url"].rstrip("/").split(".")[-1]
            doc_id = threads_map.get(tid, "—")
            print(f"  [{i:>2}/{len(threads)}] {tid:>6}  {doc_id:<14}  {t['title'][:55]}")
        print()

        if not args.no_ask:
            ans = input("Начать сбор? [y/n]: ").strip().lower()
            if ans != "y":
                print("Отменено.")
                browser.close()
                return

        print("\n=== СБОР ДАННЫХ ===")
        for i, t in enumerate(threads, 1):
            tid = t["url"].rstrip("/").split(".")[-1]
            doc_id = threads_map.get(tid, "")
            short_title = titles.get(doc_id, "") or t["title"]
            print(f"\n[{i}/{len(threads)}] {tid} — {doc_id or '(нет doc_id)'} — {t['title'][:60]}")

            posts = collect_all_posts(page, t["url"])
            if not posts:
                print("  ⚠️  Постов не найдено, пропускаю.")
                continue

            # revision = дата последнего редактирования первого поста,
            # иначе — дата публикации первого поста
            revision = posts[0].get("last_edit") or posts[0].get("date") or ""

            json_path, txt_path = save_raw(
                thread_id=tid,
                doc_id=doc_id,
                thread_title=t["title"],
                thread_url=t["url"],
                posts=posts,
                revision=revision,
            )

            total_chars = sum(len(p["text"]) for p in posts)
            print(f"  ✅ Постов: {len(posts)}, символов: {total_chars}, редакция: {revision}")
            print(f"     → {json_path.name}")
            print(f"     → {txt_path.name}")

        browser.close()

    print(f"\n=== ГОТОВО ===")
    print(f"Файлы сохранены в: {RAW_DIR}")
    print(f"Всего файлов: {len(list(RAW_DIR.glob('*.json')))} json + {len(list(RAW_DIR.glob('*.txt')))} txt")


if __name__ == "__main__":
    main()