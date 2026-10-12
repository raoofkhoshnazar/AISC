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
  const partialData = Object.fromEntries(new FormData(form));
  localStorage.setItem('aisc-draft-profile', JSON.stringify(partialData));
  window.location.href = 'index.html';
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!validateStep(currentStep)) return;
  const profile = Object.fromEntries(new FormData(form));
  localStorage.setItem('aisc-profile', JSON.stringify(profile));
  localStorage.removeItem('aisc-draft-profile');
  window.location.href = 'student.html';
});

const draft = JSON.parse(localStorage.getItem('aisc-draft-profile') || 'null');
if (draft) {
  Object.entries(draft).forEach(([name, value]) => {
    const field = form.elements.namedItem(name);
    if (!field) return;
    if (field instanceof RadioNodeList) {
      [...field].forEach((radio) => { radio.checked = radio.value === value; });
    } else field.value = value;
  });
}
