#!/usr/bin/env python3
"""
ai-dashboard.py — Launch and supervise game bot processes with a live "top"-style dashboard.

Now with live columns for each bot's in‑game name, role, and current location.
For best results, have your bots print a single JSON line whenever these values are set/changed, e.g.:

    print('DASHBOARD {"bot_name":"Alice","role":"Healer","location":"Town/Inn"}')

The optional prefix "DASHBOARD " helps ignore unrelated output. Raw JSON lines without the prefix also work.

Usage:
  python3 ai-dashboard.py path/to/config.yaml

YAML formats supported (any one of these):
  1) Simple list of scripts:
     - bots:
         - name: Alpha
           script: alpha_bot.py
         - name: Beta
           script: beta_bot.py

  2) Keys 'bots' OR 'scripts' OR a top-level list of strings:
     bots:
       - alpha_bot.py
       - beta_bot.py

  3) With instances per bot:
     bots:
       - name: Alpha
         script: alpha_bot.py
         instances: 2

Dashboard columns:
  • IDX — internal bot index
  • PID — process id (or "-" if not started)
  • BOT — launcher name (from YAML)
  • INGAME — in‑game name (from bot stdout)
  • ROLE — role (from bot stdout)
  • LOC — latest location (from bot stdout)
  • STATE — running / exited / restarting
  • UP — uptime hh:mm:ss for the current run
  • RST — number of restarts so far
  • EXIT — last exit code / signal if any

Controls:
  q — quit (terminate all bots)
  r — restart selected bot (use ↑/↓ to move selection)
  R — restart ALL bots
  k — kill (terminate) selected bot
  ENTER — toggle pause/resume auto-restart for selected bot
  ↑/↓ — move selection

Notes:
  • Auto-restart: by default, if a bot exits, it will be restarted after a short backoff.
  • If curses is unavailable (e.g., not a TTY), a text table refreshes every ~2s as a fallback.
"""

from __future__ import annotations
import argparse
import curses
import json
import os
import signal
import random
import subprocess
import sys
import threading
import re
import traceback
import time
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any

try:
    import yaml  # type: ignore
except Exception as e:  # pragma: no cover
    print("PyYAML is required: pip install pyyaml", file=sys.stderr)
    raise

# ------------------------------
# Data structures
# ------------------------------

DEBUG_MSG = "<< DEBUG GOES HERE >>"
LOG_BOTS = False
KILL_RANGE = ()
LOTTERY_TIME = 10         # time elapsed to wait before next lottery
LAST_LOTTO_TIME = None      # last time since lottery played
LAST_IDX_WINNER = -1        # last index of bot that won lottery
IP_ADDR = ""

def debug_log(t):
    global DEBUG_MSG
    DEBUG_MSG = t
    # with open("dashboard_debug.txt") as f:
    #     f.write(t)

@dataclass
class BotSpec:
    name: str
    script: str
    instances: int = 1

@dataclass
class ProcInfo:
    spec_idx: int
    inst_idx: int
    name: str  # launcher name (e.g., Alpha#1)
    script: str
    process: Optional[subprocess.Popen] = None
    start_time: Optional[float] = None
    restarts: int = 0
    last_exit: Optional[str] = None
    auto_restart: bool = True
    state: str = "starting"  # starting | running | exited | restarting | killed
    # live fields parsed from stdout
    ingame_name: Optional[str] = None
    role: Optional[str] = None
    location: Optional[str] = None
    last_line: Optional[str] = None

    def uptime(self) -> float:
        if self.start_time is None:
            return 0.0
        return max(0.0, time.time() - self.start_time)

# ------------------------------
# YAML parsing
# ------------------------------

