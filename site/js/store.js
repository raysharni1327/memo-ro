// ============================================================
// Хранилище: избранное, корзина, недавние. Всё в localStorage.
// ============================================================

const Store = (() => {

  const KEY_FAV    = 'ro_memo_favorites';
  const KEY_CART   = 'ro_memo_cart';
  const KEY_RECENT = 'ro_memo_recent';

  const RECENT_MAX = 8;

  // === Утилиты ===

  function load(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function save(key, arr) {
    localStorage.setItem(key, JSON.stringify(arr));
  }

  function parseNodeId(nodeId) {
    const dashIdx = nodeId.indexOf('-');
    if (dashIdx === -1) return null;
    return {
      docId: nodeId.substring(0, dashIdx),
      articleNum: nodeId.substring(dashIdx + 1),
    };
  }

  // === Избранное ===

  function favList() {
    return load(KEY_FAV);
  }

  function favHas(nodeId) {
    return favList().includes(nodeId);
  }

  function favToggle(nodeId) {
    const list = favList();
    const idx = list.indexOf(nodeId);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(nodeId);
    }
    save(KEY_FAV, list);
    return idx < 0;
  }

  function favCount() {
    return favList().length;
  }

  function favClear() {
    save(KEY_FAV, []);
  }

  // === Корзина ===

  function cartList() {
    return load(KEY_CART);
  }

  function cartHas(nodeId) {
    return cartList().includes(nodeId);
  }

  function cartToggle(nodeId) {
    const list = cartList();
    const idx = list.indexOf(nodeId);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(nodeId);
    }
    save(KEY_CART, list);
    return idx < 0;
  }

  function cartCount() {
    return cartList().length;
  }

  function cartClear() {
    save(KEY_CART, []);
  }

  // === Недавние ===
  // Хранит список nodeId, от самого свежего к самому старому.
  // Максимум RECENT_MAX записей. Дубликаты не создаются — при повторном
  // открытии статья поднимается в начало.

  function recentList() {
    return load(KEY_RECENT);
  }

  function recentAdd(nodeId) {
    if (!nodeId) return;
    let list = recentList();
    // убираем, если уже есть — чтобы поднять наверх
    list = list.filter(id => id !== nodeId);
    // добавляем в начало
    list.unshift(nodeId);
    // обрезаем до максимума
    if (list.length > RECENT_MAX) {
      list = list.slice(0, RECENT_MAX);
    }
    save(KEY_RECENT, list);
  }

  function recentClear() {
    save(KEY_RECENT, []);
  }

  // === Разбор node_id в объект статьи ===

  function resolveNode(nodeId) {
    const p = parseNodeId(nodeId);
    if (!p) return null;
    const article = Docs.findArticle(nodeId);
    if (!article) return { nodeId, docId: p.docId, articleNum: p.articleNum, error: true };
    return {
      nodeId,
      docId: p.docId,
      articleNum: p.articleNum,
      title: article.title || '',
      penalty: article.penalty || null,
      meta: article.meta || {},
    };
  }

  // === Агрегация корзины ===

  function cartSummary() {
    const items = cartList().map(resolveNode).filter(Boolean);
    let fineMin = 0, fineMax = 0, hasFine = false;
    let arrestMax = 0;
    let freedomMax = 0;
    let starsMax = 0;

    for (const it of items) {
      if (it.penalty && it.penalty.types) {
        for (const t of it.penalty.types) {
          if (t.type === 'штраф') {
            hasFine = true;
            if (t.from) fineMin += t.from;
            if (t.to)   fineMax += t.to;
          }
          if (t.type === 'арест' && t.to) {
            if (t.to > arrestMax) arrestMax = t.to;
          }
          if (t.type === 'лишение свободы' && t.to) {
            if (t.to > freedomMax) freedomMax = t.to;
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

  return {
    // избранное
    favList, favHas, favToggle, favCount, favClear,
    // корзина
    cartList, cartHas, cartToggle, cartCount, cartClear,
    // недавние
    recentList, recentAdd, recentClear,
    // утилиты
    parseNodeId, resolveNode,
    cartSummary,
  };

})();