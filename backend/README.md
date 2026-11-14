# Listen to Earth — Backend / Data Pipeline

> **NASA Space Apps Challenge 2026:** *The Earth Information Jukebox*  
> **Team:** AI-MINDS (Hyderabad, Pakistan)  
> **Status:** Production Ready · 100% Smoke Tests Passing

Turns **NASA Earth Information Center (EIC)** visualizations into structured **telemetry arrays** that drive the Web Audio sonification engine and the accessible command deck. All heavy computer-vision and feature extraction happens **offline**, allowing the frontend to stream lightweight telemetry across any low-power or mobile device.

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

This folder is the data/backend half of the project. The sonification engine (Web Audio / Python) and the frontend (React 19) consume the scientific contract in [§5](#5-the-feature-contract).

---

## 1. Setup
```bash
pip install -r requirements.txt            # Pillow + numpy + fastapi + uvicorn
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

## 7. Serving the API & Static Assets
For the "backend API endpoint" deliverable form:
```bash
pip install fastapi uvicorn
python serve_features.py   # serves http://127.0.0.1:8000/ (/manifest.json, /features/*, /frames/*, /audio/*, /health, /docs)
```
The FastAPI server mounts root aliases so the frontend can stream frames and metadata directly:
* `/manifest.json` — Returns the catalog of all NASA EIC visual frames.
* `/features/{id}.json` — Returns feature contracts (luminance, hot plume area, panX, delta).
* `/frames/co2/co2_%04d.jpg` — Serves 314 real NASA satellite animation frames.
* `/audio/{id}.wav` — Serves pre-rendered 44.1kHz stereo audio artifacts.

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

---

## 10. Batch build, audio, Docker & CI (complete pipeline)

**Build every visualization at once** — declare them in `datasets.yaml`, then:
```bash
python build_all.py --audio          # fetch -> frames -> features -> audio -> manifest -> verify
python build_all.py --dry-run        # preview the commands
python build_all.py --skip-fetch     # reuse already-downloaded movies
```

**Offline audio artifact** — render a `features.json` to a real stereo WAV (for the
30-second demo video and as a judging-day fallback; it's also the reference mapping
the Tone.js engine mirrors):
```bash
python render_audio.py --features public/features/co2.json --out public/audio/co2.wav
python render_audio.py --features public/features/co2.json --max-seconds 30 --out public/audio/co2_demo.wav
```
Mapping: hue→pentatonic note, brightness→octave+volume, hot→harmonic richness,
panX→stereo pan, delta→accent. The audio is a deterministic function of NASA data —
not AI-generated (note this in the SI/AI disclosure).

**Docker** — run the API containerized:
```bash
docker compose up --build            # serves http://localhost:8000
# build data inside the container instead:
docker run --rm -v "$PWD/public:/app/public" -v "$PWD/data:/app/data" listen-to-earth python build_all.py
```

**CI** — `.github/workflows/ci.yml` runs the offline smoke test (both pipeline paths)
on every push and PR, so the contract can't silently break.

## 11. Scientific Sonification Engine (`backend/sonification/`)

The dedicated Python sonification module provides the reference psychoacoustic audio synthesis implementation:
- **`engine.py`**: 7-channel psychoacoustic synthesizer (C Major Pentatonic scale, 65.41 Hz grounding sub-drone, constant-power binaural stereo panning, dynamic noise transients, and soft-knee brickwall limiter).
- **`sonify_real_data.py`**: Batch sonifier for NASA SVS 5196 and GMAO NetCDF time series into studio-grade 44.1kHz stereo audio.
- **`tests/test_sonification.py`**: 9 automated pytest tests validating pitch monotonicity, constant-power energy conservation, and clipping prevention.

```bash
# Run sonification test suite
python -m pytest backend/sonification/tests

# Generate real NASA data sonification outputs
python backend/sonification/sonify_real_data.py
```

**License** — Apache-2.0 (`LICENSE`), the NASA Space Apps default, so all code is
freely usable and citable per the rules.
