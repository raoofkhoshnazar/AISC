const reviewError = document.querySelector('#review-error');
const reviewList = document.querySelector('#review-list');
const reviewNav = document.querySelector('#review-nav');
const notificationButton = document.querySelector('#notification-button');
const notificationsCard = document.querySelector('#notifications-card');
const notificationList = document.querySelector('#notification-list');
const notificationCount = document.querySelector('#notification-count');
let reviewerRole = null;
let submissions = [];
let activeFilter = 'pending';

function renderNotifications(notifications) {
  notificationList.replaceChildren();
  if (!notifications.length) {
    const empty = document.createElement('p');
    empty.className = 'notification-empty';
    empty.textContent = 'اعلانی نداری.';
    notificationList.append(empty);
    notificationCount.hidden = true;
    return;
  }

  const unreadCount = notifications.filter((notification) => !notification.read_at).length;
  notificationCount.textContent = unreadCount.toLocaleString('fa-IR');
  notificationCount.hidden = unreadCount === 0;
  notifications.forEach((notification) => {
    const item = document.createElement('article');
    item.className = `notification-item${notification.read_at ? '' : ' unread'}`;
    const title = document.createElement('b');
    title.textContent = notification.title;
    const body = document.createElement('p');
    body.textContent = notification.body;
    item.append(title, body);
    notificationList.append(item);
  });
}

