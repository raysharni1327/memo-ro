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



  const MARK_TO_FACTION = {
    'Ф': 'fsb', 'Р': 'mvd', 'С': 'sk', 'В': 'vs',
    'Г': 'gibdd', 'О': 'fso', 'П': 'prok', 'Адв': 'adv',
  };

  // Фракции, которые НЕ участвуют в передаче материала:
  //   - Прокуратура работает по любым делам (надзор)
  //   - Адвокатура — защита, не расследование
  const NO_TRANSFER_FACTIONS = ['prok', 'adv'];

  const GRAY_FOREIGN = '#3a3a3a';
  const GRAY_COMMON  = '#555';
  
    // Ограничения отображения
  const RECENT_SHOWN    = 4;  // сколько недавних показывать на главной
  const CHANGELOG_SHOWN = 5;  // сколько изменений показывать на главной
  const STARS_MAX       = 5;  // максимум звёзд приоритета

  function iconFor(docId)    { return ICONS[docId] || '🔵'; }
  function docShort(docId)   { return DOC_SHORT[docId] || docId.toUpperCase(); }
  // Данные о фракциях — в Profile.FACTIONS (единый источник)
  function factionShort(f)   { return Profile.FACTIONS[f]?.short || f; }
  function factionColor(f)   { return Profile.FACTIONS[f]?.color || '#888'; }
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
    const shown = list.slice(0, RECENT_SHOWN);

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

    const shown = entries.slice(0, CHANGELOG_SHOWN);

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

      return `<li>
        <a href="${href}" class="changelog-link">
          <span class="changelog-date">${shortDate(date)}</span>
          <span class="changelog-doc doc-plate">${docShortName}</span>
          ${numHtml}
          <span class="changelog-text">${text}</span>
        </a>
      </li>`;
    }).join('');
  }

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
  // Текущая фракция пользователя, если он гос. Иначе — null.
  function getMyFaction() {
    const profile = Profile.get();
    return (profile && profile.role === 'gov') ? profile.faction : null;
  }
  // === Логика «моя / чужая / общая» ===

  // «Эффективные» метки статьи: фракции, которые реально могут работать.
  // Прокуратура и адвокатура исключены — они не участвуют в передаче.
  // Если массив пуст — статья считается общей.
  function effectiveMarks(article) {
    const marks = (article.meta && article.meta.marks) || [];
    return marks
      .map(markToFaction)
      .filter(f => f && !NO_TRANSFER_FACTIONS.includes(f));
  }

  function isCommon(article) {
    return effectiveMarks(article).length === 0;
  }

  function isMine(article, myFaction) {
    // Прокурор и адвокат — «своя» статья для них всегда
    if (NO_TRANSFER_FACTIONS.includes(myFaction)) return true;

    const eff = effectiveMarks(article);
    return eff.length === 0 || eff.includes(myFaction);
  }

  function transferTo(article, myFaction) {
    // Прокурор и адвокат не участвуют в передаче
    if (NO_TRANSFER_FACTIONS.includes(myFaction)) return null;

    const eff = effectiveMarks(article);
    if (eff.length === 0) return null;        // статья общая
    if (eff.includes(myFaction)) return null; // статья моя

    return eff[0];
  }

  // === law.html: список статей ===

  function articleList(docId, articles, query) {
  const el = document.getElementById('article-list');
  const countEl = document.getElementById('list-count');
  if (!el) return;

  const myFaction = getMyFaction();
  countEl.textContent = `${articles.length} статей`;

  if (!articles.length) {
    el.innerHTML = `<li class="empty-hint" style="padding:20px;">Ничего не найдено.</li>`;
    return;
  }

  // Собираем node_id всех детей article_group,
  // чтобы не рендерить их на верхнем уровне.
  const childIds = new Set();
  articles.forEach(a => {
    if (a.type === 'article_group') {
      (a.children || []).forEach(c => {
        if (c.type === 'article') {
          childIds.add(c.node_id || c.number);
        }
      });
    }
  });

  const topLevel = articles.filter(a => {
    const id = a.node_id || a.number;
    return !childIds.has(id);
  });

  function renderRow(a) {
    // article_group → строка-заголовок с ▶ и вложенным <ul>
    if (a.type === 'article_group') {
      const inner = (a.children || [])
        .filter(c => c.type === 'article')
        .map(renderRow)
        .join('');
      const n = (a.children || []).filter(c => c.type === 'article').length;
      return `<li class="article-group-row" data-group="${a.node_id || a.number}">
        <div class="row-main">
          <span class="row-num" style="background:${GRAY_COMMON}">${a.number}</span>
          <span class="row-title row-title-group">${groupTitleHtml(a)}</span>
          <span class="row-group-count">${n} ${pluralArticles(n)}</span>
          <span class="row-group-arrow">▸</span>
        </div>
        <ul class="article-group-children">${inner}</ul>
      </li>`;
    }

    // обычная статья
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

    const nodeId = `${docId}-${a.node_id || a.number}`;
    const inFav  = Store.favHas(nodeId);
    const inCart = Store.cartHas(nodeId);

    const titleHtml = a.title
      ? escapeHtml(a.title)
      : `<span class="row-preview">${escapeHtml(previewText(a))}</span>`;

    return `<li class="${cls}" data-article="${a.node_id || a.number}" data-node="${nodeId}">
      <span class="row-num" style="background:${numBg}">${a.number}</span>
      <span class="row-marks">${badgeHtml}</span>
      <span class="row-title">${titleHtml}</span>
      <span class="row-actions">
        <button class="row-btn ${inFav ? 'row-btn-active' : ''}" data-fav data-node="${nodeId}">${inFav ? '★' : '☆'}</button>
        <button class="row-btn ${inCart ? 'row-btn-active' : ''}" data-cart data-node="${nodeId}">${inCart ? '★' : '🗑'}</button>
      </span>
    </li>`;
  }

  el.innerHTML = topLevel.map(renderRow).join('');

  // обработчик раскрытия групп
  el.querySelectorAll('.article-group-row').forEach(row => {
    const main = row.querySelector('.row-main');
    if (!main) return;
    main.addEventListener('click', (e) => {
      if (e.target.closest('[data-fav],[data-cart]')) return;
      row.classList.toggle('is-open');
    });
  });
}

