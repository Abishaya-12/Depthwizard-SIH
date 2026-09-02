"""
DepthWizard prototype web app.

This is the glue between:
  1. A user uploading a photo (this file handles that)
  2. The depth model + 3D conversion (you/Dalston write process_depth() below)
  3. Showing the result back to the user (this file handles that too)

WHO DOES WHAT:
- Gyani + Charis: fill in the TODOs marked below. Everything else already works.
- You + Dalston: fill in process_depth() with the real Depth Anything V2 + PyVista code.

HOW TO RUN THIS:
  1. pip install flask
  2. python app.py
  3. Open http://127.0.0.1:5000 in your browser
"""

import os
import uuid
from functools import lru_cache
from pathlib import Path

import numpy as np
from flask import Flask, render_template, request, send_from_directory

app = Flask(__name__, template_folder=".")
BASE_DIR = Path(__file__).resolve().parent

# Folders where uploaded photos and generated results get saved.
UPLOAD_FOLDER = "uploads"
OUTPUT_FOLDER = "outputs"
SRTM_PATH = os.environ.get("SRTM_PATH", str(BASE_DIR / "srtm.tif"))
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# ---------------------------------------------------------------------------
# TODO (Gyani): Which file types should we actually accept?
# The problem statement says: PNG, JPG, or TIFF.
# Fill in this set with the correct lowercase extensions (no dots), e.g. "png".
# ---------------------------------------------------------------------------
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "tif", "tiff"}


def allowed_file(filename):
    """
    Returns True if `filename` ends with one of the extensions in
    ALLOWED_EXTENSIONS, False otherwise.

    Hint: filenames look like "photo.png". You need the part after the
    last dot, lowercased, and you need to check it's in ALLOWED_EXTENSIONS.
    "." in filename tells you there IS an extension at all.
    """
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def is_georeferenced(image_path):
    """Return whether rasterio can read a CRS from the uploaded raster."""
    import rasterio

    try:
        with rasterio.open(image_path) as dataset:
            return dataset.crs is not None
    except (rasterio.errors.RasterioIOError, ValueError):
        return False


@lru_cache(maxsize=1)
def _load_depth_model():
    """Load the pretrained Depth Anything V2 model once per process."""
    from transformers import AutoImageProcessor, AutoModelForDepthEstimation

    model_name = "depth-anything/Depth-Anything-V2-Small-hf"
    processor = AutoImageProcessor.from_pretrained(model_name)
    model = AutoModelForDepthEstimation.from_pretrained(model_name)
    model.eval()
    return processor, model


def _predict_depth(image):
    """Run pretrained monocular depth inference and return a 2D float array."""
    import torch
    from PIL import Image
    from torch.nn.functional import interpolate

    processor, model = _load_depth_model()
    inputs = processor(images=image, return_tensors="pt")
    with torch.no_grad():
        predicted_depth = model(**inputs).predicted_depth
        depth = interpolate(
            predicted_depth.unsqueeze(1),
            size=(image.height, image.width),
            mode="bicubic",
            align_corners=False,
        ).squeeze()
    return depth.cpu().numpy().astype(np.float32)


def _read_srtm_on_image_grid(srtm_path, image_dataset, shape):
    """Resample a local SRTM tile onto the uploaded image's pixel grid."""
    import rasterio
    from rasterio.warp import Resampling, reproject

    if not Path(srtm_path).is_file():
        raise FileNotFoundError(
            f"Georeferenced input requires a local SRTM GeoTIFF at {srtm_path!r}. "
            "Set SRTM_PATH to the supplied tile."
        )

    with rasterio.open(srtm_path) as srtm:
        if srtm.crs is None:
            raise ValueError("The local SRTM tile must contain a coordinate reference system.")
        elevation = np.full(shape, np.nan, dtype=np.float32)
        reproject(
            source=rasterio.band(srtm, 1),
            destination=elevation,
            src_transform=srtm.transform,
            src_crs=srtm.crs,
            src_nodata=srtm.nodata,
            dst_transform=image_dataset.transform,
            dst_crs=image_dataset.crs,
            dst_nodata=np.nan,
            resampling=Resampling.bilinear,
        )
    return elevation


