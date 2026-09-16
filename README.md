<div align="center">
<img width="1200" height="475" alt="DepthWizard logo" src="../Logo.jpeg" />
</div>

# DepthWizard

DepthWizard is an interactive ISRO-inspired digital elevation model (DEM) workspace. It combines a React operations interface, a Flask upload API, and a shared Three.js terrain engine for inspecting generated terrain and flying through the same terrain path.

## What It Can Do

- Guide an operator through a five-stage DEM workflow:
   1. Welcome portal
   2. DEM ingestion and configuration
   3. Mesh processing telemetry
   4. Interactive 3D DEM viewport
   5. 3D terrain flythrough
- Upload a relative DEM and an absolute/georeferenced DEM from the browser.
- Validate supported file extensions and enforce the 1 GB combined upload limit.
- Calculate SHA-256 hashes and file sizes on the backend.
- Inspect raster dimensions and band counts when Rasterio can decode the uploaded format.
- Return processing metadata to the frontend through a Flask JSON API.
- Display backend-derived mesh triangles, survey area, relief range, interpolation method, and resolution in the mesh screen.
- Generate a procedural 3D terrain surface with crater, ridge, and fine relief features.
- Render the terrain with Three.js lighting, shading, grid references, wireframe mode, and elevation exaggeration.
- Reuse the same terrain engine and generated Catmull-Rom path in the DEM viewer and flythrough screens.
- Animate a flythrough camera along the shared path with autopilot and speed controls.
- Provide viewer controls for camera presets, orbit rotation, render modes, solar settings, and terrain exaggeration.
- Provide flythrough controls for chase, cockpit, orbit, and top-down modes, keyboard steering, autopilot, speed multipliers, and waypoint pinning.
- Adapt the interface to desktop and mobile layouts.

## Architecture

```text
Browser
   React/Vite frontend :3000
          |
          | /api proxy during development
          v
   Flask backend :5000
          |
          +-- validates and hashes uploads
          +-- reads raster metadata with Rasterio when available

src/script.js
   Shared Three.js terrain engine
          +-- generated terrain mesh
          +-- lighting and grid
          +-- shared flythrough path
          +-- viewer and flythrough animation lifecycle
```

The authoritative 3D terrain and flythrough logic lives in [`src/script.js`](../src/script.js). The React screens import `createTerrainEngine` rather than maintaining separate terrain renderers. The React HUD and workflow state remain in `frontend/src`.

## Requirements

- Node.js 18 or newer
- Python 3.10 or newer
- A browser with WebGL support

Python dependencies are listed in [`requirements.txt`](../requirements.txt). Frontend dependencies are listed in [`package.json`](./package.json).

## Setup

From the repository root:

```powershell
python -m pip install -r requirements.txt
npm install
Copy-Item .env.example .env
```

`npm install` is run from the repository root. The root npm workspace installs the
frontend dependencies from `frontend/package.json`, including Vite, in one step.
The copied `.env` file is local-only and is ignored by Git. Add an
`OPENTOPOGRAPHY_API_KEY` there only if you use the bounding-box DEM download.
For another computer, copy the `.env` file securely or create it again from
`.env.example`; never commit it.

## Run Locally

```powershell
npm start
```

The production frontend is built automatically and Flask serves the complete app at
`http://127.0.0.1:5000`.

The normal runtime does not require Vite to be running. Vite is used only during
the build, so deployment needs `npm install`, `npm run build`, and the Python
dependencies; Flask then serves `frontend/dist`.

For a deployment environment, configure `OPENTOPOGRAPHY_API_KEY`, `HOST`, and
`PORT` as platform environment variables instead of committing a `.env` file.
Start the server with:

```powershell
python backend.py
```

## Frontend Commands

Run these from the repository root:

```powershell
npm run lint                         # Run the TypeScript check
npm run build                        # Create a production build
npm run --workspace frontend dev     # Start Vite with API proxy for development
npm run --workspace frontend preview # Preview the production build
```

## API

### Health check

```http
GET /api/health
```

Example response:

```json
{
   "status": "ok",
   "service": "depthwizard-dem-api"
}
```

### Process DEM files

```http
POST /api/process-dem
Content-Type: multipart/form-data
```

Required form fields:

- `relative_dem`: `.tif`, `.tiff`, `.img`, `.hdf5`, `.h5`, or `.dem`
- `absolute_dem`: `.dem`, `.tif`, `.tiff`, `.las`, or `.laz`

The response includes a generated job ID, validation status, metadata for both files, and the processing result used by the mesh telemetry screen. Files are written to temporary storage only while they are inspected and are removed after the request finishes.

## Project Layout

```text
backend.py                 Flask upload and metadata API
requirements.txt           Python dependencies
src/script.js              Shared Three.js terrain and flythrough engine
src/index.html             Standalone legacy Three.js page
src/style.css              Standalone renderer styles
frontend/src/App.tsx       React workflow shell
frontend/src/api.ts        Frontend API client
frontend/src/components/   Workflow, viewer, and flythrough screens
frontend/src/types.ts      Shared frontend response types
frontend/vite.config.ts    Vite configuration and API proxy
static/                    Runtime-generated DEM and calibrated raster files
```

## Current Scope

The Flask endpoint currently validates, hashes, and inspects uploads, then returns the processing metadata contract used by the UI. The Three.js engine currently generates a procedural terrain surface and shared flythrough path. A production raster-to-mesh pipeline can replace the backend result generation while preserving the existing frontend API contract and engine mount points.
