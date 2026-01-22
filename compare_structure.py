import json
import os

# Paths
working_path = r'c:\Projects\Picture Engraver\custom_grid_1769026757975.xcs'
broken_path = r'c:\Projects\Picture Engraver\public\default_test_grid.xcs'

def analyze(label, filepath):
    print(f"\n{'='*60}")
    print(f"{label}")
    print('='*60)
    
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return

    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()
        density_count = text.count('"density"')
        data = json.loads(text)

    print(f"Total 'density' occurrences in file: {density_count}")
    
    # Get first display setting
    device_data = data['device']['data']['value']
    settings_map = device_data[0][1]['displays']['value']
    print(f"Number of display settings: {len(settings_map)}")
    
    first_setting = settings_map[0][1]
    
    # Count density in FILL_VECTOR_ENGRAVING
    fill_param = first_setting['data']['FILL_VECTOR_ENGRAVING']['parameter']['customize']
    print(f"\nFILL_VECTOR_ENGRAVING parameters sample:")
    print(f"  - density: {fill_param.get('density', 'MISSING')}")
    print(f"  - dpi: {fill_param.get('dpi', 'MISSING')}")
    print(f"  - power: {fill_param.get('power', 'MISSING')}")
    print(f"  - frequency: {fill_param.get('frequency', 'MISSING')}")

analyze("WORKING (Browser Generated)", working_path)
analyze("BROKEN (Node.js Generated)", broken_path)
