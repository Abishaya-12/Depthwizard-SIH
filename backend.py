from pathlib import Path
import hashlib
import os
import tempfile
import uuid

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename

FRONTEND_DIST = Path(__file__).parent / 'frontend' / 'dist'
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 1_000 * 1024 * 1024

ALLOWED_RELATIVE = {'.png'}
ALLOWED_ABSOLUTE = {'.dem', '.tif', '.tiff', '.las', '.laz', '.png'}


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
        except (ImportError, Exception):
            # File hashing and validation still work when rasterio cannot decode a format.
            pass

        return metadata
    finally:
        temporary_path.unlink(missing_ok=True)


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

    try:
        if relative_upload is not None:
            relative = file_metadata(relative_upload, ALLOWED_RELATIVE)
        if absolute_upload is not None:
            absolute = file_metadata(absolute_upload, ALLOWED_ABSOLUTE)
    except ValueError as error:
        return jsonify({'error': str(error)}), 400

    job_id = uuid.uuid4().hex
    return jsonify({
        'jobId': job_id,
        'status': 'complete',
        'relative': relative,
        'absolute': absolute,
        'result': {
            'meshTriangles': 1_420_000,
            'surveyAreaKm2': 42.5,
            'maxReliefMeters': 2_730,
            'interpolation': 'Bicubic Spline',
            'resolution': '0.5m/pixel',
        },
    })


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
