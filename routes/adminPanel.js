const express  = require('express');
const jwt      = require('jsonwebtoken');
const CalorieSnapConfig = require('../models/CalorieSnapConfig');
const { invalidateConfigCache } = require('../controllers/calorieSnapController');

const router = express.Router();

// ─── Rate limiter (in-memory) ─────────────────────────────────────────────────
const loginAttempts = new Map(); // ip → { count, lockedUntil }
const MAX_ATTEMPTS  = 5;
const LOCKOUT_MS    = 15 * 60 * 1000; // 15 min

setInterval(() => {
  const now = Date.now();
  for (const [ip, d] of loginAttempts.entries()) {
    if (d.lockedUntil < now && d.count === 0) loginAttempts.delete(ip);
  }
}, 5 * 60 * 1000);

// ─── Admin JWT middleware ─────────────────────────────────────────────────────
function adminAuth(req, res, next) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return res.status(500).json({ success: false, message: 'ADMIN_SECRET not configured on server' });

  const token = req.headers.authorization?.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

  try {
    const payload = jwt.verify(token, secret);
    if (payload.role !== 'admin') throw new Error();
    req.admin = payload;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired session' });
  }
}

// ─── GET / — serve admin UI ──────────────────────────────────────────────────
router.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.send(buildHtml());
});

