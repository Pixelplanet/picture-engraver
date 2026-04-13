# 🎨 Picture Engraver

Convert images to **XCS laser engraving files** specifically optimized for **stainless steel color engraving**.

![Main Interface](public/screenshots/main.png)

## 🌟 Features

- **🚀 Automatic Vectorization**: Converts your bitmap images into clean vectors for laser engraving.
- **🌈 Color Quantization**: Intelligently reduces image colors to a manageable set for laser processing.
- **📊 Calibration Test Grids**: Generate optimized test grids to find the perfect laser parameters for every color.
- **📷 Smart Analyzer**: Upload a photo of your engraved test grid; the app reads the QR code and automatically maps colors to the best laser settings.
- **💾 XCS Export**: Directly export files compatible with xTool Creative Space.

## 🛠️ Calibration Workflow

The key to perfect color engraving is calibration. Picture Engraver streamlines this process:

1. **Generate Grid**: Create a "Standard" or "Custom" calibration grid.
2. **Engrave**: Run the `.xcs` file on your laser (don't forget to focus UP by 4mm!).
3. **Analyze**: Take a photo of the result and upload it to the **Analyzer**.
4. **Apply**: The app now knows exactly which settings produce which colors on your specific machine.

| Standard Grid | Analyzer |
| :---: | :---: |
| ![Standard Grid](public/screenshots/standard_grid.png) | ![Analyzer](public/screenshots/analyzer.png) |

## 🐳 Docker Deployment

The Docker image supports **both AMD64 (x86) and ARM64** architectures, making it compatible with:
- Standard cloud instances
- Oracle Cloud ARM instances (Ampere A1)
- Raspberry Pi 4/5
- Apple Silicon Macs

Run the application using Docker:

```bash
docker run -d --name picture-engraver --restart always \
  -p 3002:80 \
  -e ADMIN_TOKEN=your-secret-token \
  -v picture-engraver-data:/app/data \
  pixelplanet/picture-engraver:latest
```

Or using Docker Compose (set `ADMIN_TOKEN` in your environment or `.env` file):

```bash
ADMIN_TOKEN=your-secret-token docker-compose up -d
```

> 📖 **For developers:** See [docs/RELEASE_PROCEDURE.md](docs/RELEASE_PROCEDURE.md) for the modern deployment workflow and [docs/DOCKER_BUILD.md](docs/DOCKER_BUILD.md) for manual multi-arch build instructions.

## 🔐 Admin Portal

The admin portal lets you manage default test grid settings and color maps for all users. Access it at `/admin`.

**Features:**
- **Test Grid Defaults** — Configure default frequency, LPI, power, and speed ranges per laser type.
- **Color Map Management** — Upload, replace, and set default color mappings from analyzer export packages.

**Setup:** Set the `ADMIN_TOKEN` environment variable to enable authentication. Without it, the admin panel is inaccessible.

> 📖 See [docs/ADMIN_PORTAL.md](docs/ADMIN_PORTAL.md) for full usage documentation.

## 🏗️ Local Development

For fast development cycles, we run the app directly on the host without Docker.

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Frontend (Vite)**:
   This supports Hot Module Replacement (HMR) for the UI.
   ```bash
   npm run dev
   ```

3. **Run Backend (Node.js)**:
   This provides the API (logging, health) and serves the production build.
   ```bash
   node server.js
   ```

4. **Prepare for Deployment**:
   ```bash
   npm run build
   ```

## 🧪 Testing

The project has two layers of automated tests.

**Unit Tests** (Vitest):
```bash
npm run test:unit
```

**End-to-End Tests** (Playwright – requires a running server):
```bash
npm run test:e2e
```

---
Built for the maker community. 🛠️✨
