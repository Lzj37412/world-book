// ============================================================
// AI记忆沙盒 · RPG冒险模式快捷行动条 真实AI集成测试
// 验证 index.html 里 6 个快捷按钮对应的文案，喂给真实 AI 后
// 是否都能得到合理、不冲突的叙事结果（尤其"主动出击"应触发战斗协议，
// 其余 5 个不应该被误判为战斗）
// ============================================================

const https = require('https');

const API_KEY = 'sk-fgvotzmbnvbrwtqttumeasjadevahfkpmyesepyfkkurptwc';
const ENDPOINT = 'https://api.siliconflow.cn/v1/chat/completions';
const MODEL = 'deepseek-ai/DeepSeek-V4-Flash';

// ---------- 与 index.html 完全一致的 6 条快捷文案 ----------
const RPG_QUICK_ACTION_TEXT = {
  explore: '我在周围四处探索一下，看看有什么发现',
  quest: '我想去找人接个委托或任务做',
  encounter: '我继续往前走，看看路上会遇到什么',
  fight: '我主动寻找冲突，找人打一场',
  talk: '我想找附近的人聊聊，打听点消息',
  rest: '我找个地方休整一下，恢复状态'
};

// ---------- 从 index.html 提取的函数（与 rpg_mode_test.js 保持一致） ----------

const NPC_INDEPENDENCE_CORE = 'NPC 是独立个体，有自己的立场、利益和判断标准。';

function rpgModeRules() {
  return `${NPC_INDEPENDENCE_CORE}
【RPG冒险模式｜RPG Adventure】
这是传统 RPG 的玩法：玩家扮演自己的角色，探索、战斗、成长。与自由模式不同——你要直接写玩家角色本身的行动和结果，不用只写世界那一半。

玩家说要做什么，你就叙述这个行动实际发生的过程和结果（走进哪、打到了什么、找到了什么、和谁交谈），不用像自由模式那样把玩家的动作和决定留白。

遇到正面冲突（打怪、比武、拦路劫道等）时，按照【战斗协议】声明参战方，交给程序结算，不要自己编胜负。程序返回结果后，你负责写战斗带来的后续剧情——受伤、掉落、经验、士气变化等。

世界里的挑战应当有循序渐进的强度感，不要一上来就是足以团灭的强敌；同时也不需要每次战斗都刻意保证玩家能赢——按世界设定的合理逻辑铺展遇到的对手即可。

探索、解谜、收集、交谈、做委托等非战斗行动，仍按世界设定的因果自由发挥，不必绑定固定的任务模板。`;
}

