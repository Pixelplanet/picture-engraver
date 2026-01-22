import json

old_working = r'c:\Projects\Picture Engraver\old_working_default_test_grid.xcs'
new_fixed = r'c:\Projects\Picture Engraver\public\default_test_grid.xcs'

with open(old_working, 'r') as f:
    old = json.load(f)
    
with open(new_fixed, 'r') as f:
    new = json.load(f)

print("="*70)
print("VERIFICATION: OLD WORKING vs NEW FIXED")
print("="*70)

# Check all display settings
old_settings = old['device']['data']['value'][0][1]['displays']['value']
new_settings = new['device']['data']['value'][0][1]['displays']['value']

print(f"\nTotal settings: OLD={len(old_settings)}, NEW={len(new_settings)}")

# Check multiple cells to ensure consistency
test_indices = [0, 10, 50, 100, 122]  # First, middle, last, QR code

all_match = True
for idx in test_indices:
    if idx >= len(old_settings):
        continue
        
    old_fill = old_settings[idx][1]['data']['FILL_VECTOR_ENGRAVING']['parameter']['customize']
    new_fill = new_settings[idx][1]['data']['FILL_VECTOR_ENGRAVING']['parameter']['customize']
    
    # Compare key values
    old_repeat = old_fill.get('repeat')
    new_repeat = new_fill.get('repeat')
    
    match = "✓" if old_repeat == new_repeat else "✗"
    
    if old_repeat != new_repeat:
        all_match = False
        print(f"{match} Cell [{idx}]: repeat OLD={old_repeat}, NEW={new_repeat}")

if all_match:
    print("\n" + "!"*70)
    print("SUCCESS! All checked cells match perfectly!")
    print("The 'repeat' parameter is now consistent with the working version.")
    print("!"*70)
else:
    print("\n" + "!"*70)
    print("WARNING: Some differences still remain!")
    print("!"*70)

# Double-check critical parameters
print("\n" + "="*70)
print("Sample Cell [0] - FILL_VECTOR_ENGRAVING parameters:")
print("="*70)

old_fill = old_settings[0][1]['data']['FILL_VECTOR_ENGRAVING']['parameter']['customize']
new_fill = new_settings[0][1]['data']['FILL_VECTOR_ENGRAVING']['parameter']['customize']

for key in sorted(old_fill.keys()):
    old_val = old_fill[key]
    new_val = new_fill.get(key, 'MISSING')
    match = "✓" if old_val == new_val else "✗"
    print(f"{match} {key:25s}: OLD={old_val}, NEW={new_val}")
