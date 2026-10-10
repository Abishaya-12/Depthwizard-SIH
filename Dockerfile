# ---------- Stage 1: build the React frontend ----------
# The frontend imports Logo.jpeg and src/script.js from the repo root,
# so this stage needs the whole repo, not just frontend/.
FROM node:20-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
RUN npm ci
COPY . .
RUN npm run build

# ---------- Stage 2: Python backend that also serves the built frontend ----------
FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/.hf_cache
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# CPU-only torch first (the default PyPI build pulls in multi-GB CUDA libraries).
RUN pip install torch --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install -r requirements.txt gunicorn

# Download the depth model at build time so cold starts don't re-download it.
# Keep this model name identical to DEPTH_MODEL in backend.py.
RUN python -c "from transformers import pipeline; pipeline('depth-estimation', model='depth-anything/Depth-Anything-V2-Small-hf')"

COPY backend.py .
COPY static ./static
COPY --from=frontend /app/frontend/dist ./frontend/dist
RUN mkdir -p uploads static/generated-depth static/calibrated-dem

EXPOSE 10000
# One worker: the model is loaded at import time, so more workers = more RAM.
CMD gunicorn backend:app --workers 1 --threads 4 --timeout 300 --bind 0.0.0.0:${PORT:-10000}
