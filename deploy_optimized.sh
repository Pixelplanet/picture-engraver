#!/bin/bash
set -e

echo "=== Picture Engraver Deployment for 1GB Oracle Cloud Instance ==="

# Step 1: Setup Swap File (Critical for 1GB RAM)
echo "Step 1: Setting up 2GB swap file..."
if [ ! -f /swapfile ]; then
    sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "Swap file created successfully"
else
    echo "Swap file already exists"
fi

# Show memory status
free -h

# Step 2: Install Docker (using Oracle Linux repos)
echo "Step 2: Installing Docker..."
if ! command -v docker &> /dev/null; then
    sudo dnf config-manager --add-repo=https://download.docker.com/linux/centos/docker-ce.repo
    sudo dnf install -y docker-ce docker-ce-cli containerd.io --nobest
    sudo systemctl enable docker
    sudo systemctl start docker
    sudo usermod -aG docker opc
    echo "Docker installed successfully"
else
    echo "Docker already installed"
    sudo systemctl start docker || true
fi

# Step 3: Configure Firewall
echo "Step 3: Configuring firewall for port 3002..."
sudo firewall-cmd --permanent --add-port=3002/tcp || true
sudo firewall-cmd --reload || true

# Step 4: Pull and Run Pre-built Image (NO BUILDING!)
echo "Step 4: Pulling and running pre-built Docker image..."
sudo docker pull pixelplanet5/picture-engraver:latest

# Stop and remove existing container if present
sudo docker stop picture-engraver 2>/dev/null || true
sudo docker rm picture-engraver 2>/dev/null || true

# Run the container
sudo docker run -d \
  --name picture-engraver \
  --restart always \
  -p 3002:80 \
  pixelplanet5/picture-engraver:latest

echo ""
echo "=== Deployment Complete! ==="
echo "Your application should be accessible at: http://$(curl -s ifconfig.me):3002"
echo ""
echo "Useful commands:"
echo "  - View logs: sudo docker logs picture-engraver"
echo "  - Restart: sudo docker restart picture-engraver"
echo "  - Stop: sudo docker stop picture-engraver"
