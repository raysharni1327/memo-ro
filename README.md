# Правовая памятка РО

Статичный веб-сайт с правовой памяткой по законодательству РО. Собирает
документы с форума `forum.russia.online`, парсит в структурированное дерево
(главы → статьи → пункты), показывает через браузер. Работает оффлайн,
хостится на Netlify. Все пользовательские данные (профиль, избранное,
корзина, недавние) хранятся в `localStorage`.

Доступ: **https://ro-memo.netlify.app/**

**Локальная папка проекта:** `D:\project\memo-ro` (вне OneDrive).

> 📌 **Если возобновляешь работу после перерыва** — сначала прочитай
> `NOTES.md` в корне. Там — «где мы сейчас и что дальше».

---

## 1. Как устроено

Данные проходят путь от форума до браузера:

```
forum.russia.online
        │
        │  run_raw.py (Playwright + сохранённая сессия)
        ▼
   raw/<thread_id>.json     ← сырые посты с форума
   raw/<thread_id>.txt      ← то же, но читаемым текстом
        │
        │  parse.py (разбор дерева + diff с кэшем)
        ├────────────────────────────────────────────┐
        ▼                                            ▼
   data/<doc_id>.json                          parser/cache/<doc_id>.json
   (актуальное дерево)                         (снимок для следующего diff)
        │                                            │
        │                                            ▼
        │                                     parser/changelog.json
        │                                     (история изменений)
        │                                            │
        │  export_to_js.py                           │
        ▼                                            ▼
   site/js/data/<doc_id>.js                    site/js/data/changelog.js
   site/js/data/_manifest.js
        │
        │  браузер: Docs.get(docId), window.CHANGELOG
        ▼
   app.html / law.html
```

**Разделение по папкам:**

- `raw/` — что пришло с форума, без изменений.
- `data/` — распарсенные деревья документов (источник истины).
- `parser/cache/` — снимок предыдущего прогона, чтобы сравнивать.
- `site/js/data/` — те же данные, обёрнутые в `window.XXX_DATA` для браузера.
- `parser/` — скрипты преобразования.

**Каноническая схема данных:** `shema.json` в корне. Там описано, какие
бывают узлы, какие поля обязательные, что умеет `penalty`. Часть полей из
схемы пока не заполняется парсером — см. раздел 11.

---

## 2. Требования

- **Python 3.8+**
- **Playwright** — только для `run_raw.py`:
  ```bash
  pip install playwright
  playwright install chromium
  ```
- **Браузер** — Chrome / Edge / Firefox для просмотра сайта.
- Опционально: `git` для версионирования.

---

## 3. Быстрый старт

### Полный цикл: собрать всё с нуля

```bash
cd parser

# 1. Собрать посты с форума (нужна сохранённая сессия)
python run_raw.py

# 2. (Опционально) Посмотреть, что получилось
python analyze.py

# 3. Распарсить в дерево + обновить changelog
python parse.py

# 4. Проверить, что с штрафами всё ок
python check_penalties.py

# 5. Выгрузить JS-обёртки для фронта
python export_to_js.py
```

Открыть сайт локально:

```bash
cd site
python -m http.server 8000
# Открыть http://localhost:8000/app.html
```

⚠️ **`file://` не работает с PWA** (Service Worker не регистрируется).
Нужен локальный сервер.

### Обновление одного документа

```bash
cd parser
python run_raw.py --only 4930      # 4930 — thread_id КоАП (см. config.json)
python parse.py --only ak
python check_penalties.py
python export_to_js.py
```

`--only` можно использовать и в `run_raw.py`, и в `parse.py`.

### Проверка целостности

```bash
cd parser
python analyze.py                # общая сводка по всем документам
python check_penalties.py        # валидация штрафов
```

`analyze.py` печатает таблицу по каждому документу: сколько глав, статей,
разделов, есть ли преамбула. Плюс сохраняет `analyze_report.json`.
---

## 4. Скрипты

Все лежат в `parser/`, запускаются оттуда же.

### `run_raw.py` — сбор данных с форума

Заходит на форум через Playwright с сохранённой сессией (`storage_state.json`),
открывает раздел «Законодательная база», обходит все темы, сохраняет посты
в `raw/<thread_id>.json` и `raw/<thread_id>.txt`.

**Маппинг `thread_id → doc_id`** — в `config.json`, секция `threads`.

**Запуск:**

