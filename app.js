const SUPABASE_URL = 'https://arsfqjhvgphsglouwdsn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyc2Zxamh2Z3Boc2dsb3V3ZHNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNjA3MDAsImV4cCI6MjA3MTczNjcwMH0.WvzZ9m2tyxT0XgnWOpOFGop8gMk7fgLVwFSIaNiH62Q';

const USERS = {
  emr:   { pass: 'emr',   role: 'emr' },
  admin: { pass: 'admin', role: 'admin' }
};

let currentUser = null;

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json'
};

// --- Helpers ---

function showToast(msg, type = 'success') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium text-white ${type === 'success' ? 'bg-green-500' : 'bg-red-500'}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// --- Auth ---

document.getElementById('login-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const u = document.getElementById('login-user').value.trim().toLowerCase();
  const p = document.getElementById('login-pass').value;
  if (USERS[u] && USERS[u].pass === p) {
    currentUser = { name: u, role: USERS[u].role };
    document.getElementById('login-error').classList.add('hidden');
    showPage();
  } else {
    document.getElementById('login-error').classList.remove('hidden');
  }
});

function logout() {
  currentUser = null;
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('page-login').classList.remove('hidden');
  document.getElementById('page-emr').classList.add('hidden');
  document.getElementById('page-admin').classList.add('hidden');
}

function showPage() {
  document.getElementById('page-login').classList.add('hidden');
  if (currentUser.role === 'admin') {
    document.getElementById('page-admin').classList.remove('hidden');
    loadAdmin();
  } else {
    document.getElementById('page-emr').classList.remove('hidden');
    loadEmr();
  }
}

// --- Supabase REST helpers ---

async function rest(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { ...headers, ...opts.headers }, method: opts.method || 'GET', body: opts.body });
  if (!r.ok) throw new Error(await r.text());
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

async function rpc(fn, params = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(params) });
  if (!r.ok) throw new Error(await r.text());
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

// --- EMR VIEW ---

