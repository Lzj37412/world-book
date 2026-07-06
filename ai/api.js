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

/**
 * 调用 AI API
 * @param {string} systemPrompt - 系统提示词（GM 角色）
 * @param {string} userPrompt - 用户输入（含当前记忆回填）
 * @param {object} [configOverride] - 可选，临时覆盖 API 配置（用于创世界路由）
 * @returns {Promise<string>} AI 回复文本
 */
async function callAI(systemPrompt, userPrompt, configOverride) {
  const config = configOverride || getConfig();
  const provider = config.provider || 'ds';
  const apiKey = config.apiKey || '';

  if (!apiKey) {
    throw new Error('未配置 API Key，请在 ⚙️ 设置中填写');
  }

  if (provider === 'gemini') {
    return callGemini(systemPrompt, userPrompt, config);
  }
  return callOpenAI(systemPrompt, userPrompt, config);
}

/** OpenAI 兼容接口（DeepSeek / 本地模型等） */
async function callOpenAI(systemPrompt, userPrompt, config) {
  const endpoint = (config.endpoint || 'https://api.deepseek.com').replace(/\/+$/, '');
  const model = config.model || 'deepseek-chat';

  const body = {
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.85
  };
  // 硅基流动 Qwen 默认开启思考模式→关闭，避免思维链干扰输出
  if (config.provider === 'sf') body.enable_thinking = false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  // endpoint 已经是完整 URL（含 /v1/chat/completions）
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify(body),
    signal: controller.signal
  });
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
async function callGemini(systemPrompt, userPrompt, config) {
  const endpoint = (config.endpoint || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
  const model = config.model || 'gemini-2.0-flash';

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.85,
      maxOutputTokens: 4096
    }
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  const url = `${endpoint}/v1beta/models/${model}:generateContent?key=${config.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: controller.signal
  });
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