// ─── POST /login ──────────────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return res.status(500).json({ success: false, message: 'ADMIN_SECRET not set in environment' });

  const ip  = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const att = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };

  if (att.lockedUntil > now) {
    return res.status(429).json({
      success:      false,
      message:      'Too many failed attempts. Try again later.',
      lockedUntil:  att.lockedUntil,
      retryAfterMs: att.lockedUntil - now,
    });
  }

  const { password } = req.body;

  if (!password || password !== secret) {
    att.count += 1;
    const remaining = MAX_ATTEMPTS - att.count;
    if (remaining <= 0) {
      att.lockedUntil = now + LOCKOUT_MS;
      att.count = 0;
    }
    loginAttempts.set(ip, att);

    return res.status(401).json({
      success:           false,
      message:           remaining > 0
        ? `Incorrect password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Too many failed attempts. Locked for 15 minutes.',
      attemptsRemaining: Math.max(0, remaining),
      lockedUntil:       att.lockedUntil > now ? att.lockedUntil : null,
    });
  }

  loginAttempts.delete(ip);

  const token = jwt.sign(
    { role: 'admin' },
    secret,
    { expiresIn: '2h' }
  );

  return res.json({ success: true, token, expiresIn: 7200 });
});

// ─── GET /config ──────────────────────────────────────────────────────────────
router.get('/config', adminAuth, async (req, res) => {
  try {
    const [cfg] = await CalorieSnapConfig.findOrCreate({
      where:    { id: 1 },
      defaults: { monthlyPrice: 12900, yearlyPrice: 120000, trialDays: 3, dailyLimit: 4, subscribedDailyLimit: 6 },
    });
    return res.json({
      success: true,
      config: {
        monthlyPrice:         cfg.monthlyPrice,
        yearlyPrice:          cfg.yearlyPrice,
        trialDays:            cfg.trialDays,
        dailyLimit:           cfg.dailyLimit,
        subscribedDailyLimit: cfg.subscribedDailyLimit,
        updatedAt:            cfg.updatedAt,
      },
    });
  } catch (err) {
    console.error('admin getConfig error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load config' });
  }
});

// ─── PUT /config ──────────────────────────────────────────────────────────────
router.put('/config', adminAuth, async (req, res) => {
  try {
    const { monthlyPrice, yearlyPrice, trialDays, dailyLimit, subscribedDailyLimit } = req.body;

    const [cfg] = await CalorieSnapConfig.findOrCreate({
      where:    { id: 1 },
      defaults: { monthlyPrice: 12900, yearlyPrice: 120000, trialDays: 3, dailyLimit: 4, subscribedDailyLimit: 6 },
    });

    if (monthlyPrice !== undefined) {
      if (typeof monthlyPrice !== 'number' || monthlyPrice < 100)
        return res.status(400).json({ success: false, message: 'monthlyPrice must be ≥ 100 paise (₹1)' });
      cfg.monthlyPrice = monthlyPrice;
    }
    if (yearlyPrice !== undefined) {
      if (typeof yearlyPrice !== 'number' || yearlyPrice < 100)
        return res.status(400).json({ success: false, message: 'yearlyPrice must be ≥ 100 paise (₹1)' });
      cfg.yearlyPrice = yearlyPrice;
    }
    if (trialDays !== undefined) {
      if (!Number.isInteger(trialDays) || trialDays < 0 || trialDays > 365)
        return res.status(400).json({ success: false, message: 'trialDays must be 0–365' });
      cfg.trialDays = trialDays;
    }
    if (dailyLimit !== undefined) {
      if (!Number.isInteger(dailyLimit) || dailyLimit < 1 || dailyLimit > 100)
        return res.status(400).json({ success: false, message: 'dailyLimit must be 1–100' });
      cfg.dailyLimit = dailyLimit;
    }
    if (subscribedDailyLimit !== undefined) {
      if (!Number.isInteger(subscribedDailyLimit) || subscribedDailyLimit < 1 || subscribedDailyLimit > 100)
        return res.status(400).json({ success: false, message: 'subscribedDailyLimit must be 1–100' });
      cfg.subscribedDailyLimit = subscribedDailyLimit;
    }

    await cfg.save();
    invalidateConfigCache();

    console.log(`[Admin] Config updated — monthly:${cfg.monthlyPrice} yearly:${cfg.yearlyPrice} trialDays:${cfg.trialDays} dailyLimit:${cfg.dailyLimit} subLimit:${cfg.subscribedDailyLimit}`);

    return res.json({
      success: true,
      config: {
        monthlyPrice:         cfg.monthlyPrice,
        yearlyPrice:          cfg.yearlyPrice,
        trialDays:            cfg.trialDays,
        dailyLimit:           cfg.dailyLimit,
        subscribedDailyLimit: cfg.subscribedDailyLimit,
        updatedAt:            cfg.updatedAt,
      },
    });
  } catch (err) {
    console.error('admin updateConfig error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update config' });
  }
});

// ─── HTML ─────────────────────────────────────────────────────────────────────
function buildHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>Admin — CalorieSnap</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    :root{
      --bg:#0a0a0b;--surface:#111113;--surface2:#1a1a1e;
      --border:#2a2a2e;--text:#e8e8ea;--muted:#6b6b70;
      --accent:#6366f1;--accent-h:#818cf8;
      --green:#22c55e;--red:#ef4444;--yellow:#f59e0b;
    }
    body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh}

    /* ── Login ── */
    #login-screen{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px}
    .login-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:40px;width:100%;max-width:400px}
    .login-icon{width:48px;height:48px;background:var(--accent);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:24px}
    .login-card h1{font-size:22px;font-weight:600;margin-bottom:6px}
    .login-card>p{color:var(--muted);font-size:14px;margin-bottom:28px}
    .input-wrap{position:relative;margin-bottom:16px}
    .input-wrap input{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:15px;padding:12px 44px 12px 14px;outline:none;transition:border-color .2s}
    .input-wrap input:focus{border-color:var(--accent)}
    .toggle-pw{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);font-size:18px;line-height:1;padding:4px}
    .btn-primary{width:100%;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:500;padding:13px;cursor:pointer;transition:background .2s,opacity .2s;display:flex;align-items:center;justify-content:center;gap:8px}
    .btn-primary:hover:not(:disabled){background:var(--accent-h)}
    .btn-primary:disabled{opacity:.5;cursor:not-allowed}
    .err-box{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;color:var(--red);font-size:13px;padding:10px 12px;margin-top:12px;display:none}
    .lockout{text-align:center;font-size:13px;color:var(--yellow);margin-top:10px;display:none}

    /* ── Dashboard ── */
    #dashboard{display:none;flex-direction:column;min-height:100vh}
    header{background:var(--surface);border-bottom:1px solid var(--border);padding:0 24px;height:60px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10}
    .h-left{display:flex;align-items:center;gap:10px}
    .h-left h1{font-size:16px;font-weight:600}
    .badge{background:var(--accent);color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;text-transform:uppercase;letter-spacing:.6px}
    .h-right{display:flex;align-items:center;gap:16px}
    .session{font-size:12px;color:var(--muted)}
    .session.warn{color:var(--yellow)}
    .btn-ghost{background:none;border:1px solid var(--border);color:var(--text);border-radius:8px;font-size:13px;padding:7px 14px;cursor:pointer;transition:border-color .2s}
    .btn-ghost:hover{border-color:var(--muted)}

    main{max-width:820px;margin:0 auto;padding:32px 24px;width:100%}
    .sec-label{font-size:11px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px}
    .card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:24px;margin-bottom:16px}
    .card-title{font-size:14px;font-weight:600;margin-bottom:20px;display:flex;align-items:center;gap:8px}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    @media(max-width:540px){.grid2{grid-template-columns:1fr}}
    .field{display:flex;flex-direction:column;gap:6px}
    .field label{font-size:12px;color:var(--muted);font-weight:500}
    .f-wrap{position:relative}
    .f-prefix{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:14px;pointer-events:none}
    .field input{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:15px;padding:10px 12px 10px 28px;outline:none;transition:border-color .2s}
    .field input.no-pfx{padding-left:12px}
    .field input:focus{border-color:var(--accent)}
    .field input.changed{border-color:var(--yellow)}
    .f-hint{font-size:11px;color:var(--muted)}
    .actions{display:flex;align-items:center;justify-content:space-between;margin-top:8px}
    .last-upd{font-size:12px;color:var(--muted)}
    .btn-save{background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:500;padding:11px 28px;cursor:pointer;transition:background .2s,opacity .2s;display:flex;align-items:center;gap:8px}
    .btn-save:hover:not(:disabled){background:var(--accent-h)}
    .btn-save:disabled{opacity:.5;cursor:not-allowed}

    /* ── Modal ── */
    .overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(4px);z-index:100;align-items:center;justify-content:center;padding:16px}
    .overlay.open{display:flex}
    .modal{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:28px;max-width:480px;width:100%}
    .modal h3{font-size:16px;font-weight:600;margin-bottom:6px}
    .modal>p{color:var(--muted);font-size:13px;margin-bottom:20px}
    .diff{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px}
    .diff th{font-size:10px;color:var(--muted);text-align:left;padding:6px 8px;text-transform:uppercase;letter-spacing:.5px}
    .diff td{padding:9px 8px;border-top:1px solid var(--border)}
    .diff .fname{color:var(--muted)}
    .diff .old{text-decoration:line-through;color:var(--red);opacity:.75}
    .diff .nw{color:var(--green);font-weight:500}
    .diff .same{color:var(--muted)}
    .m-actions{display:flex;gap:10px;justify-content:flex-end}
    .btn-cancel{background:none;border:1px solid var(--border);color:var(--text);border-radius:8px;font-size:13px;padding:9px 18px;cursor:pointer;transition:border-color .2s}
    .btn-cancel:hover{border-color:var(--muted)}
    .btn-confirm{background:var(--green);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;padding:9px 20px;cursor:pointer;transition:opacity .2s;display:flex;align-items:center;gap:6px}
    .btn-confirm:disabled{opacity:.5;cursor:not-allowed}

    /* ── Toast ── */
    #toast{position:fixed;bottom:24px;right:24px;z-index:200;display:flex;flex-direction:column;gap:8px;pointer-events:none}
    .t{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px 16px;font-size:13px;display:flex;align-items:center;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,.5);animation:tIn .2s ease;max-width:320px}
    .t.ok{border-color:var(--green)}
    .t.err{border-color:var(--red)}
    @keyframes tIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:none}}

    /* ── Spinner ── */
    .spin{width:15px;height:15px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:sp .6s linear infinite;display:inline-block}
    @keyframes sp{to{transform:rotate(360deg)}}
  </style>
</head>
<body>

<!-- LOGIN -->
<div id="login-screen">
  <div class="login-card">
    <div class="login-icon">🔐</div>
    <h1>Admin Access</h1>
    <p>CalorieSnap configuration panel — authorised personnel only.</p>
    <div class="input-wrap">
      <input type="password" id="pw" placeholder="Admin password" autocomplete="current-password" />
      <button class="toggle-pw" onclick="togglePw()" type="button">👁</button>
    </div>
    <button class="btn-primary" id="login-btn" onclick="doLogin()">Login</button>
    <div class="err-box" id="err-box"></div>
    <div class="lockout" id="lockout"></div>
  </div>
</div>

<!-- DASHBOARD -->
<div id="dashboard">
  <header>
    <div class="h-left">
      <h1>CalorieSnap Config</h1>
      <span class="badge">Admin</span>
    </div>
    <div class="h-right">
      <span class="session" id="session-timer"></span>
      <button class="btn-ghost" onclick="doLogout()">Sign out</button>
    </div>
  </header>

  <main>
    <p class="sec-label">Pricing</p>
    <div class="card">
      <div class="card-title">💳 Subscription Prices</div>
      <div class="grid2">
        <div class="field">
          <label>Monthly Price (₹)</label>
          <div class="f-wrap"><span class="f-prefix">₹</span><input type="number" id="monthlyPrice" min="1" step="1"/></div>
          <span class="f-hint">Charged per month to subscribers</span>
        </div>
        <div class="field">
          <label>Yearly Price (₹)</label>
          <div class="f-wrap"><span class="f-prefix">₹</span><input type="number" id="yearlyPrice" min="1" step="1"/></div>
          <span class="f-hint">Charged per year to subscribers</span>
        </div>
      </div>
    </div>

    <p class="sec-label" style="margin-top:24px">Trial Settings</p>
    <div class="card">
      <div class="card-title">🎯 Free Trial</div>
      <div class="grid2">
        <div class="field">
          <label>Trial Duration (days)</label>
          <div class="f-wrap"><input type="number" id="trialDays" class="no-pfx" min="0" max="365" step="1"/></div>
          <span class="f-hint">Set 0 to disable trial entirely</span>
        </div>
        <div class="field">
          <label>Daily Scan Limit — Trial</label>
          <div class="f-wrap"><input type="number" id="dailyLimit" class="no-pfx" min="1" max="100" step="1"/></div>
          <span class="f-hint">Max scans per day during trial</span>
        </div>
      </div>
    </div>

    <p class="sec-label" style="margin-top:24px">Subscriber Settings</p>
    <div class="card">
      <div class="card-title">⭐ Paid Subscribers</div>
      <div class="grid2">
        <div class="field">
          <label>Daily Scan Limit — Subscribers</label>
          <div class="f-wrap"><input type="number" id="subscribedDailyLimit" class="no-pfx" min="1" max="100" step="1"/></div>
          <span class="f-hint">Max scans per day for paid users</span>
        </div>
      </div>
    </div>

    <div class="actions">
      <span class="last-upd" id="last-upd"></span>
      <button class="btn-save" id="save-btn" onclick="openConfirm()">Save Changes</button>
    </div>
  </main>
</div>

<!-- CONFIRM MODAL -->
<div class="overlay" id="modal">
  <div class="modal">
    <h3>Confirm Changes</h3>
    <p>Review before saving. New values take effect within 60 seconds across all users.</p>
    <table class="diff">
      <thead><tr><th>Setting</th><th>Current</th><th>New Value</th></tr></thead>
      <tbody id="diff-body"></tbody>
    </table>
    <div class="m-actions">
      <button class="btn-cancel" onclick="closeModal()">Cancel</button>
      <button class="btn-confirm" id="confirm-btn" onclick="doSave()">Confirm &amp; Save</button>
    </div>
  </div>
</div>

<!-- TOAST -->
<div id="toast"></div>

<script>
  let token      = sessionStorage.getItem('_at');
  let expiry     = +sessionStorage.getItem('_ae') || 0;
  let origCfg    = {};
  let lockTimer  = null;
  let sessTimer  = null;

  const FIELDS = ['monthlyPrice','yearlyPrice','trialDays','dailyLimit','subscribedDailyLimit'];
  const LABELS = {
    monthlyPrice:         'Monthly Price',
    yearlyPrice:          'Yearly Price',
    trialDays:            'Trial Duration',
    dailyLimit:           'Trial Daily Limit',
    subscribedDailyLimit: 'Subscriber Daily Limit',
  };

  // Boot
  (token && Date.now() < expiry) ? showDash() : (clearSess(), showLogin());

  // ── Login ──────────────────────────────────────────────────────────────────

  document.getElementById('pw').addEventListener('keydown', e => e.key === 'Enter' && doLogin());

  function togglePw() {
    const i = document.getElementById('pw');
    i.type = i.type === 'password' ? 'text' : 'password';
  }

  async function doLogin() {
    const pw = document.getElementById('pw').value.trim();
    if (!pw) return;
    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span>';
    try {
      const r = await fetch('/admin/calorie-snap/login', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ password: pw }),
      });
      const d = await r.json();
      if (d.success) {
        token  = d.token;
        expiry = Date.now() + d.expiresIn * 1000;
        sessionStorage.setItem('_at', token);
        sessionStorage.setItem('_ae', expiry);
        document.getElementById('pw').value = '';
        document.getElementById('err-box').style.display = 'none';
        showDash();
      } else {
        const eb = document.getElementById('err-box');
        eb.style.display = 'block';
        eb.textContent   = d.message;
        if (d.lockedUntil) startLockout(d.lockedUntil);
      }
    } catch { showErr('Network error — check connection.'); }
    finally {
      btn.disabled = false;
      btn.innerHTML = 'Login';
    }
  }

  function showErr(msg) {
    const eb = document.getElementById('err-box');
    eb.style.display = 'block';
    eb.textContent   = msg;
  }

  function startLockout(until) {
    document.getElementById('login-btn').disabled = true;
    const el = document.getElementById('lockout');
    el.style.display = 'block';
    if (lockTimer) clearInterval(lockTimer);
    lockTimer = setInterval(() => {
      const s = Math.ceil((until - Date.now()) / 1000);
      if (s <= 0) {
        clearInterval(lockTimer);
        el.style.display = 'none';
        document.getElementById('login-btn').disabled = false;
        document.getElementById('err-box').style.display = 'none';
        return;
      }
      el.textContent = 'Locked — try again in ' + Math.floor(s/60) + ':' + String(s%60).padStart(2,'0');
    }, 1000);
  }

  // ── Session ────────────────────────────────────────────────────────────────

  function showLogin() {
    document.getElementById('login-screen').style.display  = 'flex';
    document.getElementById('dashboard').style.display     = 'none';
  }

  async function showDash() {
    document.getElementById('login-screen').style.display  = 'none';
    document.getElementById('dashboard').style.display     = 'flex';
    startSessTimer();
    await loadConfig();
    FIELDS.forEach(id => document.getElementById(id).addEventListener('input', markChanged));
  }

  function doLogout() {
    clearSess();
    showLogin();
    toast('Signed out', 'ok');
  }

  function clearSess() {
    token = null; expiry = 0;
    sessionStorage.removeItem('_at');
    sessionStorage.removeItem('_ae');
    if (sessTimer) clearInterval(sessTimer);
  }

  function startSessTimer() {
    if (sessTimer) clearInterval(sessTimer);
    sessTimer = setInterval(() => {
      const s = Math.max(0, Math.floor((expiry - Date.now()) / 1000));
      if (s === 0) { clearSess(); showLogin(); toast('Session expired — please log in again.', 'err'); return; }
      const el = document.getElementById('session-timer');
      el.textContent = 'Session: ' + Math.floor(s/60) + ':' + String(s%60).padStart(2,'0');
      el.className   = 'session' + (s < 300 ? ' warn' : '');
    }, 1000);
  }

  // ── Config ─────────────────────────────────────────────────────────────────

  async function loadConfig() {
    try {
      const r = await fetch('/admin/calorie-snap/config', { headers: { Authorization: 'Bearer ' + token } });
      if (r.status === 401) { doLogout(); return; }
      const d = await r.json();
      if (!d.success) throw new Error(d.message);
      applyConfig(d.config);
    } catch (e) { toast('Failed to load config: ' + e.message, 'err'); }
  }

  function applyConfig(cfg) {
    origCfg = { ...cfg };
    document.getElementById('monthlyPrice').value        = Math.round(cfg.monthlyPrice / 100);
    document.getElementById('yearlyPrice').value         = Math.round(cfg.yearlyPrice / 100);
    document.getElementById('trialDays').value           = cfg.trialDays;
    document.getElementById('dailyLimit').value          = cfg.dailyLimit;
    document.getElementById('subscribedDailyLimit').value = cfg.subscribedDailyLimit;
    if (cfg.updatedAt) {
      const d = new Date(cfg.updatedAt);
      document.getElementById('last-upd').textContent =
        'Last saved: ' + d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
    }
    FIELDS.forEach(id => document.getElementById(id).classList.remove('changed'));
  }

  function getFormVals() {
    return {
      monthlyPrice:         Math.round(+document.getElementById('monthlyPrice').value) * 100,
      yearlyPrice:          Math.round(+document.getElementById('yearlyPrice').value) * 100,
      trialDays:            Math.round(+document.getElementById('trialDays').value),
      dailyLimit:           Math.round(+document.getElementById('dailyLimit').value),
      subscribedDailyLimit: Math.round(+document.getElementById('subscribedDailyLimit').value),
    };
  }

  function markChanged() {
    const vals = getFormVals();
    FIELDS.forEach(k => {
      document.getElementById(k).classList.toggle('changed', vals[k] !== origCfg[k]);
    });
  }

  // ── Confirm & Save ─────────────────────────────────────────────────────────

  function fmtVal(k, v) {
    if (k === 'monthlyPrice' || k === 'yearlyPrice') return '₹' + Math.round(v / 100);
    if (k === 'trialDays') return v + ' days';
    return v + ' scans/day';
  }

  function openConfirm() {
    const nv = getFormVals();
    const tbody = document.getElementById('diff-body');
    tbody.innerHTML = '';
    let hasChange = false;
    for (const [k, label] of Object.entries(LABELS)) {
      const ov = origCfg[k], nVal = nv[k], ch = ov !== nVal;
      if (ch) hasChange = true;
      tbody.insertAdjacentHTML('beforeend',
        '<tr>' +
        '<td class="fname">' + label + '</td>' +
        '<td class="' + (ch ? 'old' : 'same') + '">' + fmtVal(k, ov ?? 0) + '</td>' +
        '<td class="' + (ch ? 'nw'  : 'same') + '">' + fmtVal(k, nVal)    + '</td>' +
        '</tr>'
      );
    }
    if (!hasChange) { toast('No changes to save', 'ok'); return; }
    document.getElementById('modal').classList.add('open');
  }

  function closeModal() { document.getElementById('modal').classList.remove('open'); }

  async function doSave() {
    const btn = document.getElementById('confirm-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span> Saving…';
    try {
      const r = await fetch('/admin/calorie-snap/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(getFormVals()),
      });
      if (r.status === 401) { doLogout(); return; }
      const d = await r.json();
      if (!d.success) throw new Error(d.message);
      applyConfig(d.config);
      closeModal();
      toast('Config saved successfully ✓', 'ok');
    } catch (e) { toast('Save failed: ' + e.message, 'err'); }
    finally {
      btn.disabled = false;
      btn.innerHTML = 'Confirm &amp; Save';
    }
  }

  // ── Toast ──────────────────────────────────────────────────────────────────

  function toast(msg, type) {
    const el = document.createElement('div');
    el.className = 't ' + (type || 'ok');
    el.innerHTML = (type === 'err' ? '✕ ' : '✓ ') + msg;
    document.getElementById('toast').appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  document.addEventListener('keydown', e => e.key === 'Escape' && closeModal());
</script>
</body>
</html>`;
}

module.exports = router;
