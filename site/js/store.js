// ============================================================
// Хранилище: избранное, корзина, недавние. Всё в localStorage.
// ============================================================

const Store = (() => {

  const KEY_FAV    = 'ro_memo_favorites';
  const KEY_CART   = 'ro_memo_cart';
  const KEY_RECENT = 'ro_memo_recent';

  const RECENT_MAX = 8;

  // ----------------------------------------------------------
  // Базовые операции с localStorage
  // ----------------------------------------------------------

  function load(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];

      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      console.warn(`Store.load(${key}): не удалось прочитать`, e);
      return [];
    }
  }

  function save(key, arr) {
    try {
      localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {
      console.warn(`Store.save(${key}): не удалось сохранить`, e);
    }
  }

  // ----------------------------------------------------------
  // Фабрика списков (избранное и корзина устроены одинаково)
  // ----------------------------------------------------------

  function createList(key) {
    return {
      list:   ()      => load(key),
      has:    (id)    => load(key).includes(id),
      count:  ()      => load(key).length,
      clear:  ()      => save(key, []),
      toggle: (id)    => {
        const list = load(key);
        const idx = list.indexOf(id);
        if (idx >= 0) list.splice(idx, 1);
        else list.push(id);
        save(key, list);
        return idx < 0; // true — добавили, false — убрали
      },
    };
  }

  const fav  = createList(KEY_FAV);
  const cart = createList(KEY_CART);

  // ----------------------------------------------------------
  // Недавние
  // Хранит список nodeId, от свежего к старому.
  // Максимум RECENT_MAX, дубликаты не создаются —
  // при повторном открытии статья поднимается в начало.
  // ----------------------------------------------------------

  function recentList() {
    return load(KEY_RECENT);
  }

  function recentAdd(nodeId) {
    if (!nodeId) return;

    let list = recentList();
    list = list.filter(id => id !== nodeId); // убрать, если уже есть
    list.unshift(nodeId);                    // в начало
    if (list.length > RECENT_MAX) {
      list = list.slice(0, RECENT_MAX);      // обрезать
    }
    save(KEY_RECENT, list);
  }

  function recentClear() {
    save(KEY_RECENT, []);
  }

  // ----------------------------------------------------------
  // Разбор nodeId → объект статьи
  // Формат nodeId: "<docId>-<articleNum>", например "ak-14.3"
  // ----------------------------------------------------------

  function parseNodeId(nodeId) {
    const dashIdx = nodeId.indexOf('-');
    if (dashIdx === -1) return null;
    return {
      docId: nodeId.substring(0, dashIdx),
      articleNum: nodeId.substring(dashIdx + 1),
    };
  }

  function resolveNode(nodeId) {
    const p = parseNodeId(nodeId);
    if (!p) return null;

    const article = Docs.findArticle(nodeId);
    if (!article) {
      return { nodeId, docId: p.docId, articleNum: p.articleNum, error: true };
    }

    return {
      nodeId,
      docId: p.docId,
      articleNum: p.articleNum,
      title: article.title || '',
      penalty: article.penalty || null,
      meta: article.meta || {},
    };
  }

  // ----------------------------------------------------------
  // Агрегация корзины
  // ----------------------------------------------------------

  function cartSummary() {
    const items = cart.list().map(resolveNode).filter(Boolean);

    let fineMin = 0, fineMax = 0, hasFine = false;
    let arrestMax = 0, freedomMax = 0, starsMax = 0;

    for (const it of items) {
      const p = it.penalty;
      if (p && p.types) {
        for (const t of p.types) {
          if (t.type === 'штраф') {
            hasFine = true;
            if (t.from) fineMin += t.from;
            if (t.to)   fineMax += t.to;
          }
          if (t.type === 'арест' && t.to && t.to > arrestMax) {
            arrestMax = t.to;
          }
          if (t.type === 'лишение свободы' && t.to && t.to > freedomMax) {
            freedomMax = t.to;
          }
        }
      }

      const stars = it.meta && it.meta.priorityStars;
      if (stars && stars > starsMax) starsMax = stars;
    }

    return {
      count: items.length,
      items,
      hasFine,
      fineMin,
      fineMax,
      arrestMax,
      freedomMax,
      starsMax,
    };
  }

  // ----------------------------------------------------------
  // Публичный API
  // Сохраняем старые имена (favList, cartToggle и т.д.),
  // чтобы не ломать вызовы в render.js и modal.js.
  // ----------------------------------------------------------

  return {
    // избранное
    favList:   fav.list,
    favHas:    fav.has,
    favToggle: fav.toggle,
    favCount:  fav.count,
    favClear:  fav.clear,

    // корзина
    cartList:   cart.list,
    cartHas:    cart.has,
    cartToggle: cart.toggle,
    cartCount:  cart.count,
    cartClear:  cart.clear,

    // недавние
    recentList, recentAdd, recentClear,

    // утилиты
    parseNodeId, resolveNode, cartSummary,
  };

})();