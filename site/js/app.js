// ============================================================
// Точка входа главной страницы.
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  const profile = Profile.get();
  if (!profile) {
    window.location.href = 'index.html';
    return;
  }

  updateHeader(profile);

  Render.sidebar();
  Render.popular();
  Render.recent();
  Render.changelog();

  Modal.updateCounters();

  // Кнопки в шапке
  document.getElementById('btn-fav').addEventListener('click', () => Modal.openFavorites());
  document.getElementById('btn-cart').addEventListener('click', () => Modal.openCart());

  // Глобальный поиск: кнопка вместо input
  document.getElementById('global-search').addEventListener('click', () => Modal.openSearch());

  // Ctrl+K — открыть поиск
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      Modal.openSearch();
    }
  });

  // Смена профиля
  document.getElementById('switch-profile').addEventListener('click', () => {
    Modal.openProfileSwitcher(() => {
      updateHeader(Profile.get());
      Render.sidebar();
      Render.popular();
      Render.recent();
      Render.changelog();
    });
  });

});

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