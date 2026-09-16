from pathlib import Path
import base64
import hashlib
import io
import logging
import os
import math
import tempfile
import uuid

import cv2
import numpy as np
import requests
from sklearn.linear_model import HuberRegressor
from sklearn.model_selection import train_test_split
from scipy.ndimage import zoom

from flask import Flask, jsonify, request, send_from_directory
from dotenv import load_dotenv
from werkzeug.utils import secure_filename

load_dotenv(Path(__file__).parent / '.env')

FRONTEND_DIST = Path(__file__).parent / 'frontend' / 'dist'
DEPTH_OUTPUT_DIR = Path(__file__).parent / 'static' / 'generated-depth'
DEPTH_MODEL = 'depth-anything/Depth-Anything-V2-Small-hf'
depth_estimator = None
logging.basicConfig(level=logging.INFO)

try:
    from transformers import pipeline
    depth_estimator = pipeline('depth-estimation', model=DEPTH_MODEL)
    logging.getLogger(__name__).info('Depth estimation model loaded successfully: %s', DEPTH_MODEL)
except Exception as error:
    logging.getLogger(__name__).warning('Depth estimation model unavailable: %s', error)

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 1_000 * 1024 * 1024

ALLOWED_RELATIVE = {'.png'}
ALLOWED_ABSOLUTE = {'.dem', '.tif', '.tiff', '.las', '.laz', '.png'}
ALLOWED_RGB = {'.jpg', '.jpeg', '.png'}


def file_metadata(upload, allowed_extensions):
    filename = secure_filename(upload.filename or '')
    extension = Path(filename).suffix.lower()
    if not filename or extension not in allowed_extensions:
        raise ValueError(f'Unsupported file type: {extension or "missing extension"}')

    with tempfile.NamedTemporaryFile(delete=False, suffix=extension) as temporary_file:
        upload.save(temporary_file)
        temporary_path = Path(temporary_file.name)

    try:
        digest = hashlib.sha256()
        size = 0
        with temporary_path.open('rb') as source:
            for chunk in iter(lambda: source.read(1024 * 1024), b''):
                digest.update(chunk)
                size += len(chunk)

        metadata = {
            'name': filename,
            'bytes': size,
            'sha256': digest.hexdigest(),
            'format': extension.lstrip('.').upper(),
            'width': None,
            'height': None,
            'bands': None,
        }

        try:
            import rasterio
            with rasterio.open(temporary_path) as dataset:
                metadata.update({
                    'width': dataset.width,
                    'height': dataset.height,
                    'bands': dataset.count,
                })
        except Exception:
            # File hashing and validation still work when rasterio cannot decode a format.
            pass

        return metadata
    finally:
        temporary_path.unlink(missing_ok=True)


def save_upload_for_inference(upload):
    filename = secure_filename(upload.filename or '')
    extension = Path(filename).suffix.lower()
    if not filename or extension not in ALLOWED_RGB:
        raise ValueError(f'Unsupported RGB image type: {extension or "missing extension"}')

    with tempfile.NamedTemporaryFile(delete=False, suffix=extension) as temporary_file:
        upload.save(temporary_file)
        return Path(temporary_file.name)


def save_upload_for_processing(upload, allowed_extensions):
    filename = secure_filename(upload.filename or '')
    extension = Path(filename).suffix.lower()
    if not filename or extension not in allowed_extensions:
        raise ValueError(f'Unsupported file type: {extension or "missing extension"}')

    with tempfile.NamedTemporaryFile(delete=False, suffix=extension) as temporary_file:
        upload.save(temporary_file)
        return Path(temporary_file.name)


def load_relative_dem(path):
    from PIL import Image

    with Image.open(path) as image:
        image = image.convert('L')
        values = np.asarray(image, dtype=np.float32) / 255.0
    if values.ndim != 2 or values.size == 0:
        raise ValueError('Relative DEM must contain a readable 2D grayscale image.')
    return values


def load_absolute_dem(path):
    import rasterio

    with rasterio.open(path) as dataset:
        if dataset.count < 1:
            raise ValueError('Absolute DEM has no readable elevation band.')
        values = dataset.read(1).astype(np.float32)
        valid = np.isfinite(values)
        if dataset.nodata is not None:
            valid &= ~np.isclose(values, dataset.nodata)
        if not np.any(valid):
            raise ValueError('Absolute DEM contains no valid elevation values.')
        profile = dataset.profile.copy()
        crs = dataset.crs
        transform = dataset.transform
        width = dataset.width
        height = dataset.height
        pixel_width = abs(transform.a)
        pixel_height = abs(transform.e)

    return values, valid, profile, crs, transform, width, height, pixel_width, pixel_height