def load_config(path: str) -> List[BotSpec]:
    global KILL_RANGE, IP_ADDR
    with open(path, 'r') as fp:
        data = yaml.safe_load(fp)

    IP_ADDR = data["ip_addr"]

    if isinstance(data, list):
        # list of script paths
        return [BotSpec(name=os.path.splitext(os.path.basename(s))[0], script=str(s), instances=1) for s in data]

    if not isinstance(data, dict):
        raise ValueError("Config must be a list or a mapping with key 'bots' or 'scripts'.")

    bots = data.get('bots') or data.get('scripts')
    if not bots:
        raise ValueError("Config missing 'bots' or 'scripts'.")

    specs: List[BotSpec] = []
    if isinstance(bots, list):
        for entry in bots:
            if isinstance(entry, str):
                specs.append(BotSpec(name=os.path.splitext(os.path.basename(entry))[0], script=entry, instances=1))
            elif isinstance(entry, dict):
                name = entry.get('name') or os.path.splitext(os.path.basename(entry.get('script', 'bot.py')))[0]
                script = entry.get('script')
                if not script:
                    raise ValueError("Each bot dict needs a 'script' key.")
                instances = int(entry.get('instances', 1))
                specs.append(BotSpec(name=name, script=script, instances=instances))
            else:
                raise ValueError("Unsupported bot entry format.")
    else:
        raise ValueError("'bots'/'scripts' must be a list.")
    

    # set the kill range
    if 'kill_range' in data:
        KILL_RANGE = data['kill_range']
    else:
        KILL_RANGE = (5,30)        # bots live for 5-30 minutes for lottery time

    return specs

# ------------------------------
# Process management
# ------------------------------

