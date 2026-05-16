const stats = new Map();

function normalizePath(url) {
  return url
    .split('?')[0]
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
}

function performanceMonitor(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - start) / 1e6;
    const path = normalizePath(req.originalUrl);
    const key = `${req.method} ${path}`;

    if (!stats.has(key)) {
      stats.set(key, {
        method: req.method,
        path,
        count: 0,
        totalTime: 0,
        maxTime: 0,
        minTime: Infinity,
        errors: 0,
        recentTimes: [],
        lastCalled: null,
        statusCodes: {},
      });
    }

    const s = stats.get(key);
    s.count++;
    s.totalTime += duration;
    if (duration > s.maxTime) s.maxTime = duration;
    if (duration < s.minTime) s.minTime = duration;
    s.lastCalled = new Date().toISOString();
    if (res.statusCode >= 400) s.errors++;

    const code = String(res.statusCode);
    s.statusCodes[code] = (s.statusCodes[code] || 0) + 1;

    s.recentTimes.push(Math.round(duration));
    if (s.recentTimes.length > 100) s.recentTimes.shift();
  });

  next();
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(Math.ceil((p / 100) * sorted.length) - 1, sorted.length - 1)];
}

function getStats() {
  return Array.from(stats.values()).map(s => ({
    method: s.method,
    path: s.path,
    count: s.count,
    avgTime: s.count ? Math.round(s.totalTime / s.count) : 0,
    p95: percentile(s.recentTimes, 95),
    maxTime: Math.round(s.maxTime),
    minTime: s.minTime === Infinity ? 0 : Math.round(s.minTime),
    errors: s.errors,
    errorRate: s.count ? +((s.errors / s.count) * 100).toFixed(1) : 0,
    lastCalled: s.lastCalled,
    statusCodes: s.statusCodes,
    sparkline: s.recentTimes.slice(-20),
  })).sort((a, b) => b.avgTime - a.avgTime);
}

function resetStats() {
  stats.clear();
}

module.exports = { performanceMonitor, getStats, resetStats };
