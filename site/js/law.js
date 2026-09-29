// ============================================================
// Страница закона: law.html#<doc_id>[/<node>][-<article>]
// Примеры: #uk, #uk/r4, #uk/r4/c6, #uk-6.2, #uk/r4-6.2
// ============================================================

const LawState = {
  docId: null,
  nodePath: null,
  articleNum: null,
};

document.addEventListener('DOMContentLoaded', () => {

  const profile = Profile.get();
  if (!profile) {
    window.location.href = 'index.html';
    return;
  }

  updateHeader(profile);
  Modal.updateCounters();

  parseHash();

  if (!LawState.docId || !Docs.get(LawState.docId)) {
    document.getElementById('tree-nav').innerHTML =
      `<div class="empty-hint" style="padding:20px;">Документ не указан.</div>`;
    return;
  }

  Render.tree(LawState.docId, LawState.nodePath);
  renderList();

  if (LawState.articleNum) {
    Render.article(LawState.docId, LawState.articleNum);
    highlightActiveArticle(LawState.articleNum);
  }

  // === Клик по дереву ===
  document.getElementById('tree-nav').addEventListener('click', (e) => {
    if (e.target.closest('.tree-arrow')) {
      e.stopPropagation();
      const parent = e.target.closest('.tree-node');
      if (parent) parent.classList.toggle('tree-open');
      return;
    }

    const label = e.target.closest('.tree-label');
    if (!label) return;

    const node = label.closest('.tree-node');
    if (!node) return;

    const path = node.dataset.path;
    const isActive = node.classList.contains('tree-active');

    if (isActive) {
      LawState.nodePath = null;
    } else {
      LawState.nodePath = path ? path.split('/') : null;
    }

    LawState.articleNum = null;
    updateHash();
    Render.tree(LawState.docId, LawState.nodePath);
    renderList();
    document.getElementById('article-view').innerHTML =
      `<div class="empty-hint" style="margin-top: 40px;">Выбери статью слева.</div>`;
  });

  // === Поиск ===
  document.getElementById('list-search-input').addEventListener('input', (e) => {
    renderList(e.target.value);
  });

  // === Кнопка "Показать все статьи" ===
  document.getElementById('list-reset').addEventListener('click', () => {
    LawState.nodePath = null;
    LawState.articleNum = null;
    updateHash();
    Render.tree(LawState.docId, null);
    renderList();
  });

  // === Клик по статье или по ★/🗑 в списке ===
  document.getElementById('article-list').addEventListener('click', (e) => {
    const favBtn = e.target.closest('[data-fav]');
    if (favBtn) {
      e.stopPropagation();
      const nodeId = favBtn.dataset.node;
      const added = Store.favToggle(nodeId);
      favBtn.textContent = added ? '★' : '☆';
      favBtn.classList.toggle('row-btn-active', added);
      Modal.updateCounters();
      return;
    }
    const cartBtn = e.target.closest('[data-cart]');
    if (cartBtn) {
      e.stopPropagation();
      const nodeId = cartBtn.dataset.node;
      const added = Store.cartToggle(nodeId);
      cartBtn.classList.toggle('row-btn-active', added);
      Modal.updateCounters();
      return;
    }

    const row = e.target.closest('.article-row');
    if (!row) return;
    const num = row.dataset.article;
    if (!num) return;

    LawState.articleNum = num;
    updateHash();

    document.querySelectorAll('.article-row').forEach(r => r.classList.remove('row-active'));
    row.classList.add('row-active');

    Render.article(LawState.docId, num);
  });

  // === Кнопки в шапке ===
  document.getElementById('btn-fav')?.addEventListener('click', () => Modal.openFavorites());
  document.getElementById('btn-cart')?.addEventListener('click', () => Modal.openCart());

  // === Смена профиля — через модалку, без confirm() ===
  document.getElementById('switch-profile')?.addEventListener('click', () => {
    Modal.openProfileSwitcher(() => {
      updateHeader(Profile.get());
      // перерисовать список статей (цвета фракций) и текущую статью (warn-block)
      if (LawState.docId) {
        renderList();
        if (LawState.articleNum) {
          Render.article(LawState.docId, LawState.articleNum);
        }
      }
    });
  });

  // === Реакция на смену hash ===
  window.addEventListener('hashchange', () => {
    parseHash();
    if (!LawState.docId || !Docs.get(LawState.docId)) return;

    Render.tree(LawState.docId, LawState.nodePath);
    renderList();

    if (LawState.articleNum) {
      Render.article(LawState.docId, LawState.articleNum);
      highlightActiveArticle(LawState.articleNum);
    } else {
      document.getElementById('article-view').innerHTML =
        `<div class="empty-hint" style="margin-top: 40px;">Выбери статью слева.</div>`;
    }
  });

});

