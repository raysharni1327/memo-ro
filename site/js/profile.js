// ============================================================
// Профиль пользователя: гражданский или гос сотрудник + фракция
// Хранится в localStorage.
// ============================================================

const Profile = (() => {

  const KEY = 'ro_memo_profile';

  // Список фракций с их цветами и названиями
  const FACTIONS = {
    fsb:   { short: 'ФСБ',  name: 'ФСБ',                  color: '#e94a4a' },
    mvd:   { short: 'МВД',  name: 'МВД',                  color: '#3b82f6' },
    sk:    { short: 'СК',   name: 'Следственный комитет', color: '#8b5cf6' },
    vs:    { short: 'ВС',   name: 'Вооружённые Силы',     color: '#22c55e' },
    gibdd: { short: 'ГИБДД',name: 'ГИБДД',                color: '#f97316' },
    fso:   { short: 'ФСО',  name: 'ФСО',                  color: '#ea580c' },
    prok:  { short: 'ПРОК.',name: 'Прокуратура',          color: '#06b6d4' },
    adv:   { short: 'АДВ.', name: 'Адвокатура',           color: '#10b981' },
  };

  function get() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function setRole(role, faction) {
    const data = { role, faction: faction || null };
    localStorage.setItem(KEY, JSON.stringify(data));
    return data;
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  function isCivil() {
    const p = get();
    return p && p.role === 'civil';
  }

  function isGov() {
    const p = get();
    return p && p.role === 'gov';
  }

  function factionInfo() {
    const p = get();
    if (!p || !p.faction) return null;
    return FACTIONS[p.faction] || null;
  }

  return { get, setRole, clear, isCivil, isGov, factionInfo, FACTIONS };

})();