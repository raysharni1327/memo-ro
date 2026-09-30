// ============================================================
// Страница закона: law.html#<doc_id>[/<node>][-<article>]
// ============================================================

// Соответствие букв типам узлов (в URL: p3, s2, c1)
const NODE_TYPE_MAP = { p: 'part', s: 'section', c: 'chapter' };

// Цвета индикатора профиля (совпадают с акцентами CSS)
const DOT_COLORS = {
  civil: '#8b5cf6',
  gov:   '#3b82f6',
};

// Заглушки
const HINT_NO_DOC = `<div class="empty-hint empty-hint--padded">Документ не указан.</div>`;
const HINT_PICK_ARTICLE = `<div class="empty-hint empty-hint--mt40">Выбери статью слева.</div>`;

// Состояние страницы
const LawState = {
  docId: null,
  nodePath: null,
  articleNum: null,
};

// ------------------------------------------------------------
// Точка входа
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {

  const profile = Profile.get();
  if (!profile) {
    location.href = 'index.html';
    return;
  }

  updateHeader(profile);
  Modal.updateCounters();

  parseHash();

  const treeNav = document.getElementById('tree-nav');
  if (!LawState.docId || !Docs.get(LawState.docId)) {
    if (treeNav) treeNav.innerHTML = HINT_NO_DOC;
    return;
  }

  renderAll();

  bindTreeNav();
  bindListReset();
  bindArticleList();
  bindHeaderButtons();
  bindHotkeys();
  bindProfileSwitcher();
  bindHashChange();
});

// ------------------------------------------------------------
// Полный рендер страницы под текущее состояние
// ------------------------------------------------------------
function renderAll() {
  Render.tree(LawState.docId, LawState.nodePath);
  renderList();

  const articleView = document.getElementById('article-view');
  if (LawState.articleNum) {
    Render.article(LawState.docId, LawState.articleNum);
    highlightActiveArticle(LawState.articleNum);
  } else if (articleView) {
    articleView.innerHTML = HINT_PICK_ARTICLE;
  }
}

// ------------------------------------------------------------
// Обработчики
// ------------------------------------------------------------
function bindTreeNav() {
  const treeNav = document.getElementById('tree-nav');
  if (!treeNav) return;

  treeNav.addEventListener('click', (e) => {
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

    LawState.nodePath = isActive ? null : (path ? path.split('/') : null);
    LawState.articleNum = null;
    updateHash();

    Render.tree(LawState.docId, LawState.nodePath);
    renderList();

    const articleView = document.getElementById('article-view');
    if (articleView) articleView.innerHTML = HINT_PICK_ARTICLE;
  });
}

function bindListReset() {
  const btn = document.getElementById('list-reset');
  if (!btn) return;

  btn.addEventListener('click', () => {
    LawState.nodePath = null;
    LawState.articleNum = null;
    updateHash();
    Render.tree(LawState.docId, null);
    renderList();
  });
}

function bindArticleList() {
  const list = document.getElementById('article-list');
  if (!list) return;

  list.addEventListener('click', (e) => {
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

    document.querySelectorAll('.article-row')
      .forEach(r => r.classList.remove('row-active'));
    row.classList.add('row-active');

    Render.article(LawState.docId, num);
  });
}

function bindHeaderButtons() {
  document.getElementById('btn-fav')
    ?.addEventListener('click', () => Modal.openFavorites());
  document.getElementById('btn-cart')
    ?.addEventListener('click', () => Modal.openCart());
  document.getElementById('global-search')
    ?.addEventListener('click', () => Modal.openSearch());
  document.getElementById('switch-profile')
    ?.addEventListener('click', () => {
      Modal.openProfileSwitcher(() => {
        updateHeader(Profile.get());
        if (LawState.docId) {
          renderList();
          if (LawState.articleNum) {
            Render.article(LawState.docId, LawState.articleNum);
          }
        }
      });
    });
}

function bindHotkeys() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      Modal.openSearch();
    }
  });
}

function bindProfileSwitcher() {
  // Уже встроено в bindHeaderButtons — оставлено для совместимости.
  // Если понадобится отдельная логика — вынести сюда.
}

function bindHashChange() {
  window.addEventListener('hashchange', () => {
    parseHash();
    if (!LawState.docId || !Docs.get(LawState.docId)) return;
    renderAll();
  });
}

// ------------------------------------------------------------
// Hash-навигация
// ------------------------------------------------------------
function parseHash() {
  const hash = location.hash.substring(1);

  if (!hash) {
    LawState.docId = null;
    LawState.nodePath = null;
    LawState.articleNum = null;
    return;
  }

  const [docAndPath, articleNum] = splitArticle(hash);
  LawState.articleNum = articleNum;   // уже без #pN

  const parts = docAndPath.split('/');
  LawState.docId = parts[0];
  LawState.nodePath = parts.length > 1 ? parts.slice(1) : null;
}

// Разбор хвоста хеша:
//   "ak"                 → [docAndPath="ak",                 articleNum=null]
//   "ak-14.18"           → [docAndPath="ak",                 articleNum="14.18"]
//   "ak-14.18#p1"        → [docAndPath="ak",                 articleNum="14.18"]   (partNum отбрасываем)
//   "ak/s1/c2-14.18#p1"  → [docAndPath="ak/s1/c2",           articleNum="14.18"]
function splitArticle(hash) {
  // 1. Отрезаем суффикс части "#pN"
  let cleanHash = hash;
  const hashIdx = hash.indexOf('#p');
  if (hashIdx >= 0) {
    cleanHash = hash.substring(0, hashIdx);
  }

  // 2. Ищем "номер статьи" в хвосте (после последнего "/" и после дефиса)
  const parts = cleanHash.split('/');
  const tail = parts[parts.length - 1];
  const dashIdx = tail.indexOf('-');

  if (dashIdx > 0) {
    const num = tail.substring(dashIdx + 1);
    if (/^\d/.test(num)) {
      parts[parts.length - 1] = tail.substring(0, dashIdx);
      return [parts.join('/'), num];
    }
  }
  return [cleanHash, null];
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

// ------------------------------------------------------------
// Список статей
// ------------------------------------------------------------
function renderList() {
  const articles = getFilteredArticles(LawState.docId, LawState.nodePath);
  Render.articleList(LawState.docId, articles);

  const resetBtn = document.getElementById('list-reset');
  if (resetBtn) {
    resetBtn.style.display =
      (LawState.nodePath && LawState.nodePath.length) ? 'inline-block' : 'none';
  }

  if (LawState.articleNum) highlightActiveArticle(LawState.articleNum);
}

function getFilteredArticles(docId, nodePath) {
  let articles = Docs.allArticles(docId);

  if (nodePath && nodePath.length) {
    const node = findNode(docId, nodePath);
    if (node) articles = collectArticles(node);
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

  const type = NODE_TYPE_MAP[match[1].toLowerCase()];
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
    r.classList.toggle('row-active', r.dataset.article === num);
  });
}

// ------------------------------------------------------------
// Шапка страницы
// ------------------------------------------------------------
function updateHeader(profile) {
  const label = document.getElementById('profile-label');
  const dot = document.getElementById('profile-dot');
  if (!label || !dot) return;

  let text, color;

  if (profile.role === 'civil') {
    text = 'Гражданский';
    color = DOT_COLORS.civil;
  } else {
    const info = Profile.factionInfo();
    text = info ? `Гос: ${info.short}` : 'Гос сотрудник';
    color = info ? info.color : DOT_COLORS.gov;
  }

  label.textContent = text;
  dot.style.background = color;
  dot.style.color = color;
}