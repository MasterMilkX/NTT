#!/usr/bin/env python3

import os
import subprocess
import yaml
import signal
import sys

CONFIG_PATH = "data/ai-config.yaml"
LOG_FILE = "bots-all.log"
PYTHON_EXE = "../../npc_tt_env/bin/python3"
PID_FILE = "bots-master.pid"


def load_config():
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)


def main():
    config = load_config()
    bots = config.get("bots", [])

    # Open shared log file
    log_fp = open(LOG_FILE, "ab", buffering=0)

    processes = []

    for bot in bots:
        script = bot.get("script")
        instances = int(bot.get("instances", 0))

        if not script or instances <= 0:
            continue

        for _ in range(instances):
            cmd = ['taskset','-c','0-2',PYTHON_EXE, script]

            p = subprocess.Popen(
                cmd,
                stdout=log_fp,
                stderr=log_fp,
                start_new_session=True  # detach from terminal
            )
            processes.append(p)

    # Save master PID list
    with open(PID_FILE, "w") as f:
        for p in processes:
            f.write(str(p.pid) + "\n")

    print(f"Started {len(processes)} bot processes in background.")
    print(f"Logging to: {LOG_FILE}")
    print(f"PIDs saved to: {PID_FILE}")


if __name__ == "__main__":
    main()

