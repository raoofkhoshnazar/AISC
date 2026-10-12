const loginForm = document.querySelector('#login-form');
const loginError = document.querySelector('#login-error');

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(loginForm);
  const identifier = data.get('identifier').trim();
  const password = data.get('password').trim();

  if (!identifier || !password) {
    loginError.textContent = 'لطفاً ایمیل یا کد دسترسی و رمز عبور را وارد کن.';
    return;
  }

  localStorage.setItem('aisc-session', JSON.stringify({ identifier }));
  const profile = JSON.parse(localStorage.getItem('aisc-profile') || 'null');
  window.location.href = profile ? 'student.html' : 'onboarding.html';
});