```bash
python run_raw.py                 # все темы раздела
python run_raw.py --only 4930     # только одна тема
python run_raw.py --no-ask        # без подтверждения
```

**Про `storage_state.json`:** cookies форума, создаётся один раз после ручного
логина. Когда сессия истечёт — `run_raw.py` начнёт получать 403, надо
пересоздать. **Файл нельзя коммитить** (см. `.gitignore`).

### `analyze.py` — диагностика сырых данных

Проходит по всем `raw/*.json`, считает количество глав/статей/разделов.
Полезно при добавлении нового документа: сначала смотришь цифры, потом
решаешь, к какому типу (A/B/C/D) он относится.

```bash
python analyze.py
```

Результат — таблица в консоли + `parser/analyze_report.json`.

### `parse.py` — парсер с diff

Читает `raw/*.json`, определяет тип документа (A/B/C/D), строит дерево,
извлекает штрафы. Сохраняет в `data/<doc_id>.json`.

**Дополнительно:**

- Сравнивает новое дерево со снимком в `parser/cache/<doc_id>.json`.
- Найденные изменения пишет в `parser/changelog.json`.
- Обновляет снимок в `cache/` для следующего прогона.

```bash
python parse.py                    # все документы
python parse.py --only ak          # только один
python parse.py --show ak          # напечатать дерево, не сохранять
python parse.py --no-cache         # не трогать cache/ и changelog
```

`--no-cache` полезен при отладке.

**Что извлекает:**

- `meta.marks` — метки фракций из заголовка.
- `meta.priorityStars` — приоритет розыска.
- `penalty` — блок наказания.
- `preamble` и `signature` — для типа D.

**Что не извлекает:** `conviction`, `jurisdiction`, `resolution`, `group`,
`related` — см. раздел 11.

### `check_penalties.py` — валидация штрафов

Ищет три класса проблем:

1. **Инверсии** — `from > to`.
2. **Пропущенный диапазон** — в `penalty.raw` есть «от X до Y», но в
   `types` нет `from`/`to`.
3. **Штраф без сумм** — упомянут штраф, но `types` без чисел.

```bash
python check_penalties.py
```

Должно выводить `✅ Проблем не найдено.`

### `export_to_js.py` — конвертер для фронта

Читает `data/*.json` и `parser/changelog.json`, пишет:

- `site/js/data/<doc_id>.js` — `window.AK_DATA = {…};`
- `site/js/data/_manifest.js` — список всех документов.
- `site/js/data/changelog.js` — `window.CHANGELOG = […];`

**Важно:** обязательно после каждого `parse.py`, иначе фронт не увидит
изменений.

---

## 5. Форматы файлов

### `raw/<thread_id>.json` — входные данные

```json
{
  "thread_id": "4930",
  "thread_url": "https://forum.russia.online/threads/…",
  "doc_id": "ak",
  "thread_title": "КОДЕКС РО ОБ АДМИНИСТРАТИВНЫХ ПРАВОНАРУШЕНИЯХ",
  "revision": "20.09.2026",
  "post_count": 1,
  "first_post_id": "post-16504",
  "posts": [
    {
      "post_id": "post-16504",
      "author": "Марк Брагин",
      "date": "25.08.2026",
      "last_edit": "27.09.2026",
      "text": "ПОЛНЫЙ ТЕКСТ ПОСТА…"
    }
  ]
}
```

### `data/<doc_id>.json` — дерево документа

```json
{
  "id": "ak",
  "title": "КоАП РО",
  "full_title": "КОДЕКС РО ОБ АДМИНИСТРАТИВНЫХ ПРАВОНАРУШЕНИЯХ",
  "revision": "20.09.2026",
  "source_url": "https://forum.russia.online/threads/…",
  "post_id": "post-16504",
  "preamble": "",
  "signature": "Нормативно-правовой акт подписан …",
  "type_detected": "A",
  "nodes": [ … ]
}
```

**Типы узлов в `nodes`:**

| type           | Поля                                          | Смысл                     |
|----------------|-----------------------------------------------|---------------------------|
| `part`         | `title`, `children`                           | ОБЩАЯ / ОСОБЕННАЯ ЧАСТЬ   |
| `section`      | `number`, `title`, `children`                 | Раздел                    |
| `chapter`      | `number`, `title`, `children`                 | Глава                     |
| `article`      | `number`, `title`, `children`, `meta?`, `penalty?` | Статья               |
| `paragraph`    | `number?`, `text`, `children?`                | Пункт                     |
| `subparagraph` | `number`, `text`                              | Подпункт                  |
| `note`         | `text`                                        | Примечание                |

