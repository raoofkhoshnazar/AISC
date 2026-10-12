const signupForm = document.querySelector('#signup-form');
const signupError = document.querySelector('#signup-error');
const signupSuccess = document.querySelector('#signup-success');
const signupButton = signupForm.querySelector('button[type="submit"]');

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  signupError.textContent = '';
  signupSuccess.textContent = '';

  if (!window.aiscSupabaseConfigured) {
    signupError.textContent = 'اتصال امن AISC هنوز تنظیم نشده است.';
    return;
  }

  const data = new FormData(signupForm);
  const fullName = data.get('fullName').trim();
  const email = data.get('email').trim();
  const password = data.get('password');

  if (fullName.length < 2 || !email || password.length < 8) {
    signupError.textContent = 'لطفاً نام، ایمیل معتبر و رمزی با حداقل ۸ کاراکتر وارد کن.';
    return;
  }

  signupButton.disabled = true;
  signupButton.textContent = 'در حال ساخت حساب...';

  const { data: signupData, error } = await window.aiscSupabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: new URL('onboarding.html', window.location.href).href,
    },
  });

  if (error) {
    signupError.textContent = error.message.includes('already registered')
      ? 'برای این ایمیل قبلاً حساب ساخته شده است. وارد شو.'
      : 'ساخت حساب انجام نشد. لطفاً دوباره تلاش کن.';
    signupButton.disabled = false;
    signupButton.innerHTML = 'ساخت حساب AISC <span>←</span>';
    return;
  }

  if (signupData.session) {
    window.location.href = 'onboarding.html';
    return;
  }

  signupSuccess.textContent = 'حساب ساخته شد. ایمیل تأیید را بررسی کن و سپس وارد شو.';
  signupButton.disabled = false;
  signupButton.innerHTML = 'ساخت حساب AISC <span>←</span>';
});
