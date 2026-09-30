# NOTES — рабочий контекст проекта

> Этот файл — для быстрого возврата в контекст. Если начинается новая сессия
> (например, в чате с ассистентом), достаточно скинуть `README.md` + `NOTES.md`
> и всё станет понятно без объяснений с нуля.
>
> `README.md` — стабильная документация. Этот файл — «где мы сейчас и что дальше».

---

## Кратко о проекте

- **Что:** статичный веб-сайт «Правовая памятка РО», показывает законы с форума
  `forum.russia.online` в структурированном виде.
- **Стек:** Python (парсер) + статичный HTML/CSS/JS (фронт, без фреймворков).
- **Хостинг:** Netlify (только `site/`).
- **Данные:** 28 документов (УК, КоАП, ПК, ПДД, ТК, Конституция, ФКЗ, ФЗ).
- **Пайплайн:** `raw/` → `data/` → `site/js/data/` → браузер.

---

## Текущее состояние

### Готово (работает)

**Парсер:**
- `run_raw.py` — сбор постов с форума (Playwright + сессия).
- `analyze.py` — диагностика структуры raw-файлов.
- `parse.py` — дерево + diff + cache + changelog.
- `check_penalties.py` — валидация штрафов (инверсии, пропуски).
- `export_to_js.py` — конвертер в `window.XXX_DATA` для фронта.
- Типы документов: A (обычный), B (ПДД), C (этика), D (Конституция).

**Парсер штрафов:**
- Регулярка `RE_RANGE` ловит «от X до Y», включая «от X рублей до Y рублей».
- Многочастные статьи (разные суммы для разных категорий) сжимаются в один
  широкий `min(from)…max(to)` — вариант A.
- Все 28 документов проходят `check_penalties.py` без ошибок.

**Diff + changelog:**
- `parser/cache/<doc_id>.json` — снимок предыдущего прогона.
- `parser/changelog.json` — плоский список записей (до 500).
- Виды записей: `article_added`, `article_removed`, `title_changed`,
  `penalty_changed`, `text_changed`, `revision_changed`.
- На главной показывается топ-5 свежих.

**Фронт:**
- Профиль: гражданский / гос + фракция (`ro_memo_profile`).
- Избранное и корзина (`ro_memo_favorites`, `ro_memo_cart`).
- Недавние статьи (`ro_memo_recent`, максимум 8, на главной топ-4).
- Changelog на главной.
- Тёмная тема с градиентами, слоями, акцентами.
- Модалки: избранное, корзина, смена профиля, глобальный поиск.
- Глобальный поиск (`Ctrl+K`) — по номеру, заголовку, тексту статьи,
  с сортировкой по релевантности.
- Смена профиля через модалку (без confirm() и без перезагрузки страницы).
- Логика «передачи материала»: прокуратура и адвокатура исключены
  (`NO_TRANSFER_FACTIONS`).

**Инфраструктура:**
- `git` — репозиторий инициализирован, `.gitignore` в коммите.
- `README.md` — полная документация пайплайна и скриптов.
- `shema.json` — каноническая схема данных (часть полей пока не реализована).

**PWA:**
- `site/manifest.webmanifest` — манифест (standalone, тёмная тема, `start_url=./app.html`).
- `site/sw.js` — service worker, cache-first.
- Иконки: `site/icons/icon-192.png`, `site/icons/icon-512.png`.
- Регистрация SW — в `app.html` и `law.html`.
- Офлайн-режим работает (при условии, что посетил хотя бы раз).
- **ВАЖНО:** при обновлении данных (после `parse.py` + `export_to_js.py`) —
  поднять `CACHE_VERSION` в `site/sw.js` (с `v1` на `v2`), иначе браузер
  отдаст старую версию из кэша.

### В работе

- (пусто)

---

## Архитектура — где что лежит

### Пайплайн данных

