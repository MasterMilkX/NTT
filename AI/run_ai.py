import subprocess
import threading
import random
import time
import os
import signal
import yaml


# Store process references
processes = [None]

def start_instance(i,script_path):
    processes[i] = subprocess.Popen(["python3", script_path])
    print(f"Started instance {i} with PID {processes[i].pid}")

def kill_and_restart_loop(i):
    while True:
        wait_time = random.randint(600, 900)  # 10 to 15 minutes in seconds
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


def start_bots():

    # read in the yaml file
    with open("data/ai-config.yaml", 'r') as f:
        config = yaml.safe_load(f)

    # import the data
    bots = config.get("bots", [])
    scripts = []
    all_instances = 0
    for bot in bots:
        instances = bot.get('instances', 3)
        all_instances += instances
        for _ in range(instances):
            scripts.append(bot.get('script', "random_bot.py"))

        print(f"% Configured [ {instances} ] instances of [ {bot.get('script', 'random_bot.py')} ]")
    
    print("===-- TOTAL PROCESSES TO RUN:", all_instances, "--===")

    # set the processes
    global processes
    processes = [None] * all_instances

    # Start all instances initially
    for i in range(all_instances):
        start_instance(i,scripts[i])

    # Start a thread for each instance to manage killing and restarting
    for i in range(all_instances):
        t = threading.Thread(target=kill_and_restart_loop, args=(i,), daemon=True)
        t.start()

    # check for terminated processes and restart them
    def monitor_processes():
        while True:
            for i in range(all_instances):
                proc = processes[i]
                if proc and proc.poll() is not None:  # process has terminated
                    print(f"Process {i} (PID {proc.pid}) terminated unexpectedly. Restarting...")
                    start_instance(i,scripts[i])
            time.sleep(10)  # check every 10 seconds

    monitor_thread = threading.Thread(target=monitor_processes, daemon=True)
    monitor_thread.start()

    # Keep the main thread alive
    try:
        while True:
            time.sleep(60)
    except KeyboardInterrupt:
        print("Shutting down...")
        for proc in processes:
            if proc:
                proc.terminate()


if __name__ == "__main__":
    start_bots()