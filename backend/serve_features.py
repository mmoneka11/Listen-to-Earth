#!/usr/bin/env python3
"""
serve_features.py — the Listen to Earth backend app (read-only API + static host).

Run it and open http://127.0.0.1:8000/ for a landing page that lists every built
visualization with links to its features, frames and audio. Everything under
public/ is served, so the frontend (or the demo) can pull frames and WAVs directly.

    pip install fastapi uvicorn
    python serve_features.py                 # http://127.0.0.1:8000
    HOST=0.0.0.0 PORT=8000 python serve_features.py   # for Docker / LAN

Endpoints:
    GET /                        landing page (HTML)
    GET /health                  {"status":"ok", ...}
    GET /manifest.json           the manifest (root alias)
    GET /api/visualizations      the manifest
    GET /api/features/{id}       that visualization's features.json
    GET /public/...              static: frames, features, audio
    GET /frames/...              static frame image alias
    GET /features/...            static features json alias
    GET /audio/...               static audio wav alias
"""
from __future__ import annotations

import json
import os

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import HTMLResponse
    from fastapi.staticfiles import StaticFiles
except ImportError:
    raise SystemExit("Install the API extras first:  pip install fastapi uvicorn")

HERE = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(HERE, "public")

app = FastAPI(title="Listen to Earth — Backend API", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def load_manifest():
    p = os.path.join(PUBLIC, "manifest.json")
    if not os.path.exists(p):
        return None
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/health")
def health():
    m = load_manifest()
    n = len(m["visualizations"]) if m and "visualizations" in m else 0
    return {"status": "ok", "visualizations": n, "data_built": m is not None}


@app.get("/manifest.json")
def manifest_root():
    m = load_manifest()
    if not m:
        raise HTTPException(404, "Manifest not found. Run python build_all.py first.")
    return m


@app.get("/api/visualizations")
def visualizations():
    m = load_manifest()
    if not m:
        raise HTTPException(404, "No data built yet — run build_all.py (or make build).")
    return m


@app.get("/api/features/{viz_id}")
def features(viz_id: str):
    safe = os.path.basename(viz_id)
    p = os.path.join(PUBLIC, "features", f"{safe}.json")
    if not os.path.exists(p):
        raise HTTPException(404, f"no features for '{safe}'")
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/", response_class=HTMLResponse)
def index():
    m = load_manifest()
    rows = ""
    if m and m.get("visualizations"):
        for v in m["visualizations"]:
            vid = v["id"]
            audio = (
                f'<a href="/public/audio/{vid}.wav">audio</a>'
                if os.path.exists(os.path.join(PUBLIC, "audio", f"{vid}.wav"))
                else "<span>—</span>"
            )
            rows += (
                f"<tr><td><strong>{v.get('title', vid)}</strong><br>"
                f"<small>{v.get('description','')}</small></td>"
                f"<td>{v.get('frame_count','?')}</td>"
                f'<td><a href="/api/features/{vid}">features</a></td>'
                f"<td>{audio}</td>"
                f'<td><a href="{v.get("source_url","#")}">NASA source</a></td></tr>'
            )
    else:
        rows = (
            '<tr><td colspan="5">No data built yet. Run '
            "<code>python build_all.py</code> then refresh.</td></tr>"
        )

    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Listen to Earth — Backend API</title>
<style>
 :root {{ color-scheme: light dark; font-family: system-ui, sans-serif; }}
 body {{ max-width: 820px; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }}
 h1 {{ margin-bottom: .2rem; }} .sub {{ opacity:.7; margin-top:0; }}
 table {{ border-collapse: collapse; width: 100%; margin-top: 1rem; }}
 th,td {{ text-align: left; padding: .5rem .6rem; border-bottom: 1px solid #8884; vertical-align: top; }}
 code {{ background: #8882; padding: .1rem .3rem; border-radius: 4px; }}
 ul {{ padding-left: 1.1rem; }}
</style></head><body>
<h1>Listen to Earth</h1>
<p class="sub">Backend API — NASA Earth Information Center visualizations, sonified.</p>
<h2>Visualizations</h2>
<table><thead><tr><th>Visualization</th><th>Frames</th><th>Data</th><th>Audio</th><th>Source</th></tr></thead>
<tbody>{rows}</tbody></table>
<h2>Endpoints</h2>
<ul>
 <li><a href="/health">/health</a> — status</li>
 <li><a href="/manifest.json">/manifest.json</a> — direct manifest link</li>
 <li><a href="/api/visualizations">/api/visualizations</a> — the manifest</li>
 <li><code>/api/features/&lt;id&gt;</code> — a visualization's feature array</li>
 <li><code>/public/...</code> — static frames, features &amp; audio</li>
 <li><a href="/docs">/docs</a> — interactive API docs</li>
</ul>
</body></html>"""


# Serve everything under public/
if os.path.isdir(PUBLIC):
    app.mount("/public", StaticFiles(directory=PUBLIC), name="public")

# Mount direct static aliases for clean frontend fetching
frames_dir = os.path.join(PUBLIC, "frames")
if os.path.isdir(frames_dir):
    app.mount("/frames", StaticFiles(directory=frames_dir), name="frames")

features_dir = os.path.join(PUBLIC, "features")
if os.path.isdir(features_dir):
    app.mount("/features", StaticFiles(directory=features_dir), name="features")

audio_dir = os.path.join(PUBLIC, "audio")
if os.path.isdir(audio_dir):
    app.mount("/audio", StaticFiles(directory=audio_dir), name="audio")


if __name__ == "__main__":
    import uvicorn

    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(app, host=host, port=port)