**`meta` у статьи:** `marks: ["Ф", "Р", …]`, `priorityStars: 1..5`.

**`penalty` у статьи:**

```json
"penalty": {
  "raw": "административный штраф от 10 000 до 30 000 рублей…",
  "types": [
    { "type": "штраф", "currency": "RUB", "from": 10000, "to": 30000 },
    { "type": "арест", "to": 10, "unit": "суток" },
    { "type": "конфискация" }
  ]
}
```

Возможные `type`: `штраф`, `арест`, `лишение свободы`, `лишение права`,
`конфискация`, `обязательные работы`, `предупреждение`,
`приостановление деятельности`.

**Как парсятся штрафы:** регулярка `RE_RANGE` ловит «от X до Y», допускает
«рублей» между числами. Если в статье несколько диапазонов — сжимаются
в один `min(from) … max(to)`.

### `parser/cache/<doc_id>.json` — снимок для diff

Полная копия `data/<doc_id>.json` на момент предыдущего прогона `parse.py`.
**Коммитится в git.**

### `parser/changelog.json` — история изменений

```json
{
  "entries": [
    {
      "date": "2026-09-29",
      "doc_id": "ak",
      "article": "14.3",
      "kind": "penalty_changed",
      "text": "Изменено наказание"
    }
  ]
}
```

Записи сверху вниз от свежих. Хранится **до 500 записей**
(`CHANGELOG_MAX` в `parse.py`).

**Возможные `kind`:** `article_added`, `article_removed`, `title_changed`,
`penalty_changed`, `text_changed`, `revision_changed`.

### `site/js/data/<doc_id>.js` — обёртка для браузера

```javascript
window.AK_DATA = {"id":"ak","title":"КоАП РО",…};
```

Плюс `_manifest.js` и `changelog.js`.

---

## 6. Changelog: как работает

1. `parse.py` для каждого документа:
   - читает предыдущий снимок из `cache/`,
   - парсит новый,
   - сравнивает: добавленные / удалённые / изменённые статьи,
   - пишет изменения в `parser/changelog.json`,
   - обновляет снимок в `cache/`.
2. `export_to_js.py` выгружает в `site/js/data/changelog.js`.
3. `Render.changelog()` на главной показывает последние 5 записей.
   **Клик по записи → переход на статью.**

**Первый прогон:** кэша нет → changelog пустой. Со второго — работает.

**Сбросить историю:** удалить `parser/changelog.json` и `parser/cache/*.json`,
прогнать `parse.py`, потом `export_to_js.py`.

---

## 7. Типы документов

### A — обычный закон

«Глава 1.», «Статья 14.3.», пункты «1.», подпункты «а)», «1)».

**Примеры:** `ak`, `uk`, `pk`, `tk`, `fsb`, `police`, `gibdd`, `sk`,
`prosecutor`, `duma`, `government`, `ministries`, `courts`, `territories`,
`advocacy`, `business`, `service`, `secret`, `weapons`, `vs`, `fso`,
`immunity`, `emergency`, `parties`, `health`.

### B — ПДД

«Раздел 1.», пункты «1.1.», «1.2.» (играют роль статей), подпункты «1)».

**Пример:** `pdd`.

### C — этика

Разделы «Раздел I.», статьи «Статья 1.», пункты «1.1.», «а)». Глав нет.

**Пример:** `ethics`.

### D — Конституция

Есть преамбула и содержание, главы «Глава I.», пункты «1.», «2.».

**Пример:** `constitution`.
---

## 8. Фронтенд

Все файлы в `site/js/`.

| Файл         | Что делает                                                    |
|--------------|---------------------------------------------------------------|
| `profile.js` | Профиль: роль (гражданский / гос), фракция. Хранится в LS.   |
| `data.js`    | Загрузчик: `Docs.get`, `findArticle`, `allArticles`, `searchAll`, `parseNodeId`, `walkTree`. |
| `store.js`   | Избранное, корзина, недавние. Всё в LS. `resolveNode`, `cartSummary`. |
| `render.js`  | Рендер: sidebar, tree, articleList, article, changelog, recent. `effectiveMarks`, `getMyFaction`. |
| `modal.js`   | Модалки: избранное, корзина, смена профиля, поиск.            |
| `app.js`     | Точка входа главной (`app.html`).                            |
| `law.js`     | Точка входа страницы закона (`law.html`).                    |

