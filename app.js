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

function isSection(title) { return title.startsWith('══'); }
function isEtapa(title) { return title.startsWith('──'); }

function getItemType(title) {
  if (title.startsWith('[!]')) return 'critical';
  if (title.startsWith('[~]')) return 'partial';
  if (title.startsWith('[x]')) return 'done';
  if (title.startsWith('[ ]')) return 'pending';
  return 'pending';
}

function cleanTitle(title) {
  return title.replace(/^\[[\!\~x ]\]\s*/, '').replace(/^═+\s*/, '').replace(/\s*═+$/, '').replace(/^─+\s*/, '').replace(/\s*─+$/, '');
}

function getBadge(type) {
  const map = {
    critical: '<span class="badge-critical inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/20">Crítico</span>',
    partial:  '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/20">Parcial</span>',
    pending:  '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-500/15 text-slate-400 border border-slate-500/20">Pendente</span>',
    done:     '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Recebido</span>'
  };
  return map[type] || map.pending;
}

function getItemNumber(title) {
  const m = title.match(/^(?:\[[\!\~x ]\]\s*)?(\d+\.\d+|[A-D]\.\d+)/);
  return m ? m[1] : null;
}

function showToast(msg, type = 'success') {
  const c = document.getElementById('toast-container');
  const icon = type === 'success'
    ? '<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>'
    : '<svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';
  const bg = type === 'success' ? 'bg-emerald-500/90 border-emerald-400/30' : 'bg-rose-500/90 border-rose-400/30';
  const t = document.createElement('div');
  t.className = `toast flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium text-white ${bg} border backdrop-blur-sm`;
  t.innerHTML = `${icon}<span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 2800);
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

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  const days = Math.floor(hrs / 24);
  return `${days}d atrás`;
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
    const btn = e.target.querySelector('button[type="submit"]');
    btn.style.transform = 'translateX(-4px)';
    setTimeout(() => btn.style.transform = 'translateX(4px)', 80);
    setTimeout(() => btn.style.transform = 'translateX(-2px)', 160);
    setTimeout(() => btn.style.transform = '', 240);
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

// --- Supabase REST ---

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
      container.innerHTML = '<p class="text-center text-slate-500 py-12">Nenhum item no checklist.</p>';
      return;
    }

    const actionableItems = items.filter(i => !isSection(i.title) && !isEtapa(i.title));
    document.getElementById('emr-progress-wrap').classList.remove('hidden');
    document.getElementById('emr-progress-text').textContent = `${actionableItems.length} itens`;

    items.forEach((item, idx) => {
      if (isSection(item.title)) {
        const sec = document.createElement('div');
        const secTitle = cleanTitle(item.title);
        sec.className = 'section-header rounded-xl px-4 sm:px-5 py-3 sm:py-4 mt-6 mb-3 first:mt-0';
        sec.innerHTML = `<h2 class="text-xs sm:text-sm font-bold text-brand-300 uppercase tracking-wider">${escapeHtml(secTitle)}</h2>`;
        container.appendChild(sec);
        return;
      }

      if (isEtapa(item.title)) {
        const et = document.createElement('div');
        const etTitle = cleanTitle(item.title);
        et.className = 'etapa-header rounded-lg px-4 py-2.5 mt-4 mb-2';
        et.innerHTML = `<h3 class="text-xs font-semibold text-sky-300 uppercase tracking-wider">${escapeHtml(etTitle)}</h3>`;
        container.appendChild(et);
        return;
      }

      const type = getItemType(item.title);
      const num = getItemNumber(item.title);
      const title = cleanTitle(item.title);
      const borderClass = type === 'critical' ? 'critical' : type === 'partial' ? 'partial' : 'pending';

      const card = document.createElement('div');
      card.className = `item-card glass-light rounded-xl overflow-hidden ${borderClass}`;
      card.innerHTML = `
        <button onclick="toggleCollapse(this)" class="w-full px-4 sm:px-5 py-3.5 flex items-center gap-3 text-left hover:bg-white/[.03] transition group">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              ${num ? `<span class="text-[11px] font-bold text-slate-500 tabular-nums bg-slate-800/50 px-1.5 py-0.5 rounded">${num}</span>` : ''}
              ${getBadge(type)}
            </div>
            <p class="text-sm text-slate-200 mt-1.5 leading-relaxed">${escapeHtml(title)}</p>
          </div>
          <svg class="w-4 h-4 text-slate-500 transition-transform flex-shrink-0 group-hover:text-slate-300 chevron" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
        </button>
        <div class="collapse-body">
          <div class="px-4 sm:px-5 pb-4 pt-3 border-t border-white/5">
            <div class="space-y-3">
              <div>
                <label class="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Texto da resposta</label>
                <textarea id="emr-text-${item.id}" rows="3" class="input-dark w-full px-3.5 py-2.5 rounded-xl text-sm resize-none" placeholder="Digite sua resposta ou comentário..."></textarea>
              </div>
              <div>
                <label class="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Link ou arquivo <span class="text-slate-600 normal-case">(opcional)</span></label>
                <input id="emr-link-${item.id}" type="url" class="input-dark w-full px-3.5 py-2.5 rounded-xl text-sm" placeholder="https://drive.google.com/...">
              </div>
              <div class="flex justify-end">
                <button onclick="submitEntry('${item.id}', this)" class="btn-submit text-white text-sm font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    loading.innerHTML = '<p class="text-rose-400 text-sm">Erro ao carregar checklist.</p>';
    console.error(err);
  }
}