async function loadNotifications() {
  const { data, error } = await window.aiscSupabase
    .from('notifications')
    .select('id, title, body, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  if (!error) renderNotifications(data ?? []);
}

async function markNotificationsRead() {
  const { data: unread } = await window.aiscSupabase
    .from('notifications')
    .select('id')
    .is('read_at', null)
    .limit(10);
  if (!unread?.length) return;
  await window.aiscSupabase.rpc('mark_my_notifications_read', {
    notification_ids: unread.map((notification) => notification.id),
  });
  await loadNotifications();
}

const statusLabels = {
  draft: 'پیش‌نویس',
  submitted: 'در انتظار پشتیبان',
  supporter_revision_requested: 'نیازمند اصلاح دانش‌آموز',
  supporter_approved: 'در انتظار مدیر پروژه',
  manager_revision_requested: 'نیازمند اصلاح دانش‌آموز',
  manager_approved: 'تأیید نهایی',
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

function safeUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function reviewForm(submission) {
  const statusIsPending = reviewerRole === 'supporter'
    ? submission.status === 'submitted'
    : submission.status === 'supporter_approved';
  if (!statusIsPending) return '';

  return `<form class="review-form" data-submission-id="${submission.id}"><h3>بازخورد ${reviewerRole === 'supporter' ? 'پشتیبان' : 'مدیر پروژه'}</h3><label>امتیاز<select name="score" required><option value="">انتخاب امتیاز</option><option value="5">۵ · عالی</option><option value="4">۴ · خوب</option><option value="3">۳ · قابل بهبود</option><option value="2">۲ · نیازمند تلاش بیشتر</option><option value="1">۱ · نیازمند بازبینی کامل</option></select></label><label>بازخورد<textarea name="feedback" required placeholder="بازخوردت باید روشن، عملی و محترمانه باشد."></textarea></label><div class="review-actions"><button class="revision-button" type="submit" name="decision" value="revision">نیاز به اصلاح</button><button class="approve-button" type="submit" name="decision" value="approve">تأیید</button></div></form>`;
}

function previousFeedback(submission) {
  const blocks = [];
  if (submission.supporter_feedback) blocks.push(`<div class="feedback-box"><b>بازخورد پشتیبان · ${submission.supporter_score ?? '—'} از ۵</b>${escapeHtml(submission.supporter_feedback)}</div>`);
  if (submission.manager_feedback) blocks.push(`<div class="feedback-box"><b>بازخورد مدیر پروژه · ${submission.manager_score ?? '—'} از ۵</b>${escapeHtml(submission.manager_feedback)}</div>`);
  return blocks.join('');
}

function renderSubmissions() {
  const pendingStatuses = reviewerRole === 'supporter' ? ['submitted'] : ['supporter_approved'];
  const visible = activeFilter === 'pending'
    ? submissions.filter((submission) => pendingStatuses.includes(submission.status))
    : submissions;

  if (!visible.length) {
    reviewList.innerHTML = '<div class="empty-review">فعلاً تکلیفی برای بررسی وجود ندارد.</div>';
    return;
  }

  reviewList.innerHTML = visible.map((submission) => {
    const studentName = escapeHtml(submission.student_name || 'دانش‌آموز');
    const initial = escapeHtml(studentName.charAt(0) || '؟');
    const assignmentTitle = escapeHtml(submission.assignment_title || 'تکلیف');
    const response = escapeHtml(submission.response_text || 'دانش‌آموز پاسخی ثبت نکرده است.');
    const resourceUrl = safeUrl(submission.resource_url);
    const isApproved = submission.status === 'manager_approved';
    return `<article class="review-card"><header class="review-card-header"><div><div class="review-student"><span>${initial}</span>${studentName}</div><h2>${assignmentTitle}</h2></div><span class="review-status ${isApproved ? 'approved' : ''}">${statusLabels[submission.status]}</span></header><div class="review-content"><div class="student-response"><h3>پاسخ دانش‌آموز</h3><p>${response}</p>${resourceUrl ? `<a href="${escapeHtml(resourceUrl)}" target="_blank" rel="noopener noreferrer">مشاهدهٔ لینک خروجی ←</a>` : ''}${previousFeedback(submission)}</div>${reviewForm(submission)}</div></article>`;
  }).join('');
}

async function loadReviews() {
  if (!window.aiscSupabaseConfigured) {
    reviewError.textContent = 'اتصال امن AISC هنوز تنظیم نشده است.';
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

  if (accountError || !['supporter', 'project_manager'].includes(account?.role)) {
    window.location.href = account?.role === 'student' ? 'student.html' : 'index.html';
    return;
  }

  reviewerRole = account.role;
  await loadNotifications();
  const name = account.full_name || (reviewerRole === 'supporter' ? 'پشتیبان' : 'مدیر پروژه');
  document.querySelector('#reviewer-name').textContent = name;
  document.querySelector('#reviewer-avatar').textContent = name.trim().charAt(0);
  document.querySelector('#reviewer-role-label').textContent = reviewerRole === 'supporter' ? 'پشتیبان AISC' : 'مدیر پروژه';

  if (reviewerRole === 'supporter') {
    document.body.querySelector('.sidebar').classList.add('supporter-sidebar');
    document.querySelector('#reviewer-role').textContent = 'پنل پشتیبان AISC';
    document.querySelector('#reviewer-eyebrow').textContent = 'پشتیبانی دانش‌آموزان';
    document.querySelector('#review-title').textContent = 'تکلیف‌های دانش‌آموزان من';
    document.querySelector('#review-intro').textContent = 'تکلیف‌ها را بررسی کن، بازخورد بده و آماده‌بودن آن‌ها برای تأیید نهایی را مشخص کن.';
  }

  const { data: submissionData, error: submissionError } = await window.aiscSupabase
    .from('submissions')
    .select('*')
    .order('submitted_at', { ascending: false });

  if (submissionError) {
    reviewError.textContent = 'تکلیف‌ها دریافت نشدند. لطفاً دوباره تلاش کن.';
    return;
  }

  const studentIds = [...new Set(submissionData.map((submission) => submission.student_id))];
  const assignmentIds = [...new Set(submissionData.map((submission) => submission.assignment_id))];
  const [{ data: profiles, error: profilesError }, { data: assignments, error: assignmentsError }] = await Promise.all([
    studentIds.length ? window.aiscSupabase.from('profiles').select('id, full_name').in('id', studentIds) : { data: [], error: null },
    assignmentIds.length ? window.aiscSupabase.from('assignments').select('id, title').in('id', assignmentIds) : { data: [], error: null },
  ]);

  if (profilesError || assignmentsError) {
    reviewError.textContent = 'اطلاعات تکلیف‌ها کامل دریافت نشد. لطفاً دوباره تلاش کن.';
    return;
  }

  const namesById = new Map(profiles.map((profile) => [profile.id, profile.full_name]));
  const assignmentsById = new Map(assignments.map((assignment) => [assignment.id, assignment.title]));
  submissions = submissionData.map((submission) => ({
    ...submission,
    student_name: namesById.get(submission.student_id),
    assignment_title: assignmentsById.get(submission.assignment_id),
  }));
  renderSubmissions();
}

reviewList.addEventListener('submit', async (event) => {
  const form = event.target.closest('.review-form');
  if (!form) return;
  event.preventDefault();
  reviewError.textContent = '';
  const data = new FormData(form);
  const decision = data.get('decision');
  const score = Number(data.get('score'));
  const feedback = data.get('feedback').trim();
  if (!score || !feedback) {
    reviewError.textContent = 'امتیاز و بازخورد را کامل کن.';
    return;
  }

  const buttons = form.querySelectorAll('button');
  buttons.forEach((button) => { button.disabled = true; });
  const functionName = reviewerRole === 'supporter' ? 'review_submission_as_supporter' : 'review_submission_as_manager';
  const { error } = await window.aiscSupabase.rpc(functionName, {
    target_submission_id: form.dataset.submissionId,
    new_score: score,
    new_feedback: feedback,
    is_approved: decision === 'approve',
  });

  if (error) {
    reviewError.textContent = 'ثبت بررسی انجام نشد. لطفاً دوباره تلاش کن.';
    buttons.forEach((button) => { button.disabled = false; });
    return;
  }
  await loadReviews();
});

document.querySelector('#mark-notifications-read').addEventListener('click', markNotificationsRead);
notificationButton.addEventListener('click', () => {
  const isHidden = notificationsCard.hidden;
  notificationsCard.hidden = !isHidden;
  notificationButton.setAttribute('aria-expanded', String(isHidden));
});

document.querySelectorAll('.filter-button').forEach((button) => {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.status;
    document.querySelectorAll('.filter-button').forEach((item) => item.classList.toggle('active', item === button));
    renderSubmissions();
  });
});

document.querySelector('#logout-button').addEventListener('click', async () => {
  if (window.aiscSupabaseConfigured) await window.aiscSupabase.auth.signOut();
  window.location.href = 'index.html';
});

loadReviews();
