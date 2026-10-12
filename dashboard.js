const profile = JSON.parse(localStorage.getItem('aisc-profile') || 'null');

if (profile?.name) {
  const firstName = profile.name.trim().split(/\s+/)[0];
  document.querySelector('#profile-name').textContent = profile.name;
  document.querySelector('#profile-avatar').textContent = firstName.charAt(0);
  document.querySelector('#greeting-name').textContent = firstName;
}

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
