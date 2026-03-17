#!/usr/bin/env python3
"""
run_bots_from_yaml.py

Usage:
  python3 run_bots_from_yaml.py config.yaml --log bots_all.log

Requires:
  pip install pyyaml
"""

import argparse
import os
import signal
import subprocess
import sys
import threading
import time

try:
    import yaml  # pip install pyyaml
except Exception:
    print("Missing dependency: pyyaml. Install with: pip install pyyaml", file=sys.stderr)
    raise


PYTHON_EXE = "../../npc_tt_env/bin/python3"


def load_config(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    if not isinstance(data, dict):
        raise ValueError("YAML root must be a mapping/dict.")
    return data


def reader_thread(proc: subprocess.Popen, tag: str, log_fp, lock: threading.Lock):
    # Stream combined output line-by-line
    assert proc.stdout is not None
    for line in proc.stdout:
        ts = time.strftime("%Y-%m-%d %H:%M:%S")
        out = f"[{ts}] [{tag}] {line.rstrip()}\n"
        with lock:
            log_fp.write(out)
            log_fp.flush()
        # also echo to console
        print(out, end="")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("config", help="Path to YAML config")
    ap.add_argument("--log", default="bots_all.log", help="Single output log file")
    ap.add_argument("--python", default=PYTHON_EXE, help="Python interpreter to run bots with")
    args = ap.parse_args()

    cfg = load_config(args.config)

    bots = cfg.get("bots", [])
    if not isinstance(bots, list):
        raise ValueError("'bots' must be a list.")

    # Optional: expose these as env vars (handy for bots)
    ip_addr = cfg.get("ip_addr")
    kill_range = cfg.get("kill_range")

    env_base = dict(os.environ)
    env_base["PYTHONUNBUFFERED"] = "1"
    if ip_addr is not None:
        env_base["IP_ADDR"] = str(ip_addr)
    if kill_range is not None:
        # keep it simple: store as "10,30"
        if isinstance(kill_range, (list, tuple)) and len(kill_range) == 2:
            env_base["KILL_RANGE"] = f"{kill_range[0]},{kill_range[1]}"
        else:
            env_base["KILL_RANGE"] = str(kill_range)

    procs: list[subprocess.Popen] = []
    threads: list[threading.Thread] = []
    log_lock = threading.Lock()

    def shutdown(signum=None, frame=None):
        # terminate everything
        for p in procs:
            if p.poll() is None:
                try:
                    p.terminate()
                except Exception:
                    pass
        # give a moment, then hard kill if needed
        time.sleep(1.0)
        for p in procs:
            if p.poll() is None:
                try:
                    p.kill()
                except Exception:
                    pass
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    with open(args.log, "a", encoding="utf-8", buffering=1) as log_fp:
        # Launch
        for bot in bots:
            if not isinstance(bot, dict):
                continue
            script = bot.get("script")
            instances = int(bot.get("instances", 0) or 0)
            if not script or instances <= 0:
                continue

            for i in range(instances):
                tag = f"{os.path.basename(script)}#{i+1}"
                cmd = [args.python, "-u", script]
                p = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,  # merge stderr into stdout
                    text=True,
                    bufsize=1,
                    env=env_base,
                )
                procs.append(p)

                t = threading.Thread(target=reader_thread, args=(p, tag, log_fp, log_lock), daemon=True)
                t.start()
                threads.append(t)

        if not procs:
            print("No bots launched (all instances were 0 or scripts missing).")
            return

        # Wait for processes (or Ctrl-C)
        while True:
            alive = any(p.poll() is None for p in procs)
            if not alive:
                break
            time.sleep(0.2)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