function combatProtocol() {
  return `【战斗协议】
战斗的数值结算由程序负责，不是你的职责——你只需要在故事需要开战时"声明战斗"，程序会自动算出结果并把结果告诉你，你负责把结果写成后续剧情。

以下五个字段名是程序识别的固定协议关键字，必须逐字使用这几个中文词，不能按自己的命名习惯改写、翻译成英文或替换成同义词，否则程序无法识别、战斗数值不会生效：
"战斗"、"战斗属性"、"元素克制"、"元素"、"技能加成"
这几个字段专门给程序识别战斗数据用，和你自己命名的其他世界数据字段（比如地点、天气、剧情线之类，命名不受限制）是两套不同的东西，不要混淆。

触发战斗：故事中出现正面冲突时，在 STATE 中加入 "战斗" 字段，两个键分别是参战双方（键名自定，比如"我方"/"敌方"，或具体阵营名），值是参战角色的名字数组。例如：
"战斗": {"张三": ["张三"], "黑风寨": ["黑风寨群匪甲", "黑风寨群匪乙"]}
这个字段只在触发那一轮写一次，程序处理后会自动移除，不用你手动删，也不用管它有没有出现在下一轮 STATE 里。声明 "战斗" 的这一轮，必须在同一份 STATE 里把双方的 "战斗属性" 一起写出来，不能只声明战斗、把数值留到下一轮——尤其是玩家指令里直接给了具体数字时，必须原样写进这一轮的 "战斗属性"，不能漏写导致程序套用默认值。

维护数值：在 STATE 的 "战斗属性" 字段里，为可能参战的角色维护 {生命, 攻击, 防御, 速度} 四个数值（数字类型）。没有出现在 "战斗属性" 里的角色，程序会给一份中庸的默认值。战斗造成的生命变化由程序写回这个字段，之后你要按这个字段延续伤势、死亡等因果——不要在叙事里说角色没事，除非 "战斗属性" 显示他满血。

【元素克制（可选）】参考世界观自我完善——比如宝可梦式的属性克制、武侠式的招式相克、赛博朋克式的电子干扰克机械等，元素名字、谁克谁、克制多少倍伤害全部由你根据这个世界的设定自己决定，不必套用某个具体作品的规则。如果这个世界里的战斗有克制关系，在 STATE 的 "元素克制" 字段声明，格式是数组，每一条 {"克制方": "元素名", "被克方": "元素名", "倍率": 数字}，例如：
"元素克制": [{"克制方": "火", "被克方": "草", "倍率": 2}, {"克制方": "电", "被克方": "机械单位", "倍率": 1.5}]
然后在角色的 "战斗属性" 里给带元素的角色加一个 "元素" 字段（数组，如 ["火"]）。程序结算时会查这张表，双方元素有克制关系就按你给的倍率放大伤害，没有克制关系或整个世界不需要元素系统就不用写这两个字段，程序按普通四维计算。

【技能加成（可选）】如果角色在这场战斗里使用了技能、法术、装备增益等，效果如何全部由你按剧情自由发挥，只需要把这次生效的攻击力加值换算成一个数字，写进该角色 "战斗属性" 里的 "技能加成" 字段（这一轮的临时加值，不写则视为0，不会自动累加到下一场战斗）。程序只是把这个数字加进攻击力参与计算，不会判断技能本身是否合理、加成多少合适——那是你的叙事判断，不是程序的职责。

玩家有最终裁定权：如果玩家在指令里直接给出了具体数字（比如"这次技能加成按200算"、"这个元素倍率调成3倍"），把玩家给的数字原样写进对应字段，不要自己按"合理性"打折或改成别的数值，你只需要负责编一个说得过去的叙事理由（技能融合、装备觉醒、灵气爆发等）去承接这个数字。玩家的数值指令始终优先于你自己对平衡性的判断。

读取结果：程序结算后会在 "战斗结果" 字段给你一句话摘要（胜方、阵亡名单）。下一轮你据此续写战斗的后果、余波和角色反应，不要重新描述或改判战斗过程本身——过程已经是确定的事实，只有结果之后发生的事才是你的叙事空间。`;
}

function coreMemoryRules() {
  return `按照玩家（我）指定首次创造世界类型默认剧本进行，若无指定或含糊表达，请自我完善丰富其世界类型；世界的暗流和动态会自然出现在叙事中——即使玩家没有主动询问，世界的其他角落也在发生事情。

我（玩家）可以选择旁观这个世界自然发展，也可以选择出手干预。每次选择都会产生对应的因果，你负责按着因果自行推演剧情。

世界里的NPC各有各的生活，并自身带有性格、行为等。玩家对NPC提出的要求或建议，NPC会根据自身性格、立场和当下处境判断是否接受，不会因为玩家说了就照做。`;
}

function stateOutputProtocol() {
  return `【STATE 输出格式】
先写叙事，再输出 STATE 快照。STATE 是当前世界的完整快照，不是增量更新。

<<STATE>>
{"world": "世界名", "location": "位置", ...}
<<ENDSTATE>>

规则：
- 叙事在先，STATE 在后。不要把叙事内容放到STATE里面。
- 字段用中文。
- 没有变化的字段也要包含（继承），不再有效的字段不要包含。
- 字段名称、层级、内容不做限制。AI自己决定记什么。`;
}

function systemPrompt(memory) {
  const m = memory || {};
  const world = m.world || m.世界观 || m.世界 || '这个世界';
  const identity = m.玩家身份 || m.player || m.身份 || m.玩家 || m.玩家角色 || '一个旅人';
  const location = m.位置 || m.location || m.地点 || m.当前位置 || '';

  let prompt = `我在创造一个RPG冒险世界。你是GM，负责运行一场可以探索、战斗、成长的冒险。世界的默认设定是自主运转的，不会因为任何事情停下。

【GM 设定摘要】
世界背景：${world}
玩家角色：${identity}。`;
  if (location) prompt += `\n当前位置：${location}。`;

  prompt += '\n\n' + coreMemoryRules();
  prompt += '\n\n' + rpgModeRules();
  prompt += '\n\n' + stateOutputProtocol();
  prompt += '\n\n' + combatProtocol();

  return prompt;
}

