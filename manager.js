const managerError = document.querySelector('#manager-error');
const table = document.querySelector('#students-table');
const search = document.querySelector('#student-search');
const detailSection = document.querySelector('#student-details');
const detailSubmissionList = document.querySelector('#detail-submission-list');
let students = [];
let supporters = [];

const submissionLabels = {
  draft: 'پیش‌نویس',
  submitted: 'در انتظار بررسی پشتیبان',
  supporter_revision_requested: 'نیازمند اصلاح',
  supporter_approved: 'در انتظار تأیید مدیر',
  manager_revision_requested: 'نیازمند اصلاح مدیر',
  manager_approved: 'تأیید نهایی',
};
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

function accessOptions(currentAccess) {
  return Object.entries(accessLabels).map(([value, label]) => (
    `<option value="${value}"${value === currentAccess ? ' selected' : ''}>${label}</option>`
  )).join('');
}

function supporterOptions(currentSupporterId) {
  const options = supporters.map((supporter) => (
    `<option value="${supporter.id}"${supporter.id === currentSupporterId ? ' selected' : ''}>${escapeHtml(supporter.full_name || 'بدون نام')}</option>`
  )).join('');
  return `<option value=""${currentSupporterId ? '' : ' selected'}>بدون پشتیبان</option>${options}`;
}

function renderStudents() {
  const query = search.value.trim().toLowerCase();
  const filtered = students.filter((student) => (student.full_name || '').toLowerCase().includes(query));

  if (!filtered.length) {
    table.innerHTML = '<tr><td colspan="6" class="loading-cell">دانش‌آموزی پیدا نشد.</td></tr>';
    return;
  }

  table.innerHTML = filtered.map((student) => {
    const initial = escapeHtml((student.full_name || '').trim().charAt(0) || '؟');
    const name = escapeHtml(student.full_name || 'بدون نام');
    const status = student.onboarding_completed
      ? '<span class="status complete">تکمیل شده</span>'
      : '<span class="status pending">در انتظار تکمیل</span>';
    const idea = escapeHtml(student.idea || 'هنوز ثبت نشده');
    return `<tr><td><div class="student-name"><span>${initial}</span>${name}</div></td><td>${status}</td><td><select class="table-select access-select" data-student-id="${student.id}" aria-label="سطح دسترسی ${name}">${accessOptions(student.access)}</select></td><td><select class="table-select supporter-select" data-student-id="${student.id}" aria-label="پشتیبان ${name}">${supporterOptions(student.supporter_id)}</select></td><td class="idea-cell" title="${idea}">${idea}</td><td><button class="detail-button" type="button" data-student-details="${student.id}">جزئیات</button></td></tr>`;
  }).join('');
}

async function showStudentDetails(studentId) {
  const student = students.find((item) => item.id === studentId);
  if (!student) return;

  detailSection.hidden = false;
  document.querySelector('#detail-student-name').textContent = student.full_name || 'دانش‌آموز';
  document.querySelector('#detail-onboarding').textContent = student.onboarding_completed ? 'تکمیل شده' : 'در انتظار تکمیل';
  document.querySelector('#detail-submission-list').replaceChildren();
  const loading = document.createElement('p');
  loading.className = 'loading-cell';
  loading.textContent = 'در حال دریافت...';
  detailSubmissionList.append(loading);

  const [{ data: profile, error: profileError }, { data: gamification, error: gamificationError }, { data: submissionData, error: submissionsError }] = await Promise.all([
    window.aiscSupabase.from('student_profiles').select('grade, age_range').eq('user_id', studentId).maybeSingle(),
    window.aiscSupabase.from('gamification_profiles').select('xp, level, current_streak, last_activity_date').eq('user_id', studentId).maybeSingle(),
    window.aiscSupabase.from('submissions').select('assignment_id, status, updated_at').eq('student_id', studentId).order('updated_at', { ascending: false }).limit(5),
  ]);

  if (profileError || gamificationError || submissionsError) {
    managerError.textContent = 'جزئیات دانش‌آموز دریافت نشد.';
    return;
  }

  document.querySelector('#detail-gamification').textContent = gamification
    ? `${gamification.xp.toLocaleString('fa-IR')} XP · سطح ${gamification.level.toLocaleString('fa-IR')}`
    : 'هنوز ثبت نشده';
  document.querySelector('#detail-grade').textContent = [profile?.age_range, profile?.grade].filter(Boolean).join(' · ') || 'ثبت نشده';
  document.querySelector('#detail-activity').textContent = gamification?.last_activity_date
    ? new Date(gamification.last_activity_date).toLocaleDateString('fa-IR')
    : 'هنوز فعالیتی ثبت نشده';

  const assignmentIds = (submissionData ?? []).map((submission) => submission.assignment_id);
  const { data: assignments } = assignmentIds.length
    ? await window.aiscSupabase.from('assignments').select('id, title').in('id', assignmentIds)
    : { data: [] };
  const titles = new Map((assignments ?? []).map((assignment) => [assignment.id, assignment.title]));
  detailSubmissionList.replaceChildren();
  if (!submissionData?.length) {
    const empty = document.createElement('p');
    empty.className = 'notification-empty';
    empty.textContent = 'هنوز تکلیفی ثبت نشده است.';
    detailSubmissionList.append(empty);
    return;
  }
  submissionData.forEach((submission) => {
    const item = document.createElement('div');
    item.className = 'detail-submission';
    const title = document.createElement('b');
    title.textContent = titles.get(submission.assignment_id) || 'تکلیف';
    const status = document.createElement('span');
    status.textContent = submissionLabels[submission.status] || submission.status;
    item.append(title, status);
    detailSubmissionList.append(item);
  });
}

