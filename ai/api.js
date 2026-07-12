// ============================================================
// AI API 调用模块
// 支持 OpenAI 兼容接口（DeepSeek 等）和 Google Gemini
// 配置从 localStorage 读取，通过页面设置面板写入
// ============================================================

function getConfig() {
  try {
    return JSON.parse(localStorage.getItem('ai_config') || '{}');
  } catch (e) {
    return {};
  }
}

function hasApiKey() {
  const cfg = getConfig();
  return !!cfg.apiKey;
}

// ---------- 联网搜索（走本地后端代理） ----------

/**
 * 调用本地后端的百度搜索代理
 * @param {string} query
 * @returns {Promise<Array>} 搜索结果数组 [{title, url, content, snippet, website}]
 */
async function callSearch(query) {
  const encoded = encodeURIComponent(query.trim());
  const server = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? '' : 'https://world-book-production.up.railway.app';
  const res = await fetch(`${server}/api/search?q=${encoded}`);
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`搜索失败 ${res.status}: ${t.slice(0, 100)}`);
  }
  const data = await res.json();
  return data.results || [];
}

/**
 * 调用 AI API
 * @param {string} systemPrompt - 系统提示词（GM 角色）
 * @param {string} userPrompt - 用户输入（含当前记忆回填）
 * @param {object} [configOverride] - 可选，临时覆盖 API 配置（用于创世界路由）
 * @param {object} [opts] - 可选，{maxTokens, temperature, timeoutMs}
 * @returns {Promise<string>} AI 回复文本
 */
async function callAI(systemPrompt, userPrompt, configOverride, opts) {
  const config = configOverride || getConfig();
  const provider = config.provider || 'ds';
  const apiKey = config.apiKey || '';

  if (!apiKey) {
    throw new Error('未配置 API Key，请在 ⚙️ 设置中填写');
  }

  if (provider === 'gemini') {
    return callGemini(systemPrompt, userPrompt, config, opts);
  }
  return callOpenAI(systemPrompt, userPrompt, config, opts);
}

/** OpenAI 兼容接口（DeepSeek / 本地模型等） */
async function callOpenAI(systemPrompt, userPrompt, config, opts) {
  const endpoint = (config.endpoint || 'https://api.deepseek.com').replace(/\/+$/, '');
  const model = config.model || 'deepseek-chat';
  const maxTokens = opts?.maxTokens || 1600;
  const temperature = opts?.temperature ?? 0.65;
  const timeoutMs = opts?.timeoutMs || 120000;

  const body = {
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: temperature,
    max_tokens: maxTokens
  };
  // 硅基流动 Qwen 默认开启思考模式→关闭，避免思维链干扰输出
  if (config.provider === 'sf') body.enable_thinking = false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  // endpoint 已经是完整 URL（含 /v1/chat/completions）
  let res;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') {
      throw new Error('本轮请求过重，超时未响应，建议精简输入或重试');
    }
    throw e;
  }
  clearTimeout(timeout);

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try { const errBody = await res.text(); if (errBody) errMsg += `: ${errBody}`; } catch (_) {}
    throw new Error(errMsg);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

/** Google Gemini 接口 */
async function callGemini(systemPrompt, userPrompt, config, opts) {
  const endpoint = (config.endpoint || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
  const model = config.model || 'gemini-2.0-flash';
  const maxTokens = opts?.maxTokens || 1600;
  const temperature = opts?.temperature ?? 0.65;
  const timeoutMs = opts?.timeoutMs || 90000;

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: temperature,
      maxOutputTokens: maxTokens
    }
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${endpoint}/v1beta/models/${model}:generateContent?key=${config.apiKey}`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') {
      throw new Error('本轮请求过重，超时未响应，建议精简输入或重试');
    }
    throw e;
  }
  clearTimeout(timeout);

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try { const d = await res.json(); errMsg = d.error?.message || d.error?.status || errMsg; } catch (_) {}
    throw new Error(errMsg);
  }

  const data = await res.json();
  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('Gemini 未返回内容（可能被安全过滤）');
  }
  return data.candidates[0].content.parts[0].text;
}
