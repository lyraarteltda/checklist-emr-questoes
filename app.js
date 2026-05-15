const SUPABASE_URL = 'https://arsfqjhvgphsglouwdsn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyc2Zxamh2Z3Boc2dsb3V3ZHNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNjA3MDAsImV4cCI6MjA3MTczNjcwMH0.WvzZ9m2tyxT0XgnWOpOFGop8gMk7fgLVwFSIaNiH62Q';

const USERS = { emr: { pass: 'emr', role: 'emr' }, admin: { pass: 'admin', role: 'admin' } };
let currentUser = null;

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json'
};

// ── Helpers ──

function isSection(t) { return t.trim().startsWith('══') || t.trim().startsWith('=='); }
function isEtapa(t) { return t.trim().startsWith('──') || t.trim().startsWith('--'); }
function isHeader(t) { return isSection(t) || isEtapa(t); }

function getStatus(t) {
  if (t.startsWith('[!]')) return 'critical';
  if (t.startsWith('[~]')) return 'partial';
  if (t.startsWith('[x]')) return 'done';
  return 'pending';
}

function cleanTitle(t) {
  return t
    .replace(/^\[[\!\~x ]\]\s*/, '')
    .replace(/^═+\s*/, '').replace(/\s*═+$/, '')
    .replace(/^─+\s*/, '').replace(/\s*─+$/, '')
    .replace(/^==+\s*/, '').replace(/\s*==+$/, '')
    .replace(/^--+\s*/, '').replace(/\s*--+$/, '')
    .trim();
}

function getItemNum(t) {
  const m = t.match(/(?:\[[\!\~x ]\]\s*)?(\d+\.\d+|[A-D]\.\d+)/);
  return m ? m[1] : null;
}

function getSectionNum(t) {
  const m = t.match(/SEÇÃO\s*(\d+)/i);
  return m ? m[1] : null;
}

function getEtapaLabel(t) {
  const m = t.match(/Etapa\s+([A-D])/i);
  return m ? m[1] : null;
}

function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return m + 'min';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h';
  return Math.floor(h / 24) + 'd';
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
}

function badgeHtml(status) {
  const map = {
    critical: '<span class="badge badge-critical"><span class="pulse-dot">●</span> Critico</span>',
    partial:  '<span class="badge badge-partial">◐ Parcial</span>',
    pending:  '<span class="badge badge-pending">○ Pendente</span>',
    done:     '<span class="badge badge-done">✓ Concluido</span>'
  };
  return map[status] || map.pending;
}

// ── Toast ──

function toast(msg, type = 'success') {
  const c = document.getElementById('toast-container');
  const colors = type === 'success'
    ? 'background:rgba(16,185,129,.92);border:1px solid rgba(52,211,153,.3);'
    : 'background:rgba(239,68,68,.92);border:1px solid rgba(252,165,165,.3);';
  const icon = type === 'success'
    ? '<svg width="16" height="16" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>'
    : '<svg width="16" height="16" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';
  const el = document.createElement('div');
  el.className = 'toast-item pointer-events-auto';
  el.style.cssText = `${colors}color:white;font-size:13px;font-weight:500;padding:10px 16px;border-radius:12px;display:flex;align-items:center;gap:8px;box-shadow:0 8px 30px rgba(0,0,0,.3);backdrop-filter:blur(8px);`;
  el.innerHTML = `${icon}<span>${msg}</span>`;
  c.appendChild(el);
  setTimeout(() => { el.classList.add('removing'); setTimeout(() => el.remove(), 300); }, 2500);
}

// ── Auth ──

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
    const card = document.querySelector('.login-card');
    card.style.animation = 'none';
    card.offsetHeight;
    card.style.animation = 'shake .4s ease';
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

// ── Supabase ──

async function rest(path, opts = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { ...headers, ...opts.headers },
    method: opts.method || 'GET',
    body: opts.body
  });
  if (!r.ok) throw new Error(await r.text());
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

