import subprocess
import threading
import random
import time
import os
import signal

# Number of instances
INSTANCE_COUNT = 7
# Path to the script
SCRIPT_PATH = "testbot.py"

# Store process references
processes = [None] * INSTANCE_COUNT

def start_instance(i):
    processes[i] = subprocess.Popen(["python3", SCRIPT_PATH])
    print(f"Started instance {i} with PID {processes[i].pid}")

def kill_and_restart_loop(i):
    while True:
        wait_time = random.randint(300, 600)  # 5 to 10 minutes in seconds
        time.sleep(wait_time)
        
        proc = processes[i]
        if proc and proc.poll() is None:  # still running
            print(f"Killing instance {i} (PID {proc.pid})")
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()

        print(f"Restarting instance {i}")
        start_instance(i)

# Start all instances initially
for i in range(INSTANCE_COUNT):
    start_instance(i)

# Start a thread for each instance to manage killing and restarting
for i in range(INSTANCE_COUNT):
    t = threading.Thread(target=kill_and_restart_loop, args=(i,), daemon=True)
    t.start()

# Keep the main thread alive
try:
    while True:
        time.sleep(60)
except KeyboardInterrupt:
    print("Shutting down...")
    for proc in processes:
        if proc:
            proc.terminate()
