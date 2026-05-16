const express = require('express');
const { getStats, resetStats } = require('../middleware/performanceMonitor');

const router = express.Router();

// ─── Pre-defined bottleneck analysis based on code review ───────────────────

const ANALYSIS = [
  {
    method: 'GET',
    path: '/user/api/users/feed',
    summary: 'Heavy social feed with N+1 queries and no pagination',
    severity: 'critical',
    category: 'Database',
    issues: [
      'Fetches ALL posts without LIMIT/OFFSET — grows unboundedly with data',
      'N+1 query: separate DB call per post for reactions and comments',
      'No response caching — full DB hit on every request',
      'Missing composite index on ("userId", "createdAt")',
    ],
    fixes: [
      { priority: 'P0', label: 'Add pagination', snippet: 'await Feed.findAll({ limit: 10, offset: page * 10, where: { ... } })' },
      { priority: 'P0', label: 'Eager-load associations', snippet: 'await Feed.findAll({\n  include: [\n    { model: PostReaction },\n    { model: PostComment }\n  ]\n})' },
      { priority: 'P1', label: 'Add composite DB index', snippet: 'CREATE INDEX ON "Feeds" ("userId", "createdAt" DESC);' },
      { priority: 'P1', label: 'Cache feed per user (Redis, 30s TTL)', snippet: 'const key = "feed:" + userId;\nconst hit = await redis.get(key);\nif (hit) return res.json(JSON.parse(hit));\nawait redis.setex(key, 30, JSON.stringify(result));' },
    ],
    gain: '60–80% faster',
  },
  {
    method: 'GET',
    path: '/user/api/users/leaderboard',
    summary: 'Full table aggregation + sort on every request with no caching',
    severity: 'critical',
    category: 'Database',
    issues: [
      'Full table scan — ORDER BY workout_time has no supporting index',
      'Expensive aggregation runs on every API call',
      'No result limit — returns all users',
    ],
    fixes: [
      { priority: 'P0', label: 'Add index on workout_time', snippet: 'CREATE INDEX ON "Users" ("workout_time" DESC);' },
      { priority: 'P0', label: 'Cache leaderboard for 5 minutes', snippet: 'const hit = await redis.get("leaderboard");\nif (hit) return res.json(JSON.parse(hit));\nawait redis.setex("leaderboard", 300, JSON.stringify(result));' },
      { priority: 'P1', label: 'Limit to top 100 users', snippet: 'await User.findAll({ order: [["workout_time", "DESC"]], limit: 100 })' },
    ],
    gain: '70–90% faster',
  },
  {
    method: 'POST',
    path: '/user/api/users/reel/upload',
    summary: 'FFmpeg video compression blocks the request thread for minutes',
    severity: 'critical',
    category: 'I/O',
    issues: [
      'FFmpeg runs synchronously inside the HTTP request — blocks Event Loop',
      '300 MB upload limit means very long waits before processing starts',
      'No progress feedback to client during processing',
      'S3 upload happens after compression — client waits for both',
    ],
    fixes: [
      { priority: 'P0', label: 'Return 202 Accepted immediately', snippet: 'res.status(202).json({ reelId, status: "processing" });\nsetImmediate(() => processReel(reelId, filePath));' },
      { priority: 'P0', label: 'Move FFmpeg to a Worker Thread', snippet: 'const { Worker } = require("worker_threads");\nnew Worker("./workers/compressReel.js", { workerData: { filePath, reelId } });' },
      { priority: 'P1', label: 'Add GET /reel/:id status polling', snippet: '// Client polls until status === "ready"\n// { status: "processing" | "ready", url }' },
      { priority: 'P2', label: 'Use AWS MediaConvert (no server CPU)', snippet: '// Upload raw to S3, trigger MediaConvert job\n// No server processing — scales automatically' },
    ],
    gain: '95%+ faster response (async)',
  },
  {
    method: 'POST',
    path: '/user/api/auth/register',
    summary: 'Blocks on synchronous Twilio/SMS call — adds 300–800ms latency',
    severity: 'high',
    category: 'External API',
    issues: [
      'SMS API call (Twilio/InfoBIP) is awaited synchronously',
      'No rate limiting — SMS flooding risk (direct cost exposure)',
      'OTP stored in DB with no expiry enforced at query level',
    ],
    fixes: [
      { priority: 'P0', label: 'Rate-limit per mobile number', snippet: 'const rateLimit = require("express-rate-limit");\nrouter.post("/register",\n  rateLimit({ windowMs: 60_000, max: 3 }),\n  register\n);' },
      { priority: 'P1', label: 'Queue SMS asynchronously (BullMQ)', snippet: '// Instead of: await sendSMS(mobile, otp)\nawait smsQueue.add("send-otp", { mobile, otp });\nres.json({ message: "OTP sent" }); // respond immediately' },
      { priority: 'P2', label: 'Index OTP expiry column', snippet: 'ALTER TABLE "Users" ADD COLUMN otp_expires_at TIMESTAMP;\nCREATE INDEX ON "Users" (otp_expires_at);' },
    ],
    gain: '40–60% faster response',
  },
  {
    method: 'POST',
    path: '/user/api/booking/initiate',
    summary: 'Razorpay order creation blocks on external API with no timeout',
    severity: 'high',
    category: 'External API',
    issues: [
      'Razorpay API call has no timeout — hangs indefinitely on outage',
      'No retry logic for transient Razorpay failures',
      'Entire booking flow fails if Razorpay is down',
    ],
    fixes: [
      { priority: 'P0', label: 'Wrap with a timeout', snippet: 'const createWithTimeout = (opts) =>\n  Promise.race([\n    razorpay.orders.create(opts),\n    new Promise((_, rej) =>\n      setTimeout(() => rej(new Error("Timeout")), 8000)\n    )\n  ]);' },
      { priority: 'P1', label: 'Add retry with exponential backoff', snippet: 'const { retry } = require("@lifeomic/attempt");\nawait retry(() => razorpay.orders.create(opts), {\n  maxAttempts: 3, delay: 200, factor: 2\n});' },
      { priority: 'P2', label: 'Add circuit breaker', snippet: '// Use opossum to fail-fast during Razorpay outage\nconst breaker = new CircuitBreaker(createOrder, { timeout: 5000 });' },
    ],
    gain: '30–50% reliability improvement',
  },
  {
    method: 'GET',
    path: '/user/api/users/nearby-users',
    summary: 'ILIKE search disables B-tree indexes — full table scan every call',
    severity: 'high',
    category: 'Database',
    issues: [
      'ILIKE on "username" / "location" bypasses B-tree index entirely',
      'Full table scan executed on every search keystroke',
      'No debouncing or caching for repeated queries',
    ],
    fixes: [
      { priority: 'P0', label: 'Install pg_trgm + GIN index', snippet: 'CREATE EXTENSION IF NOT EXISTS pg_trgm;\nCREATE INDEX ON "Users" USING gin(username gin_trgm_ops);' },
      { priority: 'P1', label: 'Switch to full-text search', snippet: "WHERE to_tsvector('english', username) @@ plainto_tsquery(:q)" },
      { priority: 'P2', label: 'Cache search results 60 s', snippet: 'await redis.setex("search:" + q, 60, JSON.stringify(results));' },
    ],
    gain: '80%+ faster on large user tables',
  },
  {
    method: 'GET',
    path: '/user/api/booking/visited-gyms',
    summary: 'Complex multi-join aggregation runs fresh on every request',
    severity: 'high',
    category: 'Database',
    issues: [
      'Joins Bookings + Gyms + Slots without caching',
      'Missing indexes on Bookings."userId" and Bookings."gymId"',
      'Workout duration aggregated in app layer, not in SQL',
    ],
    fixes: [
      { priority: 'P0', label: 'Add foreign key indexes', snippet: 'CREATE INDEX ON "Bookings" ("userId");\nCREATE INDEX ON "Bookings" ("gymId");' },
      { priority: 'P1', label: 'Cache per user (5 min)', snippet: 'const key = "visited:" + userId;\nconst hit = await redis.get(key);\nif (hit) return res.json(JSON.parse(hit));\nawait redis.setex(key, 300, JSON.stringify(result));' },
      { priority: 'P2', label: 'Aggregate in SQL', snippet: 'SELECT "gymId", SUM("durationMinutes") AS total\nFROM "Bookings"\nWHERE "userId" = :uid\nGROUP BY "gymId"' },
    ],
    gain: '50–70% faster',
  },
  {
    method: 'POST',
    path: '/user/api/users/uploadProfileImage',
    summary: 'Uploads original full-size image to S3 — no resize, client waits',
    severity: 'medium',
    category: 'I/O',
    issues: [
      'No image resizing before S3 upload — stores original large files',
      'Client waits for complete S3 transfer before receiving a response',
      'No file size validation before upload processing begins',
    ],
    fixes: [
      { priority: 'P0', label: 'Resize with sharp before upload', snippet: "const sharp = require('sharp');\nconst resized = await sharp(req.file.buffer)\n  .resize(400, 400)\n  .webp()\n  .toBuffer();" },
      { priority: 'P1', label: 'Use S3 presigned URL (client uploads directly)', snippet: 'const url = s3.getSignedUrl("putObject", {\n  Bucket, Key, Expires: 60, ContentType: "image/webp"\n});\nres.json({ uploadUrl: url });' },
      { priority: 'P2', label: 'Validate size before processing', snippet: 'if (req.file.size > 5 * 1024 * 1024)\n  return res.status(400).json({ error: "Max 5 MB" });' },
    ],
    gain: '50–70% faster',
  },
  {
    method: 'GET',
    path: '/user/api/gym/get',
    summary: 'Gym listing hits DB fresh on every request — gyms rarely change',
    severity: 'medium',
    category: 'Database',
    issues: [
      'No caching — full DB query even though gym data changes rarely',
      'No pagination — returns entire gym table',
      'Selects all columns including potentially large JSON fields',
    ],
    fixes: [
      { priority: 'P0', label: 'Cache gym list for 5 minutes', snippet: 'const hit = await redis.get("gyms:all");\nif (hit) return res.json(JSON.parse(hit));\nawait redis.setex("gyms:all", 300, JSON.stringify(gyms));' },
      { priority: 'P1', label: 'Select only needed columns', snippet: 'await Gym.findAll({\n  attributes: ["id", "name", "address", "rating", "images"]\n})' },
      { priority: 'P1', label: 'Add pagination', snippet: 'await Gym.findAll({ limit: 20, offset: (page - 1) * 20 })' },
    ],
    gain: '40–60% faster',
  },
  {
    method: 'GET',
    path: '/user/api/users/reel',
    summary: 'Returns all reels without pagination, CDN URLs regenerated every request',
    severity: 'medium',
    category: 'Database',
    issues: [
      'No LIMIT on reel query — returns everything',
      'CloudFront URLs generated on-the-fly instead of stored at upload time',
      'No index on view_count or createdAt for trending sort',
    ],
    fixes: [
      { priority: 'P0', label: 'Add pagination', snippet: 'await Reel.findAll({\n  limit: 10,\n  offset: page * 10,\n  order: [["createdAt", "DESC"]]\n})' },
      { priority: 'P1', label: 'Store final CDN URL at upload time', snippet: '// During upload — save once:\nconst url = "https://cdn.fitzoos.com/" + s3Key;\nawait Reel.create({ ..., url });' },
    ],
    gain: '50–70% faster',
  },
  {
    method: 'GET',
    path: '/user/api/users/message/:id',
    summary: 'Message history loaded without cursor pagination or compound index',
    severity: 'medium',
    category: 'Database',
    issues: [
      'No pagination — loads all messages for a chat at once',
      'Missing compound index on ("chat_id", "createdAt")',
    ],
    fixes: [
      { priority: 'P0', label: 'Add compound index', snippet: 'CREATE INDEX ON "Messages" ("chat_id", "createdAt" DESC);' },
      { priority: 'P1', label: 'Cursor-based pagination', snippet: 'await Message.findAll({\n  where: { chat_id, createdAt: { [Op.lt]: beforeCursor } },\n  limit: 20,\n  order: [["createdAt", "DESC"]]\n})' },
    ],
    gain: '40–60% faster',
  },
  {
    method: 'GET',
    path: '/user/api/users/messages',
    summary: 'Chat list requires joining per-conversation for last-message lookup',
    severity: 'medium',
    category: 'Database',
    issues: [
      'No indexes on "sender_id" / "receiver_id" for chat lookup',
      'Last-message lookup done inefficiently per conversation',
    ],
    fixes: [
      { priority: 'P0', label: 'Add participant indexes', snippet: 'CREATE INDEX ON "Messages" ("sender_id");\nCREATE INDEX ON "Messages" ("receiver_id");' },
      { priority: 'P1', label: 'Use DISTINCT ON for last message', snippet: 'SELECT DISTINCT ON (chat_id) *\nFROM "Messages"\nORDER BY chat_id, "createdAt" DESC;' },
    ],
    gain: '30–50% faster',
  },
  {
    method: 'POST',
    path: '/user/api/auth/login',
    summary: 'No brute-force protection; bcrypt cost factor not explicitly set',
    severity: 'low',
    category: 'Security',
    issues: [
      'No rate limiting on login endpoint — brute-force risk',
      'bcrypt cost factor not explicitly configured (uses library default)',
    ],
    fixes: [
      { priority: 'P0', label: 'Add rate limiting', snippet: 'router.post("/login",\n  rateLimit({ windowMs: 15 * 60_000, max: 10 }),\n  login\n);' },
      { priority: 'P2', label: 'Explicitly set bcrypt rounds', snippet: 'await bcrypt.hash(password, 10); // 10 is the right balance of speed vs security' },
    ],
    gain: 'Security improvement primarily',
  },
];