**Ключевые фичи:**

- **Избранное** — ★ на статье, модалка в топбаре.
- **Корзина** — 🗑 на статье, агрегация наказаний (сумма штрафов,
  максимальный арест, максимальный приоритет). Сводка + «Скопировать
  полностью» / «Скопировать номера».
- **Недавние** — последние 8 открытых статей (в LS), на главной — 4 свежих.
- **Changelog** — последние 5 изменений на главной, кликаются.
- **Профиль** — гражданский или гос-сотрудник (с фракцией). Влияет на
  подсветку статей, метки фракций, warn-блоки «не подследственно».
- **Смена профиля** — через модалку в сайдбаре, без перезагрузки.
- **Глобальный поиск** (`Ctrl+K`) — по номеру, заголовку, тексту статьи,
  с сортировкой по релевантности.

**Хранилище (localStorage):**

- `ro_memo_profile` — профиль.
- `ro_memo_favorites` — избранные `nodeId`.
- `ro_memo_cart` — корзина `nodeId`.
- `ro_memo_recent` — недавние `nodeId` (максимум 8).

Ключи — **с подчёркиваниями**. Если остались старые ключи (`ro-memo-*`
с дефисами) — удалить вручную через DevTools.

---

## 9. Workflow

### Обновить существующий закон

1. Найти `thread_id` в `parser/config.json` → секция `threads`.
2. `python run_raw.py --only 4930`
3. `python parse.py --only ak`
4. `python check_penalties.py`
5. `python export_to_js.py`
6. Открыть `law.html#ak` на сайте (`Ctrl + Shift + R`), проверить.

### Добавить новый закон

1. Открыть тему на форуме, скопировать `thread_id`.
2. Добавить в `parser/config.json`: `threads`, `titles`.
3. `python run_raw.py --only <thread_id>`
4. `python analyze.py` — определить тип (A/B/C/D).
5. `python parse.py --only <doc_id>`
6. `python parse.py --show <doc_id>` — посмотреть дерево.
7. `python check_penalties.py`
8. Добавить `doc_id` в `DOC_IDS` в `parser/export_to_js.py`.
9. `python export_to_js.py`
10. Добавить `<script src="js/data/<doc_id>.js"></script>` в `app.html` и
    `law.html`, а также `doc_id` в `GROUPS` в `render.js`.
11. Добавить имя файла в `PRECACHE` в `site/sw.js`.
12. Поднять `CACHE_VERSION`.
13. Проверить на сайте.

---

## 10. Git

**Локальная папка:** `D:\project\memo-ro` (вне OneDrive — чтобы не было
конфликтов с `git`).

**`.gitignore`** исключает:

- `parser/storage_state.json` — cookies форума (**критично**),
- `raw_backup_*/`, `mockup/` — архивы,
- `__pycache__/`, `*.pyc`,
- `.vscode/`, `.idea/`,
- системные файлы.

**Коммитим:** `raw/`, `data/`, `parser/cache/`, `parser/changelog.json`,
`site/js/data/*.js`, все скрипты, документацию, `NOTES.md`.

**Что нельзя коммитить:** `parser/storage_state.json`. Если случайно
закоммитил — сразу отозвать: файл содержит активную сессию форума.
---

## 11. Известные ограничения и TODO

**Не реализовано (хотя есть в `shema.json`):**

- `meta.conviction`, `meta.jurisdiction`, `meta.resolution`, `meta.group`.
- `related` — связи со статьями других кодексов.
- Обработка дублей номеров статей.

**Многочастные статьи со штрафами:**

Например, статья 8.8 КоАП: разные суммы для гражданина / должностного лица /
организации. Парсер сжимает все диапазоны в один: `from: 20000, to: 250000`.
Точность по частям не сохраняется.

**Числа прописью и МРОТ:** «не менее пяти тысяч рублей», «до ста тысяч»,
«500 МРОТ» — не парсятся.

**Мёртвые поля в `config.json`:** `location`, `blacklist`, `schemas` — не
используются.

**Мобильная вёрстка:** есть `@media (max-width: 900px)`, но `layout-3col`
на телефоне не перестраивается. Если понадобится — отдельная задача.

**Чистка Python-скриптов:** не начата. JS-модули и CSS — почищены.

---

## 12. Отладка

**`check_penalties.py` нашёл «ПРОПУЩЕН ДИАПАЗОН».**
Открой `raw/<doc_id>.json`, найди статью, посмотри формулировку. Скорее
всего — нестандартный формат. Регулярку `RE_RANGE` в `parse.py` можно
расширить.

