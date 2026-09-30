// ============================================================
// Загрузчик данных + глобальный поиск.
// ============================================================

const Docs = (() => {

  const VAR_MAP = {
    ak: 'AK_DATA', pdd: 'PDD_DATA', pk: 'PK_DATA', uk: 'UK_DATA',
    advocacy: 'ADVOCACY_DATA', business: 'BUSINESS_DATA', courts: 'COURTS_DATA',
    duma: 'DUMA_DATA', emergency: 'EMERGENCY_DATA', ethics: 'ETHICS_DATA',
    government: 'GOVERNMENT_DATA', ministries: 'MINISTRIES_DATA', parties: 'PARTIES_DATA',
    secret: 'SECRET_DATA', service: 'SERVICE_DATA', territories: 'TERRITORIES_DATA',
    tk: 'TK_DATA', constitution: 'CONSTITUTION_DATA', fso: 'FSO_DATA',
    weapons: 'WEAPONS_DATA', vs: 'VS_DATA', fsb: 'FSB_DATA',
    police: 'POLICE_DATA', gibdd: 'GIBDD_DATA', sk: 'SK_DATA',
    prosecutor: 'PROSECUTOR_DATA', health: 'HEALTH_DATA', immunity: 'IMMUNITY_DATA',
  };

  const cache = {};

  function get(docId) {
    if (cache[docId]) return cache[docId];
    const varName = VAR_MAP[docId];
    if (!varName) return null;
    const data = window[varName];
    if (!data) return null;
    cache[docId] = data;
    return data;
  }

  function manifest() {
    return window.DOC_MANIFEST || {};
  }

  function findArticle(nodeId) {
    if (!nodeId || !nodeId.includes('-')) return null;
    const [docId, ...rest] = nodeId.split('-');
    const articleNum = rest.join('-');
    const doc = get(docId);
    if (!doc) return null;

    let found = null;
    function walk(nodes) {
      for (const n of nodes) {
        if (found) return;
        if (n.type === 'article' && n.number === articleNum) {
          found = n;
          return;
        }
        if (n.children) walk(n.children);
      }
    }
    walk(doc.nodes || []);
    return found;
  }

  function allArticles(docId) {
    const doc = get(docId);
    if (!doc) return [];
    const out = [];
    function walk(nodes) {
      for (const n of nodes) {
        if (n.type === 'article') out.push(n);
        if (n.children) walk(n.children);
      }
    }
    walk(doc.nodes || []);
    return out;
  }

  // ============================================================
  // Глобальный поиск
  // ============================================================

  function _collectText(article) {
    const parts = [];
    function walk(nodes) {
      for (const n of nodes) {
        if (n.text) parts.push(n.text);
        if (n.children) walk(n.children);
      }
    }
    walk(article.children || []);
    return parts.join(' ');
  }

  function _contextAround(text, query, radius) {
    const lower = text.toLowerCase();
    const idx = lower.indexOf(query.toLowerCase());
    if (idx === -1) return '';
    const start = Math.max(0, idx - radius);
    const end = Math.min(text.length, idx + query.length + radius);
    let snippet = text.substring(start, end).trim();
    if (start > 0) snippet = '… ' + snippet;
    if (end < text.length) snippet = snippet + ' …';
    return snippet;
  }

  function searchAll(query) {
    query = (query || '').trim();
    if (query.length < 2) return [];

    const q = query.toLowerCase();
    const results = [];
    const manifestData = manifest();

    for (const docId of Object.keys(manifestData)) {
      const doc = get(docId);
      if (!doc) continue;

      const docTitle = doc.title || docId.toUpperCase();

      // Совпадение с названием документа
      const docMatches = docTitle.toLowerCase().includes(q) ||
                         (doc.full_title || '').toLowerCase().includes(q);

      function walk(nodes) {
        for (const n of nodes) {
          if (n.type === 'article') {
            const num = n.number || '';
            const title = n.title || '';
            const bodyText = _collectText(n);

            const numMatch   = num.toLowerCase().includes(q);
            const titleLower = title.toLowerCase();

            let score = 0;
            let kind = '';

            if (num === q) {
              score = 100;                       // точное совпадение номера
              kind = 'number';
            } else if (numMatch) {
              score = 80;                        // префикс номера
              kind = 'number';
            } else if (titleLower === q) {
              score = 70;                        // точное совпадение заголовка
              kind = 'title';
            } else if (titleLower.startsWith(q)) {
              score = 60;                        // начало заголовка
              kind = 'title';
            } else if (titleLower.includes(q)) {
              score = 50;                        // внутри заголовка
              kind = 'title';
            } else if (bodyText.toLowerCase().includes(q)) {
              score = 30;                        // в тексте статьи
              kind = 'text';
            } else if (docMatches) {
              // статья из документа, чьё название совпало — очень низкий приоритет
              score = 5;
              kind = 'doc';
            }

            if (score > 0) {
              let context = '';
              if (kind === 'text') {
                context = _contextAround(bodyText, q, 40);
              } else if (kind === 'title' || kind === 'number') {
                context = title;
              } else if (kind === 'doc') {
                context = title;
              }

              results.push({
                docId,
                docTitle,
                num,
                title,
                kind,
                context,
                score,
              });
            }
          }

          if (n.children) walk(n.children);
        }
      }

      walk(doc.nodes || []);
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.docId.localeCompare(b.docId) || a.num.localeCompare(b.num);
    });

    return results.slice(0, 20);
  }

  return { get, manifest, findArticle, allArticles, searchAll };

})();