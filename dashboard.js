async function hydrateDashboard() {
  if (!window.aiscSupabaseConfigured) return;

  const { data: userData } = await window.aiscSupabase.auth.getUser();
  if (!userData.user) {
    window.location.href = 'login.html';
    return;
  }

  const [{ data: profile }, { data: gamification }] = await Promise.all([
    window.aiscSupabase
      .from('profiles')
      .select('full_name')
      .eq('id', userData.user.id)
      .maybeSingle(),
    window.aiscSupabase
      .from('gamification_profiles')
      .select('xp, level, current_streak')
      .eq('user_id', userData.user.id)
      .maybeSingle(),
  ]);

  if (profile?.full_name) {
    const firstName = profile.full_name.trim().split(/\s+/)[0];
    document.querySelector('#profile-name').textContent = profile.full_name;
    document.querySelector('#profile-avatar').textContent = firstName.charAt(0);
    document.querySelector('#greeting-name').textContent = firstName;
  }

  if (gamification) {
    const currentLevelBase = (gamification.level - 1) * 100;
    const xpIntoLevel = gamification.xp - currentLevelBase;
    const remainingXp = Math.max(0, 100 - xpIntoLevel);
    document.querySelector('#profile-level').textContent = gamification.level.toLocaleString('fa-IR');
    document.querySelector('#xp-value').textContent = gamification.xp.toLocaleString('fa-IR');
    document.querySelector('#xp-next-level').textContent = (currentLevelBase + 100).toLocaleString('fa-IR');
    document.querySelector('#xp-progress').style.width = `${Math.min(100, xpIntoLevel)}%`;
    document.querySelector('#xp-copy').textContent = remainingXp
      ? `${remainingXp.toLocaleString('fa-IR')} XP تا سطح بعدی`
      : 'برای باز کردن سطح بعدی، یک مأموریت دیگر انجام بده.';
  }
}

hydrateDashboard();

document.querySelector('[data-learning-open]').addEventListener('click', () => {
  window.location.href = 'learning.html';
});

document.querySelector('#logout-button').addEventListener('click', async () => {
  if (window.aiscSupabaseConfigured) await window.aiscSupabase.auth.signOut();
  window.location.href = 'index.html';
});

const panel = document.querySelector('#ai-panel');
const input = panel.querySelector('input');
const messages = panel.querySelector('.ai-messages');

document.querySelectorAll('[data-ai-open]').forEach((button) => {
  button.addEventListener('click', () => {
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    input.focus();
  });
});

document.querySelector('[data-ai-close]').addEventListener('click', () => {
  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
});

panel.querySelector('form').addEventListener('submit', (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  const message = document.createElement('p');
  message.className = 'from-ai';
  message.textContent = `پیامت ثبت شد: «${text}»`;
  messages.append(message);
  input.value = '';
});
