# Docker Build & Deployment Guide

## ⚠️ IMPORTANT: Multi-Architecture Builds Required

This application MUST be built for **both AMD64 (x86) and ARM64** architectures to support all deployment targets including:
- Standard cloud instances (AMD64)
- Oracle Cloud ARM instances (ARM64/aarch64)
- Raspberry Pi and other ARM devices
- Apple Silicon Macs (ARM64)

**Do NOT push single-architecture images to Docker Hub.**

---

## Building Multi-Architecture Images

### Prerequisites

1. **Docker Buildx** (included in Docker Desktop 19.03+)
2. **Docker Hub credentials** (for pushing)

### One-Time Setup

Create a multi-platform builder (only needed once):

```bash
docker buildx create --name multiarch-builder --use
docker buildx inspect --bootstrap
```

### Building and Pushing

Use the following command to build for both architectures and push to Docker Hub:

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t pixelplanet5/picture-engraver:latest \
  --push \
  .
```

### Build Script (Recommended)

For convenience, use the provided `build_multiarch.ps1` (Windows) or `build_multiarch.sh` (Linux/Mac) scripts.

---

## Architecture Support

| Platform | Architecture | Supported |
|----------|--------------|-----------|
| Linux x86 | `linux/amd64` | ✅ |
| Linux ARM | `linux/arm64` | ✅ |
| Windows x86 | `windows/amd64` | ❌ (use WSL2) |
| macOS Intel | `linux/amd64` | ✅ |
| macOS Apple Silicon | `linux/arm64` | ✅ |

---

## Deployment

### Quick Start (Any Architecture)

```bash
docker run -d --name picture-engraver --restart always -p 3002:80 pixelplanet5/picture-engraver:latest
```

Docker will automatically pull the correct architecture version.

### Oracle Cloud (ARM)

Oracle Cloud's free-tier Ampere A1 instances use ARM64. The multi-arch image works automatically.

### Verifying Architecture

To check which architecture is running:

```bash
docker inspect picture-engraver --format '{{.Architecture}}'
```

---

## Updating the Image

When making changes:

1. Make your code changes
2. Run `npm run build` locally to verify
3. Build and push the multi-arch image:
   ```bash
   docker buildx build --platform linux/amd64,linux/arm64 -t pixelplanet5/picture-engraver:latest --push .
   ```
4. On the server, update with:
   ```bash
   docker pull pixelplanet5/picture-engraver:latest
   docker stop picture-engraver
   docker rm picture-engraver
   docker run -d --name picture-engraver --restart always -p 3002:80 pixelplanet5/picture-engraver:latest
   ```

---

## Troubleshooting

### "exec format error"
This means the image architecture doesn't match the host. Ensure you've pushed a multi-arch image.

### Build fails on ARM dependencies
Some npm packages with native binaries may need adjustment. The current Dockerfile uses Alpine which has good ARM support.

### Slow builds
Multi-arch builds use QEMU emulation for cross-compilation. Building on native hardware is faster but not required.
