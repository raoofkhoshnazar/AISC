const form = document.querySelector('#onboarding-form');
const steps = [...document.querySelectorAll('.form-step')];
const progress = [...document.querySelectorAll('.step-progress span')];
const nextButton = document.querySelector('#next-step');
const previousButton = document.querySelector('#previous-step');
const finishButton = document.querySelector('#finish-onboarding');
const saveExitButton = document.querySelector('#save-exit');
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

async function getCurrentUser() {
  if (!window.aiscSupabaseConfigured) {
    error.textContent = 'اتصال امن AISC هنوز تنظیم نشده است.';
    return null;
  }

  const { data: userData } = await window.aiscSupabase.auth.getUser();
  if (!userData.user) window.location.href = 'login.html';
  return userData.user;
}

function populateForm(profile) {
  const values = {
    name: profile.full_name,
    age: profile.age_range,
    grade: profile.grade,
    time: profile.weekly_time,
    skills: profile.skills,
    interests: profile.interests,
    experience: profile.paid_experience,
    audience: profile.audience,
    goal: profile.goal,
    idea: profile.idea,
  };

  Object.entries(values).forEach(([name, value]) => {
    if (!value) return;
    const field = form.elements.namedItem(name);
    if (field instanceof RadioNodeList) {
      [...field].forEach((radio) => { radio.checked = radio.value === value; });
    } else if (field) {
      field.value = value;
    }
  });
}

async function saveProfile(completed) {
  const user = await getCurrentUser();
  if (!user) return false;

  const data = Object.fromEntries(new FormData(form));
  const { error: saveError } = await window.aiscSupabase
    .from('student_profiles')
    .upsert({
      user_id: user.id,
      age_range: data.age || null,
      grade: data.grade || null,
      weekly_time: data.time || null,
      skills: data.skills || null,
      interests: data.interests || null,
      paid_experience: data.experience || null,
      audience: data.audience || null,
      goal: data.goal || null,
      idea: data.idea || null,
      onboarding_completed: completed,
    }, { onConflict: 'user_id' });

  if (saveError) {
    error.textContent = 'ذخیره‌سازی انجام نشد. لطفاً دوباره تلاش کن.';
    return false;
  }

  if (data.name?.trim().length >= 2) {
    const { error: nameError } = await window.aiscSupabase.rpc('update_my_full_name', { new_full_name: data.name });
    if (nameError) {
      error.textContent = 'نام پروفایل ذخیره نشد. لطفاً دوباره تلاش کن.';
      return false;
    }
  }

  return true;
}

nextButton.addEventListener('click', () => {
  if (validateStep(currentStep)) showStep(currentStep + 1);
});

previousButton.addEventListener('click', () => showStep(currentStep - 1));

saveExitButton.addEventListener('click', async () => {
  saveExitButton.disabled = true;
  saveExitButton.textContent = 'در حال ذخیره...';
  const saved = await saveProfile(false);
  if (saved) {
    await window.aiscSupabase.auth.signOut();
    window.location.href = 'index.html';
  }
  saveExitButton.disabled = false;
  saveExitButton.textContent = 'ذخیره و خروج';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!validateStep(currentStep)) return;

  finishButton.disabled = true;
  finishButton.textContent = 'در حال ذخیره...';
  const saved = await saveProfile(true);
  if (saved) window.location.href = 'student.html';

  finishButton.disabled = false;
  finishButton.innerHTML = 'شروع مسیر من <span>←</span>';
});

async function hydrateOnboarding() {
  const user = await getCurrentUser();
  if (!user) return;

  const { data: profile } = await window.aiscSupabase
    .from('student_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  const { data: account } = await window.aiscSupabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  if (profile) populateForm({ ...profile, full_name: account?.full_name });
  else if (account?.full_name) form.elements.namedItem('name').value = account.full_name;
}

hydrateOnboarding();
