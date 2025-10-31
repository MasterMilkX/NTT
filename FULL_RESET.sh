#!/usr/bin/env bash
set -euo pipefail

VENV_BIN="$HOME/npc_tt_env/bin"
PY="$VENV_BIN/python"

cd ~/NTT/online-game
pm2 restart game-server

cd ~/NTT/AI
./killbots.sh

# Restart tmux session using the venv's interpreter directly
if tmux has-session -t bots 2>/dev/null; then
  tmux kill-session -t bots
fi

# -c ensures the working dir is the AI folder (where we already are)
tmux new-session -s bots -c "$PWD" -d "$PY -u ai-dashboard.py"
