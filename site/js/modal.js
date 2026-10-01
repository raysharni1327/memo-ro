// ============================================================
// Модальные окна: избранное, корзина, смена профиля, поиск.
// ============================================================

const Modal = (() => {

  let overlayEl = null;

  // Максимум звёзд приоритета (совпадает с render.js)
  const STARS_MAX = 5;
  // ----------------------------------------------------------
  // Базовое открытие / закрытие
  // ----------------------------------------------------------

  function ensureOverlay() {
    if (overlayEl) return overlayEl;
    overlayEl = document.createElement('div');
    overlayEl.className = 'modal-overlay';
    overlayEl.addEventListener('click', (e) => {
      if (e.target === overlayEl) close();
    });
    document.body.appendChild(overlayEl);
    return overlayEl;
  }

  function open(htmlContent, title) {
    const overlay = ensureOverlay();
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">${title}</h2>
          <button class="modal-close">✕</button>
        </div>
        <div class="modal-body">${htmlContent}</div>
      </div>
    `;
    overlay.classList.add('modal-overlay--open');
    overlay.querySelector('.modal-close').addEventListener('click', close);
  }

  function close() {
    if (overlayEl) overlayEl.classList.remove('modal-overlay--open');
  }

  // === Избранное ===

  function openFavorites() {
    const list = Store.favList();
    let html;

    if (!list.length) {
      html = `<div class="empty-hint">Избранных статей пока нет. Нажми ★ у статьи, чтобы добавить её сюда.</div>`;
    } else {
            html = `<ul class="modal-list">` + list.map(nodeId => {
        const it = Store.resolveNode(nodeId);
        if (!it || it.error) return '';
        const numLabel = it.isPart ? `${it.articleNum} ч.${it.partNum}` : it.articleNum;
        return renderListItem(nodeId, numLabel, it.title, Render.docShort(it.docId));
      }).join('') + `</ul>`;
    }

    open(html, `Избранное (${Store.favCount()})`);
    attachListHandlers('fav');
  }

  // === Корзина ===

  function openCart() {
    const summary = Store.cartSummary();
    let html;

    if (!summary.count) {
      html = `<div class="empty-hint">Корзина пуста. Нажми 🗑 у статьи, чтобы добавить её сюда.</div>`;
    } else {
      let aggHtml = '';

      if (summary.starsMax) {
        const stars = '★'.repeat(summary.starsMax) + '☆'.repeat(STARS_MAX - summary.starsMax);
        aggHtml += `<div class="cart-agg">
          <span class="cart-agg-label">Приоритет розыска</span>
          <span class="cart-agg-value stars-value">${stars}</span>
        </div>`;
      }

      if (summary.hasFine) {
        aggHtml += `<div class="cart-agg">
          <span class="cart-agg-label">Штраф</span>
          <span class="cart-agg-value">${formatFineRange(summary)}</span>
        </div>`;
      }

      if (summary.arrestMax) {
        aggHtml += `<div class="cart-agg">
          <span class="cart-agg-label">Арест</span>
          <span class="cart-agg-value">до ${summary.arrestMax} суток</span>
        </div>`;
      }

      if (summary.freedomMax) {
        aggHtml += `<div class="cart-agg">
          <span class="cart-agg-label">Лишение свободы</span>
          <span class="cart-agg-value">до ${summary.freedomMax} мес.</span>
        </div>`;
      }

            const itemsHtml = summary.items.map(it => {
        const numLabel = it.isPart ? `${it.articleNum} ч.${it.partNum}` : it.articleNum;
        return renderListItem(it.nodeId, numLabel, it.title, Render.docShort(it.docId));
      }).join('');

      html = `
        <div class="cart-summary">${aggHtml || '<div class="cart-agg"><span class="cart-agg-label">Наказания</span><span class="cart-agg-value">нет данных</span></div>'}</div>
        <ul class="modal-list">${itemsHtml}</ul>
        <div class="cart-actions">
          <button class="cart-btn cart-btn-primary" data-cart-copy="full">Скопировать полностью</button>
          <button class="cart-btn" data-cart-copy="numbers">Скопировать номера</button>
          <button class="cart-btn cart-btn-danger" data-cart-clear>Очистить</button>
        </div>
      `;
    }

    open(html, `Корзина (${Store.cartCount()})`);
    attachListHandlers('cart');
    attachCartHandlers();
  }

  // === Смена профиля ===

  function openProfileSwitcher(onChange) {
    const profile = Profile.get();
    const currentRole = profile ? profile.role : null;
    const currentFaction = profile ? profile.faction : null;

    const FACTIONS = Profile.FACTIONS;

    let html = '';

    html += `<div class="profile-modal-group-title">Роль</div>`;
    html += `<div class="profile-modal-list">`;

    const civilActive = currentRole === 'civil' ? 'is-current' : '';
    html += `<button class="profile-modal-item ${civilActive}" data-role="civil">
      <span class="pm-dot" style="background:#8b5cf6"></span>
      <span class="pm-name">Гражданский</span>
      ${currentRole === 'civil' ? '<span class="pm-tag">текущий</span>' : ''}
    </button>`;

    html += `</div>`;

    html += `<div class="profile-modal-group-title">Гос структуры</div>`;
    html += `<div class="profile-modal-list">`;

    for (const key of Object.keys(FACTIONS)) {
      const f = FACTIONS[key];
      const isCurrent = currentRole === 'gov' && currentFaction === key;
      const activeCls = isCurrent ? 'is-current' : '';
      html += `<button class="profile-modal-item ${activeCls}" data-faction="${key}">
        <span class="pm-dot" style="background:${f.color}"></span>
        <span class="pm-name">${f.name}</span>
        ${isCurrent ? '<span class="pm-tag">текущая</span>' : ''}
      </button>`;
    }

    html += `</div>`;

    open(html, 'Сменить профиль');

    overlayEl.querySelectorAll('.profile-modal-item[data-role="civil"]').forEach(btn => {
      btn.addEventListener('click', () => {
        Profile.setRole('civil', null);
        close();
        if (typeof onChange === 'function') onChange();
      });
    });

    overlayEl.querySelectorAll('.profile-modal-item[data-faction]').forEach(btn => {
      btn.addEventListener('click', () => {
        const faction = btn.dataset.faction;
        Profile.setRole('gov', faction);
        close();
        if (typeof onChange === 'function') onChange();
      });
    });
  }

  // === Глобальный поиск ===

  function openSearch() {
    open(`
      <div class="search-modal">
        <div class="search-modal-input-wrap">
          <span class="search-icon">🔍</span>
          <input type="text" id="search-modal-input" class="search-modal-input"
                 placeholder="Ищи по номеру, заголовку, тексту статьи…" autocomplete="off" />
          <span class="search-kbd">Esc</span>
        </div>
        <div class="search-modal-results" id="search-modal-results">
          <div class="search-hint">Введи минимум 2 символа.</div>
        </div>
      </div>
    `, 'Поиск');

    const input = overlayEl.querySelector('#search-modal-input');
    const resultsEl = overlayEl.querySelector('#search-modal-results');
    let activeIndex = -1;
    let currentResults = [];

    function renderResults(query) {
      const trimmed = (query || '').trim();
      if (trimmed.length < 2) {
        resultsEl.innerHTML = `<div class="search-hint">Введи минимум 2 символа.</div>`;
        currentResults = [];
        activeIndex = -1;
        return;
      }

      const results = Docs.searchAll(trimmed);
      currentResults = results;
      activeIndex = results.length ? 0 : -1;

      if (!results.length) {
        resultsEl.innerHTML = `<div class="search-hint">Ничего не найдено по запросу «${escapeHtml(trimmed)}».</div>`;
        return;
      }

      resultsEl.innerHTML = results.map((r, i) => {
        const docShort = Render.docShort(r.docId);
        const cls = i === 0 ? 'search-result search-result--active' : 'search-result';
        return `<a class="${cls}" href="law.html#${r.docId}-${r.nodeId}" data-index="${i}">
          <span class="modal-doc doc-plate">${docShort}</span>
          <span class="modal-num">${r.num}</span>
          <span class="search-result-text">
            <span class="search-result-title">${escapeHtml(r.title || '')}</span>
            ${r.context && r.kind === 'text'
              ? `<span class="search-result-context">${escapeHtml(r.context)}</span>`
              : ''}
          </span>
        </a>`;
      }).join('');
    }

    function setActive(idx) {
      const items = resultsEl.querySelectorAll('.search-result');
      items.forEach(el => el.classList.remove('search-result--active'));
      if (idx >= 0 && idx < items.length) {
        items[idx].classList.add('search-result--active');
        items[idx].scrollIntoView({ block: 'nearest' });
      }
      activeIndex = idx;
    }

    input.addEventListener('input', (e) => {
      renderResults(e.target.value);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!currentResults.length) return;
        setActive(Math.min(currentResults.length - 1, activeIndex + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!currentResults.length) return;
        setActive(Math.max(0, activeIndex - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0 && currentResults[activeIndex]) {
          const r = currentResults[activeIndex];
          const href = `law.html#${r.docId}-${r.nodeId}`;
          if (location.pathname.endsWith('law.html')) {
            location.hash = `${r.docId}-${r.nodeId}`;
            close();
          } else {
            location.href = href;
          }
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    });

    // Клик по результату
    resultsEl.addEventListener('click', (e) => {
      const link = e.target.closest('.search-result');
      if (!link) return;
      e.preventDefault();
      const idx = parseInt(link.dataset.index, 10);
      const r = currentResults[idx];
      if (!r) return;
      if (location.pathname.endsWith('law.html')) {
        location.hash = `${r.docId}-${r.nodeId}`;
        close();
      } else {
        location.href = `law.html#${r.docId}-${r.num}`;
      }
    });

    // Автофокус
    setTimeout(() => input.focus(), 50);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // === Обработчики общих списков ===

  function attachListHandlers(kind) {
    // kind: 'fav' | 'cart'
    const isFav = kind === 'fav';

    overlayEl.querySelectorAll('.modal-list-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.modal-remove')) return;
        const nodeId = item.dataset.node;
        close();
        if (location.pathname.endsWith('law.html')) {
          location.hash = nodeId;
        } else {
          location.href = `law.html#${nodeId}`;
        }
      });
    });

    overlayEl.querySelectorAll('.modal-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const nodeId = btn.dataset.remove;
        if (isFav) {
          Store.favToggle(nodeId);
        } else {
          Store.cartToggle(nodeId);
        }
        updateCounters();
        Render.refreshRowButtons(nodeId);
        Render.refreshArticleButtons(nodeId);
        if (isFav) {
          openFavorites();
        } else {
          openCart();
        }
      });
    });
  }

  function attachCartHandlers() {
    const copyFull = overlayEl.querySelector('[data-cart-copy="full"]');
    const copyNums = overlayEl.querySelector('[data-cart-copy="numbers"]');
    const clearBtn = overlayEl.querySelector('[data-cart-clear]');

    copyFull?.addEventListener('click', () => {
      const summary = Store.cartSummary();
      try {
        navigator.clipboard.writeText(formatCartFull(summary));
      } catch (e) {
        console.warn('Не удалось скопировать', e);
      }
      flashButton(copyFull, 'Скопировано ✓');
    });

    copyNums?.addEventListener('click', () => {
      const summary = Store.cartSummary();
            const text = summary.items.map(it => {
        const numLabel = it.isPart ? `${it.articleNum} ч.${it.partNum}` : it.articleNum;
        return `${Render.docShort(it.docId)} ${numLabel}`;
      }).join('\n');
      try {
        navigator.clipboard.writeText(text);
      } catch (e) {
        console.warn('Не удалось скопировать', e);
      }
      flashButton(copyNums, 'Скопировано ✓');
    });

    clearBtn?.addEventListener('click', () => {
      if (!confirm('Очистить корзину?')) return;
      const nodeIds = Store.cartList().slice();
      Store.cartClear();
      updateCounters();
      nodeIds.forEach(id => {
        Render.refreshRowButtons(id);
        Render.refreshArticleButtons(id);
      });
      openCart();
    });
  }

  // === Общие рендеры ===

  // Один элемент списка (используется в избранном и корзине)
  function renderListItem(nodeId, articleNum, title, docShortName) {
    return `<li class="modal-list-item" data-node="${nodeId}">
      <span class="modal-doc doc-plate">${docShortName}</span>
      <span class="modal-num">${articleNum}</span>
      <span class="modal-title-text">${title}</span>
      <button class="modal-remove" data-remove="${nodeId}">✕</button>
    </li>`;
  }

  // Диапазон штрафа: "1 000 — 5 000 ₽" / "от 1 000 ₽" / "до 5 000 ₽"
  function formatFineRange(summary) {
    if (summary.fineMin && summary.fineMax) {
      return `${formatMoney(summary.fineMin)} — ${formatMoney(summary.fineMax)} ₽`;
    }
    if (summary.fineMin) return `от ${formatMoney(summary.fineMin)} ₽`;
    if (summary.fineMax) return `до ${formatMoney(summary.fineMax)} ₽`;
    return '';
  }

  // === Утилиты ===

  function formatMoney(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  // Временно меняет текст кнопки (вместо alert)
  function flashButton(btn, text, ms = 1500) {
    if (!btn) return;
    const original = btn.textContent;
    btn.textContent = text;
    setTimeout(() => { btn.textContent = original; }, ms);
  }

  function formatCartFull(summary) {
    const lines = [];
    lines.push(`КОРЗИНА (${summary.count} ${plural(summary.count, 'статья', 'статьи', 'статей')})`);
    lines.push('');

    if (summary.hasFine) {
      lines.push(`Штраф: ${formatFineRange(summary) || '—'}`);
    }
    if (summary.arrestMax) lines.push(`Арест: до ${summary.arrestMax} суток`);
    if (summary.freedomMax) lines.push(`Лишение свободы: до ${summary.freedomMax} мес.`);
    lines.push('');

    for (const it of summary.items) {
            const numLabel = it.isPart ? `${it.articleNum} ч.${it.partNum}` : it.articleNum;
      lines.push(`${Render.docShort(it.docId)} ${numLabel}. ${it.title}`);
      if (it.penalty && it.penalty.raw) {
        lines.push(`    ${it.penalty.raw}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  function plural(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
    return many;
  }

  function updateCounters() {
    const favEl = document.getElementById('fav-count');
    const cartEl = document.getElementById('cart-count');
    if (favEl) favEl.textContent = Store.favCount();
    if (cartEl) cartEl.textContent = Store.cartCount();
  }

  return { openFavorites, openCart, openProfileSwitcher, openSearch, close, updateCounters };

})();