async function rpc(fn, params = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers, body: JSON.stringify(params)
  });
  if (!r.ok) throw new Error(await r.text());
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

// ── EMR VIEW ──

async function loadEmr() {
  const container = document.getElementById('emr-items');
  const loading = document.getElementById('emr-loading');

  try {
    const items = await rpc('get_items_with_counts');
    loading.style.display = 'none';
    container.innerHTML = '';

    if (!items || !items.length) {
      container.innerHTML = '<p style="text-align:center;color:#64748b;padding:60px 0;">Nenhum item no checklist.</p>';
      return;
    }

    const actionable = items.filter(i => !isHeader(i.title));
    const checkedCount = actionable.filter(i => i.completed || i.entry_count > 0).length;
    const prog = document.getElementById('emr-progress');
    prog.classList.remove('hidden');
    prog.classList.add('flex');
    document.getElementById('emr-progress-text').textContent = checkedCount + ' / ' + actionable.length + ' itens';

    let html = '';
    items.forEach((item) => {
      const title = item.title.trim();

      if (isSection(title)) {
        const clean = cleanTitle(title);
        const num = getSectionNum(title);
        html += `
          <div class="section-divider rounded-xl px-4 sm:px-5 py-3 sm:py-4 mt-8 mb-3" style="margin-top:${html ? '32px' : '0'}">
            <div class="flex items-center gap-2.5">
              ${num ? `<span style="font-size:11px;font-weight:800;color:rgba(167,139,250,.6);background:rgba(124,58,237,.12);padding:2px 8px;border-radius:6px;letter-spacing:.05em;">S${num}</span>` : ''}
              <h2 style="font-size:12px;font-weight:700;color:#a78bfa;text-transform:uppercase;letter-spacing:.06em;line-height:1.4;">${escHtml(clean)}</h2>
            </div>
          </div>`;
        return;
      }

      if (isEtapa(title)) {
        const clean = cleanTitle(title);
        const label = getEtapaLabel(title);
        html += `
          <div class="etapa-divider rounded-lg px-4 py-2.5 mt-5 mb-2">
            <div class="flex items-center gap-2">
              ${label ? `<span style="font-size:10px;font-weight:800;color:rgba(56,189,248,.7);background:rgba(56,189,248,.1);padding:2px 7px;border-radius:5px;letter-spacing:.04em;">Etapa ${label}</span>` : ''}
              <h3 style="font-size:11px;font-weight:600;color:#7dd3fc;text-transform:uppercase;letter-spacing:.05em;">${escHtml(clean)}</h3>
            </div>
          </div>`;
        return;
      }

      const status = getStatus(title);
      const num = getItemNum(title);
      const clean = cleanTitle(title);
      const id = item.id;
      const hasEntries = item.entry_count > 0;
      const isChecked = item.completed || hasEntries;
      const displayStatus = isChecked ? 'done' : status;
      const completedClass = isChecked ? 'item-completed' : '';

      html += `
        <div class="item-card status-${displayStatus} ${completedClass} rounded-xl mb-2 overflow-hidden">
          <div class="w-full px-4 sm:px-5 py-3 flex items-start gap-3" style="background:transparent;">
            <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="emrToggleItem('${id}')" class="check-box" style="margin-top:2px;flex-shrink:0;">
            <button onclick="emrToggle(this)" class="flex items-start gap-3 text-left transition-colors" style="background:transparent;border:none;cursor:pointer;flex:1;min-width:0;padding:0;">
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;">
                  ${num ? `<span class="badge-num">${num}</span>` : ''}
                  ${badgeHtml(displayStatus)}
                  ${hasEntries ? `<span class="badge badge-count">${item.entry_count} enviado${item.entry_count > 1 ? 's' : ''}</span>` : ''}
                </div>
                <p style="font-size:13px;color:#cbd5e1;line-height:1.55;margin:0;">${escHtml(clean)}</p>
              </div>
              <svg class="chevron-icon" style="flex-shrink:0;margin-top:2px;" width="16" height="16" fill="none" stroke="#475569" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
            </button>
          </div>
          <div class="collapse-content">
            <div class="collapse-inner">
              <div style="padding:0 16px 16px;border-top:1px solid rgba(255,255,255,.04);" class="sm:px-5">
                <div style="padding-top:12px;">
                  <label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;">Texto da resposta</label>
                  <textarea id="txt-${id}" rows="3" class="input-field" style="width:100%;padding:10px 14px;border-radius:12px;resize:none;" placeholder="Digite sua resposta ou comentario..."></textarea>
                  <label style="display:block;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;margin-top:10px;">Link <span style="color:#475569;text-transform:none;font-weight:400;">(opcional)</span></label>
                  <input id="lnk-${id}" type="url" class="input-field" style="width:100%;padding:10px 14px;border-radius:12px;" placeholder="https://drive.google.com/...">
                  <div style="display:flex;justify-content:flex-end;margin-top:12px;">
                    <button onclick="submitEntry('${id}',this)" class="btn-primary" style="color:white;font-size:13px;font-weight:600;padding:10px 20px;border-radius:12px;border:none;cursor:pointer;display:flex;align-items:center;gap:6px;">
                      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                      Enviar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>`;
    });

    container.innerHTML = html;
  } catch (err) {
    loading.innerHTML = '<p style="color:#f87171;text-align:center;padding:40px 0;">Erro ao carregar checklist.</p>';
    console.error(err);
  }
}

