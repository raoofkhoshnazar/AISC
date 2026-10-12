const managerError = document.querySelector('#manager-error');
const table = document.querySelector('#students-table');
const search = document.querySelector('#student-search');
let students = [];

const accessLabels = {
  trial: 'آزمایشی',
  paid: 'پولی',
  complimentary: 'فعال‌سازی دستی',
  suspended: 'متوقف‌شده',
};

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character]);
}

function renderStudents() {
  const query = search.value.trim().toLowerCase();
  const filtered = students.filter((student) => student.full_name.toLowerCase().includes(query));

  if (!filtered.length) {
    table.innerHTML = '<tr><td colspan="4" class="loading-cell">دانش‌آموزی پیدا نشد.</td></tr>';
    return;
  }

  table.innerHTML = filtered.map((student) => {
    const initial = escapeHtml(student.full_name.trim().charAt(0) || '؟');
    const name = escapeHtml(student.full_name || 'بدون نام');
    const status = student.onboarding_completed
      ? '<span class="status complete">تکمیل شده</span>'
      : '<span class="status pending">در انتظار تکمیل</span>';
    const idea = escapeHtml(student.idea || 'هنوز ثبت نشده');
    return `<tr><td><div class="student-name"><span>${initial}</span>${name}</div></td><td>${status}</td><td><span class="access">${accessLabels[student.access] || student.access}</span></td><td class="idea-cell" title="${idea}">${idea}</td></tr>`;
  }).join('');
}

async function loadManagerDashboard() {
  if (!window.aiscSupabaseConfigured) {
    managerError.textContent = 'اتصال امن AISC هنوز تنظیم نشده است.';
    return;
  }

  const { data: userData } = await window.aiscSupabase.auth.getUser();
  if (!userData.user) {
    window.location.href = 'login.html';
    return;
  }

  const { data: account, error: accountError } = await window.aiscSupabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (accountError || !['project_manager', 'executive_manager'].includes(account?.role)) {
    window.location.href = 'student.html';
    return;
  }

  document.querySelector('#manager-name').textContent = account.full_name || 'مدیر پروژه';
  document.querySelector('#manager-avatar').textContent = (account.full_name || 'م').trim().charAt(0);

  const [{ data: profiles, error: profilesError }, { data: onboarding, error: onboardingError }] = await Promise.all([
    window.aiscSupabase.from('profiles').select('id, full_name, role, access').eq('role', 'student').order('created_at', { ascending: false }),
    window.aiscSupabase.from('student_profiles').select('user_id, onboarding_completed, idea'),
  ]);

  if (profilesError || onboardingError) {
    managerError.textContent = 'اطلاعات مدیریت دریافت نشد. لطفاً دوباره تلاش کن.';
    return;
  }

  const onboardingByUser = new Map(onboarding.map((profile) => [profile.user_id, profile]));
  students = profiles.map((profile) => ({ ...profile, ...onboardingByUser.get(profile.id) }));
  const completed = students.filter((student) => student.onboarding_completed).length;
  document.querySelector('#student-count').textContent = students.length.toLocaleString('fa-IR');
  document.querySelector('#onboarding-count').textContent = completed.toLocaleString('fa-IR');
  document.querySelector('#incomplete-count').textContent = (students.length - completed).toLocaleString('fa-IR');

  const { count: supporterCount } = await window.aiscSupabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'supporter');
  document.querySelector('#supporter-count').textContent = (supporterCount || 0).toLocaleString('fa-IR');

  renderStudents();
}

document.querySelector('#logout-button').addEventListener('click', async () => {
  if (window.aiscSupabaseConfigured) await window.aiscSupabase.auth.signOut();
  window.location.href = 'index.html';
});

search.addEventListener('input', renderStudents);
loadManagerDashboard();