function buildWorldPrompt(form) {
  let prompt = '';
  const parts = [];
  if (form.world) parts.push(`这是一场发生在${form.world}的RPG冒险`);
  if (form.player) parts.push(`玩家以${form.player}的身份开始这段旅程`);
  if (form.npcs) parts.push(`这个世界中有${form.npcs}`);
  if (form.goals) parts.push(`故事走向大致是${form.goals}`);

  prompt += `以下是由玩家创造的世界设定。你作为GM负责在这个设定基础上运行一场可以探索、战斗、成长的冒险：
"`;
  prompt += parts.join('。');
  if (form.scene) prompt += `。${form.scene}`;
  prompt += `"

以一个自然的场景直接开场。不需要解释世界，呈现一个活着的切片。
用第二人称"你"来叙事（指玩家角色），不要用"我"。

直接写玩家角色本身的行动和处境，不要只写世界那一半。
最后输出 STATE 快照：
<<STATE>>
{"world": "世界名", "location": "位置", ...}
<<ENDSTATE>>
包含所有需要长期记忆的事实。AI 自己决定有哪些字段。
请为玩家角色在 STATE 中初始化"战斗属性"字段（{生命,攻击,防御,速度}四个数值），供后续战斗结算使用。`;
  return prompt;
}

function flattenValue(val, indent = 0) {
  const pad = '  '.repeat(indent);
  if (val === null || val === undefined) return `${pad}（无）`;
  if (typeof val === 'string') return `${pad}${val}`;
  if (typeof val === 'number' || typeof val === 'boolean') return `${pad}${String(val)}`;
  if (Array.isArray(val)) {
    if (val.length === 0) return `${pad}（无）`;
    const hasObjectItems = val.some(v => typeof v === 'object' && v !== null);
    if (!hasObjectItems) return val.map(v => flattenValue(v, indent)).join(', ');
    return val.map((v, i) => {
      if (typeof v === 'object' && v !== null) return `${pad}[${i + 1}]\n${flattenValue(v, indent + 1)}`;
      return `${pad}${flattenValue(v, indent)}`;
    }).join('\n');
  }
  if (typeof val === 'object') {
    const entries = Object.entries(val);
    if (entries.length === 0) return `${pad}（空）`;
    return entries.map(([k, v]) => {
      if (typeof v === 'object' && v !== null) return `${pad}${k}:\n${flattenValue(v, indent + 1)}`;
      return `${pad}${k}: ${v}`;
    }).join('\n');
  }
  return `${pad}${String(val)}`;
}

function buildPrompt(input, memory, recentHistory) {
  const worldDesc = memory && memory.世界设定原文 ? memory.世界设定原文 : '';
  const suppressKeys = ['世界设定原文'];
  const dataLines = Object.entries(memory || {})
    .filter(([k]) => !suppressKeys.includes(k))
    .map(([key, val]) => {
      const v = flattenValue(val, 0);
      if (typeof val === 'object' && val !== null && !Array.isArray(val) && Object.keys(val).length > 0) {
        return `${key}:\n${v}`;
      }
      return `${key}: ${v}`;
    });
  const dataText = dataLines.length > 0 ? dataLines.join('\n') : '';
  const historyText = (recentHistory && recentHistory.length > 0)
    ? recentHistory.map(h => `玩家：${h.input}\nGM：${h.narrative}`).join('\n\n')
    : '（无）';

  let worldSection = '';
  if (worldDesc) {
    worldSection = `【当前世界】\n${worldDesc}`;
    if (dataText) worldSection += `\n\n【世界数据】\n${dataText}`;
  } else if (dataText) {
    worldSection = `【当前世界状态】\n${dataText}`;
  } else {
    worldSection = '（无）';
  }

  return `【最近对话】\n${historyText}\n\n${worldSection}\n\n【玩家行动】\n${input}\n\n根据当前状态和玩家行动推进剧情。基于已有事实延续发展，不重复描写已经建立的环境细节。\n\n---\n请在叙事结束后输出 STATE 快照（<<STATE>>...<<ENDSTATE>>）\n字段名与上一轮保持一致，不要临时改用新的命名方式描述同一件事。 ---`;
}