async function updateAccess(event) {
  const { studentId } = event.target.dataset;
  const newAccess = event.target.value;
  event.target.disabled = true;
  managerError.textContent = '';
  const { error } = await window.aiscSupabase.rpc('set_student_access', {
    target_student_id: studentId,
    new_access: newAccess,
  });

  if (error) {
    managerError.textContent = 'تغییر سطح دسترسی ذخیره نشد.';
    renderStudents();
  } else {
    students = students.map((student) => student.id === studentId ? { ...student, access: newAccess } : student);
  }
  event.target.disabled = false;
}

async function updateSupporter(event) {
  const { studentId } = event.target.dataset;
  const supporterId = event.target.value;
  event.target.disabled = true;
  managerError.textContent = '';
  let error;
  if (!supporterId) {
    ({ error } = await window.aiscSupabase.rpc('unassign_supporter_from_student', {
      target_student_id: studentId,
    }));
  } else {
    ({ error } = await window.aiscSupabase.rpc('assign_supporter_to_student', {
      target_student_id: studentId,
      target_supporter_id: supporterId,
    }));
  }

  if (error) {
    managerError.textContent = 'تخصیص پشتیبان ذخیره نشد.';
    renderStudents();
  } else {
    students = students.map((student) => student.id === studentId ? { ...student, supporter_id: supporterId } : student);
  }
  event.target.disabled = false;
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

  if (accountError || account?.role !== 'project_manager') {
    window.location.href = 'student.html';
    return;
  }

  document.querySelector('#manager-name').textContent = account.full_name || 'مدیر پروژه';
  document.querySelector('#manager-avatar').textContent = (account.full_name || 'م').trim().charAt(0);

  const [{ data: profiles, error: profilesError }, { data: onboarding, error: onboardingError }, { data: assignments, error: assignmentsError }, { data: analytics, error: analyticsError }] = await Promise.all([
    window.aiscSupabase.from('profiles').select('id, full_name, role, access').in('role', ['student', 'supporter']).order('created_at', { ascending: false }),
    window.aiscSupabase.from('student_profiles').select('user_id, onboarding_completed, idea'),
    window.aiscSupabase.from('supporter_assignments').select('student_id, supporter_id'),
    window.aiscSupabase.rpc('get_aisc_manager_analytics'),
  ]);

  if (profilesError || onboardingError || assignmentsError || analyticsError) {
    managerError.textContent = 'اطلاعات مدیریت دریافت نشد. لطفاً دوباره تلاش کن.';
    return;
  }

  supporters = profiles.filter((profile) => profile.role === 'supporter');
  const assignmentByStudent = new Map(assignments.map((assignment) => [assignment.student_id, assignment.supporter_id]));
  const onboardingByUser = new Map(onboarding.map((profile) => [profile.user_id, profile]));
  students = profiles
    .filter((profile) => profile.role === 'student')
    .map((profile) => ({ ...profile, ...onboardingByUser.get(profile.id), supporter_id: assignmentByStudent.get(profile.id) }));
  const completed = students.filter((student) => student.onboarding_completed).length;
  const metrics = analytics?.[0];
  document.querySelector('#student-count').textContent = (metrics?.student_count ?? students.length).toLocaleString('fa-IR');
  document.querySelector('#onboarding-count').textContent = (metrics?.onboarding_completed ?? completed).toLocaleString('fa-IR');
  document.querySelector('#incomplete-count').textContent = ((metrics?.student_count ?? students.length) - (metrics?.onboarding_completed ?? completed)).toLocaleString('fa-IR');
  document.querySelector('#supporter-count').textContent = supporters.length.toLocaleString('fa-IR');
  document.querySelector('#supporter-review-count').textContent = (metrics?.supporter_review_pending ?? 0).toLocaleString('fa-IR');
  document.querySelector('#manager-review-count').textContent = (metrics?.manager_review_pending ?? 0).toLocaleString('fa-IR');
  document.querySelector('#approved-submission-count').textContent = (metrics?.approved_submissions ?? 0).toLocaleString('fa-IR');
  renderStudents();
}

document.querySelector('#logout-button').addEventListener('click', async () => {
  if (window.aiscSupabaseConfigured) await window.aiscSupabase.auth.signOut();
  window.location.href = 'index.html';
});

table.addEventListener('click', (event) => {
  const detailButton = event.target.closest('[data-student-details]');
  if (detailButton) showStudentDetails(detailButton.dataset.studentDetails);
});
document.querySelector('#close-student-details').addEventListener('click', () => {
  detailSection.hidden = true;
});

table.addEventListener('change', (event) => {
  if (event.target.matches('.access-select')) updateAccess(event);
  if (event.target.matches('.supporter-select')) updateSupporter(event);
});
search.addEventListener('input', renderStudents);
loadManagerDashboard();
