
import json
import os

file_working = r'c:\Projects\Picture Engraver\custom_grid_1769026757975.xcs'
file_broken = r'c:\Projects\Picture Engraver\custom_grid_1769026990285.xcs'

def analyze_file(filepath, label):
    print(f"--- Analyzing {label}: {os.path.basename(filepath)} ---")
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        canvas = data.get('canvas', [])[0]
        displays = canvas.get('displays', [])
        print(f"Number of displays: {len(displays)}")
        
        device_data = data.get('device', {}).get('data', {}).get('value', [])
        # Structure is [[canvasId, { data:..., displays: { value: [...] } }]]
        
        if not device_data:
            print("Device data invalid or empty")
            return

        inner_payload = device_data[0][1]
        display_settings_map = inner_payload.get('displays', {}).get('value', [])
        print(f"Number of display settings entries: {len(display_settings_map)}")
        
        # Check first display setting content
        if len(display_settings_map) > 0:
            first_setting = display_settings_map[0]
            # [id, settingObj]
            print(f"First setting keys: {first_setting[1].keys()}")
            fill_data = first_setting[1].get('data', {}).get('FILL_VECTOR_ENGRAVING', {}).get('parameter', {}).get('customize', {})
            print(f"First setting Sample param: density={fill_data.get('density')}, power={fill_data.get('power')}")

        # Check for discrepancies between displays and settings
        display_ids = set(d['id'] for d in displays)
        setting_ids = set(s[0] for s in display_settings_map)
        
        only_in_displays = display_ids - setting_ids
        only_in_settings = setting_ids - display_ids
        
        if only_in_displays:
            print(f"WARNING: {len(only_in_displays)} IDs in displays but not configured in settings")
        if only_in_settings:
            print(f"WARNING: {len(only_in_settings)} IDs in settings but not in displays")
            
        print(f"Canvas ID: {data.get('canvasId')}")
        print(f"Device Data Canvas Key: {device_data[0][0]}")
        
    except Exception as e:
        print(f"Error analyzing {label}: {e}")

analyze_file(file_working, "WORKING")
print("\n")
analyze_file(file_broken, "BROKEN")
