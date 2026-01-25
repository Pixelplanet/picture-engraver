# Multi-Architecture Docker Build Script for Picture Engraver
# Builds and pushes images for both AMD64 and ARM64

param(
    [switch]$NoPush,
    [string]$Tag = "latest"
)

$IMAGE_NAME = "pixelplanet5/picture-engraver"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Multi-Arch Docker Build" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Image: $IMAGE_NAME`:$Tag" -ForegroundColor White
Write-Host "Platforms: linux/amd64, linux/arm64" -ForegroundColor White
Write-Host ""

# Check if buildx is available
Write-Host "[1/4] Checking Docker Buildx..." -ForegroundColor Yellow
$buildxVersion = docker buildx version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker Buildx is not available!" -ForegroundColor Red
    Write-Host "Please install Docker Desktop 19.03+ or enable buildx plugin" -ForegroundColor Red
    # Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "  Buildx available: $buildxVersion" -ForegroundColor Gray

# Create or use multi-platform builder
Write-Host "[2/4] Setting up multi-platform builder..." -ForegroundColor Yellow
$existingBuilder = docker buildx ls 2>&1 | Select-String "multiarch-builder"
if (-not $existingBuilder) {
    Write-Host "  Creating new builder..." -ForegroundColor Gray
    docker buildx create --name multiarch-builder --use
    docker buildx inspect --bootstrap
}
else {
    Write-Host "  Using existing builder" -ForegroundColor Gray
    docker buildx use multiarch-builder
}

# Build
Write-Host "[3/4] Building for AMD64 and ARM64..." -ForegroundColor Yellow
Write-Host "  This may take several minutes..." -ForegroundColor Gray
Write-Host ""

if ($NoPush) {
    # Local build only (loads to local Docker)
    docker buildx build `
        --platform linux/amd64, linux/arm64 `
        -t ${IMAGE_NAME}:$Tag `
        --load `
        .
}
else {
    # Build and push to Docker Hub
    docker buildx build `
        --platform linux/amd64, linux/arm64 `
        -t ${IMAGE_NAME}:$Tag `
        --push `
        .
}

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Build failed!" -ForegroundColor Red
    # Read-Host "Press Enter to exit"
    exit 1
}

# Verify
Write-Host ""
Write-Host "[4/4] Verifying multi-arch manifest..." -ForegroundColor Yellow
docker buildx imagetools inspect ${IMAGE_NAME}:$Tag

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Build Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Image pushed: $IMAGE_NAME`:$Tag" -ForegroundColor Cyan
Write-Host "Architectures: AMD64 (x86), ARM64 (aarch64)" -ForegroundColor Cyan
Write-Host ""
Write-Host "To deploy on any architecture:" -ForegroundColor White
Write-Host "  docker pull $IMAGE_NAME`:$Tag" -ForegroundColor Gray
Write-Host ""

# Read-Host "Press Enter to close"