function parseAIOutput(text) {
  let narrative = text;
  let state = null;
  function tryParse(jsonStr) {
    try { return JSON.parse(jsonStr); }
    catch (e) {
      const fixed = jsonStr.replace(/,\s*([}\]])/g, '$1');
      try { return JSON.parse(fixed); } catch (e2) { return null; }
    }
  }
  const markerMatch = text.match(/<<STATE>>\s*\n?([\s\S]*?)<<ENDSTATE>>/);
  if (markerMatch) {
    const raw = markerMatch[1].trim();
    state = tryParse(raw);
    if (!state) {
      const kvLines = raw.split('\n');
      const kv = {};
      let hasKV = false;
      for (const line of kvLines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const k = line.substring(0, colonIdx).trim();
          const v = line.substring(colonIdx + 1).trim();
          if (k && v) { kv[k] = v; hasKV = true; }
        }
      }
      if (hasKV) state = kv;
    }
    narrative = text.replace(markerMatch[0], '').trim();
    return { narrative, state };
  }
  const blockMatch = text.match(/```\w*\s*\n?([\s\S]*?)```/);
  if (blockMatch) {
    state = tryParse(blockMatch[1].trim());
    narrative = text.replace(blockMatch[0], '').trim();
    return { narrative, state };
  }
  const lastClose = text.lastIndexOf('}');
  if (lastClose > 0) {
    const lastOpen = text.lastIndexOf('{', lastClose);
    if (lastOpen >= 0) {
      state = tryParse(text.substring(lastOpen, lastClose + 1));
      if (state) { narrative = text.substring(0, lastOpen).trim(); return { narrative, state }; }
    }
  }
  return { narrative, state };
}

function updateMemory(oldMemory, newState) {
  if (!newState || typeof newState !== 'object' || Object.keys(newState).length === 0) return false;
  const preservedDesc = oldMemory.世界设定原文 || null;
  Object.keys(oldMemory).forEach(k => delete oldMemory[k]);
  Object.assign(oldMemory, newState);
  if (preservedDesc) oldMemory.世界设定原文 = preservedDesc;
  return true;
}

// ---------- 战斗结算（与 index.html 一致，用于验证"主动出击"是否走程序判定） ----------

const COMBAT_DEFAULT_STATS = { 生命: 20, 攻击: 5, 防御: 3, 速度: 5 };
const COMBAT_MAX_ROUNDS = 500;

function buildElementCounterMap(counters) {
  const map = new Map();
  if (Array.isArray(counters)) {
    counters.forEach(entry => {
      if (entry && entry.克制方 && entry.被克方 && Number.isFinite(entry.倍率)) {
        map.set(`${entry.克制方}→${entry.被克方}`, entry.倍率);
      }
    });
  }
  return map;
}

function elementMultiplier(counterMap, attackerElements, targetElements) {
  if (!counterMap.size || !Array.isArray(attackerElements) || !Array.isArray(targetElements)) return 1;
  let best = 1;
  attackerElements.forEach(a => {
    targetElements.forEach(t => {
      const mult = counterMap.get(`${a}→${t}`);
      if (Number.isFinite(mult) && mult > best) best = mult;
    });
  });
  return best;
}

const COMBAT_FIELD_ALIASES = {
  战斗: ['combat', 'battle'],
  战斗属性: ['combat_attributes', 'combatStats', 'battle_stats'],
  元素克制: ['element_crushing', 'element_system', 'elemental_counters']
};

function normalizeCombatFieldAliases(memory) {
  if (!memory || typeof memory !== 'object') return;
  Object.entries(COMBAT_FIELD_ALIASES).forEach(([canonical, aliases]) => {
    if (memory[canonical] !== undefined) return;
    for (const alias of aliases) {
      if (memory[alias] !== undefined) {
        memory[canonical] = memory[alias];
        delete memory[alias];
        break;
      }
    }
  });
}

