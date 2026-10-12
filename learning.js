const learningError = document.querySelector('#learning-error');
const moduleList = document.querySelector('#module-list');
const moduleContent = document.querySelector('#module-content');
let currentUser = null;
let modules = [];
let moduleStates = new Map();
let selectedModuleId = null;

const submissionLabels = {
  draft: 'پیش‌نویس',
  submitted: 'ارسال شده؛ در انتظار بررسی',
  supporter_revision_requested: 'پشتیبان درخواست اصلاح داده است',
  supporter_approved: 'تأیید پشتیبان؛ در انتظار مدیر پروژه',
  manager_revision_requested: 'مدیر پروژه درخواست اصلاح داده است',
  manager_approved: 'تأیید نهایی مدیر پروژه',
};

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
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

function renderModules() {
  moduleList.innerHTML = modules.map((module, index) => {
    const state = moduleStates.get(module.id) || 'locked';
    const icon = state === 'complete' ? '✓' : state === 'current' ? '★' : '●';
    return `<button class="learning-module node-${state} ${module.id === selectedModuleId ? 'active' : ''}" type="button" data-module-id="${module.id}" data-module-state="${state}" style="--node-offset: ${(index % 4 === 1 ? 34 : index % 4 === 2 ? 34 : 0)}px" ${state === 'locked' ? 'disabled' : ''}><span>${icon}</span><b>هفتهٔ ${module.position.toLocaleString('fa-IR')}</b><small>${state === 'complete' ? 'تکمیل‌شده' : state === 'current' ? 'مرحلهٔ فعلی' : 'قفل'}</small></button>`;
  }).join('');
}

function submissionForm(assignment, submission) {
  const editable = !submission || ['draft', 'supporter_revision_requested', 'manager_revision_requested'].includes(submission.status);
  const response = escapeHtml(submission?.response_text || '');
  const resourceUrl = escapeHtml(submission?.resource_url || '');
  const state = submission ? `<p class="submission-state">${escapeHtml(submissionLabels[submission.status])}</p>` : '';
  if (!editable) return `${state}<p class="submission-state">پاسخ تو برای بررسی ثبت شده است.</p>`;
  return `<form class="submission-form" data-assignment-id="${assignment.id}"><label>پاسخ تو<textarea name="responseText" required placeholder="خروجی، توضیح یا نتیجهٔ تکلیف را اینجا بنویس...">${response}</textarea></label><label>لینک خروجی <input name="resourceUrl" type="url" value="${resourceUrl}" placeholder="https://..." /></label>${state}<button class="button" type="submit">ارسال برای بررسی <span>←</span></button></form>`;
}

async function showModule(moduleId) {
  selectedModuleId = moduleId;
  renderModules();
  const selected = modules.find((module) => module.id === moduleId);
  moduleContent.innerHTML = '<div class="empty-learning"><span>…</span><h2>در حال آماده‌سازی هفته</h2></div>';

  const [{ data: lessons, error: lessonsError }, { data: assignments, error: assignmentsError }] = await Promise.all([
    window.aiscSupabase.from('lessons').select('*').eq('module_id', moduleId).eq('is_published', true).order('position'),
    window.aiscSupabase.from('assignments').select('*').eq('module_id', moduleId).eq('is_published', true).order('created_at'),
  ]);

  if (lessonsError || assignmentsError) {
    learningError.textContent = 'محتوای این هفته دریافت نشد. لطفاً دوباره تلاش کن.';
    return;
  }

  const assignmentIds = assignments.map((assignment) => assignment.id);
  let submissions = [];
  if (assignmentIds.length) {
    const { data, error } = await window.aiscSupabase.from('submissions').select('*').in('assignment_id', assignmentIds).eq('student_id', currentUser.id);
    if (error) {
      learningError.textContent = 'وضعیت تکلیف‌ها دریافت نشد. لطفاً دوباره تلاش کن.';
      return;
    }
    submissions = data;
  }

  const submissionsByAssignment = new Map(submissions.map((submission) => [submission.assignment_id, submission]));
  const lessonsHtml = lessons.map((lesson) => {
    const resourceUrl = safeUrl(lesson.resource_url);
    return `<article class="lesson-card"><span class="assignment-label"><span>✦</span> درس ${lesson.position.toLocaleString('fa-IR')}</span><h3>${escapeHtml(lesson.title)}</h3><p>${escapeHtml(lesson.content)}</p>${resourceUrl ? `<a href="${escapeHtml(resourceUrl)}" target="_blank" rel="noopener noreferrer">مشاهدهٔ منبع ←</a>` : ''}</article>`;
  }).join('');
  const assignmentsHtml = assignments.map((assignment) => `<article class="assignment-card" id="assignment-${assignment.id}"><span class="assignment-label"><span>✓</span> مأموریت · ${assignment.xp_reward.toLocaleString('fa-IR')} XP</span><h3>${escapeHtml(assignment.title)}</h3><p>${escapeHtml(assignment.instructions)}</p>${assignment.rubric ? `<p class="rubric"><b>معیار ارزیابی:</b> ${escapeHtml(assignment.rubric)}</p>` : ''}${submissionForm(assignment, submissionsByAssignment.get(assignment.id))}</article>`).join('');

  moduleContent.innerHTML = `<section class="module-heading"><span class="pill">هفتهٔ ${selected.position.toLocaleString('fa-IR')}</span><h2>${escapeHtml(selected.title)}</h2><p>${escapeHtml(selected.description)}</p></section>${lessonsHtml || '<div class="empty-learning"><span>✦</span><h2>درس این هفته به‌زودی منتشر می‌شود.</h2></div>'}${assignmentsHtml ? `<section id="assignments">${assignmentsHtml}</section>` : ''}`;
}

