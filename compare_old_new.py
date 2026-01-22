import json

old_working = r'c:\Projects\Picture Engraver\old_working_default_test_grid.xcs'
new_broken = r'c:\Projects\Picture Engraver\public\default_test_grid.xcs'

print("="*70)
print("COMPARING OLD WORKING vs NEW BROKEN")
print("="*70)

with open(old_working, 'r') as f:
    old = json.load(f)
    
with open(new_broken, 'r') as f:
    new = json.load(f)

# Compare first display setting in detail
old_setting = old['device']['data']['value'][0][1]['displays']['value'][0][1]
new_setting = new['device']['data']['value'][0][1]['displays']['value'][0][1]

print("\n" + "="*70)
print("FILL_VECTOR_ENGRAVING parameters (FIRST CELL):")
print("="*70)

old_fill = old_setting['data']['FILL_VECTOR_ENGRAVING']['parameter']['customize']
new_fill = new_setting['data']['FILL_VECTOR_ENGRAVING']['parameter']['customize']

# Get all keys from both
all_keys = sorted(set(old_fill.keys()) | set(new_fill.keys()))

differences = []
for key in all_keys:
    old_val = old_fill.get(key, '*** MISSING ***')
    new_val = new_fill.get(key, '*** MISSING ***')
    
    if old_val == new_val:
        match = "✓"
    else:
        match = "✗✗✗ DIFF"
        differences.append(key)
    
    print(f"{match:12s} {key:25s} | OLD: {str(old_val):20s} | NEW: {str(new_val):20s}")

if differences:
    print("\n" + "!"*70)
    print(f"FOUND {len(differences)} DIFFERENCE(S): {', '.join(differences)}")
    print("!"*70)

# Check ALL processing types
print("\n" + "="*70)
print("CHECKING ALL PROCESSING TYPES FOR DIFFERENCES")
print("="*70)

for proc_type in ['VECTOR_CUTTING', 'VECTOR_ENGRAVING', 'FILL_VECTOR_ENGRAVING', 'INTAGLIO', 'INNER_THREE_D']:
    old_proc = old_setting['data'][proc_type]['parameter']['customize']
    new_proc = new_setting['data'][proc_type]['parameter']['customize']
    
    all_proc_keys = sorted(set(old_proc.keys()) | set(new_proc.keys()))
    
    has_diff = False
    for key in all_proc_keys:
        old_val = old_proc.get(key, 'MISSING')
        new_val = new_proc.get(key, 'MISSING')
        
        if old_val != new_val:
            if not has_diff:
                print(f"\n{proc_type}:")
                has_diff = True
            print(f"  ✗ {key}: OLD={old_val}, NEW={new_val}")