async function emrToggleItem(id) {
  try {
    await rpc('toggle_item', { p_item_id: id });
    loadEmr();
  } catch (err) { toast('Erro ao atualizar.', 'error'); console.error(err); }
}

function emrToggle(btn) {
  const card = btn.closest('.item-card');
  const body = card.querySelector('.collapse-content');
  const chev = btn.querySelector('.chevron-icon');
  const wasOpen = body.classList.contains('open');

  document.querySelectorAll('#emr-items .collapse-content.open').forEach(el => {
    if (el !== body) {
      el.classList.remove('open');
      const c = el.closest('.item-card')?.querySelector('.chevron-icon');
      if (c) c.classList.remove('rotated');
    }
  });

  body.classList.toggle('open', !wasOpen);
  chev.classList.toggle('rotated', !wasOpen);
}

async function submitEntry(itemId, btn) {
  const txt = document.getElementById('txt-' + itemId)?.value.trim();
  const lnk = document.getElementById('lnk-' + itemId)?.value.trim();
  if (!txt && !lnk) { toast('Preencha ao menos um campo.', 'error'); return; }

  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<svg width="16" height="16" fill="none" viewBox="0 0 24 24" style="animation:spin 1s linear infinite"><circle opacity=".25" cx="12" cy="12" r="10" stroke="white" stroke-width="4"/><path opacity=".75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Enviando...';

  try {
    await rest('checklist_entries', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ item_id: itemId, entry_text: txt || null, entry_link: lnk || null })
    });

    document.getElementById('txt-' + itemId).value = '';
    document.getElementById('lnk-' + itemId).value = '';

    btn.innerHTML = '<svg width="16" height="16" fill="none" stroke="white" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> Enviado!';
    btn.style.background = 'linear-gradient(135deg,#10b981,#059669)';
    btn.style.boxShadow = '0 2px 16px rgba(16,185,129,.3)';
    toast('Enviado com sucesso!');

    setTimeout(() => { loadEmr(); }, 1200);
  } catch (err) {
    toast('Erro ao enviar.', 'error');
    btn.innerHTML = origHtml;
    btn.disabled = false;
    console.error(err);
  }
}

// ── ADMIN VIEW ──