def _render_surface(image, height_map, output_path):
    """Render the height grid with the source image as its surface texture."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d import Axes3D  # noqa: F401

    texture = np.asarray(image.convert("RGB"), dtype=np.float32) / 255.0
    rows, columns = height_map.shape
    y_grid, x_grid = np.mgrid[0:rows, 0:columns]
    figure = plt.figure(figsize=(11, 8), dpi=120)
    axes = figure.add_subplot(111, projection="3d")
    axes.plot_surface(
        x_grid,
        y_grid,
        height_map,
        facecolors=texture,
        rcount=min(rows, 180),
        ccount=min(columns, 180),
        linewidth=0,
        antialiased=True,
        shade=False,
    )
    axes.set_xlabel("Image X")
    axes.set_ylabel("Image Y")
    axes.set_zlabel("Elevation / relative height")
    axes.view_init(elev=35, azim=-125)
    figure.tight_layout()
    figure.savefig(output_path, bbox_inches="tight")
    plt.close(figure)


def process_depth(image_path):
    """
    Run pretrained depth inference, calibrate georeferenced inputs, and render.
    """
    import rasterio
    from PIL import Image
    from sklearn.linear_model import LinearRegression

    os.makedirs(OUTPUT_FOLDER, exist_ok=True)
    image = Image.open(image_path).convert("RGB")
    georeferenced = is_georeferenced(image_path)
    depth_map = _predict_depth(image)

    if georeferenced:
        with rasterio.open(image_path) as image_dataset:
            srtm_map = _read_srtm_on_image_grid(SRTM_PATH, image_dataset, depth_map.shape)
        valid = np.isfinite(depth_map) & np.isfinite(srtm_map)
        if valid.sum() < 2:
            raise ValueError("The SRTM tile has fewer than two valid pixels overlapping the image.")
        calibration = LinearRegression().fit(depth_map[valid].reshape(-1, 1), srtm_map[valid])
        height_map = calibration.predict(depth_map.reshape(-1, 1)).reshape(depth_map.shape)
    else:
        minimum = float(np.nanmin(depth_map))
        spread = float(np.nanmax(depth_map) - minimum)
        height_map = (depth_map - minimum) / spread if spread else np.zeros_like(depth_map)

    output_name = f"result_{uuid.uuid4().hex}.png"
    output_path = os.path.join(OUTPUT_FOLDER, output_name)
    _render_surface(image, height_map, output_path)
    return output_path


@app.route("/")
def index():
    """Shows the upload form."""
    return render_template("index.html")


@app.route("/upload", methods=["POST"])
def upload():
    """Handles the uploaded file, runs the pipeline, shows the result."""
    if "photo" not in request.files:
        return "No file part in the request", 400

    file = request.files["photo"]

    if file.filename == "":
        return "No file selected", 400

    if not allowed_file(file.filename):
        return "File type not allowed. Please upload PNG, JPG, or TIFF.", 400

    # -----------------------------------------------------------------
    # TODO (Charis): generate a unique filename so two people uploading
    # "photo.png" at the same time don't overwrite each other.
    #
    # Hint: uuid.uuid4() generates a random unique ID. Something like:
    #   extension = file.filename.rsplit(".", 1)[1]
    #   unique_name = f"{uuid.uuid4().hex}.{extension}"
    # -----------------------------------------------------------------
    extension = file.filename.rsplit(".", 1)[1].lower()
    unique_name = f"{uuid.uuid4().hex}.{extension}"

    save_path = os.path.join(app.config["UPLOAD_FOLDER"], unique_name)
    file.save(save_path)

    try:
        result_path = process_depth(save_path)
    except (FileNotFoundError, ValueError, RuntimeError) as error:
        return f"Processing could not complete: {error}", 422
    result_type = "Absolute DSM" if is_georeferenced(save_path) else "Relative DSM"

    return render_template(
        "Result.html",
        result_image=os.path.basename(result_path),
        result_type=result_type,
        source_name=file.filename,
    )


@app.route("/outputs/<path:filename>")
def output_file(filename):
    """Serves generated preview images to the result page."""
    return send_from_directory(OUTPUT_FOLDER, filename)


if __name__ == "__main__":
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)
    app.run(debug=True)
