import json

# Load working file
with open(r'c:\Projects\Picture Engraver\custom_grid_1769026757975.xcs', 'r') as f:
    working_data = json.load(f)

# Load broken file  
with open(r'c:\Projects\Picture Engraver\public\default_test_grid.xcs', 'r') as f:
    broken_data = json.load(f)

print("WORKING FILE - First 5 density values:")
working_settings = working_data['device']['data']['value'][0][1]['displays']['value']
for i in range(min(5, len(working_settings))):
    density = working_settings[i][1]['data']['FILL_VECTOR_ENGRAVING']['parameter']['customize']['density']
    dpi = working_settings[i][1]['data']['FILL_VECTOR_ENGRAVING']['parameter']['customize']['dpi']
    print(f"  [{i}] density={density}, dpi={dpi}")

print("\nBROKEN FILE - First 5 density values:")
broken_settings = broken_data['device']['data']['value'][0][1]['displays']['value']
for i in range(min(5, len(broken_settings))):
    density = broken_settings[i][1]['data']['FILL_VECTOR_ENGRAVING']['parameter']['customize']['density']
    dpi = broken_settings[i][1]['data']['FILL_VECTOR_ENGRAVING']['parameter']['customize']['dpi']
    print(f"  [{i}] density={density}, dpi={dpi}")