function toggleCollapse(btn) {
  const body = btn.nextElementSibling;
  const chevron = btn.querySelector('.chevron');
  const isOpen = body.classList.contains('open');

  document.querySelectorAll('.collapse-body.open').forEach(b => {
    if (b !== body) {
      b.classList.remove('open');
      const ch = b.previousElementSibling.querySelector('.chevron');
      if (ch) ch.style.transform = '';
    }
  });

  body.classList.toggle('open');
  chevron.style.transform = body.classList.contains('open') ? 'rotate(180deg)' : '';
}

async function submitEntry(itemId, btn) {
  const text = document.getElementById(`emr-text-${itemId}`).value.trim();
  const link = document.getElementById(`emr-link-${itemId}`).value.trim();
  if (!text && !link) { showToast('Preencha ao menos um campo.', 'error'); return; }

  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg><span>Enviando...</span>';

  try {
    await rest('checklist_entries', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ item_id: itemId, entry_text: text || null, entry_link: link || null })
    });
    document.getElementById(`emr-text-${itemId}`).value = '';
    document.getElementById(`emr-link-${itemId}`).value = '';

    btn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg><span>Enviado!</span>';
    btn.classList.add('!bg-emerald-500');
    showToast('Enviado com sucesso!');

    setTimeout(() => {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
      btn.classList.remove('!bg-emerald-500');
      const body = btn.closest('.collapse-body');
      if (body) {
        body.classList.remove('open');
        const chevron = body.previousElementSibling?.querySelector('.chevron');
        if (chevron) chevron.style.transform = '';
      }
    }, 1500);
  } catch (err) {
    showToast('Erro ao enviar. Tente novamente.', 'error');
    btn.innerHTML = originalHtml;
    btn.disabled = false;
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
      container.innerHTML = '<p class="text-center text-slate-500 py-12">Nenhum item no checklist.</p>';
      return;
    }

    let doneCount = 0, pendingCount = 0;
    items.forEach(item => {
      if (!isSection(item.title) && !isEtapa(item.title)) {
        if (item.completed) doneCount++; else pendingCount++;
      }
    });
    document.getElementById('admin-stats').classList.remove('hidden');
    document.getElementById('admin-stat-done').textContent = `${doneCount} concluídos`;
    document.getElementById('admin-stat-pending').textContent = `${pendingCount} pendentes`;

    items.forEach(item => {
      if (isSection(item.title)) {
        const sec = document.createElement('div');
        sec.className = 'section-header rounded-xl px-4 sm:px-5 py-3 sm:py-4 mt-6 mb-3 first:mt-0';
        sec.innerHTML = `
          <div class="flex items-center justify-between">
            <h2 class="text-xs sm:text-sm font-bold text-brand-300 uppercase tracking-wider">${escapeHtml(cleanTitle(item.title))}</h2>
            <button onclick="adminDeleteItem('${item.id}')" class="text-slate-600 hover:text-rose-400 transition p-1 rounded" title="Excluir seção">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>`;
        container.appendChild(sec);
        return;
      }

      if (isEtapa(item.title)) {
        const et = document.createElement('div');
        et.className = 'etapa-header rounded-lg px-4 py-2.5 mt-4 mb-2';
        et.innerHTML = `
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-semibold text-sky-300 uppercase tracking-wider">${escapeHtml(cleanTitle(item.title))}</h3>
            <button onclick="adminDeleteItem('${item.id}')" class="text-slate-600 hover:text-rose-400 transition p-1 rounded" title="Excluir etapa">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>`;
        container.appendChild(et);
        return;
      }

      const type = getItemType(item.title);
      const num = getItemNumber(item.title);
      const title = cleanTitle(item.title);
      const borderClass = item.completed ? '' : type === 'critical' ? 'critical' : type === 'partial' ? 'partial' : 'pending';
      const entryCount = item.entries ? item.entries.length : 0;

      const entriesHtml = (item.entries && item.entries.length > 0)
        ? item.entries.map(e => `
          <div class="entry-hover entry-row flex items-start gap-3 py-3 border-b border-white/5 last:border-0 group">
            <div class="flex-1 min-w-0">
              ${e.entry_text ? `<p class="text-sm text-slate-300 leading-relaxed">${escapeHtml(e.entry_text)}</p>` : ''}
              ${e.entry_link ? `<a href="${escapeHtml(e.entry_link)}" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-sm text-brand-400 hover:text-brand-300 transition break-all mt-1">
                <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                ${escapeHtml(e.entry_link)}
              </a>` : ''}
              <div class="flex items-center gap-2 mt-1.5">
                <span class="text-[11px] text-slate-500">${formatDate(e.created_at)}</span>
                <span class="text-[11px] text-slate-600">·</span>
                <span class="text-[11px] text-slate-600">${timeAgo(e.created_at)}</span>
              </div>
            </div>
            <button onclick="adminDeleteEntry('${e.id}')" class="btn-delete text-slate-600 hover:text-rose-400 transition flex-shrink-0 p-1 rounded hover:bg-rose-500/10" title="Excluir resposta">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        `).join('')
        : '<p class="text-sm text-slate-600 italic py-3">Nenhuma resposta ainda.</p>';

      const card = document.createElement('div');
      card.className = `item-card glass-light rounded-xl overflow-hidden ${borderClass} ${item.completed ? 'opacity-60' : ''}`;
      card.innerHTML = `
        <div class="px-4 sm:px-5 py-3.5 flex items-start gap-3">
          <input type="checkbox" ${item.completed ? 'checked' : ''} onchange="adminToggle('${item.id}')" class="custom-check mt-0.5">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap mb-1">
              ${num ? `<span class="text-[11px] font-bold text-slate-500 tabular-nums bg-slate-800/50 px-1.5 py-0.5 rounded">${num}</span>` : ''}
              ${!item.completed ? getBadge(type) : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Concluído</span>'}
              ${entryCount > 0 ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/15">${entryCount} resposta${entryCount > 1 ? 's' : ''}</span>` : ''}
            </div>
            <input type="text" value="${escapeHtml(title)}" onblur="adminUpdateTitle('${item.id}', this.value, '${escapeHtml(item.title)}')" onkeydown="if(event.key==='Enter')this.blur()"
              class="admin-title w-full text-sm text-slate-200 px-0 py-0.5 ${item.completed ? 'line-through text-slate-500' : ''}">
          </div>
          <button onclick="adminDeleteItem('${item.id}')" class="text-slate-600 hover:text-rose-400 transition flex-shrink-0 p-1 rounded hover:bg-rose-500/10 mt-0.5" title="Excluir item">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
        ${entryCount > 0 ? `
        <div class="px-4 sm:px-5 pb-3 pt-0">
          <div class="border-t border-white/5 pt-3">
            <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Respostas</p>
            ${entriesHtml}
          </div>
        </div>` : ''}
      `;
      container.appendChild(card);
    });
  } catch (err) {
    loading.innerHTML = '<p class="text-rose-400 text-sm">Erro ao carregar painel.</p>';
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
    await rpc('admin_create_item', { admin_pass: 'admin', p_title: title.trim(), p_position: 999 });
    showToast('Item adicionado!');
    loadAdmin();
  } catch (err) { showToast('Erro ao adicionar.', 'error'); console.error(err); }
}

async function adminUpdateTitle(itemId, newTitle, originalRaw) {
  if (!newTitle.trim()) return;
  const prefix = originalRaw.match(/^\[[\!\~x ]\]\s*/)?.[0] || '';
  const fullTitle = prefix + newTitle.trim();
  try {
    await rpc('admin_update_item_title', { admin_pass: 'admin', p_item_id: itemId, p_new_title: fullTitle });
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
