// ============================================================
// Рендер боковой панели, дерева, списка статей, статьи.
// ============================================================

const Render = (() => {

  const GROUPS = [
    { title: 'Кодексы',           ids: ['uk', 'ak', 'pk', 'pdd'] },
    { title: 'Конституция и ФКЗ', ids: ['constitution', 'government', 'duma', 'courts', 'ministries', 'emergency'] },
    { title: 'ФЗ',                ids: ['police', 'fsb', 'prosecutor', 'sk', 'gibdd', 'fso', 'vs', 'service', 'secret', 'advocacy', 'territories', 'parties', 'tk', 'health', 'immunity', 'weapons', 'business', 'ethics'] },
  ];

  const ICONS = {
    uk: '📕', ak: '📘', pk: '📗', pdd: '📙', constitution: '📜',
    tk: '📒', fsb: '🛡', police: '🚔', gibdd: '🚦', sk: '⚖',
    prosecutor: '⚔', fso: '🔒', vs: '🎖', advocacy: '📚',
    courts: '🏛', duma: '🏛', government: '🏛', ministries: '🏢',
    emergency: '🚨', territories: '🗺', business: '💼', parties: '🎯',
    weapons: '🔫', health: '🏥', service: '📋', secret: '🔐',
    immunity: '🛡', ethics: '⚖',
  };

  const DOC_SHORT = {
    uk: 'УК', ak: 'КоАП', pk: 'ПК', pdd: 'ПДД', constitution: 'Конст.',
    tk: 'ТК', fsb: 'ФСБ', police: 'Полиция', gibdd: 'ГИБДД', sk: 'СК',
    prosecutor: 'Прок.', fso: 'ФСО', vs: 'ВС', advocacy: 'Адв.',
    courts: 'Суды', duma: 'Дума', government: 'Прав.', ministries: 'Мин.',
    emergency: 'ЧП', territories: 'Терр.', business: 'Бизн.', parties: 'Партии',
    weapons: 'Оружие', health: 'Здрав.', service: 'Служба', secret: 'Тайна',
    immunity: 'Неприк.', ethics: 'Этика',
  };

  const CODEX_IDS = ['uk', 'ak', 'pk', 'pdd'];

  const FACTION_SHORT = {
    fsb: 'ФСБ', mvd: 'МВД', sk: 'СК', vs: 'ВС',
    gibdd: 'ГИБДД', fso: 'ФСО', prok: 'ПРОК.', adv: 'АДВ.',
  };

  const FACTION_COLOR = {
    fsb: '#e94a4a', mvd: '#3b82f6', sk: '#8b5cf6', vs: '#22c55e',
    gibdd: '#f97316', fso: '#ea580c', prok: '#06b6d4', adv: '#10b981',
  };

  const MARK_TO_FACTION = {
    'Ф': 'fsb', 'Р': 'mvd', 'С': 'sk', 'В': 'vs',
    'Г': 'gibdd', 'О': 'fso', 'П': 'prok', 'Адв': 'adv',
  };

  const GRAY_FOREIGN = '#3a3a3a';
  const GRAY_COMMON  = '#555';

  function iconFor(docId)    { return ICONS[docId] || '🔵'; }
  function docShort(docId)   { return DOC_SHORT[docId] || docId.toUpperCase(); }
  function factionShort(f)   { return FACTION_SHORT[f] || f; }
  function factionColor(f)   { return FACTION_COLOR[f] || '#888'; }
  function markToFaction(m)  { return MARK_TO_FACTION[m] || null; }

  // === Главная: боковая панель ===

  function sidebar() {
    const nav = document.getElementById('sidebar-nav');
    if (!nav) return;
    const manifest = Docs.manifest();
    let html = '';

    for (const group of GROUPS) {
      const docs = group.ids.filter(id => manifest[id]);
      if (!docs.length) continue;

      html += `<details class="nav-section" ${group.title === 'Кодексы' ? 'open' : ''}>`;
      html += `<summary class="nav-title">${group.title}</summary>`;
      for (const id of docs) {
        const title = manifest[id].title || id;
        const isCodex = CODEX_IDS.includes(id);
        const short = DOC_SHORT[id] || id.toUpperCase().slice(0, 3);
        const iconHtml = isCodex
          ? `<span class="nav-codex nav-codex-${id}">${short}</span>`
          : `<span class="nav-icon">${iconFor(id)}</span>`;
        html += `<a class="nav-item" href="law.html#${id}">
          ${iconHtml}
          <span>${title}</span>
        </a>`;
      }
      html += `</details>`;
    }

    nav.innerHTML = html;
  }

  // === Главная: "Часто нужны" ===

  const POPULAR = [
    { doc: 'ak',  num: '14.2', title: 'Управление в состоянии опьянения' },
    { doc: 'ak',  num: '14.1', title: 'Без прав' },
    { doc: 'uk',  num: '17.6', title: 'Неповиновение' },
    { doc: 'uk',  num: '6.2',  title: 'Убийство' },
  ];

  function popular() {
    const el = document.getElementById('block-popular');
    if (!el) return;
    el.innerHTML = POPULAR.map(p => `
      <a class="card-mini" href="law.html#${p.doc}-${p.num}">
        <div class="card-doc doc-plate">${docShort(p.doc)}</div>
        <div class="card-num">${p.num}</div>
        <div class="card-title">${p.title}</div>
      </a>
    `).join('');
  }

  // === Главная: "Недавние" ===

  function recent() {
    const el = document.getElementById('block-recent');
    if (!el) return;

    const list = Store.recentList();
    const shown = list.slice(0, 4);

    if (!shown.length) {
      el.innerHTML = `
        <div class="card-ghost"></div>
        <div class="card-ghost"></div>
        <div class="card-ghost"></div>
        <div class="card-ghost"></div>
      `;
      return;
    }

    el.innerHTML = shown.map(nodeId => {
      const it = Store.resolveNode(nodeId);
      if (!it || it.error) return '';
      return `<a class="card-mini" href="law.html#${nodeId}">
        <div class="card-doc doc-plate">${docShort(it.docId)}</div>
        <div class="card-num">${it.articleNum}</div>
        <div class="card-title">${it.title}</div>
      </a>`;
    }).join('');
  }

  // === Главная: "Последние изменения" ===

  function changelog() {
    const el = document.getElementById('block-changelog');
    if (!el) return;

    const entries = (typeof window.CHANGELOG !== 'undefined' && Array.isArray(window.CHANGELOG))
      ? window.CHANGELOG
      : [];

    if (!entries.length) {
      el.innerHTML = `
        <li class="changelog-ghost"></li>
        <li class="changelog-ghost"></li>
        <li class="changelog-ghost"></li>
      `;
      return;
    }

    const shown = entries.slice(0, 5);

    el.innerHTML = shown.map(e => {
      const docShortName = docShort(e.doc_id);
      const date = e.date || '';
      const num = e.article || '';
      const text = e.text || '';

      const href = e.article
        ? `law.html#${e.doc_id}-${e.article}`
        : `law.html#${e.doc_id}`;

      const numHtml = num
        ? `<span class="changelog-num">${num}</span>`
        : '';

      return `<li onclick="location.href='${href}'">
        <span class="changelog-date">${shortDate(date)}</span>
        <span class="changelog-doc doc-plate">${docShortName}</span>
        ${numHtml}
        <span class="changelog-text">${text}</span>
      </li>`;
    }).join('');
  }

  // "2026-09-29" → "29.09"
  function shortDate(iso) {
    if (!iso || iso.length < 10) return iso || '';
    return iso.substring(8, 10) + '.' + iso.substring(5, 7);
  }

  // === law.html: дерево документа ===

  function tree(docId, activePath) {
    const el = document.getElementById('tree-nav');
    if (!el) return;

    const doc = Docs.get(docId);
    if (!doc) {
      el.innerHTML = `<div class="empty-hint">Документ не найден: ${docId}</div>`;
      return;
    }

    let html = '';

    html += `<div class="tree-doc-title">${iconFor(docId)} ${doc.title || docId.toUpperCase()}</div>`;
    html += renderTreeNodes(doc.nodes || [], [], activePath);

    el.innerHTML = html;

    if (activePath && activePath.length) {
      el.querySelectorAll('.tree-node').forEach(n => {
        const p = n.dataset.path;
        if (p && activePath.join('/').startsWith(p)) n.classList.add('tree-open');
      });
    } else {
      el.querySelectorAll('.tree-node').forEach(n => {
        const depth = n.dataset.path ? n.dataset.path.split('/').length : 0;
        if (depth <= 1) n.classList.add('tree-open');
      });
    }
  }

  function renderTreeNodes(nodes, pathArr, activePath) {
    let html = '';
    const counters = { part: 0, section: 0, chapter: 0 };

    for (const n of nodes) {
      if (n.type === 'article') continue;
      if (!n.children || !n.children.length) continue;
      if (!['part', 'section', 'chapter'].includes(n.type)) continue;

      let prefix = '';
      if (n.type === 'part')    { counters.part++;    prefix = 'p'; }
      if (n.type === 'section') { counters.section++; prefix = 's'; }
      if (n.type === 'chapter') { counters.chapter++; prefix = 'c'; }

      const segment = `${prefix}${counters[n.type]}`;
      const currentPath = [...pathArr, segment];
      const pathStr = currentPath.join('/');
      const isActive = activePath && activePath.join('/') === pathStr;
      const activeCls = isActive ? 'tree-active' : '';

      const title = n.title || '';
      const num = n.number ? `${n.number}. ` : '';
      const label = `${num}${title}`;

      const hasChildren = (n.children || []).some(c =>
        ['part', 'section', 'chapter', 'article'].includes(c.type)
      );

      html += `<div class="tree-node ${activeCls}" data-path="${pathStr}">`;
      html += `<div class="tree-row">`;
      html += `<span class="tree-arrow">${hasChildren ? '▸' : '·'}</span>`;
      html += `<span class="tree-label">${label}</span>`;
      html += `</div>`;
      html += `<div class="tree-children">`;
      html += renderTreeNodes(n.children, currentPath, activePath);
      html += `</div>`;
      html += `</div>`;
    }

    return html;
  }

  // === Логика «моя / чужая / общая» ===

  function isCommon(article) {
    const marks = (article.meta && article.meta.marks) || [];
    return marks.length === 0;
  }

  function isMine(article, myFaction) {
    const marks = (article.meta && article.meta.marks) || [];
    if (marks.length === 0) return true;
    return marks.some(m => markToFaction(m) === myFaction);
  }

  function transferTo(article, myFaction) {
    const marks = (article.meta && article.meta.marks) || [];
    if (marks.length === 0) return null;
    if (marks.some(m => markToFaction(m) === myFaction)) return null;
    const firstFaction = markToFaction(marks[0]);
    return firstFaction || null;
  }

  // === law.html: список статей ===

  function articleList(docId, articles, query) {
    const el = document.getElementById('article-list');
    const countEl = document.getElementById('list-count');
    if (!el) return;

    const profile = Profile.get();
    const myFaction = profile && profile.role === 'gov' ? profile.faction : null;

    countEl.textContent = `${articles.length} статей`;

    if (!articles.length) {
      el.innerHTML = `<li class="empty-hint" style="padding:20px;">Ничего не найдено.</li>`;
      return;
    }

    el.innerHTML = articles.map(a => {
      const marks = (a.meta && a.meta.marks) || [];
      const common = marks.length === 0;

      let numBg;
      let badgeHtml = '';

      if (!myFaction) {
        numBg = GRAY_COMMON;
      } else if (common) {
        numBg = GRAY_COMMON;
      } else {
        const mine = isMine(a, myFaction);
        if (mine) {
          numBg = factionColor(myFaction);
        } else {
          numBg = GRAY_FOREIGN;
          const transfer = transferTo(a, myFaction);
          if (transfer) {
            const color = factionColor(transfer);
            badgeHtml = `<span class="mark-badge" style="background:${color}">→ ${factionShort(transfer)}</span>`;
          }
        }
      }

      const cls = (!myFaction || common || isMine(a, myFaction))
        ? 'article-row'
        : 'article-row row-foreign';

      const nodeId = `${docId}-${a.number}`;
      const inFav  = Store.favHas(nodeId);
      const inCart = Store.cartHas(nodeId);

      return `<li class="${cls}" data-article="${a.number}" data-node="${nodeId}">
        <span class="row-num" style="background:${numBg}">${a.number}</span>
        <span class="row-marks">${badgeHtml}</span>
        <span class="row-title">${a.title || ''}</span>
        <span class="row-actions">
          <button class="row-btn ${inFav ? 'row-btn-active' : ''}" data-fav data-node="${nodeId}">${inFav ? '★' : '☆'}</button>
          <button class="row-btn ${inCart ? 'row-btn-active' : ''}" data-cart data-node="${nodeId}">🗑</button>
        </span>
      </li>`;
    }).join('');
  }

  // === law.html: статья справа ===

  function article(docId, articleNum) {
    const el = document.getElementById('article-view');
    if (!el) return;

    const doc = Docs.get(docId);
    if (!doc) return;

    const found = Docs.findArticle(`${docId}-${articleNum}`);
    if (!found) {
      el.innerHTML = `<div class="empty-hint">Статья ${articleNum} не найдена.</div>`;
      return;
    }

    // Сохраняем в "Недавние"
    const nodeId = `${docId}-${articleNum}`;
    Store.recentAdd(nodeId);

    const profile = Profile.get();
    const myFaction = profile && profile.role === 'gov' ? profile.faction : null;
    const transfer = myFaction ? transferTo(found, myFaction) : null;

    const marks = (found.meta && found.meta.marks) || [];
    const marksHtml = marks.map(m => {
      const f = markToFaction(m);
      const color = f ? factionColor(f) : '#888';
      const label = f ? factionShort(f) : m;
      return `<span class="mark" style="background:${color}">${label}</span>`;
    }).join('');

    const stars = found.meta && found.meta.priorityStars;
    let starsHtml = '';
    if (stars) {
      starsHtml = '★'.repeat(stars) + `<span class="stars-dim">${'★'.repeat(Math.max(0, 5 - stars))}</span>`;
    }

    let warnHtml = '';
    if (transfer) {
      const color = factionColor(transfer);
      warnHtml = `<div class="warn-block" style="border-color:${color}; background:${hexA(color, 0.10)};">
        <span class="warn-icon">➜</span>
        <span class="warn-text">
          <strong>Не подследственно твоей фракции.</strong>
          Ты вправе задержать до выяснения обстоятельств. Передай материал: <strong>${factionShort(transfer)}</strong>.
        </span>
      </div>`;
    }

    const parts = (found.children || []).filter(c => c.type === 'paragraph' || c.type === 'subparagraph');
    const partsHtml = parts.map(p =>
      `<p class="article-text">${p.number ? `<strong>${p.number}.</strong> ` : ''}${p.text || ''}</p>`
    ).join('');

    let penaltyHtml = '';
    if (found.penalty && found.penalty.raw) {
      const parsed = (found.penalty.types || []).map(t => {
        if (t.type === 'штраф') {
          let range;
          if (t.from && t.to) {
            range = `${fmt(t.from)} — ${fmt(t.to)} ₽`;
          } else if (t.from) {
            range = `от ${fmt(t.from)} ₽`;
          } else if (t.to) {
            range = `до ${fmt(t.to)} ₽`;
          } else {
            range = 'штраф';
          }
          return `Штраф · ${range}`;
        }
        if (t.type === 'лишение свободы') {
          if (t.to) return `Лишение свободы · до ${t.to} ${t.unit || ''}`.trim();
          return 'Лишение свободы';
        }
        if (t.type === 'арест') {
          if (t.to) return `Арест · до ${t.to} ${t.unit || 'суток'}`;
          return 'Арест';
        }
        if (t.type === 'лишение права') {
          if (t.to) return `Лишение права · до ${t.to} ${t.unit || ''}`.trim();
          return 'Лишение права';
        }
        if (t.type === 'конфискация') return 'Конфискация';
        if (t.type === 'предупреждение') return 'Предупреждение';
        if (t.type === 'обязательные работы') {
          if (t.to) return `Обязательные работы · до ${t.to} ${t.unit || ''}`.trim();
          return 'Обязательные работы';
        }
        if (t.type === 'приостановление деятельности') {
          if (t.to) return `Приостановление деятельности · до ${t.to} ${t.unit || ''}`.trim();
          return 'Приостановление деятельности';
        }
        return t.type;
      }).join(' · ');

      penaltyHtml = `<div class="penalty-block">
        <span class="penalty-raw">${found.penalty.raw}</span>
        ${parsed ? `<span class="penalty-parsed">${parsed}</span>` : ''}
      </div>`;
    }

    const inFav  = Store.favHas(nodeId);
    const inCart = Store.cartHas(nodeId);

    el.innerHTML = `
      <div class="article-header">
        <div class="article-meta-top">
          <span class="card-doc doc-plate">${docShort(docId)}</span>
          <span class="article-num">Статья ${found.number}</span>
        </div>
        <h1 class="article-title">${found.title || ''}</h1>
      </div>

      ${warnHtml}

      <div class="article-body">
        ${starsHtml ? `<div class="article-field">
          <div class="field-label">Приоритет розыска</div>
          <div class="stars">${starsHtml}</div>
        </div>` : ''}

        ${marksHtml ? `<div class="article-field">
          <div class="field-label">Кто может работать</div>
          <div class="marks">${marksHtml}</div>
        </div>` : ''}

        ${partsHtml ? `<div class="article-field">
          <div class="field-label">Состав</div>
          ${partsHtml}
        </div>` : ''}

        ${penaltyHtml ? `<div class="article-field">
          <div class="field-label">Наказание</div>
          ${penaltyHtml}
        </div>` : ''}
      </div>

      <div class="article-actions">
        <button class="action-btn action-primary ${inFav ? 'is-active' : ''}" data-fav data-node="${nodeId}">
          <span>★</span><span>${inFav ? 'В избранном' : 'В избранное'}</span>
        </button>
        <button class="action-btn ${inCart ? 'is-active' : ''}" data-cart data-node="${nodeId}">
          <span>🛒</span><span>${inCart ? 'В корзине' : 'В корзину'}</span>
        </button>
        <button class="action-btn" data-copy data-node="${nodeId}">
          <span>📋</span><span>Копировать ссылку</span>
        </button>
      </div>
    `;

    // === Обработчики ===

    const favBtn = el.querySelector('[data-fav]');
    const cartBtn = el.querySelector('[data-cart]');
    const copyBtn = el.querySelector('[data-copy]');

    favBtn?.addEventListener('click', () => {
      const added = Store.favToggle(nodeId);
      favBtn.classList.toggle('is-active', added);
      favBtn.querySelector('span:nth-child(2)').textContent = added ? 'В избранном' : 'В избранное';
      Modal.updateCounters();
      refreshRowButtons(nodeId);
    });

    cartBtn?.addEventListener('click', () => {
      const added = Store.cartToggle(nodeId);
      cartBtn.classList.toggle('is-active', added);
      cartBtn.querySelector('span:nth-child(2)').textContent = added ? 'В корзине' : 'В корзину';
      Modal.updateCounters();
      refreshRowButtons(nodeId);
    });

    copyBtn?.addEventListener('click', () => {
      const url = `${location.origin}${location.pathname}#${nodeId}`;
      navigator.clipboard.writeText(url);
      alert('Ссылка скопирована: ' + url);
    });
  }

  // Обновить иконки ★/🗑 в строке списка
  function refreshRowButtons(nodeId) {
    const row = document.querySelector(`.article-row[data-node="${nodeId}"]`);
    if (!row) return;
    const fav = Store.favHas(nodeId);
    const cart = Store.cartHas(nodeId);
    const favBtn = row.querySelector('[data-fav]');
    const cartBtn = row.querySelector('[data-cart]');
    if (favBtn) {
      favBtn.textContent = fav ? '★' : '☆';
      favBtn.classList.toggle('row-btn-active', fav);
    }
    if (cartBtn) {
      cartBtn.classList.toggle('row-btn-active', cart);
    }
  }

  // Обновить кнопки ★/🛒 в блоке статьи справа
  function refreshArticleButtons(nodeId) {
    const el = document.getElementById('article-view');
    if (!el) return;

    const favBtn = el.querySelector('.article-actions [data-fav]');
    const cartBtn = el.querySelector('.article-actions [data-cart]');
    if (!favBtn || !cartBtn) return;
    if (favBtn.dataset.node !== nodeId) return;

    const inFav = Store.favHas(nodeId);
    const inCart = Store.cartHas(nodeId);

    favBtn.classList.toggle('is-active', inFav);
    cartBtn.classList.toggle('is-active', inCart);

    const favLabel = favBtn.querySelector('span:nth-child(2)');
    const cartLabel = cartBtn.querySelector('span:nth-child(2)');
    if (favLabel) favLabel.textContent = inFav ? 'В избранном' : 'В избранное';
    if (cartLabel) cartLabel.textContent = inCart ? 'В корзине' : 'В корзину';
  }

  // Форматирование чисел: 30000 → "30 000"
  function fmt(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function hexA(hex, a) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  return {
    sidebar, popular, recent, changelog,
    tree, articleList, article,
    isCommon, isMine, transferTo,
    docShort, factionShort, factionColor,
    refreshRowButtons,
    refreshArticleButtons,
  };

})();