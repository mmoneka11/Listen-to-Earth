# Listen to Earth — backend image (data pipeline + API)
FROM python:3.12-slim

# ffmpeg is needed by extract_frames.py
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
# install core + API + config + optional netCDF deps
RUN pip install --no-cache-dir Pillow numpy pyyaml fastapi uvicorn xarray netCDF4

COPY . .
EXPOSE 8000
ENV HOST=0.0.0.0 PORT=8000

# default: serve the API. To build data instead:
#   docker run --rm -v "$PWD/public:/app/public" -v "$PWD/data:/app/data" listen-to-earth python build_all.py
CMD ["python", "serve_features.py"]
