#!/bin/sh
# Ensure data and log directories are writable by the node user.
# When Docker named volumes are mounted, they may be owned by root
# even though the Dockerfile chowns the directory before the volume is attached.

# Fix ownership if running as root (allows USER node to write)
if [ "$(id -u)" = "0" ]; then
    chown -R node:node /app/data /app/logs 2>/dev/null || true
    exec su-exec node node server.js
else
    # Already running as node — just start
    exec node server.js
fi
