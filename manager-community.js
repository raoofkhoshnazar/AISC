const error = document.querySelector('#community-error');
const roomList = document.querySelector('#room-list');
const form = document.querySelector('#room-form');
const members = document.querySelector('#member-select');
let manager;
function esc(value) { return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]); }
async function load() {
  const { data: userData } = await window.aiscSupabase.auth.getUser();
  if (!userData.user) { window.location.href = 'login.html'; return; }
  const { data: account } = await window.aiscSupabase.from('profiles').select('id,full_name,role').eq('id', userData.user.id).maybeSingle();
  if (account?.role !== 'project_manager') { window.location.href = 'index.html'; return; }
  manager = account;
  document.querySelector('#manager-name').textContent = account.full_name || 'مدیر پروژه';
  document.querySelector('#manager-avatar').textContent = (account.full_name || 'م').charAt(0);
  const [{ data: profiles }, { data: rooms }] = await Promise.all([
    window.aiscSupabase.from('profiles').select('id,full_name,role').in('role', ['student', 'supporter']).order('full_name'),
    window.aiscSupabase.from('chat_rooms').select('id,name,room_type,created_at').order('created_at', { ascending: false }),
  ]);
  members.innerHTML = profiles.map((profile) => `<option value="${profile.id}">${esc(profile.full_name || 'بدون نام')} · ${profile.role === 'supporter' ? 'پشتیبان' : 'دانش‌آموز'}</option>`).join('');
  roomList.innerHTML = rooms.length ? rooms.map((room) => `<article class="path-item"><b>${esc(room.name)}</b><small>${room.room_type === 'class' ? 'گروه کلاس' : room.room_type === 'supporter_group' ? 'گروه پشتیبانی' : 'کانال اطلاع‌رسانی'}</small></article>`).join('') : '<p class="empty-content">هنوز گروهی ساخته نشده است.</p>';
}
form.addEventListener('submit', async (event) => {
  event.preventDefault(); error.textContent = '';
  const data = new FormData(form); const name = data.get('name').trim();
  const { data: room, error: roomError } = await window.aiscSupabase.from('chat_rooms').insert({ name, room_type: data.get('type'), created_by: manager.id }).select('id').single();
  if (roomError) { error.textContent = 'ساخت گروه انجام نشد.'; return; }
  const selected = [...members.selectedOptions].map((option) => option.value);
  const memberRows = [...new Set([...selected, manager.id])].map((user_id) => ({ room_id: room.id, user_id }));
  const { error: memberError } = await window.aiscSupabase.from('chat_room_members').insert(memberRows);
  if (memberError) { error.textContent = 'گروه ساخته شد، اما افزودن اعضا انجام نشد.'; return; }
  form.reset(); await load();
});
document.querySelector('#logout-button').addEventListener('click', async () => { await window.aiscSupabase.auth.signOut(); window.location.href = 'index.html'; });
load();
