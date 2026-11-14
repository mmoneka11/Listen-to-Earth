# Listen to Earth — Backend / Data Pipeline

Turns a **NASA Earth Information Center (EIC)** visualization into the **feature
array**



```
 NASA SVS (rendered DYAMOND frames)
        │  svs_fetch.py  → data/raw/<name>.mp4
        ▼  extract_frames.py (ffmpeg)
 public/frames/<viz>/*.jpg
        │  extract_features.py
        ▼
 public/features/<viz>.json  +  public/manifest.json   →  engine + UI

 (optional) real NASA gridded DATA VALUES:
 NASA netCDF  →  ingest_netcdf.py  →  public/features/<viz>.json  (same contract)
```

This folder is the data/backend half of the project. The sonification engine
(Tone.js) and the frontend (accessible UI) consume only the contract in
[§5](#5-the-feature-contract); they do not care how it was produced.

---

## 1. Setup
```bash
pip install -r requirements.txt            # Pillow + numpy  (svs_fetch needs no deps)
# ffmpeg must be on PATH:  brew install ffmpeg   |   sudo apt install ffmpeg
# optional, only for ingest_netcdf.py:
pip install xarray netCDF4
```

## 2. The NASA data we use (and why) — verified

**Primary dataset: DYAMOND Global Carbon Dioxide — NASA Scientific Visualization
Studio, visualization 5196** → https://svs.gsfc.nasa.gov/5196

Verified provenance chain (all links checked — see `DATASETS.md`):
- **Scientific source:** NASA GMAO **DYAMOND Phase II**, the GEOS 3 km run that
  includes global carbon emissions for chemistry transport.
  Data access: https://gmao.gsfc.nasa.gov/gmao-products/dyamond-phase-ii/data-access_dyamond-phase-ii/
  Raw grids (NCCS): https://portal.nccs.nasa.gov/datashare/G5NR/DYAMONDv2/03KM/
- **Rendered form (what we read):** NASA SVS 5196 renders that model into animation
  frames, tagged by SVS as an Earth Information Center display asset.
- **EIC home:** https://earth.gov

We read the **SVS-rendered frames**, not the raw NCCS netCDF, on purpose: the raw
3 km run is a c2880 cubed-sphere grid with 181 vertical levels (multi-GB per
variable per timestep, not a simple lat-lon grid, and not "visual frames"). The
challenge asks you to sonify EIC **visual frames**, so the rendered DYAMOND frames
are both the correct form and feasible for a lightweight, accessible web app. We
cite GMAO/NCCS as the underlying scientific source.

> If you ever want to sonify the **data values** themselves rather than pixels,
> `ingest_netcdf.py` reads a tractable lat-lon NASA netCDF and emits the same
> contract. The raw DYAMOND 3 km files are not suitable to feed it directly.

## 3. How to fetch the NASA data

Every SVS page exposes a JSON manifest at `https://svs.gsfc.nasa.gov/api/<ID>`
listing every asset with a direct URL. `svs_fetch.py` reads that, so you never
guess a link, and it prefers the small MP4 over the hyperwall-resolution PNG
frame sets.

```bash
python svs_fetch.py 5196 --list                  # see every asset + size
python svs_fetch.py 5196 --out-dir data/raw      # grabs the <=1080p movie (~6.9 MB)
# or force a specific camera move:
python svs_fetch.py 5196 --pick orbit_1080p30_h265
```
> Run this on your own machine or CI — it reaches nasa.gov. Keep the big raw mp4
> out of git (`data/` is gitignored); only the downsampled `public/frames/` and
> `public/features/*.json` get committed.

## 4. Build the data for one visualization
```bash
# a) movie -> committed display frames
python extract_frames.py --src data/raw/<file>.mp4 --viz co2 \
    --out public/frames/co2 --fps 8 --scale 640x360 --format jpg --max-frames 320

# b) frames -> features.json (contract + accessible captions)
python extract_features.py --frames public/frames/co2 --viz co2-dyamond-svs5196 \
    --title "DYAMOND Global Carbon Dioxide (NASA SVS 5196)" \
    --description "Global CO2 moving through the atmosphere, Jan-Mar 2020 (GEOS DYAMOND model)." \
    --source-url https://svs.gsfc.nasa.gov/5196 \
    --fps 12 --hot-mode bright --hot-threshold 0.6 --hue-region frame \
    --out public/features/co2.json

# c) rebuild the picker index
python make_manifest.py
```
Or one line: `make build ID=5196 VIZ=co2 TITLE="DYAMOND Global Carbon Dioxide (NASA SVS 5196)" SRC=data/raw/<file>.mp4`

**Tuning (where the "Validity" score is won):** the extractor prints each
feature's min/max spread. If one barely moves, adjust `--hot-mode`
(`warm` for fire/aerosol reds, `bright` for plumes/night-lights),
`--hot-threshold`, or `--hue-region hot` (make melody track the active region).

## 5. The feature contract

`features.json`:
```json
{
  "viz": "co2-dyamond-svs5196",
  "title": "DYAMOND Global Carbon Dioxide (NASA SVS 5196)",
  "description": "Global CO2 moving through the atmosphere ...",
  "source_url": "https://svs.gsfc.nasa.gov/5196",
  "source": "frames",
  "fps": 12, "frame_count": 320, "hot_mode": "bright",
  "captions": [ { "start": 0, "end": 53, "text": "Intensity rising, brightness rising, activity moving right" } ],
  "frames": [ { "i": 0, "hue": 210.0, "brightness": 0.42, "hot": 0.18, "panX": 0.55, "delta": 0.03 } ]
}
```
Per-frame fields — **names frozen; append new fields, never rename**:

| field | range | meaning | engine maps to |
|-------|-------|---------|----------------|
| `i` | int | frame index | step order |
| `hue` | 0–360 | dominant colour family (or value→hue for netCDF) | note in pentatonic scale |
| `brightness` | 0–1 | avg luminance, auto-gained | octave + volume |
| `hot` | 0–1 | share of high-value pixels, auto-gained | rhythm density / layers |
| `panX` | 0–1 | L–R centroid of activity (0.5 = centre) | stereo pan |
| `delta` | 0–1 | change vs previous frame, auto-gained | accents / triggers |

`hue` and `panX` are deliberately **not** auto-gained. `captions` is an
accessibility track (plain-language description of the data's movement, timed to
frame ranges). `manifest.json` → `{ "visualizations": [...] }` is what the
picker loads and what citations use (`source_url`).

## 6. Optional: sonify real data values (netCDF)
```bash
pip install xarray netCDF4
python ingest_netcdf.py --src data/raw/some_nasa.nc --var CO2 \
    --viz co2-values --title "NASA CO2 (data values)" \
    --source-url <the NASA data page> --out public/features/co2_values.json
```
Each time step becomes a frame; the field's own numbers drive the features
(value → hue → note). Output is the identical contract, so the engine/UI are
unchanged.

## 7. Optional: serve as an API instead of static files
Static `public/` on GitHub Pages / Netlify is recommended (nothing to crash
during judging). For the "backend API endpoint" deliverable form:
```bash
pip install fastapi uvicorn
python serve_features.py   # GET /api/visualizations, /api/features/{id}, /frames/{id}/{file}
```

## 8. Accessibility
See `ACCESSIBILITY.md`. In short: the sonification **is** the access feature
(sound as an alternative to sight); the backend also emits plain-language
`captions` for screen readers, and precomputing features keeps the app fast on
low-end devices. No NASA branding/logos are generated or modified by any tool.

## 9. Citations & SI/AI disclosure (required by NASA)
NASA's 2026 terms allow removing awards from teams that don't cite resources —
cite everything, even open source. Minimum for this project:
- **NASA Data:** DYAMOND Global Carbon Dioxide (SVS 5196) `https://svs.gsfc.nasa.gov/5196`;
  NASA Earth Information Center `https://earth.gov`; GMAO DYAMOND Phase II (scientific source).
- **SI/AI:** this pipeline's code was written with AI assistance. The NASA data
  processing, the sonification mapping, and the generated audio are deterministic
  outputs of this code — not AI-generated. No NASA branding was generated/modified.

See `DATASETS.md` for the full verified resource list and `tests/smoke_test.py`
to validate the pipeline offline.