async function loadLearning() {
  if (!window.aiscSupabaseConfigured) {
    learningError.textContent = 'اتصال امن AISC هنوز تنظیم نشده است.';
    return;
  }

  const { data: userData } = await window.aiscSupabase.auth.getUser();
  currentUser = userData.user;
  if (!currentUser) {
    window.location.href = 'login.html';
    return;
  }

  const { data: profile } = await window.aiscSupabase.from('profiles').select('full_name, role').eq('id', currentUser.id).maybeSingle();
  if (profile?.role !== 'student') {
    window.location.href = profile?.role === 'project_manager' ? 'manager.html' : 'index.html';
    return;
  }

  const firstName = profile.full_name.trim().split(/\s+/)[0] || 'دانش‌آموز';
  document.querySelector('#profile-name').textContent = profile.full_name || 'دانش‌آموز';
  document.querySelector('#profile-avatar').textContent = firstName.charAt(0);

  const { data: paths, error: pathError } = await window.aiscSupabase.from('learning_paths').select('*').eq('is_published', true).order('created_at').limit(1);
  if (pathError || !paths?.length) {
    moduleList.innerHTML = '<p class="empty-content">مسیر آموزشی هنوز منتشر نشده است.</p>';
    document.querySelector('#path-title').textContent = 'مسیر به‌زودی شروع می‌شود';
    return;
  }

  const path = paths[0];
  document.querySelector('#path-title').textContent = path.title;
  document.querySelector('#path-description').textContent = path.description || 'درس‌ها و مأموریت‌های این هفته را انجام بده.';
  const { data: moduleData, error: moduleError } = await window.aiscSupabase.from('modules').select('*').eq('learning_path_id', path.id).eq('is_published', true).order('position');
  if (moduleError || !moduleData?.length) {
    moduleList.innerHTML = '<p class="empty-content">هفته‌های این مسیر هنوز منتشر نشده‌اند.</p>';
    return;
  }

  modules = moduleData;
  const moduleIds = modules.map((module) => module.id);
  const { data: allAssignments, error: assignmentsError } = await window.aiscSupabase
    .from('assignments')
    .select('id, module_id')
    .in('module_id', moduleIds)
    .eq('is_published', true);

  if (assignmentsError) {
    learningError.textContent = 'وضعیت مسیر دریافت نشد. لطفاً دوباره تلاش کن.';
    return;
  }

  const allAssignmentIds = allAssignments.map((assignment) => assignment.id);
  const { data: allSubmissions, error: submissionsError } = allAssignmentIds.length
    ? await window.aiscSupabase
      .from('submissions')
      .select('assignment_id, status')
      .in('assignment_id', allAssignmentIds)
      .eq('student_id', currentUser.id)
    : { data: [], error: null };

  if (submissionsError) {
    learningError.textContent = 'وضعیت تکلیف‌ها دریافت نشد. لطفاً دوباره تلاش کن.';
    return;
  }

  const submissionsByAssignment = new Map(allSubmissions.map((submission) => [submission.assignment_id, submission]));
  let foundCurrent = false;
  modules.forEach((module) => {
    const moduleAssignments = allAssignments.filter((assignment) => assignment.module_id === module.id);
    const completed = moduleAssignments.length > 0 && moduleAssignments.every((assignment) => submissionsByAssignment.get(assignment.id)?.status === 'manager_approved');
    if (completed) {
      moduleStates.set(module.id, 'complete');
    } else if (!foundCurrent) {
      moduleStates.set(module.id, 'current');
      foundCurrent = true;
    } else {
      moduleStates.set(module.id, 'locked');
    }
  });

  const currentModule = modules.find((module) => moduleStates.get(module.id) === 'current');
  await showModule(currentModule?.id || modules[0].id);
}

moduleList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-module-id]');
  if (button && button.dataset.moduleState !== 'locked') showModule(button.dataset.moduleId);
});

moduleContent.addEventListener('submit', async (event) => {
  const form = event.target.closest('.submission-form');
  if (!form) return;
  event.preventDefault();
  learningError.textContent = '';
  const button = form.querySelector('button');
  button.disabled = true;
  button.textContent = 'در حال ذخیره...';
  const data = new FormData(form);
  const { error } = await window.aiscSupabase.rpc('submit_my_assignment', {
    target_assignment_id: form.dataset.assignmentId,
    new_response_text: data.get('responseText').trim(),
    new_resource_url: data.get('resourceUrl').trim() || null,
  });

  if (error) {
    learningError.textContent = 'ارسال تکلیف انجام نشد. لطفاً دوباره تلاش کن.';
    button.disabled = false;
    button.innerHTML = 'ارسال برای بررسی <span>←</span>';
    return;
  }
  await showModule(selectedModuleId);
});

document.querySelector('#logout-button').addEventListener('click', async () => {
  await window.aiscSupabase.auth.signOut();
  window.location.href = 'index.html';
});

loadLearning();
