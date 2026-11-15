# Listen to Earth — The Earth Information Jukebox

[![NASA Space Apps Challenge 2026](https://img.shields.io/badge/NASA%20Space%20Apps-2026-blue.svg)](https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/)
[![Challenge: The Earth Information Jukebox](https://img.shields.io/badge/Challenge-Earth%20Information%20Jukebox-orange.svg)](https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/)
[![Team: AI-MINDS](https://img.shields.io/badge/Team-AI--MINDS-brightgreen.svg)](https://www.spaceappschallenge.org/2026/find-a-team/ai-minds/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

> **Listen to Earth** turns **NASA Earth Information Center (EIC)** visualizations into sound,
> in real time, so sighted, blind, and low-vision users can *hear* our changing planet.
> Each animation frame is reduced to a few data-driven features, and those features drive a
> deterministic soundscape — colour becomes melody, brightness becomes octave and volume,
> activity becomes rhythm, position becomes stereo pan, and sudden change becomes an accent.

**Live app:** `<ADD DEPLOYED URL>` · **Demo video:** `<ADD DEMO LINK>` · **Repo:** https://github.com/mmoneka11/Listen-to-Earth

---

## Executive summary

NASA's Earth Information Center produces stunning visualizations of atmospheric chemistry,
ocean currents, and climate trends — but presenting Earth science visually alone limits who
can reach it. **Listen to Earth** answers the *Earth Information Jukebox* challenge by pairing
every EIC visual frame with a dynamically generated sonification, where **sound is the primary
sensory translation of the data, not background music**. A blind user can experience the same
climate trend a sighted user sees.

---

## What is actually built (honest scope)

| Capability | Status |
| :--- | :--- |
| **DYAMOND Global CO₂ — NASA SVS #5196** (real rendered frames → features → sound) | ✅ Fully implemented end-to-end (314 frames) |
| **DYAMOND Phase II — NASA GMAO NetCDF CO₂** (real gridded data values → sound) | ✅ Implemented (offline render) |
| Real-time browser sonification (Web Audio / Tone.js) | ✅ |
| Offline Python sonification engine + WAV export | ✅ |
| Accessible UI: keyboard control, screen-reader captions, high contrast | ✅ |
| Additional domains (SST, Ozone, GPM, SDO, Sea Ice) | ⚙️ **Engine tuning profiles / roadmap** — not yet wired to real NASA frames |


---

## How it works

```
NASA EIC visualization (SVS 5196 frames  |  GMAO NetCDF values)
        │
        ▼  data pipeline (backend/)
  per-frame feature array  { hue, brightness, hot, panX, delta }  + plain-language captions
        │
        ├─► Browser engine (frontend/src/utils/soundEngine.js, Tone.js)  → real-time sound + synced visuals
        └─► Python engine (backend/sonification/engine.py)               → offline 44.1 kHz stereo WAV
```

### Sonification mapping 

| Data dimension | Acoustic mapping |
| :--- | :--- |
| Concentration / value | Note in **C-major pentatonic** scale (C3–A6) — always consonant |
| Brightness | Octave lift + low-pass formant filter (350 Hz → 4500 Hz) + volume |
| Plume coverage (`hot`) | Rhythmic pulse subdivisions (2 / 4 / 8 per frame) |
| Longitude centroid (`panX`) | Constant-power stereo pan (West-left → East-right) |
| Rapid change (`delta`) | Dual chime accent (A5 / A6) for anomalies |
| Planetary grounding | Continuous sub-drone (C2, 65.41 Hz) |
| Master bus | Compressor + brickwall limiter (headphone / screen-reader safe) |

---

## Repository layout

```
Listen-to-Earth/
├── backend/                 # data pipeline + API + offline sonification
│   ├── svs_fetch.py         # download NASA SVS assets via the SVS JSON API
│   ├── extract_frames.py    # ffmpeg → numbered display frames
│   ├── extract_features.py  # frames → features.json (+ accessibility captions)
│   ├── ingest_netcdf.py     # real NASA gridded data values → same contract
│   ├── sonification/        # engine.py (Python) + engine.ts + mapping_config.json + real renders
│   ├── serve_features.py    # FastAPI app: landing page, /api, static /public
│   ├── verify_output.py     # contract + citation + accessibility validator
│   ├── build_all.py         # fetch → frames → features → audio → manifest → verify
│   └── DATASETS.md / ACCESSIBILITY.md / Dockerfile / tests/
└── frontend/                # React + Vite accessible UI (Tone.js live sonification)
    ├── src/App.jsx, components/, utils/soundEngine.js, utils/nasaDatasets.js
    └── public/ (frames, features, audio, team photos)
```

---

## Run it locally

**Backend (data + API):**
```bash
cd backend
pip install -r requirements.txt fastapi uvicorn
python build_all.py --audio      # build CO₂ from real NASA data, render audio, verify
python serve_features.py         # http://127.0.0.1:8000
```

**Frontend (accessible UI):**
```bash
cd frontend
npm install
npm run dev                      # http://localhost:5173
```

Deployment is configured for Vercel (`vercel.json`): the Vite frontend is served statically and
`/api/*` + `/health` are routed to the FastAPI backend.

---

## Accessibility

Accessibility is the point, not a layer. Highlights:
- **Sonification as the access feature** — the sound is a full alternative to sight.
- **Plain-language captions** generated from the data (backend `captions` track) announced via `aria-live`.
- **Full keyboard control** (Space play/pause, Esc stop, R restart, ←/→ step frames, 1–3 screens).
- **High-contrast theme** and `prefers-reduced-motion` support.
- **Low-frequency tactile mapping** suited to haptic / braille-adjacent output.

See `backend/ACCESSIBILITY.md` for the full approach.

---

## NASA data & credits

**NASA data used (cite these):**
- **DYAMOND Global Carbon Dioxide** — NASA Scientific Visualization Studio #5196 — https://svs.gsfc.nasa.gov/5196
- **NASA Earth Information Center (EIC)** — https://earth.gov
- **GMAO DYAMOND Phase II** (scientific source of the CO₂ run) — https://gmao.gsfc.nasa.gov/gmao-products/dyamond-phase-ii/data-access_dyamond-phase-ii/
- **NCCS DYAMOND v2 data share** (raw grids) — https://portal.nccs.nasa.gov/datashare/G5NR/DYAMONDv2/03KM/

Credit: *NASA's Scientific Visualization Studio* and *NASA Global Modeling and Assimilation Office (GMAO)*.

**Tools & libraries:** React, Vite, Tone.js, lucide-react (frontend); Python, Pillow, NumPy, ffmpeg, FastAPI, xarray/netCDF4 (backend). AI assistance: Anthropic Claude (code & docs).

### SI / AI disclosure 
Portions of this project's **code and documentation** were written with AI assistance
(Anthropic's Claude & Antigravity). All **NASA data processing, the sonification mapping, and the generated
audio are deterministic outputs of our own code — not AI-generated audio**. No NASA branding,
logos, flags, or mission identifiers were generated or modified by any SI tool. Any AI-generated
imagery used in the demo is watermarked as such.

---

## Team AI-MINDS

| Member | Role | Contribution
| :--- | :--- | :--- | 
| **Sobia** | Team Lead | 
| **Moneka Meghwar** | AI Developer | sonification engine & data/AI & project documentation |
| **Azfar** | Frontend Developer |
| **Dayanand** | Frontend Developer |
| **Sumera Shar** | Presentation Lead |



---

## License

Apache-2.0 (`LICENSE`) — the NASA Space Apps default, so all code is freely usable and citable.
