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
from flask import Flask, render_template, request, redirect, url_for

app = Flask(__name__)

# Folders where uploaded photos and generated results get saved.
UPLOAD_FOLDER = "uploads"
OUTPUT_FOLDER = "outputs"
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# ---------------------------------------------------------------------------
# TODO (Gyani): Which file types should we actually accept?
# The problem statement says: PNG, JPG, or TIFF.
# Fill in this set with the correct lowercase extensions (no dots), e.g. "png".
# ---------------------------------------------------------------------------
ALLOWED_EXTENSIONS = {}  # <-- TODO: e.g. {"png", "jpg", "jpeg", "tif", "tiff"}


def allowed_file(filename):
    """
    Returns True if `filename` ends with one of the extensions in
    ALLOWED_EXTENSIONS, False otherwise.

    Hint: filenames look like "photo.png". You need the part after the
    last dot, lowercased, and you need to check it's in ALLOWED_EXTENSIONS.
    "." in filename tells you there IS an extension at all.
    """
    # ---------------------------------------------------------------------
    # TODO (Gyani): implement this check.
    # Example approach:
    #   return "." in filename and \
    #       filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS
    # ---------------------------------------------------------------------
    return False  # <-- replace this line


def process_depth(image_path):
    """
    THIS is where the actual DepthWizard pipeline runs.

    Input:  path to the uploaded photo, e.g. "uploads/abc123.png"
    Output: path to a generated result image (e.g. a screenshot of the
            3D terrain, or the depth map) that we can show the user.

    You + Dalston: replace this stub with your real code:
      1. Load the image
      2. Run Depth Anything V2 to get a depth map
      3. Feed the depth map into PyVista to build the 3D surface
      4. Save a screenshot/render of that surface to OUTPUT_FOLDER
      5. Return the path to that saved file
    """
    # --- STUB: currently just copies the input image as a placeholder ---
    import shutil
    output_name = f"result_{os.path.basename(image_path)}"
    output_path = os.path.join(OUTPUT_FOLDER, output_name)
    shutil.copy(image_path, output_path)
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
    unique_name = file.filename  # <-- TODO: replace with a unique name

    save_path = os.path.join(app.config["UPLOAD_FOLDER"], unique_name)
    file.save(save_path)

    result_path = process_depth(save_path)

    return render_template("result.html", result_image=result_path)


if __name__ == "__main__":
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(OUTPUT_FOLDER, exist_ok=True)
    app.run(debug=True)
