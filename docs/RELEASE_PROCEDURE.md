# Release & Deployment Procedure

This document outlines the workflow for developing, testing, and deploying the Picture Engraver application.

## 1. Local Development (High Speed)

For active coding, avoid using Docker locally. It is slow and complicates the feedback loop.

- **Frontend**: Run `npm run dev`. This provides Hot Module Replacement (HMR).
- **Backend API**: Run `node server.js` (on port 3002). This provides logging, health checks, and simulates the production environment.
- **Verification**: Ensure your changes work at `http://localhost:3002`.

## 2. Pushing Changes & Cloud Build

Once changes are verified locally, push them to the `main` branch.

- **Command**: `git push origin main`
- **Automation**: A GitHub Action is triggered automatically (`.github/workflows/docker-build.yml`). 
- **Result**: A multi-architecture Docker image (`AMD64` + `ARM64`) is built natively in the cloud and pushed to Docker Hub under `pixelplanet/picture-engraver:latest`.
- **Note**: This build takes approximately 3-5 minutes.

## 3. Deployment via `DEPLOY.bat`

Use the interactive controller for all remote actions. This ensures consistency and prevents manual errors.

1. Double-click **`DEPLOY.bat`** in the project root.
2. Select **Action 2 (STAGING)**: Deploy the latest image to `test.lasertools.org`.
3. **Verify Staging**: Check the staging site for any issues.
4. Select **Action 3 (PRODUCTION)**: Deploy the verified image to `lasertools.org`.

## 4. Monitoring & Debugging

- **Logs**: Use **Action 4** (Prod) or **Action 5** (Staging) in the interactive controller to stream live logs from the remote server.
- **Health**: Check `http://lasertools.org/health` or `http://test.lasertools.org/health` for uptime and status.

---
**Agent Note**: Do NOT attempt to build Docker images locally or use `docker-compose` for development unless explicitly requested. Always prioritize the `DEPLOY.bat` workflow for remote operations.
