const form = document.querySelector('#onboarding-form');
const steps = [...document.querySelectorAll('.form-step')];
const progress = [...document.querySelectorAll('.step-progress span')];
const nextButton = document.querySelector('#next-step');
const previousButton = document.querySelector('#previous-step');
const finishButton = document.querySelector('#finish-onboarding');
const error = document.querySelector('#onboarding-error');
const titles = [
  ['قدم اول از سه قدم', 'بیایید از خودت شروع کنیم.', 'با این چند پاسخ، مستطاب می‌تواند راهنمایی‌های دقیق‌تر و کاربردی‌تری برایت آماده کند.'],
  ['قدم دوم از سه قدم', 'توانایی‌هایت را به یاد بیاور.', 'لازم نیست همه‌چیز را بلد باشی؛ فقط از چیزهایی بگو که دوست داری و تجربه کرده‌ای.'],
  ['قدم سوم از سه قدم', 'حالا نگاهت را به آینده بدوز.', 'ایده‌ات لازم نیست کامل باشد. فقط نقطهٔ شروعی برای ساختن لازم داریم.'],
];
let currentStep = 0;

function showStep(index) {
  currentStep = index;
  steps.forEach((step, stepIndex) => step.classList.toggle('active', stepIndex === index));
  progress.forEach((item, stepIndex) => item.classList.toggle('active', stepIndex <= index));
  document.querySelector('#step-label').textContent = titles[index][0];
  document.querySelector('#step-title').textContent = titles[index][1];
  document.querySelector('#step-description').textContent = titles[index][2];
  previousButton.hidden = index === 0;
  nextButton.hidden = index === steps.length - 1;
  finishButton.hidden = index !== steps.length - 1;
  error.textContent = '';
}

function validateStep(index) {
  const fields = [...steps[index].querySelectorAll('input, select, textarea')];
  const valid = fields.every((field) => !field.required || field.checkValidity());
  if (!valid) error.textContent = 'لطفاً همهٔ پاسخ‌های این مرحله را کامل کن.';
  return valid;
}

nextButton.addEventListener('click', () => {
  if (validateStep(currentStep)) showStep(currentStep + 1);
});

previousButton.addEventListener('click', () => showStep(currentStep - 1));

document.querySelector('#save-exit').addEventListener('click', () => {
  window.location.href = 'student.html';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!validateStep(currentStep)) return;

  if (!window.aiscSupabaseConfigured) {
    error.textContent = 'اتصال امن AISC هنوز تنظیم نشده است.';
    return;
  }

  const { data: userData } = await window.aiscSupabase.auth.getUser();
  if (!userData.user) {
    window.location.href = 'login.html';
    return;
  }

  const data = Object.fromEntries(new FormData(form));
  finishButton.disabled = true;
  finishButton.textContent = 'در حال ذخیره...';

  const { error: saveError } = await window.aiscSupabase
    .from('student_profiles')
    .upsert({
      user_id: userData.user.id,
      age_range: data.age,
      grade: data.grade,
      weekly_time: data.time,
      skills: data.skills,
      interests: data.interests,
      paid_experience: data.experience,
      audience: data.audience,
      goal: data.goal,
      idea: data.idea,
    }, { onConflict: 'user_id' });

  const { error: nameError } = await window.aiscSupabase.rpc('update_my_full_name', { new_full_name: data.name });

  if (saveError || nameError) {
    error.textContent = 'ذخیره‌سازی انجام نشد. لطفاً دوباره تلاش کن.';
    finishButton.disabled = false;
    finishButton.innerHTML = 'شروع مسیر من <span>←</span>';
    return;
  }

  window.location.href = 'student.html';
});