async function loadAdmin() {
  const container = document.getElementById('admin-items');
  const loading = document.getElementById('admin-loading');

  try {
    const items = await rpc('admin_get_items', { admin_pass: 'admin' });
    loading.style.display = 'none';
    container.innerHTML = '';

    if (!items || !items.length) {
      container.innerHTML = '<p style="text-align:center;color:#64748b;padding:60px 0;">Nenhum item.</p>';
      return;
    }

    let done = 0, crit = 0, pend = 0;
    items.forEach(i => {
      if (!isHeader(i.title)) {
        if (i.completed) done++;
        else if (getStatus(i.title) === 'critical') crit++;
        else pend++;
      }
    });

    document.getElementById('admin-stats').classList.remove('hidden');
    document.getElementById('admin-stats').classList.add('flex');
    document.getElementById('stat-done').textContent = done + ' ok';
    document.getElementById('stat-critical').textContent = crit + ' crit';
    document.getElementById('stat-pending').textContent = pend + ' pend';

    let html = '';
    items.forEach(item => {
      const title = item.title.trim();

      if (isSection(title)) {
        const clean = cleanTitle(title);
        const num = getSectionNum(title);
        html += `
          <div class="section-divider rounded-xl px-4 sm:px-5 py-3 sm:py-4 mt-8 mb-3" style="${html ? '' : 'margin-top:0;'}">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:8px;">
                ${num ? `<span style="font-size:11px;font-weight:800;color:rgba(167,139,250,.6);background:rgba(124,58,237,.12);padding:2px 8px;border-radius:6px;">S${num}</span>` : ''}
                <h2 style="font-size:12px;font-weight:700;color:#a78bfa;text-transform:uppercase;letter-spacing:.06em;">${escHtml(clean)}</h2>
              </div>
              <button onclick="adminDeleteItem('${item.id}')" style="background:none;border:none;cursor:pointer;color:#475569;padding:4px;border-radius:6px;" title="Excluir">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          </div>`;
        return;
      }

      if (isEtapa(title)) {
        const clean = cleanTitle(title);
        const label = getEtapaLabel(title);
        html += `
          <div class="etapa-divider rounded-lg px-4 py-2.5 mt-5 mb-2">
            <div style="display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:6px;">
                ${label ? `<span style="font-size:10px;font-weight:800;color:rgba(56,189,248,.7);background:rgba(56,189,248,.1);padding:2px 7px;border-radius:5px;">Etapa ${label}</span>` : ''}
                <h3 style="font-size:11px;font-weight:600;color:#7dd3fc;text-transform:uppercase;letter-spacing:.05em;">${escHtml(clean)}</h3>
              </div>
              <button onclick="adminDeleteItem('${item.id}')" style="background:none;border:none;cursor:pointer;color:#475569;padding:4px;border-radius:6px;" title="Excluir">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          </div>`;
        return;
      }

      const status = getStatus(title);
      const num = getItemNum(title);
      const clean = cleanTitle(title);
      const entryCount = item.entries ? item.entries.length : 0;
      const completedClass = item.completed ? 'item-completed' : '';
      const displayStatus = item.completed ? 'done' : status;

      let entriesBlock = '';
      if (entryCount > 0) {
        const entriesInner = item.entries.map(e => `
          <div class="entry-item group" style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.03);">
            <div style="flex:1;min-width:0;">
              ${e.entry_text ? `<p style="font-size:13px;color:#94a3b8;line-height:1.5;margin:0;">${escHtml(e.entry_text)}</p>` : ''}
              ${e.entry_link ? `<a href="${escHtml(e.entry_link)}" target="_blank" rel="noopener" style="font-size:12px;color:#a78bfa;text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-top:3px;word-break:break-all;">
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                ${escHtml(e.entry_link.length > 50 ? e.entry_link.slice(0, 50) + '...' : e.entry_link)}
              </a>` : ''}
              <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
                <span style="font-size:10px;color:#475569;">${fmtDate(e.created_at)}</span>
                <span style="font-size:10px;color:#334155;">·</span>
                <span style="font-size:10px;color:#334155;">${timeAgo(e.created_at)}</span>
              </div>
            </div>
            <button onclick="adminDeleteEntry('${e.id}')" class="reveal-on-hover" style="background:none;border:none;cursor:pointer;color:#475569;padding:4px;border-radius:6px;flex-shrink:0;" title="Excluir resposta">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        `).join('');

        entriesBlock = `
          <div style="padding:0 16px 12px;border-top:1px solid rgba(255,255,255,.04);" class="sm:px-5">
            <div style="padding-top:8px;">
              <p style="font-size:10px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.05em;margin:0 0 4px;">Respostas (${entryCount})</p>
              ${entriesInner}
            </div>
          </div>`;
      }

      html += `
        <div class="item-card status-${displayStatus} ${completedClass} rounded-xl mb-2 overflow-hidden">
          <div style="padding:12px 16px;display:flex;align-items:flex-start;gap:10px;" class="sm:px-5">
            <input type="checkbox" ${item.completed ? 'checked' : ''} onchange="adminToggle('${item.id}')" class="check-box" style="margin-top:1px;">
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:4px;">
                ${num ? `<span class="badge-num">${num}</span>` : ''}
                ${badgeHtml(displayStatus)}
                ${entryCount > 0 ? `<span class="badge badge-count">${entryCount} resposta${entryCount > 1 ? 's' : ''}</span>` : ''}
              </div>
              <input type="text" value="${escHtml(clean)}" onblur="adminUpdateTitle('${item.id}',this.value,'${escHtml(item.title).replace(/'/g, "\\'")}')" onkeydown="if(event.key==='Enter')this.blur()"
                class="title-edit item-title" style="width:100%;font-size:13px;color:#cbd5e1;line-height:1.5;">
            </div>
            <button onclick="adminDeleteItem('${item.id}')" style="background:none;border:none;cursor:pointer;color:#475569;padding:4px;border-radius:6px;flex-shrink:0;" title="Excluir item">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
          ${entriesBlock}
        </div>`;
    });

    container.innerHTML = html;
  } catch (err) {
    loading.innerHTML = '<p style="color:#f87171;text-align:center;">Erro ao carregar painel.</p>';
    console.error(err);
  }
}

