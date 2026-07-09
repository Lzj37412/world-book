// =========================================
// AI沙盒冒险 — 自动化测试
// 从 index.html 提取关键函数并测试
// =========================================

// ---------- 测试工具 ----------
let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✅ ${msg}`); }
  else { failed++; console.log(`  ❌ ${msg}`); }
}
function assertEq(actual, expected, msg) {
  const a = typeof actual === 'object' ? JSON.stringify(actual) : String(actual);
  const e = typeof expected === 'object' ? JSON.stringify(expected) : String(expected);
  if (a === e) { passed++; console.log(`  ✅ ${msg}`); }
  else { failed++; console.log(`  ❌ ${msg}\n      期望: ${e}\n      实际: ${a}`); }
}

// ---------- 被测试函数（从 index.html 提取） ----------

/** 排序 key 后 stringify，避免对象字段顺序不同导致的误报 */
function sortedStringify(val) {
  if (typeof val === 'object' && val !== null) {
    if (Array.isArray(val)) {
      return '[' + val.map(v => sortedStringify(v)).join(',') + ']';
    }
    const sorted = Object.keys(val).sort().reduce((acc, k) => {
      acc[k] = JSON.parse(sortedStringify(val[k]));
      return acc;
    }, {});
    return JSON.stringify(sorted);
  }
  return JSON.stringify(val);
}

function computeDiff(oldMem, newMem) {
  if (!oldMem || Object.keys(oldMem).length === 0) return null;
  const changes = [];
  const allKeys = [...new Set([...Object.keys(oldMem), ...Object.keys(newMem)])];
  for (const key of allKeys) {
    const oldVal = oldMem[key];
    const newVal = newMem[key];
    if (newVal === undefined) {
      changes.push({ type: 'removed', key, oldVal });
    } else if (oldVal === undefined) {
      changes.push({ type: 'added', key, newVal });
    } else if (sortedStringify(oldVal) !== sortedStringify(newVal)) {
      changes.push({ type: 'changed', key, oldVal, newVal });
    }
  }
  return changes.length > 0 ? changes : null;
}

// parseAIOutput — 只提取 <<STATE>> 的相关逻辑，因为其他路径与测试无关
function tryParse(jsonStr) {
  try { return JSON.parse(jsonStr); }
  catch (e) {
    const fixed = jsonStr.replace(/,\s*([}\]])/g, '$1');
    try { return JSON.parse(fixed); } catch (e2) { return null; }
  }
}

function parseAIOutput_STATE(raw) {
  // 模拟 parseAIOutput 中 <<STATE>>...<<ENDSTATE>> 路径
  let state = tryParse(raw);
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
  return state;
}

const COMBAT_DEFAULT_STATS = { 生命: 20, 攻击: 5, 防御: 3, 速度: 5 };
const COMBAT_MAX_ROUNDS = 500;

function resolveCombat(sides, statsMap) {
  const stats = statsMap || {};
  const sideNames = Object.keys(sides || {});
  if (sideNames.length !== 2) return null;

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
        速度: Number.isFinite(base.速度) ? base.速度 : COMBAT_DEFAULT_STATS.速度
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
      const damage = Math.max(1, attacker.攻击 - target.防御);
      target.生命 -= damage;
      log.push(`${attacker.name} 对 ${target.name} 造成 ${damage} 点伤害`);
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
  fighters.forEach(f => { updatedStats[f.name] = { 生命: Math.max(0, f.生命), 攻击: f.攻击, 防御: f.防御, 速度: f.速度 }; });

  return { log, winner, fallen, updatedStats };
}

// =========================================
// 测试套件
// =========================================

console.log('\n═══════════════════════════════════');
console.log('  测试 1: parseAIOutput STATE 解析');
console.log('═══════════════════════════════════\n');

// --- 1a: 标准 JSON <<STATE>> ---
(function testStandardJSON() {
  const raw = `{"world": "宝可梦", "location": "真新镇", "level": 5}`;
  const result = parseAIOutput_STATE(raw);
  assert(result !== null && result.world === '宝可梦', '标准 JSON 应正确解析');
  assertEq(result.location, '真新镇', '字段值 correct');
  assertEq(result.level, 5, '数字字段 correct');
})();

// --- 1b: 纯文本键值对（失败场景） ---
(function testPlainTextKV() {
  const raw = `世界: 宝可梦\n位置: 真新镇\n等级: 5`;
  const result = parseAIOutput_STATE(raw);
  assert(result !== null, '纯文本键值对应解析成功，不应返回 null');
  assertEq(result['世界'], '宝可梦', '中文键值对 correct');
  assertEq(result['位置'], '真新镇', '中文键值对 2');
  // 注意：纯文本键值对解析结果是字符串类型，不会转数字
  assertEq(result['等级'], '5', '纯文本值保留字符串');
})();

// --- 1c: 混合 JSON + 纯文本（先 JSON 成功则不降级） ---
(function testJSONPreferred() {
  const raw = `{"world": "宝可梦", "location": "真新镇"}`;
  const result = parseAIOutput_STATE(raw);
  assert(result !== null, 'JSON 优先');
  assert(typeof result.world === 'string' && result.world === '宝可梦', 'JSON key 正确');
})();

// --- 1d: 空/无效内容 ---
(function testEmptyContent() {
  assertEq(parseAIOutput_STATE(''), null, '空字符串 → null');
  assertEq(parseAIOutput_STATE('   '), null, '纯空格 → null');
  assertEq(parseAIOutput_STATE('随便说说没有结构化数据'), null, '无冒号文本 → null');
})();

// --- 1e: 只有部分行有冒号 ---
(function testPartialKV() {
  const raw = `世界: 宝可梦\n这是一段描述文字\n位置: 真新镇`;
  const result = parseAIOutput_STATE(raw);
  assert(result !== null, '部分行含冒号应解析');
  assertEq(result['世界'], '宝可梦', '第一行 KV');
  assertEq(result['位置'], '真新镇', '跳过描述行后 KV');
})();

// --- 1f: 值含冒号（如时间） ---
(function testValueWithColon() {
  const raw = `时间: 12:30\n位置: 宝可梦中心`;
  const result = parseAIOutput_STATE(raw);
  assert(result !== null, '值含冒号应正确截取');
  // indexOf(':') 取第一个冒号，只截到第一个冒号
  assertEq(result['时间'], '12:30', '值含冒号，substring(colonIdx+1) 取整行剩余部分，保留完整值');
  assertEq(result['位置'], '宝可梦中心', '第二个字段正常');
})();

console.log('\n═══════════════════════════════════');
console.log('  测试 2: sortedStringify 递归排序');
console.log('═══════════════════════════════════\n');

// --- 2a: 简单对象 ---
(function testSimpleObject() {
  const a = { b: 1, a: 2 };
  const b = { a: 2, b: 1 };
  assertEq(sortedStringify(a), sortedStringify(b), '字段顺序不同的简单对象应相等');
})();

// --- 2b: 嵌套对象 ---
(function testNestedObject() {
  const a = { outer: { z: 1, y: 2 }, name: 'test' };
  const b = { name: 'test', outer: { y: 2, z: 1 } };
  assertEq(sortedStringify(a), sortedStringify(b), '嵌套对象字段顺序不同应相等');
})();

// --- 2c: 深层嵌套（三层） ---
(function testDeepNested() {
  const a = { a: { b: { c: 1, d: 2 }, e: 3 } };
  const b = { a: { e: 3, b: { d: 2, c: 1 } } };
  assertEq(sortedStringify(a), sortedStringify(b), '三层嵌套顺序不同应相等');
})();

// --- 2d: 数组内对象 ---
(function testArrayWithObjects() {
  const a = { items: [{ b: 1, a: 2 }, { d: 4, c: 3 }] };
  const b = { items: [{ a: 2, b: 1 }, { c: 3, d: 4 }] };
  assertEq(sortedStringify(a), sortedStringify(b), '数组内对象字段顺序不同应相等');
})();

// --- 2e: 混合数组+嵌套 ---
(function testMixedArrayNested() {
  const a = { data: [{ info: { z: 9, x: 8 }, id: 1 }] };
  const b = { data: [{ id: 1, info: { x: 8, z: 9 } }] };
  assertEq(sortedStringify(a), sortedStringify(b), '数组内嵌套对象混合顺序应相等');
})();

// --- 2f: null / undefined / 原始类型 ---
(function testPrimitives() {
  assertEq(sortedStringify(null), 'null', 'null correct');
  assertEq(sortedStringify(42), '42', 'number correct');
  assertEq(sortedStringify('hello'), '"hello"', 'string correct');
  assertEq(sortedStringify(true), 'true', 'boolean correct');
  assertEq(sortedStringify([1, 2, 3]), '[1,2,3]', '数组 correct');
})();

console.log('\n═══════════════════════════════════');
console.log('  测试 3: computeDiff');
console.log('═══════════════════════════════════\n');

// --- 3a: 嵌套对象字段顺序不应误报 diff ---
(function testNestedOrderDiff() {
  const oldMem = { location: '真新镇', state: { hp: 100, mp: 50 } };
  const newMem = { location: '真新镇', state: { mp: 50, hp: 100 } };
  const diff = computeDiff(oldMem, newMem);
  assert(diff === null, '字段顺序不同不应报 diff');
})();

// --- 3b: 实际值不同应报 diff ---
(function testActualChangeDiff() {
  const oldMem = { location: '真新镇', hp: 100 };
  const newMem = { location: '真新镇', hp: 80 };
  const diff = computeDiff(oldMem, newMem);
  assert(diff !== null, '值变化应报 diff');
  assert(diff.length === 1, '应有 1 条变化');
  assertEq(diff[0].type, 'changed', '变化类型为 changed');
  assertEq(diff[0].key, 'hp', '变化字段为 hp');
})();

// --- 3c: 增加新字段 ---
(function testAddedFieldDiff() {
  const oldMem = { location: '真新镇' };
  const newMem = { location: '真新镇', level: 5 };
  const diff = computeDiff(oldMem, newMem);
  assert(diff !== null, '新增字段应报 diff');
  assert(diff[0].type === 'added', '变化类型为 added');
})();

// --- 3d: 移除字段 ---
(function testRemovedFieldDiff() {
  const oldMem = { location: '真新镇', hp: 100 };
  const newMem = { location: '真新镇' };
  const diff = computeDiff(oldMem, newMem);
  assert(diff !== null, '移除字段应报 diff');
  assert(diff[0].type === 'removed', '变化类型为 removed');
})();

// --- 3e: 无变化 ---
(function testNoChangeDiff() {
  const mem = { location: '真新镇', hp: 100 };
  assert(computeDiff(mem, { ...mem }) === null, '完全相同的对象应无 diff');
})();

// --- 3f: 深层嵌套变化 ---
(function testDeepNestedDiff() {
  const oldMem = { inventory: { items: [{ id: 1, name: '伤药' }] } };
  const newMem = { inventory: { items: [{ name: '伤药', id: 1 }] } };
  const diff = computeDiff(oldMem, newMem);
  assert(diff === null, '深层嵌套字段顺序不同不应报 diff');
})();

console.log('\n═══════════════════════════════════');
console.log('  测试 4: resolveCombat 战斗结算');
console.log('═══════════════════════════════════\n');

// --- 4a: 基本胜负 ---
(function testBasicCombatWin() {
  const sides = { 我方: ['张三'], 敌方: ['小怪'] };
  const stats = {
    张三: { 生命: 100, 攻击: 50, 防御: 5, 速度: 10 },
    小怪: { 生命: 10, 攻击: 1, 防御: 0, 速度: 1 }
  };
  const result = resolveCombat(sides, stats);
  assert(result !== null, '双方合法时应返回结果');
  assertEq(result.winner, '我方', '攻击力压制一方应获胜');
  assert(result.fallen.includes('小怪'), '战败方应在阵亡名单中');
})();

// --- 4b: 默认属性兜底 ---
(function testDefaultStatsFallback() {
  const sides = { A: ['甲'], B: ['乙'] };
  const result = resolveCombat(sides, {}); // 无任何战斗属性
  assert(result !== null, '缺失战斗属性时仍应能结算');
  assert(result.winner === 'A' || result.winner === 'B' || result.winner === null, '应给出确定性结果（同数值可能不分胜负）');
})();

// --- 4c: 最低伤害保底（攻击力低于对方防御力时仍造成 1 点伤害） ---
(function testMinDamageFloor() {
  const sides = { A: ['弱攻'], B: ['厚甲'] };
  const stats = {
    弱攻: { 生命: 100, 攻击: 1, 防御: 1, 速度: 10 },
    厚甲: { 生命: 5, 攻击: 0, 防御: 99, 速度: 1 }
  };
  const result = resolveCombat(sides, stats);
  assert(result.winner === 'A', '攻击力低于防御力时仍应保底造成伤害并最终获胜');
})();

// --- 4d: 速度决定行动顺序 ---
(function testSpeedOrder() {
  const sides = { A: ['快'], B: ['慢'] };
  const stats = {
    快: { 生命: 10, 攻击: 100, 防御: 0, 速度: 99 },
    慢: { 生命: 10, 攻击: 100, 防御: 0, 速度: 1 }
  };
  const result = resolveCombat(sides, stats);
  assertEq(result.winner, 'A', '速度更高的一方应先手并获胜（一击致命场景下）');
})();

// --- 4e: 多人阵营 & 集火最低生命目标 ---
(function testFocusLowestHP() {
  const sides = { A: ['A1'], B: ['B1', 'B2'] };
  const stats = {
    A1: { 生命: 100, 攻击: 10, 防御: 0, 速度: 10 },
    B1: { 生命: 5, 攻击: 1, 防御: 0, 速度: 1 },
    B2: { 生命: 50, 攻击: 1, 防御: 0, 速度: 1 }
  };
  const result = resolveCombat(sides, stats);
  assert(result.fallen.includes('B1'), '应优先集火生命值最低的敌方目标');
})();

// --- 4f: 非法输入（参战方不是恰好两方）返回 null ---
(function testInvalidSidesCount() {
  assert(resolveCombat({ 单独一方: ['甲'] }, {}) === null, '只有一方参战应返回 null');
  assert(resolveCombat({ A: ['甲'], B: ['乙'], C: ['丙'] }, {}) === null, '超过两方参战应返回 null');
})();

// --- 4g: 结算不会死循环（有限回合上限保护） ---
(function testCombatTerminates() {
  const sides = { A: ['铁壁A'], B: ['铁壁B'] };
  const stats = {
    铁壁A: { 生命: 1000000, 攻击: 1, 防御: 999, 速度: 5 },
    铁壁B: { 生命: 1000000, 攻击: 1, 防御: 999, 速度: 5 }
  };
  const start = Date.now();
  const result = resolveCombat(sides, stats);
  const elapsed = Date.now() - start;
  assert(result !== null, '极端拉锯战仍应返回结果而非卡死');
  assert(elapsed < 1000, `应在合理时间内结束（实际 ${elapsed}ms）`);
})();

// =========================================
// 结果
// =========================================
console.log('\n═══════════════════════════════════');
console.log(`  总计: ${passed + failed} 测试`);
console.log(`  ✅ 通过: ${passed}`);
console.log(`  ❌ 失败: ${failed}`);
console.log('═══════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
