let receiverUser = null;
let currentCall = null;
let receiverView = 'auth'; // auth | home | contacts | admin | log
let authTab = 'signup';

async function api(path, method = 'GET', body) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  return res.json();
}

/* ---------------- CALLER PHONE ---------------- */

function renderCallerDial() {
  document.getElementById('caller-body').innerHTML = `
    <p class="muted small">Nömrənizi yazıb zəng edin:</p>
    <input id="caller-number" placeholder="Sizin nömrəniz (+994...)">
    <button class="primary" onclick="startCall()">📞 Zəng et</button>
    <div class="hint">İpucu: <code>+994125551234</code> (təsdiqlənmiş bank), <code>+994505550000</code> (təsdiqlənməmiş), ya da ixtiyari naməlum nömrə sınayın.</div>
  `;
}

async function startCall() {
  if (!receiverUser) {
    alert('Əvvəlcə sağdaki telefonda "Zəng qəbul edən" kimi qeydiyyatdan keçin / daxil olun.');
    return;
  }
  const fromNumber = document.getElementById('caller-number').value.trim();
  if (!fromNumber) return;

  const data = await api('/api/call/incoming', 'POST', { receiverUserId: receiverUser.id, fromNumber });
  currentCall = { callId: data.callId, fromNumber };

  if (data.stage === 'contact_known') {
    renderCallerCallingKnown();
    renderReceiverRingingKnown(data.message);
  } else {
    renderCallerIvrPrompt(data.callerPrompt);
    renderReceiverRingingUnknown();
  }
}

function renderCallerCallingKnown() {
  document.getElementById('caller-body').innerHTML = `
    <div class="ring-wrap">
      <div class="avatar">📞</div>
      <div class="call-number">${currentCall.fromNumber}</div>
      <div class="call-sub">Zəng edilir, cavab gözlənilir...</div>
      <div class="call-actions"><button class="reject" onclick="resetAll()">Zəngi bitir</button></div>
    </div>
  `;
}

function renderCallerIvrPrompt(prompt) {
  document.getElementById('caller-body').innerHTML = `
    <div class="ring-wrap" style="justify-content:flex-start;">
      <div class="avatar">🤖</div>
      <div class="call-sub">Avtomatik səsli sistem (IVR):</div>
      <div class="call-prompt-box">
        <p>${prompt.text}</p>
        <button class="secondary" onclick="callerLeaveVoicemail()">${prompt.options[0].label}</button>
        <input id="token-input" placeholder="Tokeni daxil edin">
        <button class="primary" onclick="callerSubmitToken()">${prompt.options[1].label}</button>
      </div>
    </div>
  `;
}

async function callerLeaveVoicemail() {
  const message = prompt('Səsli mesajınızı yazın:') || '(boş mesaj)';
  const data = await api('/api/call/voicemail', 'POST', {
    callId: currentCall.callId,
    fromNumber: currentCall.fromNumber,
    receiverUserId: receiverUser.id,
    message
  });
  renderCallerDone('Səsli mesaj buraxıldı. Zəng bitdi.');
  renderReceiverNotification(data.receiverNotification, 'warn');
}

async function callerSubmitToken() {
  const token = document.getElementById('token-input').value.trim();
  const data = await api('/api/call/submit-token', 'POST', {
    callId: currentCall.callId,
    fromNumber: currentCall.fromNumber,
    token
  });
  const ok = data.stage === 'verified';
  renderCallerDone(ok ? 'Token təsdiqləndi. Zəng bağlandı.' : 'Token rədd edildi. Zəng bağlandı.');
  renderReceiverNotification(data.receiverNotification, ok ? 'ok' : 'warn');
}

function renderCallerDone(text) {
  document.getElementById('caller-body').innerHTML = `
    <div class="ring-wrap">
      <div class="avatar">✅</div>
      <div class="call-sub">${text}</div>
      <div class="call-actions"><button class="primary" onclick="resetAll()">Yeni zəng</button></div>
    </div>
  `;
}

function resetAll() {
  currentCall = null;
  renderCallerDial();
  receiverView = 'home';
  renderReceiver();
}

/* ---------------- RECEIVER PHONE ---------------- */

function setReceiverStatusBar(text) {
  document.getElementById('receiver-statusbar').textContent = text;
}

function renderReceiver() {
  if (receiverView === 'auth') return renderReceiverAuth();
  if (receiverView === 'home') return renderReceiverHome();
  if (receiverView === 'contacts') return renderReceiverContacts();
  if (receiverView === 'admin') return renderReceiverAdmin();
  if (receiverView === 'log') return renderReceiverLog();
}