```
forum.russia.online
        │  run_raw.py
        ▼
   raw/<thread_id>.json + .txt
        │  parse.py (с diff и cache)
        ├──► data/<doc_id>.json           (актуальное дерево)
        ├──► parser/cache/<doc_id>.json   (снимок для следующего diff)
        └──► parser/changelog.json        (история изменений)
        │  export_to_js.py
        ▼
   site/js/data/<doc_id>.js
   site/js/data/_manifest.js
   site/js/data/changelog.js
        │
        ▼
   app.html / law.html
```

### Ключевые файлы фронта

| Файл | Что делает |
|---|---|
| `site/js/data.js` | `Docs.get`, `findArticle`, `allArticles`, `searchAll` |
| `site/js/store.js` | Избранное, корзина, недавние (LS), `cartSummary` |
| `site/js/render.js` | Sidebar, tree, articleList, article, changelog, recent |
| `site/js/modal.js` | openFavorites / openCart / openProfileSwitcher / openSearch |
| `site/js/profile.js` | Роль, фракция, `FACTIONS`, `factionInfo` |
| `site/js/app.js` | Точка входа `app.html` |
| `site/js/law.js` | Точка входа `law.html` |
| `site/app.html` | Главная |
| `site/law.html` | Страница документа (3 колонки) |
| `site/sw.js` | Service worker (офлайн) |
| `site/manifest.webmanifest` | Манифест PWA |

### Ключи localStorage

- `ro_memo_profile` — `{role, faction}`
- `ro_memo_favorites` — массив `nodeId` («ak-14.3»)
- `ro_memo_cart` — массив `nodeId`
- `ro_memo_recent` — массив `nodeId` (максимум 8)

**Важно:** ключи с подчёркиваниями. Если в LS остались старые ключи вида
`ro-memo-favorites` (с дефисами) — они от предыдущей версии проекта,
их надо вручную удалять через DevTools.

---

## Решения, которые мы приняли (и почему)

1. **Многочастные штрафы — вариант A (сжатие в min…max).**
   Например, в 8.8 КоАП три диапазона для гражданина/должностного/организации.
   Мы сжимаем в один широкий. Точность по частям теряется, но не надо
   править вручную. Если когда-то понадобится точность — перейдём на
   вариант В (массив `ranges` с привязкой к частям).

2. **Прокуратура и адвокатура не участвуют в передаче материала.**
   Константа `NO_TRANSFER_FACTIONS = ['prok', 'adv']` в `render.js`.
   Прокурор работает по любым делам (надзор), адвокат — защитник.
   Warn-блок «передай материал X» для них не показывается.

3. **Локальный поиск в колонке 2 убран.**
   Есть только глобальный (`Ctrl+K`, кнопка в топбаре). Одна точка входа,
   не дублируется.

4. **Один общий localStorage для всех профилей.**
   Избранное, корзина, недавние не разделяются по ролям.

5. **`parser/cache/` и `changelog.json` коммитятся в git.**
   Чтобы diff работал на любой машине и история не терялась.
   `parser/storage_state.json` — **не коммитится** (это сессия форума).

6. **Архивные папки в `.gitignore`:**
   `mockup/`, `raw_backup_*/`. Локально остаются, в git не идут.

7. **PWA: cache-first + versioning.**
   Service worker кэширует всё, включая данные. При обновлении данных
   надо поднимать `CACHE_VERSION`. Cache-first выбран, потому что данные
   у нас обновляются редко, а заходят часто — важнее скорость.

---

## Известные ограничения и TODO

### Не реализовано

- `meta.conviction`, `meta.jurisdiction`, `meta.resolution`, `meta.group`
  — описаны в `shema.json`, но парсер их не создаёт.
- `related` — связи со статьями других кодексов. Не парсится, но в mockup
  был пример UI. Идея на будущее.
- Обработка дублей номеров статей (если в документе две `Статья 1.` —
  они получают одинаковый `node_id`, `Docs.findArticle` найдёт только первую).
- Числа прописью и МРОТ — не парсятся («не менее пяти тысяч», «500 МРОТ»).
- `config.json`: поля `location`, `blacklist`, `schemas` не используются.

