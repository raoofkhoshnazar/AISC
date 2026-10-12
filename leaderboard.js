const leaderboardError = document.querySelector('#leaderboard-error');
const podium = document.querySelector('#podium');
const leaderboardList = document.querySelector('#leaderboard-list');

function renderLeaderboard(rows) {
  const topThree = rows.slice(0, 3);
  if (!topThree.length) {
    podium.innerHTML = '<div class="podium-placeholder">با تأیید اولین تکلیف‌ها، رتبه‌بندی شکل می‌گیرد.</div>';
    leaderboardList.innerHTML = '<li class="loading-cell">هنوز امتیازی ثبت نشده است.</li>';
    return;
  }

  const podiumOrder = [topThree[1], topThree[0], topThree[2]].filter(Boolean);
  podium.replaceChildren(...podiumOrder.map((row) => {
    const card = document.createElement('article');
    card.className = `podium-card rank-${row.rank}`;
    const avatar = document.createElement('span');
    avatar.className = 'podium-avatar';
    avatar.textContent = (row.display_name || 'س').trim().charAt(0);
    const name = document.createElement('b');
    name.textContent = row.display_name || 'سازنده AISC';
    const xp = document.createElement('small');
    xp.textContent = `${row.xp.toLocaleString('fa-IR')} XP`;
    const step = document.createElement('div');
    step.className = 'podium-step';
    step.textContent = row.rank.toLocaleString('fa-IR');
    card.append(avatar, name, xp, step);
    return card;
  }));

  leaderboardList.replaceChildren(...rows.map((row) => {
    const item = document.createElement('li');
    const rank = document.createElement('span');
    rank.className = 'rank-number';
    rank.textContent = row.rank.toLocaleString('fa-IR');
    const avatar = document.createElement('span');
    avatar.className = 'rank-avatar';
    avatar.textContent = (row.display_name || 'س').trim().charAt(0);
    const name = document.createElement('span');
    name.className = 'rank-name';
    name.textContent = row.display_name || 'سازنده AISC';
    const level = document.createElement('span');
    level.className = 'rank-level';
    level.textContent = `سطح ${row.level.toLocaleString('fa-IR')}`;
    const xp = document.createElement('span');
    xp.className = 'rank-xp';
    xp.textContent = `${row.xp.toLocaleString('fa-IR')} XP`;
    item.append(rank, avatar, name, level, xp);
    return item;
  }));
}

async function loadLeaderboard() {
  if (!window.aiscSupabaseConfigured) {
    leaderboardError.textContent = 'اتصال امن AISC هنوز تنظیم نشده است.';
    return;
  }

  const { data: userData } = await window.aiscSupabase.auth.getUser();
  if (!userData.user) {
    window.location.href = 'login.html';
    return;
  }

  const [{ data: profile }, { data: rows, error }] = await Promise.all([
    window.aiscSupabase.from('profiles').select('full_name, role').eq('id', userData.user.id).maybeSingle(),
    window.aiscSupabase.rpc('get_aisc_leaderboard'),
  ]);

  if (profile?.role !== 'student') {
    window.location.href = profile?.role === 'project_manager' ? 'manager.html' : 'index.html';
    return;
  }
  const name = profile.full_name || 'دانش‌آموز';
  document.querySelector('#profile-name').textContent = name;
  document.querySelector('#profile-avatar').textContent = name.trim().charAt(0);

  if (error) {
    leaderboardError.textContent = 'رتبه‌بندی دریافت نشد. لطفاً دوباره تلاش کن.';
    return;
  }
  renderLeaderboard(rows);
}

document.querySelector('#logout-button').addEventListener('click', async () => {
  await window.aiscSupabase.auth.signOut();
  window.location.href = 'index.html';
});

loadLeaderboard();
