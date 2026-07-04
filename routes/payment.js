const express = require('express');
const router  = express.Router();

function buildSuccessPage(status) {
  const success = status !== 'cancelled' && status !== 'failed';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="robots" content="noindex,nofollow">
  <title>${success ? 'Payment Successful' : 'Payment Failed'} — Yupluck</title>
  <style>
    :root {
      --bg:       #0A0A0B;
      --surface:  #111113;
      --border:   #222226;
      --text:     #EBEBED;
      --sub:      #7A7A82;
      --ok:       #22C55E;
      --ok-dim:   rgba(34,197,94,.12);
      --ok-ring:  rgba(34,197,94,.25);
      --err:      #EF4444;
      --err-dim:  rgba(239,68,68,.12);
      --err-ring: rgba(239,68,68,.25);
      --accent:   #6366F1;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg:      #F4F5F7;
        --surface: #FFFFFF;
        --border:  #E4E5E8;
        --text:    #111113;
        --sub:     #6B6B72;
      }
    }
    :root[data-theme="dark"] {
      --bg:#0A0A0B;--surface:#111113;--border:#222226;
      --text:#EBEBED;--sub:#7A7A82;
    }
    :root[data-theme="light"] {
      --bg:#F4F5F7;--surface:#FFFFFF;--border:#E4E5E8;
      --text:#111113;--sub:#6B6B72;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      min-height: 100dvh;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      -webkit-font-smoothing: antialiased;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 40px 32px 36px;
      max-width: 380px;
      width: 100%;
      text-align: center;
      animation: rise .45s cubic-bezier(.22,.68,0,1.2) both;
    }

    @keyframes rise {
      from { opacity: 0; transform: translateY(20px) scale(.97); }
      to   { opacity: 1; transform: none; }
    }

    /* ── Icon ring ── */
    .ring {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      margin: 0 auto 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .ring.ok  { background: var(--ok-dim);  box-shadow: 0 0 0 8px var(--ok-ring);  }
    .ring.err { background: var(--err-dim); box-shadow: 0 0 0 8px var(--err-ring); }

    /* animated checkmark */
    .check-svg { overflow: visible; }
    .check-circle {
      fill: none;
      stroke: var(--ok);
      stroke-width: 3;
      stroke-dasharray: 226;
      stroke-dashoffset: 226;
      animation: draw-circle .55s .1s ease forwards;
    }
    .check-tick {
      fill: none;
      stroke: var(--ok);
      stroke-width: 3.5;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-dasharray: 50;
      stroke-dashoffset: 50;
      animation: draw-tick .35s .6s ease forwards;
    }
    @keyframes draw-circle { to { stroke-dashoffset: 0; } }
    @keyframes draw-tick   { to { stroke-dashoffset: 0; } }

    /* X icon for failure */
    .x-svg .x-circle {
      fill: none;
      stroke: var(--err);
      stroke-width: 3;
      stroke-dasharray: 226;
      stroke-dashoffset: 226;
      animation: draw-circle .55s .1s ease forwards;
    }
    .x-svg .x-line {
      fill: none;
      stroke: var(--err);
      stroke-width: 3.5;
      stroke-linecap: round;
      stroke-dasharray: 34;
      stroke-dashoffset: 34;
    }
    .x-svg .x-line:first-of-type { animation: draw-tick .28s .65s ease forwards; }
    .x-svg .x-line:last-of-type  { animation: draw-tick .28s .85s ease forwards; }

    /* ── Text ── */
    h1 {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -.4px;
      text-wrap: balance;
      margin-bottom: 10px;
    }
    .sub {
      font-size: 14px;
      line-height: 1.6;
      color: var(--sub);
      text-wrap: balance;
      margin-bottom: 32px;
    }

    /* ── Close hint ── */
    .close-hint {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 13px;
      color: var(--sub);
      border-top: 1px solid var(--border);
      padding-top: 24px;
    }
    .close-hint svg { flex-shrink: 0; opacity: .6; }

    /* ── Deep-link button (shown only if window.opener exists) ── */
    .btn-return {
      display: none;
      width: 100%;
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      padding: 14px;
      cursor: pointer;
      margin-bottom: 16px;
      transition: opacity .2s;
    }
    .btn-return:hover { opacity: .88; }
    .btn-return.visible { display: block; }

    /* ── Countdown ── */
    .countdown {
      font-size: 12px;
      color: var(--sub);
      margin-top: 8px;
      min-height: 18px;
    }

    @media (prefers-reduced-motion: reduce) {
      .card { animation: none; }
      .check-circle, .check-tick, .x-svg .x-circle, .x-svg .x-line {
        stroke-dashoffset: 0;
        animation: none;
      }
    }
  </style>
</head>
<body>
<div class="card">

  ${success ? `
  <div class="ring ok">
    <svg class="check-svg" width="44" height="44" viewBox="0 0 44 44">
      <circle class="check-circle" cx="22" cy="22" r="19" transform="rotate(-90 22 22)"/>
      <polyline class="check-tick" points="12,22 19,30 32,14"/>
    </svg>
  </div>
  <h1>Payment Successful</h1>
  <p class="sub">Your subscription is now active.<br>You can close this window and return to Yupluck.</p>
  ` : `
  <div class="ring err">
    <svg class="x-svg" width="44" height="44" viewBox="0 0 44 44">
      <circle class="x-circle" cx="22" cy="22" r="19" transform="rotate(-90 22 22)"/>
      <line class="x-line" x1="15" y1="15" x2="29" y2="29"/>
      <line class="x-line" x1="29" y1="15" x2="15" y2="29"/>
    </svg>
  </div>
  <h1>Payment Not Completed</h1>
  <p class="sub">Your payment was cancelled or could not be processed. No charge was made. Please try again from the app.</p>
  `}

  <button class="btn-return" id="btn-return" onclick="returnToApp()">Return to Yupluck</button>
  <div class="countdown" id="countdown"></div>

  <div class="close-hint">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="12" height="12" rx="2.5" stroke="currentColor" stroke-width="1.4"/>
      <path d="M5.5 8h5M8 5.5l2.5 2.5L8 10.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    You may safely close this window
  </div>
</div>

<script>
  (function () {
    var SUCCESS = ${success ? 'true' : 'false'};
    var btn = document.getElementById('btn-return');
    var cdEl = document.getElementById('countdown');

    // Show return button if the page was opened as a popup / has opener
    if (window.opener || window.history.length <= 1) {
      btn.classList.add('visible');
    }

    function returnToApp() {
      // Try deep link first, fall back to window.close
      try { window.location.href = 'yupluck://payment-' + (SUCCESS ? 'success' : 'cancelled'); } catch(e) {}
      setTimeout(function () { window.close(); }, 400);
    }

    // Auto-close countdown (only on success)
    if (SUCCESS) {
      var secs = 10;
      cdEl.textContent = 'Closing automatically in ' + secs + 's…';
      var t = setInterval(function () {
        secs--;
        if (secs <= 0) {
          clearInterval(t);
          returnToApp();
        } else {
          cdEl.textContent = 'Closing automatically in ' + secs + 's…';
        }
      }, 1000);
    }
  })();
</script>
</body>
</html>`;
}

// GET /payment/success?razorpay_payment_link_status=paid
router.get('/success', (req, res) => {
  const status = req.query.razorpay_payment_link_status || 'paid';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(buildSuccessPage(status));
});

// Alias: /payment/cancelled
router.get('/cancelled', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(buildSuccessPage('cancelled'));
});

module.exports = router;
