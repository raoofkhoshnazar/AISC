const error = document.querySelector('#curriculum-error');
const pathList = document.querySelector('#path-list');
const moduleList = document.querySelector('#module-list');
const pathForm = document.querySelector('#path-form');
const moduleForm = document.querySelector('#module-form');
const lessonForm = document.querySelector('#lesson-form');
const assignmentForm = document.querySelector('#assignment-form');
let paths = [];
let modules = [];
let lessons = [];
let assignments = [];
let selectedPathId = null;
let selectedModuleId = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character]);
}

function showError(message) {
  error.textContent = message;
}

function renderPaths() {
  if (!paths.length) {
    pathList.innerHTML = '<p class="empty-content">هنوز مسیری ساخته نشده است.</p>';
    return;
  }

  pathList.innerHTML = paths.map((path) => `<button class="path-item ${path.id === selectedPathId ? 'active' : ''}" data-path-id="${path.id}" type="button"><b>${escapeHtml(path.title)}</b><small class="${path.is_published ? 'published-label' : 'draft-label'}">${path.is_published ? 'منتشر شده' : 'پیش‌نویس'}</small></button>`).join('');
}

function renderModules() {
  const selectedPath = paths.find((path) => path.id === selectedPathId);
  document.querySelector('#selected-path-label').textContent = selectedPath ? (selectedPath.is_published ? 'مسیر منتشرشده' : 'مسیر پیش‌نویس') : 'یک مسیر انتخاب کن';
  document.querySelector('#selected-path-title').textContent = selectedPath?.title || 'هفته‌ها و ماژول‌ها';
  moduleForm.hidden = !selectedPath;

  if (!selectedPath) {
    moduleList.innerHTML = '<p class="empty-content">برای شروع، یک مسیر آموزشی بساز یا انتخاب کن.</p>';
    return;
  }

  const pathModules = modules.filter((module) => module.learning_path_id === selectedPathId);
  if (!pathModules.length) {
    moduleList.innerHTML = '<p class="empty-content">هنوز ماژولی برای این مسیر اضافه نشده است.</p>';
    return;
  }

  moduleList.innerHTML = pathModules.map((module) => {
    const lessonCount = lessons.filter((lesson) => lesson.module_id === module.id).length;
    const assignmentCount = assignments.filter((assignment) => assignment.module_id === module.id).length;
    return `<button class="module-item ${module.id === selectedModuleId ? 'active' : ''}" data-module-id="${module.id}" type="button"><b>هفتهٔ ${module.position}: ${escapeHtml(module.title)}</b><small class="${module.is_published ? 'published-label' : 'draft-label'}">${module.is_published ? 'منتشر شده' : 'پیش‌نویس'} · ${lessonCount} درس · ${assignmentCount} تکلیف</small>${module.description ? `<p class="module-content">${escapeHtml(module.description)}</p>` : ''}</button>`;
  }).join('');
}

function renderModuleDetail() {
  const selectedModule = modules.find((module) => module.id === selectedModuleId);
  const detail = document.querySelector('#content-detail');
  detail.hidden = !selectedModule;
  if (!selectedModule) return;
  document.querySelector('#selected-module-label').textContent = `هفتهٔ ${selectedModule.position}`;
  document.querySelector('#selected-module-title').textContent = selectedModule.title;
}

function render() {
  renderPaths();
  renderModules();
  renderModuleDetail();
}

async function loadCurriculum() {
  if (!window.aiscSupabaseConfigured) {
    showError('اتصال امن AISC هنوز تنظیم نشده است.');
    return;
  }

  const { data: userData } = await window.aiscSupabase.auth.getUser();
  if (!userData.user) {
    window.location.href = 'login.html';
    return;
  }

  const { data: account } = await window.aiscSupabase.from('profiles').select('full_name, role').eq('id', userData.user.id).maybeSingle();
  if (account?.role !== 'project_manager') {
    window.location.href = 'student.html';
    return;
  }
  document.querySelector('#manager-name').textContent = account.full_name || 'مدیر پروژه';
  document.querySelector('#manager-avatar').textContent = (account.full_name || 'م').trim().charAt(0);

  const [{ data: pathData, error: pathError }, { data: moduleData, error: moduleError }, { data: lessonData, error: lessonError }, { data: assignmentData, error: assignmentError }] = await Promise.all([
    window.aiscSupabase.from('learning_paths').select('*').order('created_at'),
    window.aiscSupabase.from('modules').select('*').order('position'),
    window.aiscSupabase.from('lessons').select('id, module_id'),
    window.aiscSupabase.from('assignments').select('id, module_id'),
  ]);

  if (pathError || moduleError || lessonError || assignmentError) {
    showError('محتوای آموزشی دریافت نشد. لطفاً دوباره تلاش کن.');
    return;
  }

  paths = pathData;
  modules = moduleData;
  lessons = lessonData;
  assignments = assignmentData;
  if (!selectedPathId && paths[0]) selectedPathId = paths[0].id;
  if (selectedPathId && !paths.some((path) => path.id === selectedPathId)) selectedPathId = paths[0]?.id || null;
  if (selectedModuleId && !modules.some((module) => module.id === selectedModuleId)) selectedModuleId = null;
  render();
}

pathList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-path-id]');
  if (!button) return;
  selectedPathId = button.dataset.pathId;
  selectedModuleId = null;
  render();
});

moduleList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-module-id]');
  if (!button) return;
  selectedModuleId = button.dataset.moduleId;
  render();
});

pathForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError('');
  const data = new FormData(pathForm);
  const { error: createError } = await window.aiscSupabase.from('learning_paths').insert({
    title: data.get('title').trim(), description: data.get('description').trim(), is_published: data.get('isPublished') === 'on',
  });
  if (createError) { showError('مسیر ذخیره نشد.'); return; }
  pathForm.reset();
  await loadCurriculum();
});

moduleForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError('');
  const data = new FormData(moduleForm);
  const { error: createError } = await window.aiscSupabase.from('modules').insert({
    learning_path_id: selectedPathId, position: Number(data.get('position')), title: data.get('title').trim(), description: data.get('description').trim(), is_published: data.get('isPublished') === 'on',
  });
  if (createError) { showError('ماژول ذخیره نشد. شمارهٔ هفته باید در این مسیر یکتا باشد.'); return; }
  moduleForm.reset();
  await loadCurriculum();
});

lessonForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError('');
  const data = new FormData(lessonForm);
  const { error: createError } = await window.aiscSupabase.from('lessons').insert({
    module_id: selectedModuleId, position: Number(data.get('position')), title: data.get('title').trim(), content: data.get('content').trim(), resource_url: data.get('resourceUrl').trim() || null, is_published: data.get('isPublished') === 'on',
  });
  if (createError) { showError('درس ذخیره نشد. ترتیب درس باید در این ماژول یکتا باشد.'); return; }
  lessonForm.reset();
  await loadCurriculum();
});

assignmentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError('');
  const data = new FormData(assignmentForm);
  const { error: createError } = await window.aiscSupabase.from('assignments').insert({
    module_id: selectedModuleId, title: data.get('title').trim(), instructions: data.get('instructions').trim(), rubric: data.get('rubric').trim(), xp_reward: Number(data.get('xpReward')), is_published: data.get('isPublished') === 'on',
  });
  if (createError) { showError('تکلیف ذخیره نشد.'); return; }
  assignmentForm.reset();
  await loadCurriculum();
});

document.querySelector('#logout-button').addEventListener('click', async () => {
  await window.aiscSupabase.auth.signOut();
  window.location.href = 'index.html';
});

loadCurriculum();
