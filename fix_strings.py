"""Fix literal newlines in JS single-quoted strings - all at once"""
import re

with open('index.html', 'rb') as f:
    data = f.read()

# Strategy: find ALL .join( calls and check their arguments
# Use re to find join(...) patterns
# Then check if the argument contains literal \n (0x0a) bytes

replacements = []

# Find all .join('...') patterns
pattern = re.compile(rb"\.join\('([^']*)'\)")
for m in pattern.finditer(data):
    arg = m.group(1)
    if b'\n' in arg or b'\r' in arg:
        # Has literal newlines - needs fixing
        old_text = m.group(0)
        # Replace literal \r\n with escape sequence
        fixed_arg = arg.replace(b'\r\n', b'\\n')
        fixed_arg = fixed_arg.replace(b'\r', b'\\r')
        fixed_arg = fixed_arg.replace(b'\n', b'\\n')
        new_text = b".join('" + fixed_arg + b"')"
        if old_text != new_text:
            replacements.append((old_text, new_text))
            print(f"  WILL FIX: {old_text[:50]} -> {new_text[:50]}")

# Also check template literals that might have issues
# But template literals ARE allowed to have literal newlines
# So we only need to fix single/double quoted strings

print(f"\nFound {len(replacements)} patterns to fix")

if replacements:
    for old, new in replacements:
        data = data.replace(old, new)

    with open('index.html', 'wb') as f:
        f.write(data)
    print("All fixes applied!")
else:
    print("Nothing to fix!")

# Final verification
final_pattern = re.compile(rb"\.join\('([^']*)'\)")
for m in final_pattern.finditer(data):
    arg = m.group(1)
    if b'\n' in arg or b'\r' in arg:
        print(f"  STILL BROKEN: {m.group(0)[:50]}")

# Verify script tag balance
script_open = data.count(b'<script')
script_close = data.count(b'</script>')
print(f"\nScript tags: {script_open} open / {script_close} close")
backtick_count = data.count(b'`')
print(f"Backticks: {backtick_count} ({'OK' if backtick_count % 2 == 0 else 'UNBALANCED'})")
