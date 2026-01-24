# Deploy Update Script for Picture Engraver on Oracle Cloud
# This script automatically updates the Docker container to the latest version

# Ensure we catch all errors and pause before closing
$ErrorActionPreference = "Continue"

try {
    $SSH_KEY = "C:\Users\Tom\Downloads\ssh-key-2026-01-22 (1).key"
    $SERVER_IP = "92.5.61.220"
    $SERVER_USER = "opc"
    $CONTAINER_NAME = "picture-engraver"
    $IMAGE_NAME = "pixelplanet5/picture-engraver:latest"

    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Picture Engraver - Deploy Update" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Pre-flight checks
    Write-Host "[Pre-flight] Checking prerequisites..." -ForegroundColor Yellow
    
    # Check if SSH key exists
    if (-not (Test-Path $SSH_KEY)) {
        throw "SSH key not found at: $SSH_KEY"
    }
    Write-Host "  SSH key found: $SSH_KEY" -ForegroundColor Gray
    
    # Test network connectivity
    Write-Host "  Testing network connectivity to $SERVER_IP..." -ForegroundColor Gray
    $pingResult = Test-Connection -ComputerName $SERVER_IP -Count 2 -Quiet
    if (-not $pingResult) {
        Write-Host "  WARNING: Server did not respond to ping" -ForegroundColor Yellow
        Write-Host "  This might be normal if ICMP is blocked" -ForegroundColor Gray
    } else {
        Write-Host "  Server responds to ping" -ForegroundColor Gray
    }
    
    # Test SSH port
    Write-Host "  Testing SSH port 22..." -ForegroundColor Gray
    $portTest = Test-NetConnection -ComputerName $SERVER_IP -Port 22 -WarningAction SilentlyContinue
    if ($portTest.TcpTestSucceeded) {
        Write-Host "  Port 22 is open and accepting connections" -ForegroundColor Gray
    } else {
        Write-Host "  ERROR: Port 22 is not reachable!" -ForegroundColor Red
        Write-Host "  Possible causes:" -ForegroundColor Yellow
        Write-Host "    - Server is down or rebooting" -ForegroundColor Yellow
        Write-Host "    - Firewall blocking SSH (check Oracle Cloud Security List)" -ForegroundColor Yellow
        Write-Host "    - Server ran out of memory (needs reboot)" -ForegroundColor Yellow
        throw "SSH port is not accessible"
    }
    Write-Host ""

    # Test SSH connectivity
    Write-Host "[1/5] Testing SSH connection..." -ForegroundColor Yellow
    Write-Host "  Connecting to: $SERVER_USER@$SERVER_IP" -ForegroundColor Gray
    $testResult = ssh -v -i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10 $SERVER_USER@$SERVER_IP "echo 'Connected'" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Failed to establish SSH connection!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Diagnostic Information:" -ForegroundColor Yellow
        Write-Host "  Server IP: $SERVER_IP" -ForegroundColor Gray
        Write-Host "  SSH Port: 22" -ForegroundColor Gray
        Write-Host "  User: $SERVER_USER" -ForegroundColor Gray
        Write-Host "  Key: $SSH_KEY" -ForegroundColor Gray
        Write-Host ""
        Write-Host "SSH Error Output:" -ForegroundColor Yellow
        Write-Host ($testResult | Out-String) -ForegroundColor Gray
        Write-Host ""
        Write-Host "Troubleshooting Steps:" -ForegroundColor Yellow
        Write-Host "  1. Check if server is running in Oracle Cloud Console" -ForegroundColor Gray
        Write-Host "  2. Try rebooting the instance if it's frozen" -ForegroundColor Gray
        Write-Host "  3. Verify Oracle Cloud Security List allows port 22" -ForegroundColor Gray
        Write-Host "  4. Check if the server has enough free memory (swap)" -ForegroundColor Gray
        throw "SSH connection failed"
    }
    Write-Host "SSH connection successful" -ForegroundColor Green
    Write-Host ""

    # Pull latest image
    Write-Host "[2/5] Pulling latest Docker image..." -ForegroundColor Yellow
    Write-Host "  Image: $IMAGE_NAME" -ForegroundColor Gray
    ssh -i $SSH_KEY -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP "sudo docker pull $IMAGE_NAME"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to pull Docker image!" -ForegroundColor Red
        throw "Docker pull failed - check if Docker is running on the server"
    }
    Write-Host "Latest image pulled" -ForegroundColor Green
    Write-Host ""

    # Stop existing container
    Write-Host "[3/5] Stopping existing container..." -ForegroundColor Yellow
    ssh -i $SSH_KEY -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP "sudo docker stop $CONTAINER_NAME; exit 0"
    Write-Host "Container stopped" -ForegroundColor Green
    Write-Host ""

    # Remove existing container
    Write-Host "[4/5] Removing old container..." -ForegroundColor Yellow
    ssh -i $SSH_KEY -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP "sudo docker rm $CONTAINER_NAME; exit 0"
    Write-Host "Old container removed" -ForegroundColor Green
    Write-Host ""

    # Start new container
    Write-Host "[5/5] Starting new container..." -ForegroundColor Yellow
    Write-Host "  Port mapping: 3002 -> 80" -ForegroundColor Gray
    $startOutput = ssh -i $SSH_KEY -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP "sudo docker run -d --name $CONTAINER_NAME --restart always -p 3002:80 $IMAGE_NAME" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to start new container!" -ForegroundColor Red
        Write-Host "Docker error: $startOutput" -ForegroundColor Gray
        throw "Container start failed"
    }
    Write-Host "New container started" -ForegroundColor Green
    Write-Host "  Container ID: $($startOutput.Substring(0, 12))" -ForegroundColor Gray
    Write-Host ""

    # Verify deployment
    Write-Host "Verifying deployment..." -ForegroundColor Yellow
    Start-Sleep -Seconds 3
    $status = ssh -i $SSH_KEY -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP "sudo docker ps --filter name=$CONTAINER_NAME --format '{{.Status}}'"
    Write-Host "  Container Status: $status" -ForegroundColor Cyan
    
    # Check if accessible
    Write-Host "  Testing web access..." -ForegroundColor Gray
    $webTest = Test-NetConnection -ComputerName $SERVER_IP -Port 3002 -WarningAction SilentlyContinue
    if ($webTest.TcpTestSucceeded) {
        Write-Host "  Web port 3002 is accessible!" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: Web port 3002 is not accessible yet" -ForegroundColor Yellow
        Write-Host "  The container might still be starting up" -ForegroundColor Gray
    }
    Write-Host ""

    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Deployment Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your application is running at:" -ForegroundColor White
    Write-Host "http://$SERVER_IP:3002" -ForegroundColor Cyan
}
catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "Deployment Failed!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Full error details:" -ForegroundColor Yellow
    Write-Host $_.Exception | Format-List * -Force | Out-String
}
finally {
    Write-Host ""
    Write-Host "Press Enter to close this window..." -ForegroundColor Gray
    Read-Host
}
