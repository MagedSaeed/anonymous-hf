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

# Extract DNS resolver from /etc/resolv.conf for nginx resolver directive.
# This allows nginx to re-resolve the backend hostname dynamically,
# so if the backend gets a new IP (e.g. after Railway redeploy), nginx picks it up.
RAW_RESOLVER=$(grep -m1 '^nameserver' /etc/resolv.conf | awk '{print $2}')
if [ -z "$RAW_RESOLVER" ]; then
    DNS_RESOLVER="8.8.8.8 1.1.1.1"
    echo "No nameserver in resolv.conf, using fallback: $DNS_RESOLVER"
elif echo "$RAW_RESOLVER" | grep -q ':'; then
    # IPv6 address — nginx requires brackets around IPv6 in resolver directive
    DNS_RESOLVER="[$RAW_RESOLVER]"
    echo "Using IPv6 DNS resolver from resolv.conf: $DNS_RESOLVER"
else
    DNS_RESOLVER="$RAW_RESOLVER"
    echo "Using DNS resolver from resolv.conf: $DNS_RESOLVER"
fi
export DNS_RESOLVER

# Test backend connectivity (informational only, nginx will keep retrying)
echo "=== Testing backend connectivity ==="
BACKEND_HOST=$(echo "$BACKEND_HOST_PORT" | cut -d: -f1)
RESOLVED_IP=$(getent ahostsv4 "$BACKEND_HOST" 2>/dev/null | head -1 | awk '{print $1}')
if [ -n "$RESOLVED_IP" ]; then
    echo "Backend $BACKEND_HOST resolves to IPv4: $RESOLVED_IP"
else
    echo "Could not resolve $BACKEND_HOST to IPv4 (nginx will use resolver directive)"
fi

if wget --spider --timeout=10 --tries=2 "$FULL_BACKEND_URL/admin" 2>/dev/null; then
    echo "Backend is reachable at $FULL_BACKEND_URL"
else
    echo "Backend not immediately reachable - nginx resolver will keep retrying"
fi

# Keep the hostname (NOT the resolved IP) so nginx can re-resolve dynamically
echo "Using backend address for nginx: $BACKEND_HOST_PORT (hostname, not hardcoded IP)"

# Generate nginx config from template
# Both BACKEND_URL (host:port) and DNS_RESOLVER are substituted
echo "=== Generating nginx configuration ==="
BACKEND_URL="$BACKEND_HOST_PORT" envsubst '$BACKEND_URL $DNS_RESOLVER' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf

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