def resize_array(values, shape, order):
    factors = (shape[0] / values.shape[0], shape[1] / values.shape[1])
    resized = zoom(values, factors, order=order)
    if resized.shape != shape:
        resized = resized[:shape[0], :shape[1]]
        padding = ((0, shape[0] - resized.shape[0]), (0, shape[1] - resized.shape[1]))
        resized = np.pad(resized, padding, mode='edge')
    return resized


def elevation_summary(values):
    minimum = float(np.min(values))
    maximum = float(np.max(values))
    return {
        'minElevationMeters': minimum,
        'maxElevationMeters': maximum,
        'meanElevationMeters': float(np.mean(values)),
        'maxReliefMeters': maximum - minimum,
    }


@app.post('/api/estimate-depth')
def estimate_depth():
    rgb_upload = request.files.get('rgb_image')
    if rgb_upload is None:
        return jsonify({'error': 'Provide an RGB image in the rgb_image field.'}), 400
    if depth_estimator is None:
        return jsonify({'error': 'Depth estimation model is unavailable on the server.'}), 500

    temporary_path = None
    try:
        temporary_path = save_upload_for_inference(rgb_upload)
        from PIL import Image

        with Image.open(temporary_path) as image:
            depth_result = depth_estimator(image.convert('RGB'))

        depth_image = depth_result.get('depth') if isinstance(depth_result, dict) else depth_result
        if depth_image is None:
            raise RuntimeError('The depth model returned no depth map.')

        depth_values = np.asarray(depth_image, dtype=np.float32)
        sigma = max(image.width, image.height) / 150
        depth_values = cv2.bilateralFilter(depth_values, d=9, sigmaColor=30, sigmaSpace=sigma)
        minimum, maximum = np.percentile(depth_values, [2, 98])
        if maximum > minimum:
            depth_values = np.clip(depth_values, minimum, maximum)
            depth_values = (depth_values - minimum) / (maximum - minimum)
        else:
            depth_values.fill(0)
        depth_image = Image.fromarray(np.round(depth_values * 255).astype(np.uint8), mode='L')
        depth_output = DEPTH_OUTPUT_DIR / f'{uuid.uuid4().hex}.png'
        DEPTH_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        depth_image.save(depth_output, format='PNG')

        buffer = io.BytesIO()
        depth_image.save(buffer, format='PNG')
        data_url = 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode('ascii')
        return jsonify({'relativeDemUrl': data_url, 'jobId': uuid.uuid4().hex})
    except ValueError as error:
        return jsonify({'error': str(error)}), 400
    except Exception as error:
        logging.getLogger(__name__).exception('Depth estimation failed: %s', error)
        return jsonify({'error': 'Depth estimation failed. Check the image and server model logs.'}), 500
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


