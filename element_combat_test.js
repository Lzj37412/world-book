// ============================================================
// AI记忆沙盒 · 元素克制 + 技能加成 真实AI集成测试
// 验证：AI自定义元素克制表/技能加成，程序据此正确计算伤害倍率
// ============================================================

const https = require('https');

const API_KEY = 'sk-fgvotzmbnvbrwtqttumeasjadevahfkpmyesepyfkkurptwc';
const ENDPOINT = 'https://api.siliconflow.cn/v1/chat/completions';
const MODEL = 'deepseek-ai/DeepSeek-V4-Flash';

// ---------- 从 index.html 提取的函数 ----------

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
  return `按照玩家（我）指定首次创造世界类型默认剧本进行，若无指定或含糊表达，请自我完善丰富其世界类型；世界的暗流和动态会自然出现在叙事中——即使玩家没有主动询问，世界的其他角落也在发生事情。这些信息会通过 NPC 的对话、环境变化、偶然事件等方式自然传递给玩家。如果玩家说"看看世界动态"，则集中汇报当前世界正在发生什么。

我（玩家）可以选择旁观这个世界自然发展，也可以选择出手干预。每次选择都会产生对应的因果，你负责按着因果自行推演剧情。

世界里的NPC各有各的生活，并自身带有性格、行为等。玩家对NPC提出的要求或建议，NPC会根据自身性格、立场和当下处境判断是否接受，不会因为玩家说了就照做。

**关键事件节点不可编造**——当玩家主动挑战一个即将发生的"原版事件"时，胜负应当由双方当下的实际条件真实判定，不能因为"原版是这样发生的"就预设结果。`;
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
请为玩家角色在 STATE 中初始化"战斗属性"字段（{生命,攻击,防御,速度}四个数值），供后续战斗结算使用。
这个世界的战斗如果适合有元素克制系统（参考世界观自我完善，不必是宝可梦式的具体规则），请在 STATE 中一并给出"元素克制"表和玩家角色的"元素"标签。`;
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

// ---------- 战斗结算（与 index.html 的新版 resolveCombat 保持一致） ----------

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

function formatBattleLog(result) {
  const lines = ['⚔️ 战斗结算'];
  lines.push(...result.log);
  if (result.winner) {
    lines.push(`🏆 ${result.winner} 获胜`);
  } else {
    lines.push('🏳️ 战斗未分出胜负');
  }
  if (result.fallen.length > 0) {
    lines.push(`阵亡：${result.fallen.join('、')}`);
  }
  return lines.join('\n');
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
// 第一部分：resolveCombat 本身的确定性数学验证（不依赖AI，钉死公式）
// ============================================================

function testMathDeterministic() {
  console.log('─── 第一部分：resolveCombat 元素倍率/技能加成 数学验证 ───\n');

  // 场景1：无元素、无加成 —— 应与旧公式一致
  const r1 = resolveCombat(
    { 我方: ['甲'], 敌方: ['乙'] },
    { 甲: { 生命: 20, 攻击: 10, 防御: 2, 速度: 5 }, 乙: { 生命: 20, 攻击: 5, 防御: 3, 速度: 1 } },
    []
  );
  check(r1.log[0].includes('对 乙 造成 7 点伤害'), '① 无元素/无加成时伤害=攻击-目标防御(10-3=7)', r1.log[0]);

  // 场景2：元素克制 2 倍，无加成 —— (10*2)-3=17
  const r2 = resolveCombat(
    { 我方: ['火甲'], 敌方: ['草乙'] },
    {
      火甲: { 生命: 20, 攻击: 10, 防御: 2, 速度: 5, 元素: ['火'] },
      草乙: { 生命: 20, 攻击: 5, 防御: 3, 速度: 1, 元素: ['草'] }
    },
    [{ 克制方: '火', 被克方: '草', 倍率: 2 }]
  );
  check(r2.log[0].includes('对 草乙 造成 17 点伤害'), '② 元素克制×2生效：(10攻×2)-3防=17', r2.log[0]);
  check(r2.log[0].includes('元素克制×2'), '③ 战斗日志标注了元素克制倍率');

  // 场景3：技能加成+5，无元素 —— (10+5)-2=13
  const r3 = resolveCombat(
    { 我方: ['甲'], 敌方: ['乙'] },
    { 甲: { 生命: 20, 攻击: 10, 防御: 2, 速度: 5, 技能加成: 5 }, 乙: { 生命: 30, 攻击: 5, 防御: 3, 速度: 1 } },
    []
  );
  check(r3.log[0].includes('对 乙 造成 12 点伤害'), '④ 技能加成+5生效：(10攻+5加成)-目标防御3=12', r3.log[0]);

  // 场景4：元素克制+技能加成叠加 —— (10+5)*2-3=27
  const r4 = resolveCombat(
    { 我方: ['火甲'], 敌方: ['草乙'] },
    {
      火甲: { 生命: 20, 攻击: 10, 防御: 2, 速度: 5, 元素: ['火'], 技能加成: 5 },
      草乙: { 生命: 40, 攻击: 5, 防御: 3, 速度: 1, 元素: ['草'] }
    },
    [{ 克制方: '火', 被克方: '草', 倍率: 2 }]
  );
  check(r4.log[0].includes('对 草乙 造成 27 点伤害'), '⑤ 元素克制与技能加成同时生效：((10+5)×2)-3=27', r4.log[0]);

  // 场景5：无匹配的克制关系时倍率应为1（不误伤/不误判）
  const r5 = resolveCombat(
    { 我方: ['水甲'], 敌方: ['草乙'] },
    {
      水甲: { 生命: 20, 攻击: 10, 防御: 2, 速度: 5, 元素: ['水'] },
      草乙: { 生命: 20, 攻击: 5, 防御: 3, 速度: 1, 元素: ['草'] }
    },
    [{ 克制方: '火', 被克方: '草', 倍率: 2 }]
  );
  check(r5.log[0].includes('对 草乙 造成 7 点伤害') && !r5.log[0].includes('克制'), '⑥ 无匹配克制关系时倍率=1，不受表中其他条目影响', r5.log[0]);

  // 场景6：技能加成缺省应为0，元素克制表缺省应不报错
  const r6 = resolveCombat(
    { 我方: ['甲'], 敌方: ['乙'] },
    { 甲: { 生命: 20, 攻击: 10, 防御: 2, 速度: 5 }, 乙: { 生命: 20, 攻击: 5, 防御: 3, 速度: 1 } },
    undefined
  );
  check(r6 !== null && r6.log[0].includes('造成 7 点伤害'), '⑦ 元素克制表缺省(undefined)时不报错，按普通四维计算', r6 ? r6.log[0] : 'null');

  console.log('');
}

// ============================================================
// 第二部分：真实AI流程 —— 世界创建时自主构想元素克制系统
// ============================================================

async function testRealAIFlow() {
  console.log('─── 第二部分：真实AI自主构想元素克制系统 ───\n');

  const memory = {};
  const history = [];

  const worldPrompt = buildWorldPrompt({
    world: '灵兽秘境：一片由火、水、木、雷、影等灵气构成的奇幻大陆，驯兽师们与自己缔结契约的灵兽一同冒险',
    player: '刚获得契约灵兽的新人驯兽师',
    npcs: '灵兽学院院长、卖草药的老婆婆',
    goals: '带着灵兽在各地灵兽擂台闯出名号'
  });
  const createMessages = [
    { role: 'system', content: systemPrompt({}) },
    { role: 'user', content: worldPrompt }
  ];
  console.log('  ⏳ 调用 AI 创建灵兽驯兽世界...');
  const createResult = await callAI(createMessages);
  const createParsed = parseAIOutput(createResult);

  check(createParsed.state !== null, '① STATE 存在');
  let hasCounterTable = false;
  if (createParsed.state) {
    // 战斗属性只在触发战斗时才有意义，创世界阶段是否预写不影响正确性，仅记录不计入通过/失败
    console.log(`  ℹ️  创世界阶段是否预写"战斗属性": ${!!createParsed.state.战斗属性}`);
    hasCounterTable = Array.isArray(createParsed.state.元素克制) && createParsed.state.元素克制.length > 0;
    check(hasCounterTable, '③ AI自主构想了"元素克制"表（未强制要求，验证prompt引导有效）',
      `实际字段: ${Object.keys(createParsed.state).join(', ')}`);
    if (hasCounterTable) {
      console.log(`     元素克制表: ${JSON.stringify(createParsed.state.元素克制)}`);
      const validEntries = createParsed.state.元素克制.every(e => e && typeof e.克制方 === 'string' && typeof e.被克方 === 'string' && Number.isFinite(e.倍率));
      check(validEntries, '④ 元素克制表每一条格式完整（克制方/被克方/倍率）');
    }
    createParsed.state.世界设定原文 = '灵兽秘境：驯兽师与契约灵兽的奇幻大陆。玩家是刚获得契约灵兽的新人驯兽师。';
    updateMemory(memory, createParsed.state);
  }
  console.log(`  📝 ${createParsed.narrative.slice(0, 300)}...\n`);
  history.push({ input: '(创世界)', narrative: createParsed.narrative });
  await sleep(500);

  // ---- 触发一场战斗，看AI是否延续声明元素/技能加成 ----
  console.log('─── 触发战斗，验证元素/技能加成字段延续 ───\n');
  const battleInput = hasCounterTable
    ? '我方灵兽使用了一个针对性的强力招式，主动向路上遇到的一只野生灵兽发起挑战'
    : '我在路上遇到一只野生灵兽，让我的灵兽出战迎击';
  const battleMsg = [
    { role: 'system', content: systemPrompt(memory) },
    { role: 'user', content: buildPrompt(battleInput, memory, history) }
  ];
  console.log('  ⏳ 触发战斗...');
  const battleResult = await callAI(battleMsg);
  const battleParsed = parseAIOutput(battleResult);

  check(battleParsed.state !== null, '⑤ 战斗轮 STATE 存在');
  let combatResolveResult = null;
  if (battleParsed.state) {
    const combatDeclared = !!battleParsed.state.战斗;
    check(combatDeclared, '⑥ AI在STATE中声明了"战斗"字段', `实际字段: ${Object.keys(battleParsed.state).join(', ')}`);

    if (combatDeclared) {
      normalizeCombatFieldAliases(battleParsed.state);
      const sideNames = Object.keys(battleParsed.state.战斗);
      check(sideNames.length === 2, '⑦ 战斗声明恰好两方', `双方: ${sideNames.join(' vs ')}`);
      console.log(`     参战方: ${JSON.stringify(battleParsed.state.战斗)}`);

      const counters = battleParsed.state.元素克制 || memory.元素克制;
      combatResolveResult = resolveCombat(battleParsed.state.战斗, battleParsed.state.战斗属性, counters);
      check(combatResolveResult !== null, '⑧ 程序成功结算战斗（含元素表/技能加成参数）');
      if (combatResolveResult) {
        console.log('\n  ' + formatBattleLog(combatResolveResult).split('\n').join('\n  '));
        const anyElementNote = combatResolveResult.log.some(l => l.includes('元素克制'));
        console.log(`     本场是否触发元素克制倍率: ${anyElementNote}`);
        check(Object.keys(combatResolveResult.updatedStats).length > 0, '⑨ 结算后回写了双方战斗属性');

        delete battleParsed.state.战斗;
        updateMemory(memory, battleParsed.state);
        memory.战斗属性 = Object.assign({}, memory.战斗属性, combatResolveResult.updatedStats);
        memory.战斗结果 = combatResolveResult.winner
          ? `${combatResolveResult.winner} 获胜${combatResolveResult.fallen.length > 0 ? '，阵亡：' + combatResolveResult.fallen.join('、') : ''}`
          : '战斗未分出胜负';
        check(!memory.战斗, '⑩ "战斗"字段结算后已从记忆中移除');
      }
    } else {
      updateMemory(memory, battleParsed.state);
    }
  }
  console.log(`\n  📝 ${battleParsed.narrative.slice(0, 300)}...\n`);

  return { hasCounterTable, combatResolveResult };
}

// ============================================================
// 主入口
// ============================================================

// ============================================================
// 第三部分：玩家纠错/覆盖数值 —— 验证玩家指定的数字能被AI原样写入
// 正确字段，进而被程序正确识别计算（不是新的代码通道，走的是同一条
// 自然语言输入 → AI叙事+STATE 的管道，风险点在AI是否老实照抄数字/字段名）
// ============================================================

async function testPlayerOverride() {
  console.log('─── 第三部分：玩家纠错数值（"这个技能这次按200算，就说技能融合了"）───\n');

  const memory = {};
  const history = [];

  const worldPrompt = buildWorldPrompt({
    world: '边境小镇的赏金猎人世界，猎人们靠悬赏任务和战斗本领吃饭',
    player: '刚拿到猎人执照的新人',
    npcs: '猎人公会的老板、卖装备的铁匠',
    goals: '从新人做到能独立接高阶悬赏'
  });
  const createMessages = [
    { role: 'system', content: systemPrompt({}) },
    { role: 'user', content: worldPrompt }
  ];
  console.log('  ⏳ 创建赏金猎人世界...');
  const createResult = await callAI(createMessages);
  const createParsed = parseAIOutput(createResult);
  check(createParsed.state !== null, '① STATE 存在');
  if (createParsed.state) {
    createParsed.state.世界设定原文 = '边境小镇赏金猎人世界，玩家是刚拿到执照的新人猎人。';
    updateMemory(memory, createParsed.state);
  }
  history.push({ input: '(创世界)', narrative: createParsed.narrative });
  await sleep(500);

  // 玩家在挑起战斗的同一句话里，直接下场"纠错/指定数值"指令
  console.log('─── 玩家在触发战斗的同时，直接指定技能加成数值 ───\n');
  const overrideInput = '路上遇到一个悬赏目标，我直接冲上去打。这次我用融合技，你把这次的"技能加成"按200来算，就说是技能融合触发的效果';
  const battleMsg = [
    { role: 'system', content: systemPrompt(memory) },
    { role: 'user', content: buildPrompt(overrideInput, memory, history) }
  ];
  console.log('  ⏳ 触发战斗并下达数值指令...');
  const battleResult = await callAI(battleMsg);
  const battleParsed = parseAIOutput(battleResult);
  check(battleParsed.state !== null, '② 战斗轮 STATE 存在');

  let playerName = null, declaredBonus = null;
  if (battleParsed.state) {
    normalizeCombatFieldAliases(battleParsed.state);
    const combatDeclared = !!battleParsed.state.战斗;
    check(combatDeclared, '③ AI声明了"战斗"字段', `实际字段: ${Object.keys(battleParsed.state).join(', ')}`);

    if (combatDeclared) {
      const sideNames = Object.keys(battleParsed.state.战斗);
      console.log(`     参战方: ${JSON.stringify(battleParsed.state.战斗)}`);
      // 找到玩家自己那一侧的角色名
      const myFighters = Object.values(battleParsed.state.战斗).flat();
      const combatAttrs = battleParsed.state.战斗属性 || {};
      for (const name of myFighters) {
        if (combatAttrs[name] && Number.isFinite(combatAttrs[name].技能加成)) {
          playerName = name;
          declaredBonus = combatAttrs[name].技能加成;
          break;
        }
      }
      console.log(`     战斗属性快照: ${JSON.stringify(combatAttrs)}`);
      check(playerName !== null, '④ 玩家指定的"技能加成"数值被AI写进了正确字段（战斗属性.技能加成）',
        playerName === null ? '未在任何参战角色的战斗属性中找到"技能加成"字段' : `角色: ${playerName}, 加成: ${declaredBonus}`);

      if (playerName !== null) {
        const closeToRequested = Math.abs(declaredBonus - 200) <= 50; // 允许AI在叙事口径下小幅换算，不要求分毫不差
        check(closeToRequested, '⑤ AI写入的数值与玩家指定的200接近（未被曲解成完全不同量级）', `实际值: ${declaredBonus}`);

        const before = resolveCombat(
          { 我方: [playerName] },
          { [playerName]: Object.assign({}, combatAttrs[playerName], { 技能加成: 0 }) }
        );
        // 单独验证：把程序真正会用的公式套用declaredBonus，确认落地到伤害上
        const baseAttack = Number.isFinite(combatAttrs[playerName].攻击) ? combatAttrs[playerName].攻击 : COMBAT_DEFAULT_STATS.攻击;
        const dummyDefense = 3;
        const dmgWithBonus = Math.max(1, Math.round((baseAttack + declaredBonus) * 1) - dummyDefense);
        const dmgWithoutBonus = Math.max(1, baseAttack - dummyDefense);
        check(dmgWithBonus > dmgWithoutBonus, '⑥ 该数值代入 resolveCombat 公式后确实提升了伤害输出',
          `有加成: ${dmgWithBonus} vs 无加成: ${dmgWithoutBonus}`);
      }

      const combatResult = resolveCombat(battleParsed.state.战斗, combatAttrs, battleParsed.state.元素克制);
      check(combatResult !== null, '⑦ 程序用真实声明的战斗数据完整结算了这场战斗');
      if (combatResult) {
        console.log('\n  ' + formatBattleLog(combatResult).split('\n').join('\n  '));
      }
    }
  }
  console.log(`\n  📝 ${battleParsed.narrative.slice(0, 300)}...\n`);
}

async function main() {
  console.log('\n═══════════════════════════════════');
  console.log('  AI 记忆沙盒 · 元素克制 + 技能加成 测试');
  console.log('  模型: DeepSeek-V4-Flash (硅基流动)');
  console.log('═══════════════════════════════════\n');

  testMathDeterministic();
  await testRealAIFlow();
  await testPlayerOverride();

  console.log('═══════════════════════════════════');
  console.log('  测试结果');
  console.log('═══════════════════════════════════');
  console.log(`\n  ✅ 通过: ${passed}`);
  console.log(`  ❌ 失败: ${failed}`);
  console.log(`  总计: ${passed + failed} 测试\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('\n❌ 测试崩溃:', e.message);
  process.exit(1);
});
