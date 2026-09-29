// ============================================================
// Загрузчик данных: собирает window.*_DATA в один объект Docs.
// ============================================================

const Docs = (() => {

  // Соответствие doc_id → имени глобальной переменной
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

  // Быстрый доступ к узлу по его id (например, "uk-6.2")
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

  // Все статьи документа (плоский список)
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

  return { get, manifest, findArticle, allArticles };

})();