// Заголовок группы в списке статей: настоящий title или превью из own_children.
function groupTitleHtml(a) {
  if (a.title) return escapeHtml(a.title);
  return `<span class="row-preview">${escapeHtml(previewText(a, 80))}</span>`;
}

function previewText(a, max = 90) {
  // Для article_group собственный состав живёт в own_children,
  // а не в children (там только подстатьи).
  const src = (a.type === 'article_group')
    ? (a.own_children || [])
    : (a.children || []);
  const first = src.find(c => c.type === 'paragraph' && c.text);
  let s = (first && first.text) || '';
  s = s.trim();
  if (s.length <= max) return s;
  return s.slice(0, max).replace(/\s+\S*$/, '') + '…';
}


function pluralArticles(n) {
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return 'статья';
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return 'статьи';
  return 'статей';
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
    // === Случай 1: пользователь открыл статью-контейнер ===
if (found.type === 'article_group') {
  renderArticleGroup(el, doc, found, docId);
  return;
}

        // Сохраняем в "Недавние". Используем node_id найденной статьи —
    // на случай, если пришли по старой ссылке с дублирующимся number.
    const realNodeId = found.node_id || articleNum;
    const nodeId = `${docId}-${realNodeId}`;
    Store.recentAdd(nodeId);

    const myFaction = getMyFaction();
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
      starsHtml = '★'.repeat(stars)
        + `<span class="stars-dim">${'★'.repeat(Math.max(0, STARS_MAX - stars))}</span>`;
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

        // === Состав ===
    // Если у статьи есть parts (вариант B) — рендерим их карточками.
    // Иначе — как раньше: параграфы подряд.
    let partsHtml = '';
    if (Array.isArray(found.parts) && found.parts.length) {
      partsHtml = found.parts.map(p => {
        const pen = p.penalty;
        let penHtml = '';
                if (pen && pen.raw) {
          const parsed = (pen.types || []).map(renderPenaltyType).join(' · ');
          penHtml = parsed
            ? `<div class="part-penalty">
                <span class="penalty-parsed">${parsed}</span>
              </div>`
            : `<div class="part-penalty">
                <span class="penalty-raw">${pen.raw}</span>
              </div>`;
        }
                        const partNodeId = `${docId}-${found.node_id || found.number}#p${p.number}`;
        const partInFav  = Store.favHas(partNodeId);
        const partInCart = Store.cartHas(partNodeId);

        return `<div class="part-card" data-part-node="${partNodeId}">
          <div class="part-header">
            <span class="part-label">${p.label || (found.number + ' ч.' + p.number)}</span>
            ${p.title ? `<span class="part-title">${p.title}</span>` : ''}
            <span class="part-actions">
              <button class="row-btn ${partInFav ? 'row-btn-active' : ''}" data-fav data-node="${partNodeId}">${partInFav ? '★' : '☆'}</button>
              <button class="row-btn ${partInCart ? 'row-btn-active' : ''}" data-cart data-node="${partNodeId}">🗑</button>
            </span>
          </div>
                    <div class="part-body">
            <p class="article-text">${p.text || ''}</p>
            ${renderArticleChildren(p.children || [])}
          </div>
          ${penHtml}
        </div>`;
      }).join('');
            } else {
            // Для «статьи с подстатьёй» (is_article_with_subs) собственный состав
      // лежит в own_children, а подстатьи — в children.
      const ownSrc = (Array.isArray(found.own_children) && found.own_children.length)
        ? found.own_children
        : (found.children || []);
        partsHtml = renderArticleChildren(found.children || []);
    }
    
       // Сводный penalty статьи показываем только если нет parts.
        let penaltyHtml = '';
    if (!(found.parts && found.parts.length) && found.penalty && found.penalty.raw) {
      const parsed = (found.penalty.types || []).map(renderPenaltyType).join(' · ');
      // Если распарсили — показываем только распарсенное.
      // Если парсер не справился — оставляем raw как fallback.
      penaltyHtml = parsed
        ? `<div class="penalty-block">
            <span class="penalty-parsed">${parsed}</span>
          </div>`
        : `<div class="penalty-block">
            <span class="penalty-raw">${found.penalty.raw}</span>
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

        el.onclick = (e) => {
      const favBtn  = e.target.closest('[data-fav]');
      const cartBtn = e.target.closest('[data-cart]');
      const copyBtn = e.target.closest('[data-copy]');

      if (favBtn) {
        const id = favBtn.dataset.node;
        const added = Store.favToggle(id);
        favBtn.classList.toggle('is-active', added);
        favBtn.classList.toggle('row-btn-active', added);
        // Обновить текст: там, где есть span (большая кнопка), меняем label;
        // в маленькой кнопке меняем символ ★/☆
        const label = favBtn.querySelector('span:nth-child(2)');
        if (label) {
          label.textContent = added ? 'В избранном' : 'В избранное';
        } else {
          favBtn.textContent = added ? '★' : '☆';
        }
        Modal.updateCounters();
        refreshRowButtons(id);
        return;
      }

      if (cartBtn) {
        const id = cartBtn.dataset.node;
        const added = Store.cartToggle(id);
        cartBtn.classList.toggle('is-active', added);
        cartBtn.classList.toggle('row-btn-active', added);
        const label = cartBtn.querySelector('span:nth-child(2)');
        if (label) {
          label.textContent = added ? 'В корзине' : 'В корзину';
        }
        Modal.updateCounters();
        refreshRowButtons(id);
        return;
      }

      if (copyBtn) {
        const id = copyBtn.dataset.node;
        const url = `${location.origin}${location.pathname}#${id}`;
        navigator.clipboard.writeText(url);
        const label = copyBtn.querySelector('span:nth-child(2)');
        const original = label ? label.textContent : null;
        if (label) label.textContent = 'Скопировано ✓';
        setTimeout(() => {
          if (label && original) label.textContent = original;
        }, 1500);
        return;
      }
    };
  }

    function renderArticleGroup(el, doc, group, docId) {
  const children = (group.children || []).filter(c => c.type === 'article');

  const listHtml = children.map(c => {
    const nodeId = `${docId}-${c.node_id || c.number}`;
    const titleHtml = c.title
      ? escapeHtml(c.title)
      : `<span class="row-preview">${escapeHtml(previewText(c, 100))}</span>`;
    return `<a class="group-child" href="law.html#${nodeId}">
      <span class="row-num" style="background:${GRAY_COMMON}">${c.number}</span>
      <span class="group-child-title">${titleHtml}</span>
      <span class="group-child-arrow">→</span>
    </a>`;
  }).join('');

  el.innerHTML = `
    <div class="article-header">
      <div class="article-meta-top">
        <span class="card-doc doc-plate">${docShort(docId)}</span>
        <span class="article-num">Статья ${group.number}</span>
      </div>
      ${group.title ? `<h1 class="article-title">${group.title}</h1>` : ''}
    </div>

    <div class="article-body">
      <div class="article-field">
        <div class="field-label">Содержит ${children.length} ${pluralArticles(children.length)}</div>
        <div class="group-children">${listHtml}</div>
      </div>
    </div>
  `;

  el.onclick = null;
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
  // Рекурсивный рендер состава статьи.
  // Поддерживает paragraph, subparagraph, note — с любым уровнем вложенности.


  function renderArticleChildren(children) {
    if (!children || !children.length) return '';

    return children.map(c => {
      if (c.type === 'note') {
        return `<div class="note-block">
          <div class="note-label">Примечание</div>
          <div class="note-text">${c.text || ''}</div>
        </div>`;
      }

      if (c.type === 'subparagraph') {
        const numPrefix = c.number ? `<strong>${c.number})</strong> ` : '';
        const inner = c.children ? renderArticleChildren(c.children) : '';
        return `<p class="article-text article-subtext">${numPrefix}${c.text || ''}</p>${inner}`;
      }

      if (c.type === 'paragraph') {
        const numPrefix = c.number ? `<strong>${c.number}.</strong> ` : '';
        const inner = c.children ? renderArticleChildren(c.children) : '';
        return `<p class="article-text">${numPrefix}${c.text || ''}</p>${inner}`;
      }
      if (c.type === 'bullet') {
  return `<p class="article-text article-bullet">${c.text || ''}</p>`;
}

      return '';
    }).join('');
  }
  // Рендер одного типа наказания (штраф/арест/...).
  // Возвращает строку вида "Штраф · 500 — 2 000 ₽" или "Арест · до 10 суток".
  function renderPenaltyType(t) {
    if (t.type === 'штраф') {
      let range;
      if (t.from && t.to)      range = `${fmt(t.from)} — ${fmt(t.to)} ₽`;
      else if (t.from)         range = `от ${fmt(t.from)} ₽`;
      else if (t.to)           range = `до ${fmt(t.to)} ₽`;
      else                     range = 'штраф';
      return `Штраф · ${range}`;
    }
    if (t.type === 'лишение свободы') {
  if (t.to) return `Лишение свободы · до ${t.to} мин.`;
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
  }

  return {
    sidebar, popular, recent, changelog,
    tree, articleList, article,
    docShort, factionShort, factionColor,
    refreshRowButtons,
    refreshArticleButtons,
  };

})();