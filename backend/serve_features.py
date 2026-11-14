#!/usr/bin/env python3
"""
serve_features.py — OPTIONAL. A tiny read-only API over the files in public/.

You do NOT need this for the web jukebox: shipping public/ as static files
(GitHub Pages / Netlify) is simpler and has nothing to crash during judging.
It exists only if the team wants to showcase the "backend API endpoint" deliverable
form the challenge lists, or serve features to a desktop/native client.

    pip install fastapi uvicorn
    python serve_features.py            # http://127.0.0.1:8000
Endpoints:
    GET /api/visualizations             -> the manifest
    GET /api/features/{id}              -> that visualization's features.json
    GET /frames/{id}/{file}             -> a frame image
CORS is open so a separately-hosted frontend can call it.
"""
from __future__ import annotations

import json
import os

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import FileResponse
except ImportError:
    raise SystemExit("Install the API extras first:  pip install fastapi uvicorn")

PUBLIC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")
app = FastAPI(title="Earth Information Jukebox API", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])


@app.get("/api/visualizations")
def visualizations():
    path = os.path.join(PUBLIC, "manifest.json")
    if not os.path.exists(path):
        raise HTTPException(404, "manifest.json not built yet — run make_manifest.py")
    with open(path) as f:
        return json.load(f)


@app.get("/api/features/{viz_id}")
def features(viz_id: str):
    safe = os.path.basename(viz_id)
    path = os.path.join(PUBLIC, "features", f"{safe}.json")
    if not os.path.exists(path):
        raise HTTPException(404, f"no features for '{safe}'")
    with open(path) as f:
        return json.load(f)


@app.get("/frames/{viz_id}/{filename}")
def frame(viz_id: str, filename: str):
    path = os.path.join(PUBLIC, "frames", os.path.basename(viz_id), os.path.basename(filename))
    if not os.path.exists(path):
        raise HTTPException(404, "frame not found")
    return FileResponse(path)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