class Supervisor:
    def __init__(self, specs: List[BotSpec], python_exe: str = sys.executable):
        self.specs = specs
        self.python = python_exe
        self.lock = threading.RLock()
        self.procs: List[ProcInfo] = []
        self._populate()
        self._stop = threading.Event()
        self.backoff_base = 1.5


        # Single shared log for all bots
        self.all_log_path = os.path.abspath(os.getenv("BOT_ALL_LOG", "bots_all.log"))
        self.all_log_lock = threading.Lock()
        self.all_log_file = open(self.all_log_path, "a", buffering=1, encoding="utf-8")  # line-buffered


    def _populate(self):
        for sidx, spec in enumerate(self.specs):
            for inst in range(spec.instances):
                self.procs.append(ProcInfo(spec_idx=sidx, inst_idx=inst, name=f"{spec.name}#{inst+1}", script=spec.script))

    def start_all(self):
        for i in range(len(self.procs)):
            self._start(i)
        threading.Thread(target=self._reaper_loop, daemon=True).start()

    def _start(self, idx: int):
        with self.lock:
            pinfo = self.procs[idx]
            try:
                env = dict(os.environ, PYTHONUNBUFFERED="1")
                p = subprocess.Popen(
                    [self.python, "-u", pinfo.script, IP_ADDR],     # <-- add "-u"
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    bufsize=1,                             # line buffered in text mode
                    text=True, universal_newlines=True,
                    env=env,                               # <-- pass PYTHONUNBUFFERED
                    stdin=subprocess.DEVNULL,              # avoid child waiting on stdin
                )

                pinfo.process = p
                pinfo.start_time = time.time()
                pinfo.state = "running"
                pinfo.last_exit = None
                # reader threads
                threading.Thread(target=self._stdout_reader, args=(idx,), daemon=True).start()
                threading.Thread(target=self._stderr_drain, args=(idx,), daemon=True).start()
                #debug_log("Launched threads for reading!")
            except Exception as e:
                pinfo.state = "exited"
                pinfo.last_exit = f"spawn_error:{e}"

    def _stderr_drain(self, idx: int):
        while not self._stop.is_set():
            with self.lock:
                if idx >= len(self.procs): return
                pinfo = self.procs[idx]
                p = pinfo.process
            if not p or p.stderr is None:
                return
            for raw in p.stderr:
                self._log_line(idx, "STDERR", raw.rstrip("\n"))
            return


    def _try_parse_json(self, line: str) -> Dict[str, Optional[str]]:
        s = line.strip()
        if s.startswith('DASHBOARD '):
            s = s[len('DASHBOARD '):].strip()
        try:
            obj = json.loads(s)
        except Exception:
            # debug to outfile
            debug_log("INVALID JSON\n")
            return {}
        out: Dict[str, Optional[str]] = {}
        if 'bot_name' in obj:
            out['name'] = str(obj['bot_name'])
        if 'name' in obj:
            out['name'] = str(obj['name'])
        if 'role' in obj:
            out['role'] = str(obj['role'])
        if 'location' in obj:
            out['location'] = str(obj['location'])

        # debug to outfile
        debug_log(json.dumps(out))


        return out
    
    # PATCH C: put this helper method on Supervisor
    def _extract_json_object(self, line: str) -> Optional[dict]:
        s = line.strip()
        if "DASHBOARD" in s:
            s = s.split("DASHBOARD", 1)[1].strip()
        # If JSON is embedded, peel from first '{' to last '}'.
        if '{' in s and '}' in s and s.index('{') < s.rindex('}'):
            s = s[s.index('{'):s.rindex('}')+1]
        try:
            return json.loads(s)
        except Exception:
            return None

    def _parse_and_update(self, idx: int, line: str) -> None:
        obj = self._extract_json_object(line)
        if obj:
            name = obj.get('bot_name') or obj.get('name')
            role = obj.get('role')
            loc  = obj.get('location')
            updated = []
            with self.lock:
                pinfo = self.procs[idx]
                if name: pinfo.ingame_name = str(name); updated.append(f"name={name}")
                if role: pinfo.role = str(role);        updated.append(f"role={role}")
                if loc:  pinfo.location = str(loc);     updated.append(f"loc={loc}")
            if updated:
                self._log_line(idx, "PARSED", ", ".join(updated))
            return

        # (Optional) ultra-simple regex fallbacks
        for key, pat in (("name", r"(?i)\bname[:=]\s*(.+)"),
                        ("role", r"(?i)\brole[:=]\s*(.+)"),
                        ("location", r"(?i)\b(loc|location)[:=]\s*(.+)")):
            m = re.search(pat, line)
            if m:
                val = m.group(m.lastindex).strip()
                with self.lock:
                    pinfo = self.procs[idx]
                    if key == "name":     pinfo.ingame_name = val
                    elif key == "role":   pinfo.role = val
                    else:                 pinfo.location = val
                self._log_line(idx, "PARSED", f"{key}={val}")


    def _stdout_reader(self, idx: int):
        # read stdout line by line and update live fields
        while not self._stop.is_set():
            with self.lock:
                if idx >= len(self.procs): return
                pinfo = self.procs[idx]
                p = pinfo.process
            if not p or p.stdout is None:
                return

            for raw in iter(p.stdout.readline, ''):          # <-- robust read
                line = raw.rstrip('\n')
                self._log_line(idx, "STDOUT", line)          # keep tee
                with self.lock:
                    pinfo.last_line = line

                # parse & update (see Patch C below)
                self._parse_and_update(idx, line)

            # EOF reached; if the process is still running, brief sleep then retry
            if p.poll() is None:
                time.sleep(0.05)
                continue
            return

    def stop_all(self, sig=signal.SIGTERM, timeout=5.0):
        with self.lock:
            for pinfo in self.procs:
                if pinfo.process and pinfo.process.poll() is None:
                    try:
                        pinfo.process.send_signal(sig)
                        pinfo.state = "killed"
                    except Exception:
                        pass
            end = time.time() + timeout
        while time.time() < end:
            alive = False
            with self.lock:
                for pinfo in self.procs:
                    if pinfo.process and pinfo.process.poll() is None:
                        alive = True
                        break
            if not alive:
                return
            time.sleep(0.1)
        with self.lock:
            for pinfo in self.procs:
                if pinfo.process and pinfo.process.poll() is None:
                    try:
                        pinfo.process.kill()
                    except Exception:
                        pass

    def restart(self, idx: int):
        with self.lock:
            pinfo = self.procs[idx]
            if pinfo.process and pinfo.process.poll() is None:
                try:
                    pinfo.process.terminate()
                except Exception:
                    pass
            pinfo.state = "restarting"
        time.sleep(0.1)
        self._start(idx)
        with self.lock:
            self.procs[idx].restarts += 1

    def toggle_autorestart(self, idx: int):
        with self.lock:
            self.procs[idx].auto_restart = not self.procs[idx].auto_restart

    def kill(self, idx: int):
        with self.lock:
            pinfo = self.procs[idx]
            if pinfo.process and pinfo.process.poll() is None:
                try:
                    pinfo.process.terminate()
                    pinfo.state = "killed"
                except Exception:
                    pass

    

    def _reaper_loop(self):
        # monitor processes and restart if they exit
        while not self._stop.is_set():
            with self.lock:
                for i, pinfo in enumerate(self.procs):
                    p = pinfo.process
                    if not p:
                        continue
                    rc = p.poll()
                    if rc is None:
                        continue
                    exit_desc = f"{rc}"
                    if rc < 0:
                        exit_desc = f"signal{-rc}"
                    pinfo.last_exit = exit_desc
                    pinfo.state = "exited"
                    pinfo.process = None
                    pinfo.start_time = None
                    if pinfo.auto_restart:
                        backoff = min(30.0, (self.backoff_base ** min(pinfo.restarts + 1, 8)))
                        self.lock.release()
                        try:
                            time.sleep(backoff)
                        finally:
                            self.lock.acquire()
                        self._start(i)
                        pinfo.restarts += 1
            time.sleep(0.2)

    def _log_line(self, idx: int, stream: str, line: str) -> None:
        ts = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
        with self.lock:  # read process info safely
            name = self.procs[idx].name if 0 <= idx < len(self.procs) else f"#{idx}"
            pid = (self.procs[idx].process.pid
                if 0 <= idx < len(self.procs) and self.procs[idx].process else "-")
        with self.all_log_lock:  # serialize writes
            if LOG_BOTS:
                self.all_log_file.write(f"[{ts}] [{stream}] [{name} pid={pid}] {line}\n")


    def shutdown(self):
        self._stop.set()
        self.stop_all()

        try:
            self.all_log_file.close()
        except Exception:
            pass