function renderReceiverAuth() {
  setReceiverStatusBar('Giriş');
  document.getElementById('receiver-body').innerHTML = `
    <div class="tabs">
      <button class="tab ${authTab === 'signup' ? 'active' : ''}" onclick="setAuthTab('signup')">Qeydiyyat</button>
      <button class="tab ${authTab === 'login' ? 'active' : ''}" onclick="setAuthTab('login')">Giriş</button>
    </div>
    <div id="auth-pane"></div>
  `;
  renderAuthPane();
}

function setAuthTab(tab) {
  authTab = tab;
  renderReceiverAuth();
}

function renderAuthPane() {
  const pane = document.getElementById('auth-pane');
  if (authTab === 'signup') {
    pane.innerHTML = `
      <select id="signup-type" onchange="document.getElementById('business-fields').classList.toggle('hidden', this.value !== 'business')">
        <option value="standard">Vətəndaş</option>
        <option value="business">Şirkət / Qurum</option>
      </select>
      <input id="signup-name" placeholder="Ad Soyad">
      <input id="signup-phone" placeholder="Telefon (+994...)">
      <div id="business-fields" class="hidden">
        <input id="signup-bizname" placeholder="Şirkət/Qurum adı">
        <input id="signup-biztype" placeholder="Tip (Bank, Dövlət qurumu...)">
      </div>
      <button class="primary" onclick="signup()">Qeydiyyatdan keç</button>
      <div id="signup-result" class="hint"></div>
    `;
  } else {
    pane.innerHTML = `
      <input id="login-phone" placeholder="Qeydiyyatlı telefon">
      <button class="primary" onclick="login()">Daxil ol</button>
      <div id="login-result" class="hint"></div>
    `;
  }
}

async function signup() {
  const type = document.getElementById('signup-type').value;
  const name = document.getElementById('signup-name').value;
  const phone = document.getElementById('signup-phone').value;
  const businessName = document.getElementById('signup-bizname')?.value;
  const businessType = document.getElementById('signup-biztype')?.value;
  if (!name || !phone) return;
  const data = await api('/api/auth/signup', 'POST', { type, name, phone, businessName, businessType });
  document.getElementById('signup-result').textContent = data.message || (data.user ? 'Qeydiyyat tamamlandı. İndi "Giriş" tabından daxil olun.' : (data.error || ''));
}

async function login() {
  const phone = document.getElementById('login-phone').value;
  const data = await api('/api/auth/login', 'POST', { phone });
  if (data.user) {
    receiverUser = data.user;
    receiverView = 'home';
    renderReceiver();
  } else {
    document.getElementById('login-result').textContent = data.error || 'Xəta baş verdi';
  }
}

function renderReceiverHome() {
  setReceiverStatusBar('Ana səhifə');
  document.getElementById('receiver-body').innerHTML = `
    <p class="muted small">Daxil olunub: <strong>${receiverUser.name}</strong> (${receiverUser.type === 'business' ? 'Şirkət' : 'Vətəndaş'})</p>
    <p class="muted small">📶 Zəngə hazır — soldaki telefondan zəng edin.</p>
    <div class="menu-item" onclick="receiverView='contacts'; renderReceiver();"><span>👤 Kontaktlar</span><span class="chev">›</span></div>
    <div class="menu-item" onclick="receiverView='admin'; renderReceiver();"><span>🛂 Qurum təsdiqi (admin)</span><span class="chev">›</span></div>
    <div class="menu-item" onclick="receiverView='log'; renderReceiver();"><span>🧾 Zəng tarixçəsi</span><span class="chev">›</span></div>
    <button class="link" onclick="logout()">Çıxış</button>
  `;
}

function logout() {
  receiverUser = null;
  receiverView = 'auth';
  authTab = 'login';
  renderReceiver();
}

async function renderReceiverContacts() {
  setReceiverStatusBar('Kontaktlar');
  const body = document.getElementById('receiver-body');
  body.innerHTML = `
    <button class="link" onclick="receiverView='home'; renderReceiver();">‹ Geri</button>
    <input id="contact-name" placeholder="Kontakt adı">
    <input id="contact-phone" placeholder="Kontakt nömrəsi">
    <button class="primary" onclick="addContact()">Əlavə et</button>
    <div id="contacts-list" class="list"></div>
  `;
  refreshContacts();
}

async function addContact() {
  const contactName = document.getElementById('contact-name').value;
  const contactPhone = document.getElementById('contact-phone').value;
  if (!contactName || !contactPhone) return;
  await api('/api/contacts/add', 'POST', { userId: receiverUser.id, contactName, contactPhone });
  document.getElementById('contact-name').value = '';
  document.getElementById('contact-phone').value = '';
  refreshContacts();
}

async function refreshContacts() {
  const data = await api(`/api/contacts/${receiverUser.id}`);
  const el = document.getElementById('contacts-list');
  if (!el) return;
  el.innerHTML = data.contacts.map(c => `
    <div class="list-item"><div class="title">${c.name}</div><div class="sub">${c.phone}</div></div>
  `).join('') || '<p class="muted small">Kontakt yoxdur.</p>';
}