### Потенциальные грабли

- **Service Worker требует аккуратности.** При обновлении данных нельзя
  забывать `CACHE_VERSION` в `site/sw.js`. Если забыл — браузер отдаёт
  старую версию из кэша, и выглядит это как «сайт не обновляется».
  Симптом: обновил закон, прогнал пайплайн, а на сайте всё по-старому.
  Лечение: поднять `CACHE_VERSION`, перезагрузить страницу два раза.
- **`file://` не работает с PWA.** Service worker не регистрируется.
  Для проверки PWA нужен локальный сервер: `python -m http.server 8000`
  в корне проекта, потом открывать `http://localhost:8000/site/app.html`.

### Идеи на будущее

- **Командная палитра** — расширить `Ctrl+K`: быстрые переходы к документам,
  к разделам «Часто нужны» и «Недавние», команды вроде «открыть корзину».
- **Подсветка совпадений** в результатах поиска (обернуть в `<mark>`).
- **Автоматизация пайплайна** — `parser/update_all.py` одной командой
  (`run_raw → parse → check_penalties → export_to_js`).
- **Светлая тема** (переключатель).
- **Экспорт статьи в markdown/PDF** (вместо «Копировать ссылку»).
- **Кэш документов в браузере** (IndexedDB) — чтобы сайт работал быстрее.

---

## Как обновлять данные

### Один закон

```powershell
cd parser
python run_raw.py --only 4930        # по thread_id
python parse.py --only ak
python check_penalties.py
python export_to_js.py
```

**Потом — не забыть:**

1. Открыть `site/sw.js`.
2. Поднять `CACHE_VERSION` (например, `'v1'` → `'v2'`).
3. В браузере — `Ctrl+Shift+R` (жёсткое обновление).
4. Если всё ещё старая версия — DevTools → Application → Service Workers →
   Unregister, потом перезагрузить.

Дальше — закоммитить:

```powershell
git add raw/ data/ parser/cache/ parser/changelog.json site/js/data/ site/sw.js
git commit -m "Обновить КоАП до редакции X"
```

### Добавить новый закон

1. Добавить в `parser/config.json` → `threads` (mapping `thread_id → doc_id`),
   в `titles` (короткое название).
2. `python run_raw.py --only <thread_id>`.
3. `python analyze.py` — посмотреть тип (A/B/C/D).
4. `python parse.py --only <doc_id>`.
5. `python check_penalties.py`.
6. Добавить `doc_id` в `DOC_IDS` в `parser/export_to_js.py`.
7. `python export_to_js.py`.
8. Добавить `<script src="js/data/<doc_id>.js">` в `app.html` и `law.html`,
   а также `doc_id` в `GROUPS` в `render.js`.
9. Добавить имя файла в `PRECACHE` в `site/sw.js`.
10. Поднять `CACHE_VERSION`.
11. Проверить на сайте.

---

## Git — текущий статус

- Репозиторий инициализирован, первый коммит сделан.
- `.gitignore` в коммите.

### Что коммитим

✅ `raw/`, `data/`, `parser/cache/`, `parser/changelog.json`,
   `site/js/data/*.js`, все скрипты и документация, `site/manifest.webmanifest`,
   `site/sw.js`, `site/icons/`.

### Что НЕ коммитим

❌ `parser/storage_state.json` (критично — сессия форума).
❌ `mockup/`, `raw_backup_*/` — архив, локально.
❌ `__pycache__/`, `.vscode/`, `.DS_Store`.

---

## Как продолжать в новой сессии

Если работаешь с ассистентом:

1. Скинуть `README.md` + `NOTES.md`.
2. Если нужно — приложить конкретные файлы, с которыми работаем
   (например, `site/js/render.js` или `parser/parse.py`).
3. Сказать, что делаем дальше (из списка «Идеи на будущее» или что-то своё).

Контекста в этих двух файлах достаточно, чтобы не объяснять всё с нуля.