# ------------------------------
# Formatting helpers
# ------------------------------

def fmt_uptime(seconds: float) -> str:
    s = int(seconds)
    h = s // 3600
    m = (s % 3600) // 60
    sec = s % 60
    return f"{h:02d}:{m:02d}:{sec:02d}"


def _trunc(s: Optional[str], width: int) -> str:
    if not s:
        return ''.ljust(width)
    if len(s) <= width:
        return s.ljust(width)
    if width <= 1:
        return s[:width]
    return s[: max(0, width - 1)] + '…'

# ------------------------------
# Curses UI
# ------------------------------

class Dashboard:
    def __init__(self, sup: Supervisor):
        self.sup = sup
        self.selected = 0
        self.running = True
        self.offset = 6

    def play_lottery(self):
        ''' Kills a player at random; weighted towards longest living player '''
        global LAST_LOTTO_TIME, LOTTERY_TIME, LAST_IDX_WINNER
        with self.sup.lock:
            # gather alive players
            alive_players = []
            for i, pinfo in enumerate(self.sup.procs):
                if pinfo.process and pinfo.process.poll() is None:
                    alive_players.append((i, pinfo.uptime()))

            if not alive_players:
                # no players alive
                return

            # find the longest living player
            longest_player = max(alive_players, key=lambda x: x[1])[0]

            # weighted random choice: longer living players have higher chance
            total_uptime = sum(uptime for idx, uptime in alive_players)
            if total_uptime == 0:
                # all players have zero uptime; choose randomly
                winner_idx = random.choice([idx for idx, uptime in alive_players])
            else:
                pick = random.uniform(0, total_uptime)
                cumulative = 0.0
                winner_idx = alive_players[0][0]  # default
                for idx, uptime in alive_players:
                    cumulative += uptime
                    if pick <= cumulative:
                        winner_idx = idx
                        break

            # kill the winner
            self.sup.kill(winner_idx)

            # set a new lottery time
            LAST_LOTTO_TIME = time.perf_counter()
            LOTTERY_TIME = random.randint(KILL_RANGE[0],KILL_RANGE[1])*60    # convert to seconds
            LAST_IDX_WINNER = winner_idx


    def draw(self, stdscr):
        curses.curs_set(0)
        stdscr.nodelay(True)
        stdscr.timeout(200)
        while self.running:
            # play the lottery
            if (time.perf_counter() - LAST_LOTTO_TIME) >= LOTTERY_TIME:
                self.play_lottery()

            stdscr.erase()
            stdscr.addstr(0, 0, "BOT SUPERVISOR — q:quit  r:restart  R:restart all  k:kill  ENTER:toggle autorestart  ↑/↓:select")
            stdscr.addstr(self.offset-2, 0, "IDX   PID      BOT                     INGAME              ROLE               LOC              STATE            UP      RST  EXIT")
            stdscr.addstr(1, 0, f"Countdown to next lottery: {int((LOTTERY_TIME)-(time.perf_counter() - LAST_LOTTO_TIME))}\t\tLAST WINNER: {LAST_IDX_WINNER}")
            stdscr.addstr(2, 0, DEBUG_MSG)
            stdscr.hline(self.offset-1, 0, ord('-'), max(80, curses.COLS))

            with self.sup.lock:
                for i, pinfo in enumerate(self.sup.procs):
                    pid = pinfo.process.pid if pinfo.process and pinfo.process.poll() is None else '-'
                    up = fmt_uptime(pinfo.uptime()) if pid != '-' else '00:00:00'
                    bot = _trunc(pinfo.name, 18)
                    ingame = _trunc(pinfo.ingame_name, 18)
                    role = _trunc(pinfo.role, 18)
                    state = pinfo.state + (" (AR)" if pinfo.auto_restart else " (paus)")
                    exitc = _trunc(pinfo.last_exit or '', 6)
                    # Fit remaining cols: allocate what's left for location
                    loc = _trunc(pinfo.location, 12)
                    line = f"{i:>3}   {str(pid):>6}   {bot:<18}   {ingame:<18}   {role:<18}   {loc}  {state}     {up:>8}  {pinfo.restarts:>3}  {exitc:<6}"
                    if i == self.selected:
                        stdscr.attron(curses.A_REVERSE)
                        stdscr.addstr(self.offset + i, 0, line[: curses.COLS - 1])
                        stdscr.attroff(curses.A_REVERSE)
                    else:
                        stdscr.addstr(self.offset + i, 0, line[: curses.COLS - 1])

            try:
                ch = stdscr.getch()
            except curses.error:
                ch = -1
            if ch == -1:
                continue
            elif ch in (ord('q'), ord('Q')):
                self.running = False
            elif ch in (curses.KEY_DOWN,):
                self.selected = min(self.selected + 1, len(self.sup.procs) - 1)
            elif ch in (curses.KEY_UP, ):
                self.selected = max(self.selected - 1, 0)
            elif ch in (ord('r'),):
                self.sup.restart(self.selected)
            elif ch in (ord('R'),):
                for i in range(len(self.sup.procs)):
                    self.sup.restart(i)
            elif ch in (ord('\n'), ord('\r')):
                self.sup.toggle_autorestart(self.selected)
            elif ch in (ord('k'), ord('K')):
                self.sup.kill(self.selected)


    def run(self):
        try:
            curses.wrapper(self.draw)
        except Exception:
            # print the error
            traceback.print_exc()

        # if self.running:
        #     # fallback to non-curses mode
        #     self._fallback_loop()

    def _fallback_loop(self):
        try:
            while self.running:
                os.system('clear' if os.name != 'nt' else 'cls')
                print("IDX   PID      BOT                     INGAME              ROLE               LOC              STATE            UP      RST  EXIT")
                print("-" * 120)
                with self.sup.lock:
                    for i, pinfo in enumerate(self.sup.procs):
                        pid = pinfo.process.pid if pinfo.process and pinfo.process.poll() is None else '-'
                        up = fmt_uptime(pinfo.uptime()) if pid != '-' else '00:00:00'
                        bot = _trunc(pinfo.name, 18)
                        ingame = _trunc(pinfo.ingame_name, 18)
                        role = _trunc(pinfo.role, 18)
                        state = pinfo.state + (" (AR)" if pinfo.auto_restart else " (paus)")
                        exitc = _trunc(pinfo.last_exit or '', 6)
                        # Fit remaining cols: allocate what's left for location
                        loc = _trunc(pinfo.location, 12)
                        line = f"{i:>3}   {str(pid):>6}   {bot:<18}   {ingame:<18}   {role:<18}   {loc}  {state}     {up:>8}  {pinfo.restarts:>3}  {exitc:<6}"
                        print(line)
                print("\nPress Ctrl-C to quit.\n")
                time.sleep(2.0)
        except KeyboardInterrupt:
            self.running = False

# ------------------------------
# Main
# ------------------------------

def parse_args(argv: List[str]) -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Run game bots with a live dashboard")
    ap.add_argument('--config', default='data/ai-config.yaml', help='Path to YAML config listing bot scripts')
    ap.add_argument('--python', default=sys.executable, help='Python interpreter to use (default: current)')
    return ap.parse_args(argv)


def main(argv: List[str] | None = None):
    global LAST_LOTTO_TIME, LOTTERY_TIME, LAST_IDX_WINNER
    args = parse_args(argv or sys.argv[1:])

    specs = load_config(args.config)
    if not specs:
        print("No bots found in config.", file=sys.stderr)
        return 2

    sup = Supervisor(specs, python_exe=args.python)

    def _sig_handler(signum, frame):
        sup.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, _sig_handler)
    signal.signal(signal.SIGTERM, _sig_handler)
    LAST_LOTTO_TIME = time.perf_counter()
    LOTTERY_TIME = random.randint(KILL_RANGE[0],KILL_RANGE[1])*60    # convert to seconds
    sup.start_all()

    ui = Dashboard(sup)
    ui.run()

    sup.shutdown()


if __name__ == '__main__':
    sys.exit(main())
