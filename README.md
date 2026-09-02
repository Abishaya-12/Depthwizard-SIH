# DepthWizard-SIH

Single-view remote-sensing imagery to elevation products and interactive 3D terrain.

## Project Brief

DepthWizard is designed to transform one optical RGB aerial or satellite image into a terrain representation. It targets two input paths:

- **Non-georeferenced imagery** (`PNG`, `JPG`, or `TIFF`) produces a relative Digital Surface Model (rDSM). Heights are scale-agnostic and are useful for shape, slope, and visual analysis.
- **Georeferenced imagery** (GeoTIFF with coordinate-system metadata) produces an absolute Digital Surface Model (DSM). Relative depth is calibrated to metric elevation using a lower-resolution DEM such as SRTM or a small set of Ground Control Points.

The planned pipeline is:

1. Validate and ingest the optical image.
2. Run a pre-trained monocular depth backbone, such as Depth Anything V2, to estimate relative depth.
3. Calibrate the relative output to metric heights when georeferencing or reference elevation data is available.
4. Build a terrain mesh and project the original optical image onto it.
5. Render the result as a navigable 3D scene for first-person inspection of heights and slopes.

## Current Prototype

The Flask prototype currently provides the application shell:

- Uploads `PNG`, `JPG`, `JPEG`, `TIF`, and `TIFF` files.
- Offers Relative rDSM and Absolute DSM output modes.
- Stores uploads with unique names and displays a processed preview.
- Serves the generated preview through a result page.

`process_depth()` now runs the pretrained Depth Anything V2 Small model, normalizes non-georeferenced depth to relative height, calibrates georeferenced depth against a local SRTM GeoTIFF using linear regression, and writes a texture-colored Matplotlib 3D surface render. Model weights are downloaded by Transformers on first inference; no training or fine-tuning is performed.

For absolute DSM processing, provide a valid local SRTM GeoTIFF with CRS metadata. The default location is `srtm.tif` in the project directory, or set `SRTM_PATH` to another local file. The app does not download elevation data.

## Run Locally

```bash
python -m pip install -r requirements.txt
python App.py
```

Open <http://127.0.0.1:5000> in a browser.

## Planned Evaluation

DSM quality should be evaluated against LiDAR or reference elevation data using RMSE, MAE, and correlation across urban, sparse, hilly, and forested scenes. The visualization should be assessed for texture projection, visual fidelity, interactive navigation, height/slope inspection, stability, and standalone deployment.

## Repository Files

- `App.py`: Flask routes, upload validation, and the processing hook.
- `index.html`: image upload and output-mode selection.
- `Result.html`: generated preview and processing status.
- `requirements.txt`: Python dependencies.