const loginForm = document.querySelector('#login-form');
const loginError = document.querySelector('#login-error');
const loginButton = loginForm.querySelector('button[type="submit"]');

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';

  if (!window.aiscSupabaseConfigured) {
    loginError.textContent = 'اتصال امن AISC هنوز تنظیم نشده است.';
    return;
  }

  const data = new FormData(loginForm);
  const email = data.get('identifier').trim();
  const password = data.get('password');

  if (!email || !password) {
    loginError.textContent = 'لطفاً ایمیل و رمز عبور را وارد کن.';
    return;
  }

  loginButton.disabled = true;
  loginButton.textContent = 'در حال ورود...';

  const { data: signInData, error: signInError } = await window.aiscSupabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    loginError.textContent = 'ایمیل یا رمز عبور درست نیست.';
    loginButton.disabled = false;
    loginButton.innerHTML = 'ورود به AISC <span>←</span>';
    return;
  }

  const { data: account, error: accountError } = await window.aiscSupabase
    .from('profiles')
    .select('role')
    .eq('id', signInData.user.id)
    .maybeSingle();

  if (accountError || !account) {
    loginError.textContent = 'دریافت پروفایل ممکن نشد. دوباره تلاش کن.';
    loginButton.disabled = false;
    loginButton.innerHTML = 'ورود به AISC <span>←</span>';
    return;
  }

  if (account.role === 'project_manager') {
    window.location.href = 'manager.html';
    return;
  }

  if (account.role === 'supporter') {
    window.location.href = 'review.html';
    return;
  }

  const { data: onboarding, error: profileError } = await window.aiscSupabase
    .from('student_profiles')
    .select('onboarding_completed')
    .eq('user_id', signInData.user.id)
    .maybeSingle();

  if (profileError) {
    loginError.textContent = 'دریافت پروفایل ممکن نشد. دوباره تلاش کن.';
    loginButton.disabled = false;
    loginButton.innerHTML = 'ورود به AISC <span>←</span>';
    return;
  }

  window.location.href = onboarding?.onboarding_completed ? 'student.html' : 'onboarding.html';
});
