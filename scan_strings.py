"""Scan JS strings for literal newlines in single/double-quoted strings"""
import re

with open('index.html', 'r', encoding='utf-8') as f:
    data = f.read()

# Only check the inline script section
start = data.index('<script>\n')
end = data.index('</script>', start + 1)
js = data[start+8:end]
js_lines = js.split('\n')

problems = []
in_single = False
in_double = False
in_template = False

for i, line in enumerate(js_lines):
    stripped = line.strip()
    if stripped.startswith('//'):
        # Check if previous line had unterminated string
        if in_single:
            problems.append((i, 'SINGLE_QUOTE', ''))
        if in_double:
            problems.append((i, 'DOUBLE_QUOTE', ''))
        continue

    # Track quote state character by character
    j = 0
    while j < len(line):
        ch = line[j]
        next_ch = line[j+1] if j+1 < len(line) else ''

        # Skip escaped characters
        if ch == '\\':
            j += 2
            continue

        if ch == '`' and not in_single and not in_double:
            in_template = not in_template
        elif ch == "'" and not in_double and not in_template:
            in_single = not in_single
        elif ch == '"' and not in_single and not in_template:
            in_double = not in_double

        j += 1

    # Record problematic lines
    if in_single:
        problems.append((i, 'SINGLE_UNCLOSED', line.rstrip()[:100]))
    if in_double:
        problems.append((i, 'DOUBLE_UNCLOSED', line.rstrip()[:100]))

# Report
print("=== PROBLEM LINES (unclosed single/double quotes) ===")
for lineno, ptype, content in problems:
    if content:
        print(f"  JS line {lineno+1} [{ptype}]: {content}")
    else:
        print(f"  JS line {lineno+1} [{ptype}]")

if not problems:
    print("  (none found)")

print(f"\n=== FINAL STATE ===")
print(f"  Template: {'OPEN' if in_template else 'CLOSED'}")
print(f"  Single quotes: {'OPEN' if in_single else 'CLOSED'}")
print(f"  Double quotes: {'OPEN' if in_double else 'CLOSED'}")

# Also check: does the file have the right join patterns?
print("\n=== JOIN PATTERNS IN SCRIPT ===")
join_matches = list(re.finditer(r'\.join\(', js))
for m in join_matches:
    # Get the argument
    start_pos = m.end()
    end_pos = js.index(')', start_pos)
    arg = js[start_pos:end_pos]
    has_bad_nl = '\n' in arg
    marker = ' <--- HAS LITERAL NEWLINE' if has_bad_nl else ''
    print(f"  .join({arg}){marker}")
