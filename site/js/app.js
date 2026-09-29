// ============================================================
// Точка входа главной страницы.
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  // 1. Профиль
  const profile = Profile.get();
  if (!profile) {
    window.location.href = 'index.html';
    return;
  }

  // 2. Шапка
  updateHeader(profile);

  // 3. Рендер
  Render.sidebar();
  Render.popular();
  Render.recent();
  Render.changelog();

  // 4. Счётчики
  Modal.updateCounters();

  // 5. Кнопки в шапке
  document.getElementById('btn-fav').addEventListener('click', () => Modal.openFavorites());
  document.getElementById('btn-cart').addEventListener('click', () => Modal.openCart());

  // 6. Смена профиля — только через сайдбар, без confirm(), сразу модалка
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