@app.post('/api/fetch-dem-by-bbox')
def fetch_dem_by_bbox():
    payload = request.get_json(silent=True) or {}
    try:
        south = float(payload['south'])
        north = float(payload['north'])
        west = float(payload['west'])
        east = float(payload['east'])
    except (KeyError, TypeError, ValueError):
        return jsonify({'error': 'Provide south, north, west, and east as decimal numbers.'}), 400

    if not all(math.isfinite(value) for value in (south, north, west, east)):
        return jsonify({'error': 'Bounding box coordinates must be finite numbers.'}), 400
    if not (-90 <= south < north <= 90 and -180 <= west < east <= 180):
        return jsonify({'error': 'Bounding box coordinates are invalid or out of range.'}), 400
    if north - south > 2 or east - west > 2:
        return jsonify({'error': 'Bounding box must be no larger than 2 degrees in either dimension.'}), 400

    api_key = os.getenv('OPENTOPOGRAPHY_API_KEY')
    if not api_key:
        return jsonify({'error': 'Set OPENTOPOGRAPHY_API_KEY on the server before fetching DEM data.'}), 400

    try:
        response = requests.get(
            'https://portal.opentopography.org/API/globaldem',
            params={
                'demtype': 'SRTMGL1',
                'south': south,
                'north': north,
                'west': west,
                'east': east,
                'outputFormat': 'GTiff',
                'API_Key': api_key,
            },
            timeout=60,
        )
        response.raise_for_status()
    except requests.RequestException as error:
        logging.getLogger(__name__).exception('OpenTopography DEM request failed: %s', error)
        return jsonify({'error': 'OpenTopography could not provide DEM data for that area.'}), 502

    output_name = f'{uuid.uuid4().hex}.tif'
    output_path = DEPTH_OUTPUT_DIR / output_name
    DEPTH_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(response.content)

    preview_image = None
    try:
        import rasterio
        from PIL import Image

        with rasterio.open(output_path) as dataset:
            dem_values = dataset.read(1, out_shape=(min(dataset.height, 512), min(dataset.width, 512)))
        dem_values = np.asarray(dem_values, dtype=np.float32)
        preview_min, preview_max = np.percentile(dem_values, [2, 98])
        if preview_max > preview_min:
            preview_values = np.clip(dem_values, preview_min, preview_max)
            preview_values = (preview_values - preview_min) / (preview_max - preview_min)
        else:
            preview_values = np.zeros_like(dem_values)
        preview = Image.fromarray(np.round(preview_values * 255).astype(np.uint8), mode='L')
        preview_buffer = io.BytesIO()
        preview.save(preview_buffer, format='PNG')
        preview_image = 'data:image/png;base64,' + base64.b64encode(preview_buffer.getvalue()).decode('ascii')
    except (ImportError, ValueError, OSError):
        logging.getLogger(__name__).warning('DEM preview could not be generated for %s', output_path)

    return jsonify({
        'demUrl': f'/static/generated-depth/{output_name}',
        'jobId': uuid.uuid4().hex,
        'previewImage': preview_image,
    })


@app.get('/api/health')
def health():
    return jsonify({'status': 'ok', 'service': 'depthwizard-dem-api'})