// ─── API endpoints ────────────────────────────────────────────────────────────

router.get('/data', (_req, res) => {
  res.json({
    stats: getStats(),
    analysis: ANALYSIS,
    timestamp: new Date().toISOString(),
  });
});

router.post('/reset', (_req, res) => {
  resetStats();
  res.json({ message: 'Stats reset' });
});

router.get('/', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(reportHtml());
});

// ─── HTML report page ────────────────────────────────────────────────────────

function reportHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>API Performance Report — Gym Server</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; }
  .badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700; color:#fff; }
  .badge-GET    { background:#1d4ed8; }
  .badge-POST   { background:#15803d; }
  .badge-PUT    { background:#b45309; }
  .badge-DELETE { background:#b91c1c; }
  .badge-PATCH  { background:#6d28d9; }
  .dot { display:inline-block; width:9px; height:9px; border-radius:50%; }
  .dot-fast     { background:#22c55e; }
  .dot-medium   { background:#eab308; }
  .dot-slow     { background:#f97316; }
  .dot-critical { background:#ef4444; }
  .dot-none     { background:#4b5563; }
  .sev-critical { background:#1c0505; border-left:3px solid #ef4444; }
  .sev-high     { background:#1c0a03; border-left:3px solid #f97316; }
  .sev-medium   { background:#1c1203; border-left:3px solid #eab308; }
  .sev-low      { background:#031c0a; border-left:3px solid #22c55e; }
  .p0 { background:#7f1d1d; color:#fca5a5; font-size:11px; font-weight:700; padding:2px 6px; border-radius:4px; }
  .p1 { background:#431407; color:#fdba74; font-size:11px; font-weight:700; padding:2px 6px; border-radius:4px; }
  .p2 { background:#1e3a5f; color:#93c5fd; font-size:11px; font-weight:700; padding:2px 6px; border-radius:4px; }
  pre { background:#0f172a; color:#94a3b8; padding:10px 12px; border-radius:6px; font-size:11.5px; overflow-x:auto; white-space:pre-wrap; word-break:break-word; margin:4px 0 0; line-height:1.6; }
  .expand-row { display:none; }
  .expand-row.open { display:table-row; }
  .tab-btn.active { border-bottom:2px solid #3b82f6; color:#60a5fa; }
  .tab-panel { display:none; }
  .tab-panel.active { display:block; }
  tr.data-row { cursor:pointer; transition:background 0.1s; }
  tr.data-row:hover { background:#111827; }
  .chevron { transition:transform 0.2s; display:inline-block; }
  .chevron.open { transform:rotate(90deg); }
</style>
</head>
<body class="bg-gray-950 text-gray-200 min-h-screen">
<div class="max-w-screen-2xl mx-auto px-6 py-8">

  <!-- Header -->
  <div class="flex items-center justify-between mb-8">
    <div>
      <h1 class="text-2xl font-bold text-white tracking-tight">API Performance Report</h1>
      <p class="text-gray-500 text-sm mt-0.5">fitzoos &mdash; Gym User Server</p>
    </div>
    <div class="flex items-center gap-3">
      <span class="text-xs px-3 py-1 rounded-full bg-green-950 text-green-400 border border-green-900">&#9679; Auto-refresh 5s</span>
      <span class="text-xs text-gray-600" id="last-updated">Loading...</span>
      <button onclick="doReset()" class="text-xs px-3 py-1.5 rounded bg-gray-800 text-gray-400 hover:bg-red-950 hover:text-red-400 border border-gray-700 transition-colors">Reset Stats</button>
    </div>
  </div>

  <!-- Summary cards -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
    <div class="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <div class="text-xs text-gray-500 mb-1">Endpoints Monitored</div>
      <div class="text-3xl font-bold text-white" id="c-total">—</div>
    </div>
    <div class="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <div class="text-xs text-gray-500 mb-1">Slowest (avg)</div>
      <div class="text-sm font-bold text-red-400 leading-snug" id="c-slowest">—</div>
    </div>
    <div class="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <div class="text-xs text-gray-500 mb-1">Overall Avg Response</div>
      <div class="text-3xl font-bold text-yellow-300" id="c-avg">—</div>
    </div>
    <div class="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <div class="text-xs text-gray-500 mb-1">Total Calls / Errors</div>
      <div class="text-2xl font-bold text-white" id="c-calls">—</div>
    </div>
  </div>

  <!-- Tabs -->
  <div class="flex gap-6 border-b border-gray-800 mb-6">
    <button class="tab-btn active pb-3 text-sm font-medium" onclick="switchTab('live', this)">&#9654; Live Metrics</button>
    <button class="tab-btn pb-3 text-sm font-medium text-gray-500" onclick="switchTab('analysis', this)">&#128220; Code Analysis</button>
  </div>

  <!-- ── TAB: Live Metrics ── -->
  <div id="tab-live" class="tab-panel active">
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <select id="f-method" onchange="renderTable()" class="bg-gray-900 border border-gray-700 text-sm rounded-lg px-3 py-1.5 text-gray-300">
        <option value="">All Methods</option>
        <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option>
      </select>
      <select id="f-sort" onchange="renderTable()" class="bg-gray-900 border border-gray-700 text-sm rounded-lg px-3 py-1.5 text-gray-300">
        <option value="avg">Sort: Avg Time</option>
        <option value="max">Sort: Max Time</option>
        <option value="calls">Sort: Call Count</option>
        <option value="errors">Sort: Error Rate</option>
      </select>
      <input id="f-search" oninput="renderTable()" placeholder="Search path..." class="bg-gray-900 border border-gray-700 text-sm rounded-lg px-3 py-1.5 text-gray-300 w-60">
      <div class="ml-auto hidden md:flex items-center gap-5 text-xs text-gray-500">
        <span><span class="dot dot-fast mr-1"></span>&lt;100ms Fast</span>
        <span><span class="dot dot-medium mr-1"></span>100–500ms Medium</span>
        <span><span class="dot dot-slow mr-1"></span>500–2s Slow</span>
        <span><span class="dot dot-critical mr-1"></span>&gt;2s Critical</span>
      </div>
    </div>

    <div class="overflow-x-auto rounded-xl border border-gray-800">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-gray-900 text-gray-500 text-xs uppercase tracking-wide">
            <th class="px-3 py-3 w-8"></th>
            <th class="px-3 py-3 text-left w-20">Method</th>
            <th class="px-3 py-3 text-left">Endpoint</th>
            <th class="px-4 py-3 text-right w-24">Avg</th>
            <th class="px-4 py-3 text-right w-24">P95</th>
            <th class="px-4 py-3 text-right w-24">Max</th>
            <th class="px-4 py-3 text-right w-20">Calls</th>
            <th class="px-4 py-3 text-right w-24">Errors</th>
            <th class="px-4 py-3 text-right w-32">Last Called</th>
            <th class="px-4 py-3 w-24">Trend</th>
          </tr>
        </thead>
        <tbody id="live-tbody">
          <tr><td colspan="10" class="text-center py-16 text-gray-600">No data yet — make API calls to see live metrics.</td></tr>
        </tbody>
      </table>
    </div>
    <p class="text-xs text-gray-700 mt-2 ml-1">Click any row to expand bottleneck details and fix suggestions.</p>
  </div>

  <!-- ── TAB: Code Analysis ── -->
  <div id="tab-analysis" class="tab-panel">
    <p class="text-sm text-gray-500 mb-6">Static analysis based on code review. Issues and fixes apply regardless of live traffic data.</p>
    <div id="analysis-grid" class="space-y-4"></div>
  </div>

</div><!-- /container -->

<script>
var liveStats = [];
var analysisData = [];

/* ── helpers ── */
function fmtTime(ms) {
  if (!ms) return '0ms';
  if (ms >= 1000) return (ms / 1000).toFixed(1) + 's';
  return ms + 'ms';
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString();
}
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function methodBadge(m) {
  return '<span class="badge badge-' + m + '">' + m + '</span>';
}
function dot(ms) {
  if (!ms) return '<span class="dot dot-none"></span>';
  if (ms < 100)  return '<span class="dot dot-fast"></span>';
  if (ms < 500)  return '<span class="dot dot-medium"></span>';
  if (ms < 2000) return '<span class="dot dot-slow"></span>';
  return '<span class="dot dot-critical"></span>';
}
function timeColor(ms) {
  if (ms < 100)  return 'text-green-400';
  if (ms < 500)  return 'text-yellow-300';
  if (ms < 2000) return 'text-orange-400';
  return 'text-red-400';
}
function sevColor(s) {
  return s === 'critical' ? 'text-red-400' :
         s === 'high'     ? 'text-orange-400' :
         s === 'medium'   ? 'text-yellow-300' : 'text-green-400';
}
function pBadge(p) {
  return '<span class="' + p.toLowerCase() + '">' + p + '</span>';
}
function sparkSvg(data) {
  if (!data || data.length < 2) return '<span class="text-gray-700 text-xs italic">no data</span>';
  var w = 72, h = 22, pad = 2;
  var max = Math.max.apply(null, data) || 1;
  var min = Math.min.apply(null, data);
  var pts = data.map(function(v, i) {
    var x = pad + (i / (data.length - 1)) * (w - pad * 2);
    var y = h - pad - ((v - min) / ((max - min) || 1)) * (h - pad * 2);
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  var col = max >= 2000 ? '#ef4444' : max >= 500 ? '#f97316' : max >= 100 ? '#eab308' : '#22c55e';
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' +
    '<polyline points="' + pts + '" fill="none" stroke="' + col + '" stroke-width="1.5" stroke-linejoin="round"/>' +
    '</svg>';
}

/* ── tabs ── */
function switchTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(function(b) {
    b.classList.remove('active');
    b.classList.add('text-gray-500');
  });
  document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
  document.getElementById('tab-' + tab).classList.add('active');
  btn.classList.add('active');
  btn.classList.remove('text-gray-500');
}

/* ── summary ── */
function updateSummary(stats) {
  document.getElementById('c-total').textContent = stats.length;
  if (!stats.length) return;
  var top = stats[0];
  document.getElementById('c-slowest').textContent = fmtTime(top.avgTime) + ' — ' + top.path;
  var sumAvg = stats.reduce(function(a, s) { return a + s.avgTime; }, 0);
  document.getElementById('c-avg').textContent = fmtTime(Math.round(sumAvg / stats.length));
  var calls = stats.reduce(function(a, s) { return a + s.count; }, 0);
  var errs  = stats.reduce(function(a, s) { return a + s.errors; }, 0);
  document.getElementById('c-calls').textContent = calls + ' / ' + errs + ' err';
}

/* ── find matching analysis entry ── */
function findAnalysis(method, path) {
  for (var i = 0; i < analysisData.length; i++) {
    var a = analysisData[i];
    if (a.method === method && a.path === path) return a;
  }
  return null;
}

/* ── expand detail row ── */
function toggleRow(id) {
  var el = document.getElementById(id);
  var chev = document.getElementById('chev-' + id);
  if (!el) return;
  var open = el.classList.toggle('open');
  if (chev) chev.classList.toggle('open', open);
}

function detailHtml(s) {
  var a = findAnalysis(s.method, s.path);
  var h = '<div class="flex flex-wrap gap-8 py-1">';

  /* stats panel */
  h += '<div class="flex-shrink-0">';
  h += '<div class="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">Live Stats</div>';
  h += '<table class="text-xs">';
  h += '<tr><td class="pr-5 py-0.5 text-gray-500">Min</td><td class="font-mono text-green-400">' + fmtTime(s.minTime) + '</td></tr>';
  h += '<tr><td class="pr-5 py-0.5 text-gray-500">Avg</td><td class="font-mono ' + timeColor(s.avgTime) + '">' + fmtTime(s.avgTime) + '</td></tr>';
  h += '<tr><td class="pr-5 py-0.5 text-gray-500">P95</td><td class="font-mono text-orange-400">' + fmtTime(s.p95) + '</td></tr>';
  h += '<tr><td class="pr-5 py-0.5 text-gray-500">Max</td><td class="font-mono text-red-400">' + fmtTime(s.maxTime) + '</td></tr>';
  h += '<tr><td class="pr-5 py-0.5 text-gray-500">Errors</td><td class="' + (s.errors > 0 ? 'text-red-400' : 'text-gray-600') + '">' + s.errors + ' (' + s.errorRate + '%)</td></tr>';
  var codes = Object.entries(s.statusCodes || {});
  if (codes.length) {
    h += '<tr><td class="pr-5 pt-1 text-gray-500">Codes</td><td class="font-mono text-gray-400">' +
      codes.map(function(c) { return c[0] + ':' + c[1]; }).join(', ') + '</td></tr>';
  }
  h += '</table></div>';

  if (a) {
    /* issues */
    h += '<div class="flex-1 min-w-52">';
    h += '<div class="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">Known Issues</div>';
    h += '<ul class="space-y-1.5">';
    a.issues.forEach(function(issue) {
      h += '<li class="text-xs text-gray-300 flex gap-2"><span class="text-red-500 flex-shrink-0">●</span>' + esc(issue) + '</li>';
    });
    h += '</ul>';
    h += '<div class="mt-3 text-xs text-gray-500">Estimated gain: <span class="text-green-400 font-semibold">' + esc(a.gain) + '</span></div>';
    h += '</div>';

    /* fixes */
    h += '<div class="flex-1 min-w-72">';
    h += '<div class="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">How to Fix</div>';
    a.fixes.forEach(function(fix) {
      h += '<div class="mb-3">';
      h += '<div class="flex items-center gap-2 mb-1">' + pBadge(fix.priority) + ' <span class="text-xs text-gray-200">' + esc(fix.label) + '</span></div>';
      h += '<pre>' + esc(fix.snippet) + '</pre>';
      h += '</div>';
    });
    h += '</div>';
  } else {
    h += '<div class="flex-1 text-xs text-gray-600 italic self-center">No pre-defined analysis for this endpoint.</div>';
  }

  h += '</div>';
  return h;
}

/* ── live metrics table ── */
function renderTable() {
  var method = document.getElementById('f-method').value;
  var sortBy = document.getElementById('f-sort').value;
  var search = document.getElementById('f-search').value.toLowerCase();

  var data = liveStats.filter(function(s) {
    if (method && s.method !== method) return false;
    if (search && s.path.toLowerCase().indexOf(search) === -1) return false;
    return true;
  });

  data.sort(function(a, b) {
    if (sortBy === 'max')    return b.maxTime - a.maxTime;
    if (sortBy === 'calls')  return b.count - a.count;
    if (sortBy === 'errors') return b.errorRate - a.errorRate;
    return b.avgTime - a.avgTime;
  });

  var tbody = document.getElementById('live-tbody');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center py-16 text-gray-600">No matching endpoints.</td></tr>';
    return;
  }

  var html = '';
  data.forEach(function(s, i) {
    var rid = 'exp-' + i;
    var hasA = !!findAnalysis(s.method, s.path);
    var tc = timeColor(s.avgTime);

    html += '<tr class="data-row border-t border-gray-800" onclick="toggleRow(\'' + rid + '\')">';
    html += '<td class="px-3 py-3 text-center text-gray-600"><span id="chev-' + rid + '" class="chevron text-xs">' + (hasA ? '&#9654;' : '') + '</span></td>';
    html += '<td class="px-3 py-3">' + methodBadge(s.method) + '</td>';
    html += '<td class="px-3 py-3 font-mono text-xs text-gray-300">' + dot(s.avgTime) + ' <span class="ml-2">' + esc(s.path) + '</span></td>';
    html += '<td class="px-4 py-3 text-right font-mono font-semibold ' + tc + '">' + fmtTime(s.avgTime) + '</td>';
    html += '<td class="px-4 py-3 text-right font-mono text-gray-500">' + fmtTime(s.p95) + '</td>';
    html += '<td class="px-4 py-3 text-right font-mono text-gray-500">' + fmtTime(s.maxTime) + '</td>';
    html += '<td class="px-4 py-3 text-right text-gray-400">' + s.count + '</td>';
    html += '<td class="px-4 py-3 text-right ' + (s.errorRate > 0 ? 'text-red-400' : 'text-gray-600') + '">' + s.errorRate + '%</td>';
    html += '<td class="px-4 py-3 text-right text-gray-600 text-xs">' + fmtDate(s.lastCalled) + '</td>';
    html += '<td class="px-4 py-3">' + sparkSvg(s.sparkline) + '</td>';
    html += '</tr>';

    html += '<tr id="' + rid + '" class="expand-row border-t border-gray-800 bg-gray-900/70">';
    html += '<td colspan="10" class="px-6 py-4">' + detailHtml(s) + '</td>';
    html += '</tr>';
  });

  tbody.innerHTML = html;
}

/* ── code analysis grid ── */
function renderAnalysisGrid() {
  var grid = document.getElementById('analysis-grid');
  var html = '';

  var sorted = analysisData.slice().sort(function(a, b) {
    var order = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.severity] || 9) - (order[b.severity] || 9);
  });

  sorted.forEach(function(a) {
    var sc = sevColor(a.severity);
    html += '<div class="rounded-xl border border-gray-800 sev-' + a.severity + ' p-5">';

    /* card header */
    html += '<div class="flex items-start justify-between gap-4 mb-4">';
    html += '<div>';
    html += '<div class="flex flex-wrap items-center gap-2 mb-1.5">';
    html += methodBadge(a.method);
    html += '<code class="text-sm text-gray-200 font-mono">' + esc(a.path) + '</code>';
    html += '</div>';
    html += '<p class="text-sm text-gray-400">' + esc(a.summary) + '</p>';
    html += '</div>';
    html += '<div class="flex items-center gap-2 flex-shrink-0">';
    html += '<span class="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-500">' + esc(a.category) + '</span>';
    html += '<span class="text-xs font-bold uppercase ' + sc + '">' + a.severity + '</span>';
    html += '</div>';
    html += '</div>';

    html += '<div class="grid md:grid-cols-2 gap-6">';

    /* issues */
    html += '<div>';
    html += '<div class="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-3">Problems</div>';
    html += '<ul class="space-y-2">';
    a.issues.forEach(function(issue) {
      html += '<li class="text-sm text-gray-300 flex gap-2.5"><span class="text-red-500 flex-shrink-0 mt-px">●</span>' + esc(issue) + '</li>';
    });
    html += '</ul>';
    html += '<div class="mt-4 text-sm text-gray-500">Estimated gain after fix: <span class="text-green-400 font-semibold">' + esc(a.gain) + '</span></div>';
    html += '</div>';

    /* fixes */
    html += '<div>';
    html += '<div class="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-3">How to Fix</div>';
    html += '<div class="space-y-4">';
    a.fixes.forEach(function(fix) {
      html += '<div>';
      html += '<div class="flex items-center gap-2 mb-1.5">' + pBadge(fix.priority) + '<span class="text-sm font-medium text-gray-200">' + esc(fix.label) + '</span></div>';
      html += '<pre>' + esc(fix.snippet) + '</pre>';
      html += '</div>';
    });
    html += '</div></div></div></div>';
  });

  grid.innerHTML = html;
}

/* ── reset ── */
function doReset() {
  fetch('/user/api/report/reset', { method: 'POST' }).then(fetchData);
}

/* ── fetch & refresh ── */
var analysisLoaded = false;
function fetchData() {
  fetch('/user/api/report/data')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      liveStats    = data.stats    || [];
      analysisData = data.analysis || [];
      updateSummary(liveStats);
      renderTable();
      if (!analysisLoaded && analysisData.length) {
        renderAnalysisGrid();
        analysisLoaded = true;
      }
      document.getElementById('last-updated').textContent =
        'Updated ' + new Date().toLocaleTimeString();
    })
    .catch(function(e) { console.error('Report fetch error:', e); });
}

fetchData();
setInterval(fetchData, 5000);
</script>
</body>
</html>`;
}

module.exports = router;
