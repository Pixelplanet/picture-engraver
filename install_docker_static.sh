#!/bin/bash
set -e
echo "Installing Docker from Static Binaries..."

# cleanup previous attempts
killall dockerd 2>/dev/null || true
killall docker-containerd 2>/dev/null || true

cd ~
# Download Docker static binaries (latest stable)
# Check for existing download to save bandwidth
if [ ! -f docker-26.1.3.tgz ]; then
    echo "Downloading Docker..."
    curl -LO https://download.docker.com/linux/static/stable/x86_64/docker-26.1.3.tgz
fi

echo "Extracting..."
tar xzvf docker-26.1.3.tgz

echo "Installing..."
sudo cp docker/* /usr/bin/

echo "Starting Docker Daemon..."
# Run in background with logging
sudo dockerd > dockerd.log 2>&1 &

echo "Waiting for Docker to start..."
sleep 5
sudo docker version

echo "Docker Installed Successfully!"