function resolveCombat(sides, statsMap, elementCounters) {
  const stats = statsMap || {};
  const sideNames = Object.keys(sides || {});
  if (sideNames.length !== 2) return null;
  const counterMap = buildElementCounterMap(elementCounters);

  const fighters = [];
  sideNames.forEach(sideName => {
    const names = Array.isArray(sides[sideName]) ? sides[sideName] : [];
    names.forEach(name => {
      const base = stats[name] || {};
      fighters.push({
        name,
        side: sideName,
        生命: Number.isFinite(base.生命) ? base.生命 : COMBAT_DEFAULT_STATS.生命,
        攻击: Number.isFinite(base.攻击) ? base.攻击 : COMBAT_DEFAULT_STATS.攻击,
        防御: Number.isFinite(base.防御) ? base.防御 : COMBAT_DEFAULT_STATS.防御,
        速度: Number.isFinite(base.速度) ? base.速度 : COMBAT_DEFAULT_STATS.速度,
        元素: Array.isArray(base.元素) ? base.元素 : [],
        技能加成: Number.isFinite(base.技能加成) ? base.技能加成 : 0
      });
    });
  });
  if (fighters.length === 0) return null;

  fighters.sort((a, b) => b.速度 - a.速度);
  const log = [];
  let rounds = 0;

  function aliveOf(sideName) {
    return fighters.filter(f => f.side === sideName && f.生命 > 0);
  }

  while (rounds < COMBAT_MAX_ROUNDS) {
    const [sideA, sideB] = sideNames;
    if (aliveOf(sideA).length === 0 || aliveOf(sideB).length === 0) break;

    for (const attacker of fighters) {
      if (attacker.生命 <= 0) continue;
      const enemySide = attacker.side === sideA ? sideB : sideA;
      const enemies = aliveOf(enemySide);
      if (enemies.length === 0) break;

      const target = enemies.reduce((weakest, f) => f.生命 < weakest.生命 ? f : weakest, enemies[0]);
      const rawAttack = attacker.攻击 + attacker.技能加成;
      const multiplier = elementMultiplier(counterMap, attacker.元素, target.元素);
      const damage = Math.max(1, Math.round(rawAttack * multiplier) - target.防御);
      target.生命 -= damage;
      const multNote = multiplier > 1 ? `（元素克制×${multiplier}）` : '';
      log.push(`${attacker.name} 对 ${target.name} 造成 ${damage} 点伤害${multNote}`);
      if (target.生命 <= 0) log.push(`💀 ${target.name} 倒下`);

      if (aliveOf(sideA).length === 0 || aliveOf(sideB).length === 0) break;
    }
    rounds++;
  }

  const [sideA, sideB] = sideNames;
  const aliveA = aliveOf(sideA).length > 0;
  const aliveB = aliveOf(sideB).length > 0;
  const winner = aliveA && !aliveB ? sideA : (!aliveA && aliveB ? sideB : null);
  const fallen = fighters.filter(f => f.生命 <= 0).map(f => f.name);

  const updatedStats = {};
  fighters.forEach(f => {
    updatedStats[f.name] = { 生命: Math.max(0, f.生命), 攻击: f.攻击, 防御: f.防御, 速度: f.速度 };
    if (f.元素.length > 0) updatedStats[f.name].元素 = f.元素;
  });

  return { log, winner, fallen, updatedStats };
}

// ---------- AI API 调用 ----------