// === Утилиты ===

function parseHash() {
  const hash = location.hash.substring(1);
  if (!hash) return;

  const [docAndPath, articleNum] = splitArticle(hash);
  LawState.articleNum = articleNum;

  const parts = docAndPath.split('/');
  LawState.docId = parts[0];
  LawState.nodePath = parts.length > 1 ? parts.slice(1) : null;
}

function splitArticle(hash) {
  const lastSlash = hash.lastIndexOf('/');
  const tail = hash.substring(lastSlash + 1);
  const dashIdx = tail.indexOf('-');
  if (dashIdx > 0) {
    const num = tail.substring(dashIdx + 1);
    if (/^\d/.test(num)) {
      const before = hash.substring(0, lastSlash + 1) + tail.substring(0, dashIdx);
      return [before, num];
    }
  }
  return [hash, null];
}

function updateHash() {
  const parts = [LawState.docId];
  if (LawState.nodePath && LawState.nodePath.length) {
    parts.push(LawState.nodePath.join('/'));
  }
  let hash = parts.join('/');
  if (LawState.articleNum) hash += '-' + LawState.articleNum;
  history.replaceState(null, '', '#' + hash);
}

function renderList(query = '') {
  const articles = getFilteredArticles(LawState.docId, LawState.nodePath, query);
  Render.articleList(LawState.docId, articles, query);

  const resetBtn = document.getElementById('list-reset');
  resetBtn.style.display = (LawState.nodePath && LawState.nodePath.length) ? 'inline-block' : 'none';

  if (LawState.articleNum) highlightActiveArticle(LawState.articleNum);
}

function getFilteredArticles(docId, nodePath, query) {
  let articles = Docs.allArticles(docId);

  if (nodePath && nodePath.length) {
    const node = findNode(docId, nodePath);
    if (node) articles = collectArticles(node);
  }

  if (query) {
    const q = query.toLowerCase();
    articles = articles.filter(a =>
      (a.number || '').toLowerCase().includes(q) ||
      (a.title || '').toLowerCase().includes(q) ||
      (a.children || []).some(c => (c.text || '').toLowerCase().includes(q))
    );
  }

  return articles;
}

function findNode(docId, path) {
  const doc = Docs.get(docId);
  if (!doc) return null;

  let currentLevel = doc.nodes || [];
  let found = null;

  for (let i = 0; i < path.length; i++) {
    found = findInLevel(currentLevel, path[i]);
    if (!found) return null;
    currentLevel = found.children || [];
  }

  return found;
}

function findInLevel(nodes, segment) {
  const match = segment.match(/^([psc])(\d+)$/i);
  if (!match) return null;

  const typeMap = { p: 'part', s: 'section', c: 'chapter' };
  const type = typeMap[match[1].toLowerCase()];
  const idx = parseInt(match[2], 10) - 1;

  const sameType = nodes.filter(n => n.type === type);
  return (idx >= 0 && idx < sameType.length) ? sameType[idx] : null;
}

function collectArticles(node) {
  const out = [];
  function walk(nodes) {
    for (const n of nodes) {
      if (n.type === 'article') out.push(n);
      if (n.children) walk(n.children);
    }
  }
  walk(node.children || []);
  return out;
}

function highlightActiveArticle(num) {
  document.querySelectorAll('.article-row').forEach(r => {
    if (r.dataset.article === num) r.classList.add('row-active');
    else r.classList.remove('row-active');
  });
}

function updateHeader(profile) {
  const label = document.getElementById('profile-label');
  const dot = document.getElementById('profile-dot');
  if (!label || !dot) return;

  if (profile.role === 'civil') {
    label.textContent = 'Гражданский';
    dot.style.background = '#8b5cf6';
    dot.style.color = '#8b5cf6';
    return;
  }
  const info = Profile.factionInfo();
  if (info) {
    label.textContent = `Гос: ${info.short}`;
    dot.style.background = info.color;
    dot.style.color = info.color;
  } else {
    label.textContent = 'Гос сотрудник';
    dot.style.background = '#3b82f6';
    dot.style.color = '#3b82f6';
  }
}