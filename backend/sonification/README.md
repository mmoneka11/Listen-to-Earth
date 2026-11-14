# Listen to Earth — Sonification Module (Production Ready)

> **NASA Space Apps Challenge 2026:** *The Earth Information Jukebox*  
> **Team:** AI-MINDS (Hyderabad, Pakistan)  
> **Module:** Sonification Engine & Test Suite (Dual Python + Web Audio Pipelines)  
> **Core Objective:** Turn real NASA Earth science visualizations and gridded climate data into real-time sound so blind and low-vision users can hear our changing planet.

---

## 1. Module Overview

This directory contains the self-contained, production-ready **Sonification Module** for Listen to Earth. It handles real NASA Earth science data through dual synthesis pipelines:

1. **Python Synthesis Engine (`engine.py`):** High-fidelity 44.1 kHz 16-bit stereo WAV synthesizer with soft-$tanh$ saturation, constant-power panning, and brickwall dynamics limiting. Powers offline batch rendering and the backend streaming endpoint (`GET /api/datasets/{id}/render.wav`).
2. **Web Audio Player (`engine.ts` & `frontend/src/utils/soundEngine.js`):** Zero-dependency browser-native Web Audio synthesizer for real-time, low-latency playback in the frontend UI.
3. **Unified Mapping Configuration (`mapping_config.json`):** Single source of truth for frequencies, harmonics, thresholds, and calibration profiles.
4. **Real NASA Data Generator (`sonify_real_data.py`):** Direct CLI pipeline that sonifies real NASA SVS 5196 $\text{CO}_2$ frames and real NASA GMAO NetCDF atmospheric data.
5. **Unit Test Suite (`tests/test_sonification.py` & `run_tests.py`):** 9 rigorous unit tests verifying scale tuning, energy conservation, input sanitization, clipping immunity, and speed scaling.

---

## 2. Psychoacoustic Mapping Architecture

| Visual / Data Dimension | Input Range | Musical & Acoustic Mapping | Psychoacoustic Purpose |
|:---|:---:|:---|:---|
| **Concentration / Value** | `0.0` – `1.0` | **C Major Pentatonic Pitch ($C3 \dots A6$)** | Consonant 5-tone scale ($C, D, E, G, A$) prevents cognitive fatigue and eliminates dissonant clashes. |
| **Atmospheric Luminance** | `0.0` – `1.0` | **Octave lift & Low-pass filter ($350\text{ Hz} \dots 4500\text{ Hz}$)** | Opens acoustic brightness and scales amplitude proportionally to solar and plume luminance. |
| **Plume Coverage (`hot`)** | `0.0` – `1.0` | **Rhythmic Pulse Subdivisions (2, 4, 8 pulses/frame)** | Expanding plumes add rhythmic density and urgency without cluttering the melodic pitch. |
| **Longitude Centroid (`panX`)** | `0.0` – `1.0` | **Constant-Power Stereo Panning ($L^2 + R^2 = 1.0$)** | Maps planetary longitude directly to binaural spatial orientation ($0.0 = \text{West/Left}$, $0.5 = \text{Center}$, $1.0 = \text{East/Right}$). |
| **Rapid Anomaly (`event`)** | Flag / $\Delta > 0.65$ | **Dual Harmonic Chime ($A5/A6$) & Transient Noise** | Sharp acoustic marker alerts blind listeners to sudden wildfire or industrial plume bursts. |
| **Planetary Grounding** | Continuous | **Deep Sub-Drone ($C2$ / $65.41\text{ Hz}$)** | Grounding fundamental anchor with low-pass filtered 2nd harmonic. |
| **Master Bus Limiter** | Dynamics Bus | **Dynamics Compressor & Brickwall Limiter** | Prevents digital clipping and guarantees safety for headphone and screen-reader users. |

---

## 3. Directory Layout

```
backend/sonification/
├── engine.py                  # Python audio synthesis engine (NumPy / SciPy)
├── engine.ts                  # Web Audio API TypeScript player for frontend
├── mapping_config.json        # Canonical configuration (scales, gains, thresholds)
├── sonify_real_data.py        # CLI generator for REAL NASA data sonifications
├── run_tests.py               # Combined unit test runner and audio renderer
├── __init__.py                # Package exports for backend integration
├── tests/
│   └── test_sonification.py   # Dedicated unit tests (pytest)
├── output/                    # Production 44.1kHz stereo audio outputs
│   ├── real_nasa_svs5196_co2.wav       # NASA SVS 5196 Global CO2 (314 frames)
│   ├── real_nasa_gmao_netcdf_co2.wav   # NASA GMAO Phase II NetCDF (60 time steps)
│   ├── calibration_low.wav             # Baseline reference tone
│   ├── calibration_mid.wav             # Moderate concentration tone
│   ├── calibration_high.wav            # High concentration tone
│   ├── calibration_event.wav           # Sudden plume burst alert chime
│   └── calibration_pan_sweep.wav       # West-to-East stereo sweep
└── README.md                  # Complete technical documentation
```

---

## 4. Production Commands

### A. Run Real NASA Data Sonification
Sonifies the real NASA Earth science data and writes 44.1kHz stereo WAV files into `sonification/output/`:
```powershell
python sonification/sonify_real_data.py
```

Options:
```powershell
# Sonify with 1.5x speed multiplier
python sonification/sonify_real_data.py --speed 1.5

# Sonify ONLY NASA SVS 5196 Global CO2
python sonification/sonify_real_data.py --dataset co2

# Sonify ONLY NASA GMAO NetCDF simulation data
python sonification/sonify_real_data.py --dataset gmao_co2_netcdf
```

### B. Run Sonification Unit Tests
```powershell
# Using the dedicated test runner
python sonification/run_tests.py

# Or directly with pytest
python -m pytest sonification/tests -v
```

### C. Direct Engine CLI
You can also run the engine directly on any arbitrary features JSON file:
```powershell
python -m sonification.engine --input backend/public/features/co2.json --output sonification/output/co2.wav --speed 1.0
```

---

## 5. Verification & Audio Output Specs

| File | Source | Frames/Steps | Duration | Size | Specs |
|:---|:---|:---:|:---:|:---:|:---|
| **`real_nasa_svs5196_co2.wav`** | [NASA SVS 5196](https://svs.gsfc.nasa.gov/5196) | 314 frames | 26.17s | 4.40 MB | 44.1kHz, 16-bit Stereo, Peak: -5.9 dBFS |
| **`real_nasa_gmao_netcdf_co2.wav`** | [NASA GMAO DYAMOND Phase II](https://gmao.gsfc.nasa.gov/gmao-products/dyamond-phase-ii/) | 60 steps | 5.00s | 0.84 MB | 44.1kHz, 16-bit Stereo, Peak: -6.5 dBFS |
| **`calibration_*.wav`** | Sonification Engine Reference | N/A | 1.6s–3.0s | ~275 KB | 44.1kHz, 16-bit Stereo |
