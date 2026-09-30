
### Ключевые файлы фронта

| Файл | Что делает |
|---|---|
| `site/js/data.js` | `Docs.get`, `findArticle`, `allArticles`, `searchAll`, `parseNodeId`, `walkTree` |
| `site/js/store.js` | Избранное, корзина, недавние (LS), `cartSummary`, `resolveNode` |
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
   Точность по частям теряется, но не надо править вручную.

2. **Прокуратура и адвокатура не участвуют в передаче материала.**
   Константа `NO_TRANSFER_FACTIONS = ['prok', 'adv']` в `render.js`.

3. **Локальный поиск в колонке 2 убран.**
   Есть только глобальный (`Ctrl+K`, кнопка в топбаре).

4. **Один общий localStorage для всех профилей.**

5. **`parser/cache/` и `changelog.json` коммитятся в git.**

6. **Архивные папки в `.gitignore`:** `mockup/`, `raw_backup_*/`.

7. **PWA: cache-first + versioning.**
   При обновлении данных поднимать `CACHE_VERSION` в `site/sw.js`.

8. **Единый источник данных о фракциях — `Profile.FACTIONS`.**
   Больше нет дублей `FACTION_SHORT`/`FACTION_COLOR` в `render.js`.

9. **Единый парсер `nodeId` — `Docs.parseNodeId`.**
   Больше нет дублей в `store.js`.

10. **Service Worker отключён на время разработки.**
    Перед релизом вернуть в `app.html` и `law.html`.

---

## Известные ограничения и TODO

### Не реализовано

- `meta.conviction`, `meta.jurisdiction`, `meta.resolution`, `meta.group`
  — описаны в `shema.json`, но парсер их не создаёт.
- `related` — связи со статьями других кодексов.
- Обработка дублей номеров статей (если в документе две `Статья 1.`).
- Числа прописью и МРОТ — не парсятся («не менее пяти тысяч», «500 МРОТ»).
- `config.json`: поля `location`, `blacklist`, `schemas` не используются.
- **Чистка Python-скриптов** (`check_penalties.py`, `analyze.py`,
  `parse.py`, `run_raw.py`) — не начата.
- **Мобильная вёрстка** — не делалась. Есть `@media (max-width: 900px)`,
  но `layout-3col` на телефоне не перестраивается.

### Потенциальные грабли

- **Service Worker требует аккуратности.**
  При обновлении данных — поднять `CACHE_VERSION` в `site/sw.js`.
  Симптом: обновил закон, прогнал пайплайн, а на сайте всё по-старому.
  **Лечение:**
    1. `Ctrl + Shift + R` (жёсткое обновление).
    2. Если не помогло — DevTools → Application → Service Workers →
       Unregister всё.
    3. Application → Storage → Clear site data.
    4. Перезагрузить.
  **Сейчас SW отключён на время разработки** — значит, этих проблем не будет,
  но при релизе — не забыть вернуть и настроить.

- **`file://` не работает с PWA.**
  Service worker не регистрируется. Нужен локальный сервер:
  `python -m http.server 8000` в папке `site/`.

- **Ошибки при загрузке JS видны в DevTools → Console.**
  Если что-то не работает — **первым делом** открой консоль.

### Идеи на будущее

- **Командная палитра** — расширить `Ctrl+K`: быстрые переходы к документам,
  команды вроде «открыть корзину».
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