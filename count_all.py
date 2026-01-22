import json

files = {
    'WORKING': r'c:\Projects\Picture Engraver\custom_grid_1769026757975.xcs',
    'BROKEN': r'c:\Projects\Picture Engraver\custom_grid_1769026990285.xcs',
    'NODE_GENERATED': r'c:\Projects\Picture Engraver\public\default_test_grid.xcs'
}

for name, path in files.items():
    try:
        with open(path, 'r', encoding='utf-8') as f:
            text = f.read()
            density_count = text.count('"density"')
            data = json.load(open(path, 'r'))
            settings_count = len(data['device']['data']['value'][0][1]['displays']['value'])
        
        print(f"{name:20} | density count: {density_count:3} | settings: {settings_count:3}")
    except FileNotFoundError:
        print(f"{name:20} | FILE NOT FOUND")
    except Exception as e:
        print(f"{name:20} | ERROR: {e}")
