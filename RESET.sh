#!/bin/bash

# reset the server and bots
#!/usr/bin/env bash
set -euo pipefail

# Define paths
VENV_BIN="$HOME/npc_tt_env/bin"
PY="$VENV_BIN/python"

# Navigate and run each step
cd ~/online-game
pm2 restart game-server

cd ~/AI
./killbots.sh

# Restart tmux session with your venv Python
tmux has-session -t bots 2>/dev/null && tmux kill-session -t bots
tmux new-session -s bots -d "$PY -u ai-dashboard.py"