@app.post('/api/process-dem')
def process_dem():
    relative_upload = request.files.get('relative_dem')
    absolute_upload = request.files.get('absolute_dem')
    if relative_upload is None and absolute_upload is None:
        return jsonify({'error': 'Provide at least one DEM file: relative_dem (PNG) or absolute_dem.'}), 400

    relative = None
    absolute = None
    relative_path = None
    absolute_path = None

    try:
        if relative_upload is not None:
            relative = file_metadata(relative_upload, ALLOWED_RELATIVE)
            relative_upload.stream.seek(0)
            relative_path = save_upload_for_processing(relative_upload, ALLOWED_RELATIVE)
        if absolute_upload is not None:
            absolute = file_metadata(absolute_upload, ALLOWED_ABSOLUTE)
            absolute_upload.stream.seek(0)
            absolute_path = save_upload_for_processing(absolute_upload, ALLOWED_ABSOLUTE)
    except ValueError as error:
        return jsonify({'error': str(error)}), 400

    calibrated_output = None
    try:
        relative_values = load_relative_dem(relative_path) if relative_path else None
        absolute_data = load_absolute_dem(absolute_path) if absolute_path else None
        result = {'calibrated': False}

        if relative_values is not None and absolute_data is not None:
            absolute_values, absolute_valid, profile, crs, transform, absolute_width, absolute_height, pixel_width, pixel_height = absolute_data
            absolute_resized = resize_array(absolute_values, relative_values.shape, order=1)
            valid_resized = resize_array(absolute_valid.astype(np.float32), relative_values.shape, order=1) > 0.5
            valid_overlap = valid_resized & np.isfinite(absolute_resized) & np.isfinite(relative_values)
            if np.count_nonzero(valid_overlap) < 2:
                raise ValueError('Insufficient valid overlapping data for relative-to-absolute calibration.')

            relative_samples = relative_values[valid_overlap]
            absolute_samples = absolute_resized[valid_overlap]
            if np.unique(relative_samples).size < 2:
                raise ValueError('Relative DEM does not contain enough variation for calibration.')
            validation_metrics = {}
            if relative_samples.size >= 50:
                relative_train, relative_test, absolute_train, absolute_test = train_test_split(
                    relative_samples,
                    absolute_samples,
                    test_size=0.2,
                    random_state=42,
                )
            else:
                relative_train = relative_samples
                absolute_train = absolute_samples
                relative_test = None
                absolute_test = None

            huber = HuberRegressor()
            huber.fit(relative_train.reshape(-1, 1), absolute_train)
            calibrated_values = (huber.coef_[0] * relative_values + huber.intercept_).astype(np.float32)
            if relative_test is not None and absolute_test is not None:
                test_predictions = huber.predict(relative_test.reshape(-1, 1))
                residuals = test_predictions - absolute_test
                if np.std(test_predictions) > 0 and np.std(absolute_test) > 0:
                    correlation = float(np.corrcoef(test_predictions, absolute_test)[0, 1])
                else:
                    correlation = None
                validation_metrics = {
                    'rmseMeters': float(np.sqrt(np.mean(residuals ** 2))),
                    'maeMeters': float(np.mean(np.abs(residuals))),
                    'correlationCoefficient': correlation,
                }
            if not np.all(np.isfinite(calibrated_values)):
                raise ValueError('Robust calibration produced invalid elevation values.')

            output_name = f'{uuid.uuid4().hex}.tif'
            calibrated_output = Path(__file__).parent / 'static' / 'calibrated-dem' / output_name
            calibrated_output.parent.mkdir(parents=True, exist_ok=True)
            output_profile = profile.copy()
            output_profile.update({
                'driver': 'GTiff',
                'height': calibrated_values.shape[0],
                'width': calibrated_values.shape[1],
                'count': 1,
                'dtype': 'int16',
                'nodata': -32768,
                'compress': 'deflate',
            })
            import rasterio
            with rasterio.open(calibrated_output, 'w', **output_profile) as destination:
                destination.write(np.clip(np.round(calibrated_values), -32767, 32767).astype(np.int16), 1)

            result.update({
                'calibrated': True,
                'meshTriangles': (relative_values.shape[1] - 1) * (relative_values.shape[0] - 1) * 2,
                **elevation_summary(calibrated_values),
                **validation_metrics,
                'interpolation': 'Bilinear reference resampling',
                'resolution': f'{pixel_width:g}m/pixel' if pixel_width else None,
            })
            if crs is not None and pixel_width and pixel_height:
                result['surveyAreaKm2'] = (absolute_width * pixel_width * absolute_height * pixel_height) / 1_000_000
            else:
                result.pop('surveyAreaKm2', None)
        elif relative_values is not None:
            result.update({
                'meshTriangles': max(0, (relative_values.shape[1] - 1) * (relative_values.shape[0] - 1) * 2),
                'resolution': 'relative image pixels',
            })
        else:
            absolute_values, absolute_valid, _profile, crs, _transform, absolute_width, absolute_height, pixel_width, pixel_height = absolute_data
            valid_values = absolute_values[absolute_valid]
            result.update({
                'calibrated': False,
                'meshTriangles': max(0, (absolute_width - 1) * (absolute_height - 1) * 2),
                **elevation_summary(valid_values),
                'interpolation': 'Raw reference DEM',
                'resolution': f'{pixel_width:g}m/pixel' if pixel_width else None,
            })
            if crs is not None and pixel_width and pixel_height:
                result['surveyAreaKm2'] = (absolute_width * pixel_width * absolute_height * pixel_height) / 1_000_000

        response = {
            'jobId': uuid.uuid4().hex,
            'status': 'complete',
            'relative': relative,
            'absolute': absolute,
            'result': result,
        }
        if calibrated_output is not None:
            response['calibratedDemUrl'] = f'/static/calibrated-dem/{calibrated_output.name}'
        return jsonify(response)
    except (ImportError, OSError, ValueError) as error:
        if calibrated_output is not None:
            calibrated_output.unlink(missing_ok=True)
        return jsonify({'error': str(error)}), 400
    except Exception as error:
        if calibrated_output is not None:
            calibrated_output.unlink(missing_ok=True)
        logging.getLogger(__name__).exception('DEM calibration failed: %s', error)
        return jsonify({'error': 'DEM calibration failed. Check the uploaded raster data.'}), 500
    finally:
        if relative_path is not None:
            relative_path.unlink(missing_ok=True)
        if absolute_path is not None:
            absolute_path.unlink(missing_ok=True)


@app.errorhandler(413)
def request_too_large(_error):
    return jsonify({'error': 'Combined upload exceeds the 1 GB limit.'}), 413


@app.route('/', defaults={'frontend_path': ''})
@app.route('/<path:frontend_path>')
def frontend(frontend_path):
    requested_file = FRONTEND_DIST / frontend_path
    if frontend_path and requested_file.is_file():
        return send_from_directory(FRONTEND_DIST, frontend_path)
    return send_from_directory(FRONTEND_DIST, 'index.html')


if __name__ == '__main__':
    app.run(host=os.getenv('HOST', '127.0.0.1'), port=int(os.getenv('PORT', '5000')), debug=True)
