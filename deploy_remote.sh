#!/bin/bash
set -e

# 1. Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    sudo dnf install -y dnf-utils zip unzip
    sudo dnf config-manager --add-repo=https://download.docker.com/linux/centos/docker-ce.repo
    sudo dnf remove -y runc
    sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker opc
else
    echo "Docker already installed."
fi

# 2. Setup directory
mkdir -p ~/app
cd ~/app

# 3. Unzip
echo "Unzipping deploy.zip..."
unzip -o ~/deploy.zip

# 4. Build and Run
echo "Deploying with Docker Compose..."
# Using 'docker compose' (v2 plugin) or 'docker-compose' (standalone)
if command -v docker-compose &> /dev/null; then
    sudo docker-compose up -d --build
else
    sudo docker compose up -d --build
fi

echo "Deployment Complete! Service should be running on port 3002 mapped to host port 3002 (or 80 based on your compose)."
