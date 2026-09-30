// ============================================================
// Модальные окна: избранное, корзина, смена профиля, поиск.
// ============================================================

const Modal = (() => {

  let overlayEl = null;

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
        const docShort = Render.docShort(it.docId);
        return `<li class="modal-list-item" data-node="${nodeId}">
          <span class="modal-doc doc-plate">${docShort}</span>
          <span class="modal-num">${it.articleNum}</span>
          <span class="modal-title-text">${it.title}</span>
          <button class="modal-remove" data-remove="${nodeId}">✕</button>
        </li>`;
      }).join('') + `</ul>`;
    }

    open(html, `Избранное (${Store.favCount()})`);
    attachListHandlers();
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
        const stars = '★'.repeat(summary.starsMax) + '☆'.repeat(5 - summary.starsMax);
        aggHtml += `<div class="cart-agg">
          <span class="cart-agg-label">Приоритет розыска</span>
          <span class="cart-agg-value stars-value">${stars}</span>
        </div>`;
      }

      if (summary.hasFine) {
        let range;
        if (summary.fineMin && summary.fineMax) {
          range = `${formatMoney(summary.fineMin)} — ${formatMoney(summary.fineMax)} ₽`;
        } else if (summary.fineMin) {
          range = `от ${formatMoney(summary.fineMin)} ₽`;
        } else {
          range = `до ${formatMoney(summary.fineMax)} ₽`;
        }
        aggHtml += `<div class="cart-agg">
          <span class="cart-agg-label">Штраф</span>
          <span class="cart-agg-value">${range}</span>
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
        const docShort = Render.docShort(it.docId);
        return `<li class="modal-list-item" data-node="${it.nodeId}">
          <span class="modal-doc doc-plate">${docShort}</span>
          <span class="modal-num">${it.articleNum}</span>
          <span class="modal-title-text">${it.title}</span>
          <button class="modal-remove" data-remove="${it.nodeId}">✕</button>
        </li>`;
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
    attachListHandlers();
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
        return `<a class="${cls}" href="law.html#${r.docId}-${r.num}" data-index="${i}">
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
          const href = `law.html#${r.docId}-${r.num}`;
          if (location.pathname.endsWith('law.html')) {
            location.hash = `${r.docId}-${r.num}`;
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
        location.hash = `${r.docId}-${r.num}`;
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

  function attachListHandlers() {
    const isFav = overlayEl.querySelector('.modal-title').textContent.startsWith('Избранное');

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
      navigator.clipboard.writeText(formatCartFull(summary));
      alert('Скопировано в буфер обмена.');
    });

    copyNums?.addEventListener('click', () => {
      const summary = Store.cartSummary();
      const text = summary.items.map(it => `${Render.docShort(it.docId)} ${it.articleNum}`).join('\n');
      navigator.clipboard.writeText(text);
      alert('Скопировано в буфер обмена.');
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

  // === Утилиты ===

  function formatMoney(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function formatCartFull(summary) {
    const lines = [];
    lines.push(`КОРЗИНА (${summary.count} ${plural(summary.count, 'статья', 'статьи', 'статей')})`);
    lines.push('');

    if (summary.hasFine) {
      const range = summary.fineMin && summary.fineMax
        ? `${formatMoney(summary.fineMin)} — ${formatMoney(summary.fineMax)} ₽`
        : (summary.fineMax ? `до ${formatMoney(summary.fineMax)} ₽` : '—');
      lines.push(`Штраф: ${range}`);
    }
    if (summary.arrestMax) lines.push(`Арест: до ${summary.arrestMax} суток`);
    if (summary.freedomMax) lines.push(`Лишение свободы: до ${summary.freedomMax} мес.`);
    lines.push('');

    for (const it of summary.items) {
      lines.push(`${Render.docShort(it.docId)} ${it.articleNum}. ${it.title}`);
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