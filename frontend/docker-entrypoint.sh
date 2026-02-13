#!/bin/sh
set -e

echo "=== Starting nginx setup ==="

# Debug: Show the BACKEND_URL value
echo "BACKEND_URL is set to: $BACKEND_URL"

# Ensure BACKEND_URL has protocol and port if not already included
if echo "$BACKEND_URL" | grep -q "^http"; then
    # Already has protocol, use as-is
    FULL_BACKEND_URL="$BACKEND_URL"
    # Extract host:port for upstream (remove http:// prefix)
    BACKEND_HOST_PORT=$(echo "$BACKEND_URL" | sed 's|^https\?://||')
else
    # Add protocol and port
    FULL_BACKEND_URL="http://$BACKEND_URL:8000"
    BACKEND_HOST_PORT="$BACKEND_URL:8000"
fi

echo "Full BACKEND_URL will be: $FULL_BACKEND_URL"
echo "Backend host:port for upstream: $BACKEND_HOST_PORT"

# Resolve hostname to IPv4 to avoid nginx IPv6 timeout issues on Railway
BACKEND_HOST=$(echo "$BACKEND_HOST_PORT" | cut -d: -f1)
BACKEND_PORT=$(echo "$BACKEND_HOST_PORT" | cut -d: -f2)
RESOLVED_IP=$(getent ahostsv4 "$BACKEND_HOST" 2>/dev/null | head -1 | awk '{print $1}')
if [ -n "$RESOLVED_IP" ]; then
    BACKEND_HOST_PORT="${RESOLVED_IP}:${BACKEND_PORT}"
    echo "Resolved $BACKEND_HOST to IPv4: $RESOLVED_IP"
else
    echo "Could not resolve to IPv4, using hostname: $BACKEND_HOST_PORT"
fi

# Test backend connectivity
echo "=== Testing backend connectivity ==="
if wget --spider --timeout=10 --tries=3 "$FULL_BACKEND_URL/admin" 2>/dev/null; then
    echo "Backend is reachable at $FULL_BACKEND_URL"
else
    echo "Backend not immediately reachable - nginx will retry"
fi

echo "Using backend address: $BACKEND_HOST_PORT"

# Generate nginx config from template
echo "=== Generating nginx configuration ==="
BACKEND_URL="$BACKEND_HOST_PORT" envsubst '$BACKEND_URL' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf

# Test nginx config
echo "=== Testing nginx configuration ==="
if ! nginx -t; then
    echo "Nginx config test failed!"
    echo "Full config file:"
    cat /etc/nginx/conf.d/default.conf
    sleep 300
    exit 1
fi

echo "Nginx config test passed!"

# Create nginx log files
mkdir -p /var/log/nginx
touch /var/log/nginx/access.log /var/log/nginx/error.log
chown -R nginx:nginx /var/log/nginx

# Limit nginx worker processes (default 'auto' spawns too many on Railway)
sed -i 's/worker_processes.*/worker_processes 2;/' /etc/nginx/nginx.conf

echo "=== Starting nginx ==="

# Start nginx in foreground
nginx -g 'daemon off;'
