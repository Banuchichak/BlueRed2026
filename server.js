const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_FILE = path.join(__dirname, 'data', 'trusted_numbers.json');

function loadBusinesses() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}
function saveBusinesses(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}

// ---- in-memory app state (simulation only, resets on restart) ----
let users = [];          // {id, type: 'standard'|'business', name, phone, contacts:[]}
let nextUserId = 1;
let callLog = [];        // history of simulated calls

function genToken(prefix) {
  const rand = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${rand()}-${rand()}`;
}

function isTokenValid(biz) {
  if (!biz.token || !biz.tokenIssuedAt) return false;
  const issued = new Date(biz.tokenIssuedAt).getTime();
  const ttlMs = biz.tokenTtlMinutes * 60 * 1000;
  return Date.now() - issued < ttlMs;
}

// auto-refresh expired tokens for approved businesses (simulates periodic rotation)
setInterval(() => {
  const businesses = loadBusinesses();
  let changed = false;
  businesses.forEach(b => {
    if (b.status === 'approved' && !isTokenValid(b)) {
      b.token = genToken(b.name.slice(0, 3).toUpperCase());
      b.tokenIssuedAt = new Date().toISOString();
      changed = true;
    }
  });
  if (changed) saveBusinesses(businesses);
}, 60 * 1000);

// ---------------- AUTH ----------------

app.post('/api/auth/signup', (req, res) => {
  const { type, name, phone, businessName, businessType } = req.body;
  if (!type || !name || !phone) {
    return res.status(400).json({ error: 'type, name, phone tələb olunur' });
  }

  if (type === 'standard') {
    const user = { id: nextUserId++, type, name, phone, contacts: [] };
    users.push(user);
    return res.json({ user });
  }

  if (type === 'business') {
    if (!businessName) return res.status(400).json({ error: 'businessName tələb olunur' });
    const businesses = loadBusinesses();
    const biz = {
      id: `biz-${Date.now()}`,
      name: businessName,
      type: businessType || 'Şirkət',
      phone,
      status: 'pending',
      token: null,
      tokenIssuedAt: null,
      tokenTtlMinutes: 30
    };
    businesses.push(biz);
    saveBusinesses(businesses);
    const user = { id: nextUserId++, type, name, phone, businessId: biz.id, contacts: [] };
    users.push(user);
    return res.json({ user, business: biz, message: 'Qeydiyyat alındı. Təsdiqlənmə gözlənilir.' });
  }

  res.status(400).json({ error: 'Naməlum istifadəçi tipi' });
});

app.post('/api/auth/login', (req, res) => {
  const { phone } = req.body;
  const user = users.find(u => u.phone === phone);
  if (!user) return res.status(404).json({ error: 'İstifadəçi tapılmadı, əvvəl qeydiyyatdan keçin' });
  let business = null;
  if (user.type === 'business') {
    business = loadBusinesses().find(b => b.id === user.businessId) || null;
  }
  res.json({ user, business });
});

// ---------------- ADMIN (təsdiqlənmə) ----------------

app.get('/api/admin/businesses', (req, res) => {
  res.json(loadBusinesses());
});

app.post('/api/admin/approve', (req, res) => {
  const { id } = req.body;
  const businesses = loadBusinesses();
  const biz = businesses.find(b => b.id === id);
  if (!biz) return res.status(404).json({ error: 'Tapılmadı' });
  biz.status = 'approved';
  biz.token = genToken(biz.name.slice(0, 3).toUpperCase());
  biz.tokenIssuedAt = new Date().toISOString();
  saveBusinesses(businesses);
  res.json({ business: biz });
});

// ---------------- CONTACTS ----------------

app.post('/api/contacts/add', (req, res) => {
  const { userId, contactName, contactPhone } = req.body;
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'İstifadəçi tapılmadı' });
  user.contacts.push({ name: contactName, phone: contactPhone });
  res.json({ contacts: user.contacts });
});

app.get('/api/contacts/:userId', (req, res) => {
  const user = users.find(u => u.id === Number(req.params.userId));
  if (!user) return res.status(404).json({ error: 'İstifadəçi tapılmadı' });
  res.json({ contacts: user.contacts });
});

// ---------------- CALL SIMULATION ----------------

// Receiver's phone evaluates an incoming call from `fromNumber`
app.post('/api/call/incoming', (req, res) => {
  const { receiverUserId, fromNumber } = req.body;
  const receiver = users.find(u => u.id === receiverUserId);
  if (!receiver) return res.status(404).json({ error: 'İstifadəçi tapılmadı' });

  const inContacts = receiver.contacts.some(c => c.phone === fromNumber);
  const callId = `call-${Date.now()}`;

  if (inContacts) {
    const contact = receiver.contacts.find(c => c.phone === fromNumber);
    const entry = { callId, fromNumber, receiverUserId, stage: 'contact-known', contactName: contact.name, timestamp: new Date().toISOString() };
    callLog.push(entry);
    return res.json({
      callId,
      stage: 'contact_known',
      message: `Bu zəng kontaktlarınızdan biridir: ${contact.name}`,
      options: ['accept', 'reject']
    });
  }

  const entry = { callId, fromNumber, receiverUserId, stage: 'unknown_number', timestamp: new Date().toISOString() };
  callLog.push(entry);
  return res.json({
    callId,
    stage: 'unknown_number',
    message: 'Nömrə kontaktlarda deyil. Zəng edənə seçim təqdim olunur.',
    callerPrompt: {
      text: 'Zəng edən şəxs üçün seçim:',
      options: [
        { key: 'voicemail', label: 'Sadə vətəndaşam – səsli mesaj buraxacam' },
        { key: 'token', label: 'Qurum/şirkət təmsilçisiyəm – təsdiq tokeni təqdim edəcəm' }
      ]
    }
  });
});

// Caller chooses "I'm a regular citizen" -> leaves a voicemail
app.post('/api/call/voicemail', (req, res) => {
  const { callId, fromNumber, receiverUserId, message } = req.body;
  const entry = callLog.find(c => c.callId === callId);
  if (entry) {
    entry.stage = 'voicemail_left';
    entry.voicemail = message;
  }
  res.json({
    callId,
    stage: 'voicemail_left',
    receiverNotification: {
      title: 'Sizə zəng edən qurum deyil!',
      body: `${fromNumber} nömrəsindən adi vətəndaş zəng etdi və səsli mesaj buraxdı.`,
      voicemail: message
    }
  });
});

// Caller chooses "I represent an organization" -> submits a token
app.post('/api/call/submit-token', (req, res) => {
  const { callId, fromNumber, token } = req.body;
  const businesses = loadBusinesses();
  const biz = businesses.find(b => b.phone === fromNumber);

  const entry = callLog.find(c => c.callId === callId);

  if (!biz) {
    if (entry) entry.stage = 'token_rejected_unknown_business';
    return res.json({
      callId,
      stage: 'rejected',
      receiverNotification: {
        title: 'Təhlükə! Saxta zəng ehtimalı',
        body: `${fromNumber} nömrəsi heç bir təsdiqlənmiş təşkilatla əlaqəli deyil.`
      }
    });
  }

  if (biz.status !== 'approved') {
    if (entry) entry.stage = 'token_rejected_not_approved';
    return res.json({
      callId,
      stage: 'rejected',
      receiverNotification: {
        title: 'Təsdiqlənməmiş qurum',
        body: `${biz.name} hələ təsdiq prosesindən keçməyib. Ehtiyatlı olun.`
      }
    });
  }

  if (!isTokenValid(biz) || biz.token !== token) {
    if (entry) entry.stage = 'token_rejected_invalid';
    return res.json({
      callId,
      stage: 'rejected',
      receiverNotification: {
        title: 'Token yanlış və ya vaxtı bitib',
        body: `${biz.name} adından zəng iddiası təsdiqlənmədi. Zəngi etibarsız hesab edin.`
      }
    });
  }

  if (entry) entry.stage = 'token_verified';
  res.json({
    callId,
    stage: 'verified',
    receiverNotification: {
      title: 'Təsdiqlənmiş qurum zəngi ✔',
      body: `Bu zəng "${biz.name}" (${biz.type}) tərəfindən təsdiqlənmiş rəsmi kanaldan gəlir.`,
      business: { name: biz.name, type: biz.type }
    }
  });
});

app.get('/api/call/log', (req, res) => {
  res.json({ callLog });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Vishing Shield simulyasiyası http://localhost:${PORT} ünvanında işləyir`);
});
