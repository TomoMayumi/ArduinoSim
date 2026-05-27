# Azure Deployment Plan — ArduinoSim

**Status:** Draft

## Overview

- **App**: ArduinoSim (React + Vite static SPA)
- **Target**: Azure Static Web Apps
- **Mode**: NEW deployment
- **IaC**: Azure CLI (az staticwebapp create)

## Architecture

```
GitHub Repo (TomoMayumi/ArduinoSim)
    └── GitHub Actions CI/CD
            └── Azure Static Web Apps
                    └── dist/ (npm run build output)
```

## Steps

- [ ] 1. Confirm Azure subscription and region
- [ ] 2. Create Azure Static Web App resource (az cli)
- [ ] 3. Set up GitHub Actions workflow for build & deploy
- [ ] 4. Configure vite.config.ts base path if needed
- [ ] 5. Push changes to trigger deployment
- [ ] 6. Verify live URL

## Decisions

| Item | Value |
|------|-------|
| App location | `/` |
| Build command | `npm run build` |
| Output location | `dist` |
| SKU | Free |
| Region | japaneast |
