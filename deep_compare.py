import json

working = r'c:\Projects\Picture Engraver\custom_grid_1769026757975.xcs'
node_gen = r'c:\Projects\Picture Engraver\public\default_test_grid.xcs'

with open(working, 'r') as f:
    w_data = json.load(f)
    
with open(node_gen, 'r') as f:
    n_data = json.load(f)

print("=" * 70)
print("STRUCTURAL COMPARISON")
print("=" * 70)

# Top level keys
print("\nTop-level keys:")
w_keys = set(w_data.keys())
n_keys = set(n_data.keys())
print(f"  Working:      {sorted(w_keys)}")
print(f"  Node Gen:     {sorted(n_keys)}")
print(f"  Missing in node: {w_keys - n_keys}")
print(f"  Extra in node:   {n_keys - w_keys}")

# extId and extName
print(f"\nextId:")
print(f"  Working:  {w_data.get('extId')}")
print(f"  Node Gen: {n_data.get('extId')}")

print(f"\nextName:")  
print(f"  Working:  {w_data.get('extName')}")
print(f"  Node Gen: {n_data.get('extName')}")

print(f"\nversion:")
print(f"  Working:  {w_data.get('version')}")
print(f"  Node Gen: {n_data.get('version')}")

# Device structure
print(f"\ndevice.id:")
print(f"  Working:  {w_data['device'].get('id')}")
print(f"  Node Gen: {n_data['device'].get('id')}")

print(f"\ndevice.power:")
print(f"  Working:  {w_data['device'].get('power')}")
print(f"  Node Gen: {n_data['device'].get('power')}")

# Check first display
w_display = w_data['canvas'][0]['displays'][0]
n_display = n_data['canvas'][0]['displays'][0]

print(f"\nFirst display type:")
print(f"  Working:  {w_display.get('type')}")
print(f"  Node Gen: {n_display.get('type')}")

print(f"\nFirst display keys:")
w_d_keys = set(w_display.keys())
n_d_keys = set(n_display.keys())
print(f"  Missing in node: {w_d_keys - n_d_keys}")
print(f"  Extra in node:   {n_d_keys - w_d_keys}")

# Check data types
print(f"\ndevice.data.dataType:")
print(f"  Working:  {w_data['device']['data'].get('dataType')}")
print(f"  Node Gen: {n_data['device']['data'].get('dataType')}")

print(f"\ndevice.data.value[0][1].displays.dataType:")
print(f"  Working:  {w_data['device']['data']['value'][0][1]['displays'].get('dataType')}")
print(f"  Node Gen: {n_data['device']['data']['value'][0][1]['displays'].get('dataType')}")
