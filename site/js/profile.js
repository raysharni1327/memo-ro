// ============================================================
// Профиль пользователя: гражданский или гос сотрудник + фракция.
// Хранится в localStorage.
// ============================================================

const Profile = (() => {

  const KEY = 'ro_memo_profile';
  const VALID_ROLES = ['civil', 'gov'];

  // Фракции с их цветами и названиями
  const FACTIONS = {
    fsb:   { short: 'ФСБ',    name: 'ФСБ',                  color: '#e94a4a' },
    mvd:   { short: 'МВД',    name: 'МВД',                  color: '#3b82f6' },
    sk:    { short: 'СК',     name: 'Следственный комитет', color: '#8b5cf6' },
    vs:    { short: 'ВС',     name: 'Вооружённые Силы',     color: '#22c55e' },
    gibdd: { short: 'ГИБДД',  name: 'ГИБДД',                color: '#f97316' },
    fso:   { short: 'ФСО',    name: 'ФСО',                  color: '#ea580c' },
    prok:  { short: 'ПРОК.',  name: 'Прокуратура',          color: '#06b6d4' },
    adv:   { short: 'АДВ.',   name: 'Адвокатура',           color: '#10b981' },
  };

  // ----------------------------------------------------------
  // Чтение
  // ----------------------------------------------------------
  function get() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;

      const data = JSON.parse(raw);
      if (!isValid(data)) return null;

      return data;
    } catch (e) {
      console.warn('Profile.get: не удалось прочитать профиль', e);
      return null;
    }
  }

  function isValid(data) {
    return data
      && typeof data === 'object'
      && VALID_ROLES.includes(data.role);
  }

  // ----------------------------------------------------------
  // Запись
  // ----------------------------------------------------------
  function setRole(role, faction) {
    const data = { role, faction: faction || null };
    localStorage.setItem(KEY, JSON.stringify(data));
    return data;
  }

  // ----------------------------------------------------------
  // Производные
  // ----------------------------------------------------------
  function factionInfo() {
    const p = get();
    if (!p || !p.faction) return null;
    return FACTIONS[p.faction] || null;
  }

  return { get, setRole, factionInfo, FACTIONS };

})();