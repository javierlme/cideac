#!/bin/bash
set -euxo pipefail

echo -e "\n*********** CONTAINER STARTUP ***********"

# Run slack notifications
/docker-scripts/slack-notify.sh 'started' &
# Remove health record
rm -rf .unhealthy &

# Start cron
service cron start &

echo "LANZANDO SERVICIO"
node /app/server.js 2>&1 | tee -a $LOGS_FILE
