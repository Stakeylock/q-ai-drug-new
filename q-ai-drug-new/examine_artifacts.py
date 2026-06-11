from pathlib import Path
import json

p = Path('execution_test_dir/module_runs/onco_data_builder/run_01/module_result.json')
if p.exists():
    with open(p, 'r') as f:
        print(json.dumps(json.load(f).get('artifacts', []), indent=2))
