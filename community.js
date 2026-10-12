const error = document.querySelector('#community-error');
const roomList = document.querySelector('#room-list');
const messageList = document.querySelector('#message-list');
const messageForm = document.querySelector('#message-form');
let user = null;
let rooms = [];
let selectedRoomId = null;

function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]); }
function time(value) { return new Date(value).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }); }
function renderRooms() { roomList.innerHTML = rooms.length ? rooms.map((room) => `<button class="room-button ${room.id === selectedRoomId ? 'active' : ''}" data-room-id="${room.id}"><b>${escapeHtml(room.name)}</b><small>${room.room_type === 'class' ? 'گروه کلاس' : room.room_type === 'supporter_group' ? 'گروه پشتیبانی' : 'گفت‌وگو'}</small></button>`).join('') : '<p class="empty-content">هنوز در گروهی عضو نشده‌ای.</p>'; }
async function showRoom(roomId) {
  selectedRoomId = roomId; renderRooms();
  const room = rooms.find((item) => item.id === roomId);
  document.querySelector('#chat-title').innerHTML = `<h2>${escapeHtml(room.name)}</h2><p>با احترام و برای کمک به هم گفتگو کنید.</p>`;
  const { data: messages, error: loadError } = await window.aiscSupabase.from('chat_messages').select('id, sender_id, body, created_at').eq('room_id', roomId).order('created_at').limit(100);
  if (loadError) { error.textContent = 'پیام‌ها دریافت نشدند.'; return; }
  const senderIds = [...new Set(messages.map((message) => message.sender_id))];
  const { data: profiles } = senderIds.length ? await window.aiscSupabase.from('profiles').select('id, full_name').in('id', senderIds) : { data: [] };
  const names = new Map(profiles.map((profile) => [profile.id, profile.full_name]));
  messageList.replaceChildren(...messages.map((message) => { const item = document.createElement('article'); item.className = `message ${message.sender_id === user.id ? 'mine' : ''}`; const name = document.createElement('b'); name.textContent = message.sender_id === user.id ? 'تو' : names.get(message.sender_id) || 'عضو AISC'; const body = document.createElement('div'); body.textContent = message.body; const sentAt = document.createElement('small'); sentAt.textContent = time(message.created_at); item.append(name, body, sentAt); return item; }));
  if (!messages.length) messageList.innerHTML = '<p class="empty-content">اولین پیام این گروه را تو بفرست.</p>';
  messageForm.hidden = false;
}
async function loadCommunity() {
  const { data: userData } = await window.aiscSupabase.auth.getUser(); user = userData.user;
  if (!user) { window.location.href = 'login.html'; return; }
  const { data: profile } = await window.aiscSupabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'student') { window.location.href = profile?.role === 'project_manager' ? 'manager.html' : 'index.html'; return; }
  document.querySelector('#profile-name').textContent = profile.full_name || 'دانش‌آموز'; document.querySelector('#profile-avatar').textContent = (profile.full_name || 'د').trim().charAt(0);
  const { data, error: roomError } = await window.aiscSupabase.from('chat_rooms').select('*').order('created_at');
  if (roomError) { error.textContent = 'گروه‌ها دریافت نشدند.'; return; }
  rooms = data; renderRooms(); if (rooms[0]) showRoom(rooms[0].id);
}
roomList.addEventListener('click', (event) => { const button = event.target.closest('[data-room-id]'); if (button) showRoom(button.dataset.roomId); });
messageForm.addEventListener('submit', async (event) => { event.preventDefault(); const input = document.querySelector('#message-input'); const body = input.value.trim(); if (!body) return; const { error: sendError } = await window.aiscSupabase.from('chat_messages').insert({ room_id: selectedRoomId, sender_id: user.id, body }); if (sendError) { error.textContent = 'ارسال پیام انجام نشد.'; return; } input.value = ''; showRoom(selectedRoomId); });
document.querySelector('#logout-button').addEventListener('click', async () => { await window.aiscSupabase.auth.signOut(); window.location.href = 'index.html'; });
loadCommunity();
