"""Replace systemPrompt rules 1-5 with user's new version"""
with open('index.html', 'r', encoding='utf-8') as f:
    data = f.read()

# Find exact start: after `let prompt = `
start = data.find('let prompt = `') + len('let prompt = `')

# Find exact end: backtick after '读者已知的场景'
marker = '读者已知的场景'
mk = data.find(marker)
end = data.find('`;', mk)

old_content = data[start:end]

# Verify old content
if '我在创造一个沙盒类的世界' not in old_content:
    print("ERROR: wrong start")
    exit(1)
if '不重复描写已经建立的环境细节' not in old_content:
    print("ERROR: wrong end")
    exit(1)
if '主要角色：${npcNames}' not in old_content:
    print("ERROR: missing middle section")
    exit(1)

# New content
new_content = """我在创造一个沙盒类的世界。你是GM，你主要负责推演剧情、叙事事情。世界的默认设定是自主运转的，不会因为任何事情停下，世界会在某时间段产生一些事情、暗流、灾祸等发生，详细类型事情请你自行完善并触发。

【GM 设定摘要】
世界背景：${world}
玩家角色：${identity}。`;
	  if (location) prompt += `
当前位置：${location}。`;

	  if (npcs) {
	    let npcNames = '';
	    if (typeof npcs === 'string') npcNames = npcs;
	    else if (Array.isArray(npcs)) npcNames = npcs.map(n => typeof n === 'object' ? (n.name || n.角色名 || '') : String(n)).filter(Boolean).join('、');
	    if (npcNames) prompt += `
主要角色：${npcNames}——他们有自己的意志和行动逻辑。`;
	  }

	  prompt += `

按照玩家（我）指定首次创造世界类型默认剧本进行，若无指定或含糊表达，请自我完善丰富其世界类型；当我说"看看世界动态"类似表达词语时，你直接告诉我现在实时世界发生了什么。

我（玩家）可以选择旁观这个世界自然发展，也可以选择出手干预。每次选择都会产生对应的因果，你负责按着因果自行推演剧情。

全NPC根据自身性格、好感等主动与我交互——聊天、奇遇、组队等；会随着世界、时间的自推演生产各种性格、目标等；若被玩家操作影响，按事情发展的因果自行完善NPC接下来剧情、行为动作目标等，请自我完善。

如果需要为这个世界填充功能性角色（对手、店主、同伴等），且该世界本身有对应的原作角色，就使用原作角色，不要从其他世代/版本借用同名角色或地点。

**关键事件节点不可编造**——这条规则只适用于世界已经确立的背景设定和已经发生的事。不适用于玩家正在用行动实时争夺、尚未有结果的对抗。当玩家主动挑战一个即将发生的"原版事件"时，胜负应当由双方当下的实际条件真实判定，不能因为"原版是这样发生的"就预设结果。
如果你对某个具体事实细节记不准，宁可保守处理，不要为了丰富细节而猜测。

NPC不会因为玩家只是在场旁观、什么都没做，就主动提出给玩家奖励或机会——除非玩家的行动构成了让这件事发生的理由。
【GM设定摘要】里列出的 NPC 是这个世界目前已知的全部重要角色。不要给他们凭空添加新的设定（比如新的职业身份），也不要用另一个角色套在他们身上。
不重复描写已经建立的环境细节。每轮推进时优先发展剧情进展，而非重新描写读者已知的场景。"""

data = data[:start] + new_content + data[end:]

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(data)

# Verify
with open('index.html', 'r', encoding='utf-8') as f:
    v = f.read()

checks = {
    'GM角色': '你是GM，你主要负责推演剧情',
    '世界自主运转': '自主运转的，不会因为任何事情停下',
    '暗流灾祸': '暗流、灾祸等发生',
    '看看世界动态': '看看世界动态"类似表达词语时',
    '我(玩家)旁观': '我（玩家）可以选择旁观',
    '全NPC主动交互': '全NPC根据自身性格、好感等主动与我交互',
    'NPC自推演': '自推演生产各种性格',
    'NPC受玩家影响': '若被玩家操作影响',
    '跨世代借用保留': '不要从其他世代/版本借用同名角色',
    '关键事件保留': '关键事件节点不可编造',
    '不猜测保留': '宁可保守处理，不要为了丰富细节而猜测',
    '不重复描写保留': '不重复描写已经建立的环境细节',
    '旧五感已移除': '玩家只能通过自己的五感' not in v,
    '旧GM描述已移除': '持续运行的世界模拟GM' not in v,
    '旧NPC单条已移除': 'NPC会根据自身性格、好感等主动与玩家交互' not in v,
    '旧看看世界动态已移除': '当我说"看看世界动态"时，你直接告诉我当前世界发生了什么' not in v,
}
all_ok = True
for name, result in checks.items():
    status = 'OK' if result else 'FAIL'
    if not result:
        all_ok = False
        print(f'{status}: {name}')

bt = v.count('`')
print(f"{'OK' if bt%2==0 else 'FAIL'}: 反引号 ({bt})")
print(f"{'OK' if v.count('<script')==v.count('</script>') else 'FAIL'}: script标签")

if all_ok:
    print("\nALL CHECKS PASSED ✅")
else:
    print("\nSOME CHECKS FAILED ❌")
