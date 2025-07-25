#!/bin/bash

source /home/ubuntu/npc_tt_env/bin/activate
nohup python3 run_ai.py > run_ai_OUT.log 2>&1 &
