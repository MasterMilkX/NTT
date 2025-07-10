!/bin/bash

source ~/npc_tt_env/bin/activate
nohup python3 run_ai.py > ai_log.txt 2>&1 &
echo "AI bot started in the background. Check ai_log.txt for output."