function callAI(messages) {
  const body = JSON.stringify({
    model: MODEL,
    messages,
    max_tokens: 4096,
    temperature: 0.8
  });

  return new Promise((resolve, reject) => {
    const url = new URL(ENDPOINT);
    const opts = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          return;
        }
        try {
          const json = JSON.parse(data);
          resolve(json.choices[0].message.content);
        } catch (e) {
          reject(new Error('Parse failed: ' + e.message + '\n' + data.slice(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ---------- 测试工具 ----------

let passed = 0, failed = 0;

function check(ok, label, detail) {
  if (ok) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}`);
    if (detail) console.log(`     ${detail}`);
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// 主线流程：依次点击 6 个快捷按钮，观察 AI 反应是否合理
// ============================================================

async function main() {
  console.log('\n═══════════════════════════════════');
  console.log('  AI 记忆沙盒 · RPG快捷行动条 测试');
  console.log('  模型: DeepSeek-V4-Flash (硅基流动)');
  console.log('═══════════════════════════════════\n');

  const memory = {};
  const history = [];

  // ---- 创世界 ----
  console.log('─── 创建 RPG 世界 ───\n');
  const worldPrompt = buildWorldPrompt({
    world: '边境小镇附近的荒野',
    player: '刚拿到冒险者执照的新人',
    npcs: '镇上的委托板管理员老周、旅店老板娘小芸',
    goals: '从新人做到能独立接高阶委托'
  });
  const createResult = await callAI([
    { role: 'system', content: systemPrompt({}) },
    { role: 'user', content: worldPrompt }
  ]);
  const createParsed = parseAIOutput(createResult);
  if (createParsed.state) {
    createParsed.state.世界设定原文 = '边境小镇附近的荒野RPG冒险，玩家是新人冒险者。';
    updateMemory(memory, createParsed.state);
  }
  console.log(`  📝 ${createParsed.narrative.slice(0, 200)}...\n`);
  history.push({ input: '(创世界)', narrative: createParsed.narrative });
  await sleep(500);

  const order = ['explore', 'quest', 'encounter', 'talk', 'rest', 'fight'];
  const outcomes = {};

  for (const action of order) {
    const text = RPG_QUICK_ACTION_TEXT[action];
    console.log(`─── 快捷行动【${action}】: "${text}" ───\n`);
    const msg = [
      { role: 'system', content: systemPrompt(memory) },
      { role: 'user', content: buildPrompt(text, memory, history) }
    ];
    console.log('  ⏳ 调用 AI...');
    const raw = await callAI(msg);
    const parsed = parseAIOutput(raw);

    check(parsed.state !== null, `[${action}] STATE 存在`);
    check(parsed.narrative.length > 30, `[${action}] 叙事内容非空`);

    if (parsed.state) normalizeCombatFieldAliases(parsed.state);
    const declaredCombat = !!(parsed.state && parsed.state.战斗);
    outcomes[action] = { declaredCombat, narrative: parsed.narrative };

    if (action === 'fight') {
      check(declaredCombat, `[fight] "主动出击"触发了战斗协议声明`, declaredCombat ? '' : `实际字段: ${parsed.state ? Object.keys(parsed.state).join(', ') : '无 state'}`);
      if (declaredCombat) {
        const result = resolveCombat(parsed.state.战斗, parsed.state.战斗属性, parsed.state.元素克制);
        check(result !== null, `[fight] 程序成功结算战斗`);
        if (result) {
          console.log(`     战斗结算: ${result.winner ? result.winner + ' 获胜' : '未分胜负'}，阵亡：${result.fallen.join('、') || '无'}`);
          delete parsed.state.战斗;
          parsed.state.战斗属性 = Object.assign({}, parsed.state.战斗属性, result.updatedStats);
          parsed.state.战斗结果 = result.winner ? `${result.winner} 获胜` : '未分胜负';
        }
      }
    } else {
      check(!declaredCombat, `[${action}] 未被误判为战斗（不应声明"战斗"字段）`, declaredCombat ? `误声明: ${JSON.stringify(parsed.state.战斗)}` : '');
    }

    if (parsed.state) updateMemory(memory, parsed.state);
    console.log(`  📝 ${parsed.narrative.slice(0, 250)}...\n`);
    history.push({ input: text, narrative: parsed.narrative });
    await sleep(500);
  }

  // ---- 结果汇总 ----
  console.log('═══════════════════════════════════');
  console.log('  RPG快捷行动条测试结果');
  console.log('═══════════════════════════════════');
  console.log(`\n  ✅ 通过: ${passed}`);
  console.log(`  ❌ 失败: ${failed}`);
  console.log(`  总计: ${passed + failed} 测试\n`);

  console.log('─── 各按钮结果一览 ───');
  for (const action of order) {
    const o = outcomes[action];
    console.log(`  ${action}: 声明战斗=${o.declaredCombat} | ${o.narrative.slice(0, 60).replace(/\n/g, ' ')}...`);
  }
  console.log('');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('\n❌ 测试崩溃:', e.message);
  process.exit(1);
});
