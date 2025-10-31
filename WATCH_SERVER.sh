#!/usr/bin/env bash
set -euo pipefail

# Name of your PM2 process
PROCESS_NAME="game-server"

# How often to check (in seconds)
INTERVAL=30

echo "Starting PM2 monitor for '$PROCESS_NAME' (checking every $INTERVAL seconds)..."

while true; do
    # Check if the process exists and is online
    STATUS=$(pm2 info "$PROCESS_NAME" 2>/dev/null | grep -E "status" || true)

    if [[ "$STATUS" == *"online"* ]]; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') - $PROCESS_NAME is running."
    else
        echo "$(date '+%Y-%m-%d %H:%M:%S') - $PROCESS_NAME is DOWN. Restarting..."
        ./FULL_RESET.sh
	#pm2 restart "$PROCESS_NAME" || pm2 start "$PROCESS_NAME"
    fi

    sleep "$INTERVAL"
done