async function renderReceiverAdmin() {
  setReceiverStatusBar('Qurum təsdiqi');
  document.getElementById('receiver-body').innerHTML = `
    <button class="link" onclick="receiverView='home'; renderReceiver();">‹ Geri</button>
    <p class="muted small">Hakaton ekspert/admin panelinin simulyasiyası.</p>
    <div id="business-list" class="list"></div>
  `;
  loadBusinesses();
}

async function loadBusinesses() {
  const list = await api('/api/admin/businesses');
  const el = document.getElementById('business-list');
  if (!el) return;
  el.innerHTML = list.map(b => `
    <div class="list-item">
      <div class="title">${b.name}</div>
      <div class="sub">${b.type} · ${b.phone}</div>
      <div class="sub">Token: ${b.token || '—'}</div>
      <span class="badge ${b.status === 'approved' ? 'approved' : 'pending'}">${b.status === 'approved' ? 'Təsdiqlənib' : 'Gözləyir'}</span>
      ${b.status !== 'approved' ? `<button class="secondary" onclick="approveBusiness('${b.id}')">Təsdiqlə</button>` : ''}
    </div>
  `).join('') || '<p class="muted small">Hələ heç bir qurum yoxdur.</p>';
}

async function approveBusiness(id) {
  await api('/api/admin/approve', 'POST', { id });
  loadBusinesses();
}

async function renderReceiverLog() {
  setReceiverStatusBar('Zəng tarixçəsi');
  document.getElementById('receiver-body').innerHTML = `
    <button class="link" onclick="receiverView='home'; renderReceiver();">‹ Geri</button>
    <button class="secondary" onclick="loadLog()">Yenilə</button>
    <div id="call-log" class="list"></div>
  `;
  loadLog();
}

async function loadLog() {
  const data = await api('/api/call/log');
  const el = document.getElementById('call-log');
  if (!el) return;
  el.innerHTML = data.callLog.slice().reverse().map(c => `
    <div class="list-item">
      <div class="title">${c.fromNumber}</div>
      <div class="sub">Status: ${c.stage}</div>
      ${c.voicemail ? `<div class="sub">🎙 ${c.voicemail}</div>` : ''}
    </div>
  `).join('') || '<p class="muted small">Tarixçə boşdur.</p>';
}

/* ---- receiver call-state screens (triggered by caller phone) ---- */

function renderReceiverRingingKnown(message) {
  setReceiverStatusBar('Gələn zəng');
  document.getElementById('receiver-body').innerHTML = `
    <div class="ring-wrap">
      <div class="avatar">📱</div>
      <div class="call-number">${currentCall.fromNumber}</div>
      <div class="call-sub">${message}</div>
      <div class="call-actions">
        <button class="reject" onclick="receiverRejectKnown()">Rədd et</button>
        <button class="accept" onclick="receiverAcceptKnown()">Qəbul et</button>
      </div>
    </div>
  `;
}

function receiverAcceptKnown() {
  document.getElementById('receiver-body').innerHTML = `
    <div class="ring-wrap">
      <div class="notif ok"><span class="title">Zəng qəbul edildi</span>Söhbət davam edir...</div>
      <div class="call-actions"><button class="reject" onclick="resetAll()">Bitir</button></div>
    </div>
  `;
}

function receiverRejectKnown() {
  document.getElementById('receiver-body').innerHTML = `
    <div class="ring-wrap">
      <div class="notif warn"><span class="title">Zəng rədd edildi</span></div>
      <div class="call-actions"><button class="primary" onclick="resetAll()">Bağla</button></div>
    </div>
  `;
}

function renderReceiverRingingUnknown() {
  setReceiverStatusBar('Gələn zəng');
  document.getElementById('receiver-body').innerHTML = `
    <div class="ring-wrap">
      <div class="avatar">❓</div>
      <div class="call-number">${currentCall.fromNumber}</div>
      <div class="call-sub">Naməlum nömrə — avtomatik sistem zəng edəndən təsdiq alır...</div>
    </div>
  `;
}

function renderReceiverNotification(notif, cls) {
  document.getElementById('receiver-body').innerHTML = `
    <div class="ring-wrap">
      <div class="notif ${cls}">
        <span class="title">${notif.title}</span>
        <p>${notif.body}</p>
        ${notif.voicemail ? `<em>🎙 "${notif.voicemail}"</em>` : ''}
        ${notif.business ? `<div class="sub">${notif.business.name} · ${notif.business.type}</div>` : ''}
      </div>
      <div class="call-actions"><button class="primary" onclick="resetAll()">Bağla</button></div>
    </div>
  `;
}

/* ---------------- init ---------------- */

renderCallerDial();
renderReceiver();