**Парсер построил странное дерево (`parse.py --show`).**
Смотри на `--show ak` и текст. Скорее всего — нестандартный заголовок
главы/статьи.

**На сайте не обновляются данные.**
Забыл `export_to_js.py`. Фронт читает `site/js/data/*.js`, а не
`data/*.json`.

**⚠️ Service Worker кэширует JS/CSS.**
Если правил файл, а браузер отдаёт старое:

1. `Ctrl + Shift + R` (жёсткое обновление).
2. Если не помогло — DevTools → **Application → Service Workers →
   Unregister всё**.
3. **Application → Storage → Clear site data.**
4. Перезагрузить страницу.

**Сейчас Service Worker временно отключён** в `app.html` и `law.html`
(блок регистрации закомментирован). При релизе — вернуть.

**Если что-то не работает на фронте — первым делом DevTools → Console.**
Красные ошибки там.

**Changelog показывает не то, что ожидалось.**
Проверь `parser/cache/<doc_id>.json` — там должно быть то, что было до
прогона. Можно руками отредактировать cache — тогда diff посчитается
от новой версии.

**Модалка избранного пуста, но счётчик > 0.**
Значит `nodeId` устарел. Почистить через DevTools:
```js
localStorage.removeItem('ro_memo_favorites');
localStorage.removeItem('ro_memo_cart');
location.reload();
```

**`run_raw.py` возвращает 403.**
Сессия истекла. Пересоздать `storage_state.json`.

---

## 13. Структура проекта

```
memo-ro/
├── .gitignore
├── README.md
├── NOTES.md                    # рабочий контекст (см. NOTES.md)
├── shema.json                  # каноническая схема данных
│
├── raw/                        # сырые посты с форума
│   ├── 4930.json
│   ├── 4930.txt
│   └── ...
│
├── data/                       # обработанные деревья
│   ├── ak.json
│   ├── uk.json
│   └── ...
│
├── parser/
│   ├── run_raw.py              # сбор с форума
│   ├── analyze.py              # обзор структуры
│   ├── parse.py                # парсер + diff + cache
│   ├── check_penalties.py      # валидация штрафов
│   ├── export_to_js.py         # конвертер в JS
│   ├── config.json             # маппинги thread_id ↔ doc_id
│   ├── storage_state.json      # НЕ КОММИТИТЬ
│   ├── changelog.json          # история изменений
│   ├── analyze_report.json     # отчёт analyze.py
│   └── cache/                  # снимки предыдущего прогона
│       ├── ak.json
│       └── ...
│
└── site/
    ├── index.html              # выбор профиля
    ├── faction.html            # выбор фракции
    ├── app.html                # главная
    ├── law.html                # страница документа
    ├── sw.js                   # service worker (временно отключён)
    ├── manifest.webmanifest    # PWA-манифест
    ├── icons/                  # иконки PWA
    │   ├── icon-192.png
    │   └── icon-512.png
    ├── css/
    │   └── app.css
    └── js/
        ├── data/               # JS-обёртки
        │   ├── _manifest.js
        │   ├── changelog.js
        │   ├── ak.js
        │   └── ...
        ├── app.js
        ├── data.js
        ├── law.js
        ├── modal.js
        ├── profile.js
        ├── render.js
        └── store.js
```
---

## 14. Что можно сделать дальше

- **Почистить Python-скрипты** (`check_penalties.py`, `analyze.py`,
  `parse.py`, `run_raw.py`) — по аналогии с JS.
- Научить парсер извлекать `conviction` / `jurisdiction` / `related`.
- Обработка дублей номеров статей (`node_id` с суффиксами `-1`, `-2`).
- Инкрементальный changelog (только изменённые документы).
- Командная палитра: расширить `Ctrl+K` — быстрые переходы, команды.
- Подсветка совпадений в результатах поиска (`<mark>`).
- Автоматизация пайплайна: `parser/update_all.py` одной командой.
- Светлая тема.
- Экспорт статьи в markdown/PDF.
- Кэш документов в IndexedDB.
- Мобильная вёрстка.

---

## 15. Полезные ссылки

- **Сайт:** https://ro-memo.netlify.app/
- **Форум:** https://forum.russia.online/
- **Локальный запуск:** `cd site && python -m http.server 8000`
- **Рабочий контекст:** `NOTES.md` в корне