async function loadEmr() {
  const container = document.getElementById('emr-items');
  const loading = document.getElementById('emr-loading');
  try {
    const items = await rest('checklist_items?order=position.asc,created_at.asc&select=id,title,position');
    loading.classList.add('hidden');
    container.innerHTML = '';
    if (!items || items.length === 0) {
      container.innerHTML = '<p class="text-center text-gray-400 py-8">Nenhum item no checklist.</p>';
      return;
    }
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'item-card bg-white rounded-xl border border-gray-200 overflow-hidden';
      card.innerHTML = `
        <button onclick="toggleCollapse(this)" class="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition">
          <span class="font-medium text-gray-800">${escapeHtml(item.title)}</span>
          <svg class="w-5 h-5 text-gray-400 transition-transform chevron" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
        </button>
        <div class="collapse-body">
          <div class="px-5 pb-5 pt-2 border-t border-gray-100">
            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-600 mb-1">Texto</label>
                <textarea id="emr-text-${item.id}" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none transition" placeholder="Digite sua resposta..."></textarea>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-600 mb-1">Link (opcional)</label>
                <input id="emr-link-${item.id}" type="url" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition" placeholder="https://...">
              </div>
              <button onclick="submitEntry('${item.id}')" class="bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition">Enviar</button>
            </div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    loading.textContent = 'Erro ao carregar itens.';
    console.error(err);
  }
}

function toggleCollapse(btn) {
  const body = btn.nextElementSibling;
  const chevron = btn.querySelector('.chevron');
  body.classList.toggle('open');
  chevron.style.transform = body.classList.contains('open') ? 'rotate(180deg)' : '';
}

async function submitEntry(itemId) {
  const text = document.getElementById(`emr-text-${itemId}`).value.trim();
  const link = document.getElementById(`emr-link-${itemId}`).value.trim();
  if (!text && !link) { showToast('Preencha ao menos um campo.', 'error'); return; }
  try {
    await rest('checklist_entries', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ item_id: itemId, entry_text: text || null, entry_link: link || null })
    });
    document.getElementById(`emr-text-${itemId}`).value = '';
    document.getElementById(`emr-link-${itemId}`).value = '';
    showToast('Enviado!');
  } catch (err) {
    showToast('Erro ao enviar.', 'error');
    console.error(err);
  }
}

// --- ADMIN VIEW ---

async function loadAdmin() {
  const container = document.getElementById('admin-items');
  const loading = document.getElementById('admin-loading');
  try {
    const items = await rpc('admin_get_items', { admin_pass: 'admin' });
    loading.classList.add('hidden');
    container.innerHTML = '';
    if (!items || items.length === 0) {
      container.innerHTML = '<p class="text-center text-gray-400 py-8">Nenhum item no checklist.</p>';
      return;
    }
    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'bg-white rounded-xl border border-gray-200 overflow-hidden';
      const entriesHtml = (item.entries && item.entries.length > 0)
        ? item.entries.map(e => `
          <div class="entry-row flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
            <div class="flex-1 min-w-0">
              ${e.entry_text ? `<p class="text-sm text-gray-700">${escapeHtml(e.entry_text)}</p>` : ''}
              ${e.entry_link ? `<a href="${escapeHtml(e.entry_link)}" target="_blank" rel="noopener" class="text-sm text-brand-600 hover:underline break-all">${escapeHtml(e.entry_link)}</a>` : ''}
              <p class="text-xs text-gray-400 mt-0.5">${formatDate(e.created_at)}</p>
            </div>
            <button onclick="adminDeleteEntry('${e.id}')" class="text-gray-300 hover:text-red-500 transition flex-shrink-0 mt-0.5" title="Excluir resposta">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        `).join('')
        : '<p class="text-sm text-gray-400 italic py-2">Nenhuma resposta ainda.</p>';

      card.innerHTML = `
        <div class="px-5 py-4 flex items-center gap-3 border-b border-gray-100">
          <input type="checkbox" ${item.completed ? 'checked' : ''} onchange="adminToggle('${item.id}')"
            class="w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer flex-shrink-0">
          <input type="text" value="${escapeHtml(item.title)}" onblur="adminUpdateTitle('${item.id}', this.value)" onkeydown="if(event.key==='Enter')this.blur()"
            class="flex-1 font-medium text-gray-800 bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-brand-500 focus:ring-0 outline-none px-1 py-0.5 transition ${item.completed ? 'line-through text-gray-400' : ''}">
          <button onclick="adminDeleteItem('${item.id}')" class="text-gray-300 hover:text-red-500 transition flex-shrink-0" title="Excluir item">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
        <div class="px-5 py-3">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Respostas (${item.entries ? item.entries.length : 0})</p>
          ${entriesHtml}
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    loading.textContent = 'Erro ao carregar itens.';
    console.error(err);
  }
}

async function adminToggle(itemId) {
  try {
    await rpc('admin_toggle_item', { admin_pass: 'admin', p_item_id: itemId });
    loadAdmin();
  } catch (err) { showToast('Erro ao atualizar.', 'error'); console.error(err); }
}

async function adminAddItem() {
  const title = prompt('Título do novo item:');
  if (!title || !title.trim()) return;
  try {
    await rpc('admin_create_item', { admin_pass: 'admin', p_title: title.trim(), p_position: 0 });
    showToast('Item adicionado!');
    loadAdmin();
  } catch (err) { showToast('Erro ao adicionar.', 'error'); console.error(err); }
}

async function adminUpdateTitle(itemId, newTitle) {
  if (!newTitle.trim()) return;
  try {
    await rpc('admin_update_item_title', { admin_pass: 'admin', p_item_id: itemId, p_new_title: newTitle.trim() });
  } catch (err) { showToast('Erro ao atualizar título.', 'error'); console.error(err); }
}

async function adminDeleteEntry(entryId) {
  if (!confirm('Excluir esta resposta?')) return;
  try {
    await rpc('admin_delete_entry', { admin_pass: 'admin', p_entry_id: entryId });
    showToast('Resposta excluída.');
    loadAdmin();
  } catch (err) { showToast('Erro ao excluir.', 'error'); console.error(err); }
}

async function adminDeleteItem(itemId) {
  if (!confirm('Excluir este item e todas as suas respostas?')) return;
  try {
    await rpc('admin_delete_item', { admin_pass: 'admin', p_item_id: itemId });
    showToast('Item excluído.');
    loadAdmin();
  } catch (err) { showToast('Erro ao excluir.', 'error'); console.error(err); }
}
