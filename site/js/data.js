// ============================================================
// Загрузчик данных + глобальный поиск.
// ============================================================

// Соответствие docId → имя глобальной переменной с данными
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

// Веса релевантности в глобальном поиске
const SEARCH_SCORE = {
  NUMBER_EXACT:  100,
  NUMBER_PREFIX: 80,
  TITLE_EXACT:   70,
  TITLE_START:   60,
  TITLE_INCLUDE: 50,
  TEXT:          30,
  DOC:           5,
};

// Параметры сниппета контекста
const CONTEXT_RADIUS = 40;
const SEARCH_MAX_RESULTS = 20;
const SEARCH_MIN_QUERY = 2;

const Docs = (() => {

  const cache = {};

  // ----------------------------------------------------------
  // Загрузка документов
  // ----------------------------------------------------------

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
    const m = window.DOC_MANIFEST;
    return (m && typeof m === 'object') ? m : {};
  }

  // ----------------------------------------------------------
  // Обход дерева: общая утилита
  // callback вызывается для каждого узла. Если callback вернёт
  // не-undefined — обход останавливается и это значение возвращается.
  // ----------------------------------------------------------

  function walkTree(nodes, callback) {
    for (const n of nodes) {
      const result = callback(n);
      if (result !== undefined) return result;
      if (n.children) {
        const childResult = walkTree(n.children, callback);
        if (childResult !== undefined) return childResult;
      }
    }
    return undefined;
  }

  // ----------------------------------------------------------
  // Работа со статьями
  // ----------------------------------------------------------

  function findArticle(nodeId) {
    const parsed = parseNodeId(nodeId);
    if (!parsed) return null;

    const doc = get(parsed.docId);
    if (!doc) return null;

    return walkTree(doc.nodes || [], (n) => {
      if (n.type === 'article' && n.number === parsed.articleNum) return n;
    }) || null;
  }

  function allArticles(docId) {
    const doc = get(docId);
    if (!doc) return [];

    const out = [];
    walkTree(doc.nodes || [], (n) => {
      if (n.type === 'article') out.push(n);
    });
    return out;
  }

  // ----------------------------------------------------------
  // Разбор nodeId: "<docId>-<articleNum>", например "ak-14.3"
  // Разделитель — первый дефис: docId не может содержать дефис.
  // ----------------------------------------------------------

  function parseNodeId(nodeId) {
    if (!nodeId || typeof nodeId !== 'string') return null;
    const dashIdx = nodeId.indexOf('-');
    if (dashIdx <= 0) return null;

    return {
      docId: nodeId.substring(0, dashIdx),
      articleNum: nodeId.substring(dashIdx + 1),
    };
  }

  // ============================================================
  // Глобальный поиск
  // ============================================================

  // Собрать весь текст статьи (включая вложенные узлы)
  function collectText(article) {
    const parts = [];
    walkTree(article.children || [], (n) => {
      if (n.text) parts.push(n.text);
    });
    return parts.join(' ');
  }

  // Сниппет текста вокруг первого совпадения
  function contextAround(text, q, radius = CONTEXT_RADIUS) {
    const lower = text.toLowerCase();
    const idx = lower.indexOf(q); // q уже в нижнем регистре
    if (idx === -1) return '';

    const start = Math.max(0, idx - radius);
    const end = Math.min(text.length, idx + q.length + radius);

    let snippet = text.substring(start, end).trim();
    if (start > 0) snippet = '… ' + snippet;
    if (end < text.length) snippet = snippet + ' …';
    return snippet;
  }

  // Оценка одной статьи. Возвращает { score, kind } или null.
  function scoreArticle(article, q, docMatches) {
    const num = (article.number || '').toLowerCase();
    const title = (article.title || '').toLowerCase();
    const bodyText = collectText(article).toLowerCase();

    if (num === q)             return { score: SEARCH_SCORE.NUMBER_EXACT,  kind: 'number' };
    if (num.includes(q))       return { score: SEARCH_SCORE.NUMBER_PREFIX, kind: 'number' };
    if (title === q)           return { score: SEARCH_SCORE.TITLE_EXACT,   kind: 'title'  };
    if (title.startsWith(q))   return { score: SEARCH_SCORE.TITLE_START,   kind: 'title'  };
    if (title.includes(q))     return { score: SEARCH_SCORE.TITLE_INCLUDE, kind: 'title'  };
    if (bodyText.includes(q))  return { score: SEARCH_SCORE.TEXT,          kind: 'text'   };
    if (docMatches)            return { score: SEARCH_SCORE.DOC,           kind: 'doc'    };

    return null;
  }

  // Формирование одного результата поиска
  function buildResult(article, docId, docTitle, scored, q) {
    const { score, kind } = scored;
    const num = article.number || '';
    const title = article.title || '';
    const bodyText = collectText(article);

    let context = '';
    if (kind === 'text') {
      context = contextAround(bodyText, q);
    } else {
      context = title;
    }

    return { docId, docTitle, num, title, kind, context, score };
  }

  function searchAll(query) {
    const trimmed = (query || '').trim();
    if (trimmed.length < SEARCH_MIN_QUERY) return [];

    const q = trimmed.toLowerCase();
    const results = [];
    const manifestData = manifest();

    for (const docId of Object.keys(manifestData)) {
      const doc = get(docId);
      if (!doc) continue;

      const docTitle = doc.title || docId.toUpperCase();
      const docMatches =
        docTitle.toLowerCase().includes(q) ||
        (doc.full_title || '').toLowerCase().includes(q);

      walkTree(doc.nodes || [], (n) => {
        if (n.type !== 'article') return;

        const scored = scoreArticle(n, q, docMatches);
        if (!scored) return;

        results.push(buildResult(n, docId, docTitle, scored, q));
      });
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.docId.localeCompare(b.docId) || a.num.localeCompare(b.num);
    });

    return results.slice(0, SEARCH_MAX_RESULTS);
  }

  return { get, manifest, findArticle, allArticles, searchAll, parseNodeId };

})();