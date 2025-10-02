import yaml
import subprocess

# run run_ai.py with different parameters based on ai-config.yaml

with open("AI/ai-config.yaml", 'r') as f:
    config = yaml.safe_load(f)

for bot in config['bots']:
    script = bot.get('script', 'random_bot.py')
    instances = bot.get('instances', 7)
    cmd = ["python3", "AI/run_ai.py", script, str(instances)]
    print(f"Starting command: {' '.join(cmd)}")
    subprocess.Popen(cmd)  # Start the process without waiting for it to finish

# Note: Each run_ai.py instance will manage its own set of bot instances as per the provided script and count.