async function adminToggle(id) {
  try {
    await rpc('admin_toggle_item', { admin_pass: 'admin', p_item_id: id });
    loadAdmin();
  } catch (err) { toast('Erro ao atualizar.', 'error'); console.error(err); }
}

async function adminAddItem() {
  const title = prompt('Titulo do novo item:');
  if (!title || !title.trim()) return;
  try {
    await rpc('admin_create_item', { admin_pass: 'admin', p_title: title.trim(), p_position: 999 });
    toast('Item adicionado!');
    loadAdmin();
  } catch (err) { toast('Erro ao adicionar.', 'error'); console.error(err); }
}

async function adminUpdateTitle(id, newTitle, origRaw) {
  if (!newTitle.trim()) return;
  const prefix = origRaw.match(/^\[[\!\~x ]\]\s*/)?.[0] || '';
  const full = prefix + newTitle.trim();
  try {
    await rpc('admin_update_item_title', { admin_pass: 'admin', p_item_id: id, p_new_title: full });
  } catch (err) { toast('Erro ao atualizar titulo.', 'error'); console.error(err); }
}

async function adminDeleteEntry(id) {
  if (!confirm('Excluir esta resposta?')) return;
  try {
    await rpc('admin_delete_entry', { admin_pass: 'admin', p_entry_id: id });
    toast('Resposta excluida.');
    loadAdmin();
  } catch (err) { toast('Erro ao excluir.', 'error'); console.error(err); }
}

async function adminDeleteItem(id) {
  if (!confirm('Excluir este item e todas as suas respostas?')) return;
  try {
    await rpc('admin_delete_item', { admin_pass: 'admin', p_item_id: id });
    toast('Item excluido.');
    loadAdmin();
  } catch (err) { toast('Erro ao excluir.', 'error'); console.error(err); }
}

// ── CSS animation keyframe for spinner ──
const styleEl = document.createElement('style');
styleEl.textContent = '@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}';
document.head.appendChild(styleEl);
