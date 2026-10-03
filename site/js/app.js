// ============================================================
// Точка входа главной страницы.
// ============================================================

// Цвета индикатора профиля (совпадают с акцентами CSS)
const DOT_COLORS = {
  civil: '#8b5cf6',
  gov:   '#3b82f6',
};

document.addEventListener('DOMContentLoaded', () => {

  const profile = Profile.get();
  if (!profile) {
    window.location.href = 'index.html';
    return;
  }

  refreshUI(profile);
  bindHeaderButtons();
  bindHotkeys();
});

// ------------------------------------------------------------
// Обновление всего UI под текущий профиль.
// Вызывается при загрузке и при смене профиля.
// ------------------------------------------------------------
function refreshUI(profile = Profile.get()) {
  updateHeader(profile);
  Render.sidebar();
  Render.popular();
  Render.recent();
  Render.changelog();
  Render.appChangelog();
  Render.cheatsheets();
  Modal.updateCounters();
}

// ------------------------------------------------------------
// Обработчики кнопок в шапке.
// ------------------------------------------------------------
function bindHeaderButtons() {
  const fav = document.getElementById('btn-fav');
  const cart = document.getElementById('btn-cart');
  const search = document.getElementById('global-search');
  const switcher = document.getElementById('switch-profile');

  if (fav)      fav.addEventListener('click', () => Modal.openFavorites());
  if (cart)     cart.addEventListener('click', () => Modal.openCart());
  if (search)   search.addEventListener('click', () => Modal.openSearch());

  if (switcher) {
    switcher.addEventListener('click', () => {
      Modal.openProfileSwitcher(() => refreshUI());
    });
  }
}

// ------------------------------------------------------------
// Горячие клавиши.
// ------------------------------------------------------------
function bindHotkeys() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      Modal.openSearch();
    }
  });
}

// ------------------------------------------------------------
// Обновление шапки: метка и цвет индикатора профиля.
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