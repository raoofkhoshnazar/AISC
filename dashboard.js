const panel = document.querySelector('#ai-panel');
const input = panel.querySelector('input');
const messages = panel.querySelector('.ai-messages');
let aiConversationId = null;

function appendAiMessage(role, content, className = '') {
  const message = document.createElement('p');
  message.className = role === 'user' ? 'from-user' : 'from-ai';
  if (className) message.classList.add(className);
  message.textContent = content;
  messages.append(message);
  messages.scrollTop = messages.scrollHeight;
  return message;
}

async function loadAiConversation(userId) {
  const storedConversationId = window.localStorage.getItem(`aisc-ai-conversation-${userId}`);
  if (!storedConversationId) return;

  const { data, error } = await window.aiscSupabase
    .from('ai_messages')
    .select('role, content')
    .eq('conversation_id', storedConversationId)
    .order('created_at', { ascending: true });
  if (error || !data?.length) return;

  aiConversationId = storedConversationId;
  messages.replaceChildren();
  data.forEach(({ role, content }) => appendAiMessage(role, content));
}

async function hydrateDashboard() {
  if (!window.aiscSupabaseConfigured) return;

  const { data: userData } = await window.aiscSupabase.auth.getUser();
  if (!userData.user) {
    window.location.href = 'login.html';
    return;
  }

  await loadAiConversation(userData.user.id);

  const [{ data: profile }, { data: gamification }, { data: badges }] = await Promise.all([
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
    window.aiscSupabase
      .from('user_badges')
      .select('earned_at, badges(title, description, icon)')
      .eq('user_id', userData.user.id)
      .order('earned_at', { ascending: false })
      .limit(3),
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

  if (badges) {
    const badgeList = document.querySelector('#badge-list');
    const badgesCopy = document.querySelector('#badges-copy');
    badgeList.replaceChildren();
    badges.forEach((earned) => {
      const badge = Array.isArray(earned.badges) ? earned.badges[0] : earned.badges;
      if (!badge) return;
      const item = document.createElement('span');
      item.textContent = badge.icon;
      item.title = `${badge.title}: ${badge.description}`;
      badgeList.append(item);
    });
    while (badgeList.children.length < 3) {
      const locked = document.createElement('span');
      locked.className = 'locked';
      locked.textContent = '★';
      badgeList.append(locked);
    }
    badgesCopy.textContent = badges.length
      ? `${badges.length.toLocaleString('fa-IR')} نشان باز کرده‌ای. ادامه بده!`
      : 'با تأیید نهایی تکلیف‌ها، نشان‌هایت را باز می‌کنی.';
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

panel.querySelector('form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text || input.disabled) return;

  if (!window.aiscSupabaseConfigured) {
    appendAiMessage('assistant', 'برای گفت‌وگو، ابتدا اتصال حساب را کامل کن.');
    return;
  }

  appendAiMessage('user', text);
  input.value = '';
  input.disabled = true;
  const submitButton = panel.querySelector('form button');
  submitButton.disabled = true;
  const loadingMessage = appendAiMessage('assistant', 'دارم فکر می‌کنم…', 'loading');

  const { data, error } = await window.aiscSupabase.functions.invoke('aisc-coach', {
    body: {
      conversationId: aiConversationId,
      message: text,
    },
  });

  loadingMessage.remove();
  input.disabled = false;
  submitButton.disabled = false;

  if (error || !data?.answer) {
    appendAiMessage('assistant', 'فعلاً نتوانستم پاسخ بدهم. چند لحظهٔ دیگر دوباره تلاش کن.', 'error');
    input.focus();
    return;
  }

  aiConversationId = data.conversationId;
  const { data: userData } = await window.aiscSupabase.auth.getUser();
  if (userData.user && aiConversationId) {
    window.localStorage.setItem(`aisc-ai-conversation-${userData.user.id}`, aiConversationId);
  }
  appendAiMessage('assistant', data.answer);
  input.focus();
});
