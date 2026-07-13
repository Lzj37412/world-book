// ============================================================
// AI 记忆沙盒 · 轻量后端服务器
// 职责：静态文件服务 + 百度搜索代理 + facts_cache 缓存
// ============================================================

const http = require('http');
const fs = require('fs');
const path = require('path');

// ---- 配置 ----
const PORT = process.env.PORT || 3000;
const ROOT = path.resolve(__dirname, '..'); // 项目根目录
const CACHE_PATH = path.join(ROOT, 'facts_cache.json');
const BAIDU_KEY = process.env.BAIDU_KEY || '';

// ---- MIME 类型 ----
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
};

// ---- facts_cache 读写 ----
function loadCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); }
  catch (e) { return {}; }
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

// ---- 百度千帆搜索 API ----
async function baiduSearch(query) {
  const body = JSON.stringify({
    messages: [{ content: query, role: 'user' }],
    search_source: 'baidu_search_v2',
    resource_type_filter: [{ type: 'web', top_k: 5 }]
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let res;
  try {
    res = await fetch('https://qianfan.baidubce.com/v2/ai_search/web_search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BAIDU_KEY}`,
        'Content-Type': 'application/json'
      },
      body,
      signal: controller.signal
    });
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') throw new Error('百度搜索超时');
    throw e;
  }
  clearTimeout(timeout);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`百度搜索 API ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.references || [];
}

// ---- 静态文件服务 ----
function serveStatic(req, res) {
  const parsed = new URL(req.url, `http://${req.headers.host}`);
  let p = parsed.pathname;
  if (p === '/') p = '/index.html';

  const filePath = path.join(ROOT, p);

  // 安全检查：禁止跳出项目根目录
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

// ---- 请求路由 ----
const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsed = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsed.pathname;

  // ---- API: 搜索代理 ----
  if (pathname === '/api/search' && req.method === 'GET') {
    const query = (parsed.searchParams.get('q') || '').trim();
    if (!query) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Missing ?q=' }));
      return;
    }

    // 查缓存
    const cache = loadCache();
    const cached = cache[query];
    if (cached) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ source: 'cache', results: cached }));
      return;
    }

    // 真实搜索
    baiduSearch(query).then(results => {
      // 缓存
      cache[query] = results;
      saveCache(cache);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ source: 'baidu', results }));
    }).catch(err => {
      console.error('搜索失败:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  // ---- API: 查看 facts_cache ----
  if (pathname === '/api/facts' && req.method === 'GET') {
    const cache = loadCache();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(cache));
    return;
  }

  // ---- API: 清空 facts_cache ----
  if (pathname === '/api/facts/clear' && req.method === 'POST') {
    saveCache({});
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // ---- 默认：静态文件 ----
  serveStatic(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ 记忆沙盒服务器启动 → http://localhost:${PORT}`);
  console.log(`   ${ROOT}`);
});
