# OpenTunnel Client Dockerfile
# Allows running opentunnel client without global npm install

FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY client/package.json ./
COPY client/package-lock.json* ./

# Install dependencies
RUN npm install --production

# Copy client source code
COPY client/ ./client/

# Create entrypoint script for flexible command handling
RUN echo '#!/bin/sh\n\
set -e\n\
\n\
# Handle init command\n\
if [ "$1" = "init" ]; then\n\
  shift\n\
  node /app/client/bin/opentunnel.js init "$@"\n\
  exit $?\n\
fi\n\
\n\
# Handle status command\n\
if [ "$1" = "status" ]; then\n\
  node /app/client/bin/opentunnel.js status\n\
  exit $?\n\
fi\n\
\n\
# Default: tunnel command\n\
# Usage: docker run opentunnel [port] or docker run opentunnel https://domain [port]\n\
if [ -n "$1" ] && echo "$1" | grep -qE "^https?://"; then\n\
  # First arg is domain, second is port (optional)\n\
  DOMAIN="$1"\n\
  PORT="${2:-3000}"\n\
  node /app/client/bin/opentunnel.js init "$DOMAIN" || true\n\
  node /app/client/bin/opentunnel.js "$PORT"\n\
else\n\
  # First arg is port (or default 3000)\n\
  PORT="${1:-3000}"\n\
  node /app/client/bin/opentunnel.js "$PORT"\n\
fi' > /entrypoint.sh && chmod +x /entrypoint.sh

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]

# Default command (will use port 3000)
CMD []

