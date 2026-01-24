#!/bin/bash
set -e
echo "Starting Swap Setup..."

# Check if swapfile already exists
if [ -f /swapfile ]; then
    echo "Swap file already exists."
else
    echo "Creating 2GB swap file..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "Swap file created and enabled."
fi

echo "Current Memory Status:"
free -h

echo "Configuring Firewall..."
# Try/catch style for firewall commands as they might fail if firewall-cmd isn't installed yet
if command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=3002/tcp || echo "Failed to add port 3002"
    firewall-cmd --reload || echo "Failed to reload firewall"
else
    echo "firewall-cmd not found, skipping..."
fi

echo "Setup Complete."
