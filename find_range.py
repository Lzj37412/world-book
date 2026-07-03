import sys
with open('index.html', 'rb') as f:
    data = f.read()

# Find start of template literal content
start_marker = b'let prompt = `'
start = data.find(start_marker)
if start < 0:
    print('ERROR: start not found')
    sys.exit(1)
start += len(start_marker)

# Find end - the closing backtick before // 模式规则
# Look for: ` + \n\n + tab + //
end_pattern_start = data.find(b'`;\n\n\t  // 模式规则', start)
end_pattern_mid = data.find(b"`;\n\n\t  // 模式规则", start)
end_pattern_end = data.find(b"`;\n\n\n  // 模式规则", start)

print(f"end_pattern_start: {end_pattern_start}")
print(f"end_pattern_mid: {end_pattern_mid}")
print(f"end_pattern_end: {end_pattern_end}")

# Try simpler: just find the backtick before the mode rules comment
# The pattern should be: backtick + semicolon + newlines + // mode rules
import re
# Find a backtick that's followed by ;\n\n or \n\n\t
for m in re.finditer(b'`;\n', data[start:start+1000]):
    pos = start + m.start()
    after = data[pos:pos+30]
    print(f"Backtick at {pos}: {after}")
