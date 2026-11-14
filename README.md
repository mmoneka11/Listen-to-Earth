# Listen to Earth — The Earth Information Jukebox

[![NASA Space Apps Challenge 2026](https://img.shields.io/badge/NASA%20Space%20Apps-2026-blue.svg)](https://www.spaceappschallenge.org/2026/find-a-team/ai-minds/)
[![Challenge: The Earth Information Jukebox](https://img.shields.io/badge/Challenge-Earth%20Information%20Jukebox-orange.svg)](https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/)
[![Team: AI-MINDS](https://img.shields.io/badge/Team-AI--MINDS%20(Hyderabad%2C%20Pakistan)-brightgreen.svg)](https://www.spaceappschallenge.org/2026/find-a-team/ai-minds/)
[![Accessibility: WCAG 2.2 AAA](https://img.shields.io/badge/Accessibility-WCAG%202.2%20AAA-success.svg)](#accessibility--tactile-standards)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

> **Listen to Earth** is a scientific web application and sonification engine that transforms **NASA Earth Information Center (EIC)** visualizations into dynamic, multi-sensory soundscapes in real time. By translating visual satellite animation frames into deterministic acoustic parameters, it allows sighted, blind, and low-vision researchers to hear the pulse of our changing planet.

---

## 🌍 Executive Summary

NASA’s Earth Information Center produces stunning visualizations of atmospheric chemistry, ocean currents, and climate trends. However, presenting Earth science through visualization alone limits who can reach it.

**Listen to Earth** addresses NASA's *Earth Information Jukebox* challenge directly by pairing every EIC visual frame with a dynamically generated sonification. Here, sound is not an afterthought or background music—it is the **primary sensory translation of the underlying data**:
* **Atmospheric Concentration & Brightness** drive melody across a consonant **C-Major Pentatonic scale ($C_3 \to A_6$)** and open a dynamic **$350\text{ Hz} \to 4500\text{ Hz}$ formant filter**.
* **Geographic Longitude** pans the soundscape across binaural stereo space via a **$3\text{ dB}$ constant-power pan law** ($-1.0\text{ West} \to +1.0\text{ East}$).
* **Plume Coverage Area** triggers **$1\times, 2\times, 4\times$ metronomic overtone pulses** ($2 \times f_0$) once plumes cover more than $12\%$ of the planetary disk.
* **Rapid Flux Deltas ($\Delta > 0.45$)** trigger **dual $880\text{ Hz}$ ($A_5$) and $1760\text{ Hz}$ ($A_6$) crystal chimes** to highlight transient anomalies like wildfires and solar bursts.
* **Grounding Sub-Drone ($C_2 = 65.41\text{ Hz}$)** provides a foundational acoustic baseline so users never lose their sensory bearing.

---

## 🚀 Key Features

### 1. Three-Screen Scientific Command Deck
* **Screen 1 — Live Stage (`/`)**:
  * 3-column command deck with real NASA satellite frames and high-fidelity procedural cartography.
  * **Planetary Stream Switcher**: 1-click switching across all 6 verified NASA datasets.
  * **5-Channel Telemetry Rack**: Real-time readouts of pitch, note, dB gain, filter cutoff, stereo pan, pulse rhythm, and anomaly flags.
  * **🧪 Scientific Value Injector (Manual Test Lab)**: Direct numeric inputs and sliders for researchers to test custom parameters with real-time audio auditioning and 5 NASA calibration presets (`PPM-MAX`, `BASE`, `ANOMALY`, `ARCTIC`, `EQUATOR`).
* **Screen 2 — Science & Accessibility Guide (`/guide`)**:
  * Unified scientific documentation featuring an interactive **harmonic oscilloscope**, deep dive into the **5-channel translation protocol**, and the **WCAG 2.2 AAA accessibility manual**.
  * Speech narration telemetry buffer with Brief vs Standard verbosity switcher.
* **Screen 3 — Team AI-MINDS (`/team`)**:
  * Official NASA Space Apps roster featuring all 5 members, competency tags, and the official team artwork.

### 2. Dual Sonification Pipeline
1. **Browser-Native Web Audio API ([`soundEngine.js`](frontend/src/utils/soundEngine.js))**: Zero-dependency, low-latency audio synthesizer with soft portamento frequency gliding ($35\text{ ms}$) and brickwall dynamics compressor.
2. **Python Offline Audio Engine ([`backend/sonification/engine.py`](backend/sonification/engine.py))**: 44.1 kHz 16-bit stereo WAV synthesizer with soft-$tanh$ saturation powering batch offline rendering and audio exports.

### 3. Accessible by Design (WCAG 2.2 AAA / Section 508)
* **Screen-Reader Sync**: `aria-live="polite"` speech buffers describing environmental trends and coordinates per frame.
* **Full Keyboard Keymap**: Hands-free keyboard control (<kbd>Space</kbd> for Play/Pause, <kbd>Esc</kbd> for Stop, <kbd>R</kbd> for Restart, <kbd>←</kbd>/<kbd>→</kbd> for step frames, <kbd>1</kbd>–<kbd>3</kbd> for screens).
* **Tactile & Haptic Frequency Mapping**: Calibrated $65.4\text{ Hz} \to 1760\text{ Hz}$ spectrum tailored for refreshable braille displays and low-frequency vibration transducers.
* **7:1 High-Contrast Theme**: Exceeds WCAG AAA color contrast standards.

---

## 📊 Verified NASA Datasets

| Dataset | NASA SVS ID | Domain | Base Unit | Acoustic Tuning |
| :--- | :---: | :--- | :---: | :--- |
| **DYAMOND Global Carbon Dioxide** | [SVS #5196](https://svs.gsfc.nasa.gov/5196/) | Global Carbon Cycle | $412\text{--}430\text{ ppm}$ | Strings & C-Major Pentatonic ($C_3\text{--}A_6$) |
| **Sea Surface Temperature Anomaly** | [SVS #4752](https://svs.gsfc.nasa.gov/4752/) | Ocean Dynamics & El Niño | $-2.4^\circ\text{C}\text{ to }+3.8^\circ\text{C}$ | Deep Warm Sub-Drone & Oceanic Waves |
| **Antarctic Ozone Hole Recovery** | [SVS #3890](https://svs.gsfc.nasa.gov/3890/) | Atmospheric Chemistry | $140\text{--}300\text{ DU}$ | High-Register Resonant Crystal Bells |
| **Global Precipitation Measurement (GPM)** | [SVS #4272](https://svs.gsfc.nasa.gov/4272/) | Hydrologic Weather | $0\text{--}48\text{ mm/hr}$ | Organic Rain Textures & Pulse Density |
| **Solar Dynamics Observatory Flares (SDO)** | [SVS #4812](https://svs.gsfc.nasa.gov/4812/) | Heliophysics / Space Weather | $10^{-4}\text{ W/m}^2$ | Solar Flare Microtonal Arpeggios |
| **Arctic Sea Ice Minimum Extent** | [SVS #5032](https://svs.gsfc.nasa.gov/5032/) | Cryosphere Polar Trends | Million $\text{km}^2$ | Crystalline Glacial Tones |

---

## 👥 Team AI-MINDS (Hyderabad, Pakistan)

* **Sobia Sattar** — Team Lead & Project Researcher (`@sobiaa`, Team Owner)
* **Moneka Meghwar** — Frontend & UI/UX Developer (`@mmoneka11`)
* **Sumera Shar** — Data Analyst & Visualizer (`@sumera45`)
* **Muhammad Azfar** — Software Architect & QA Engineer (`@azfarqa`)
* **Daya Nand** — Sonification Engineer & Math Modeler (`@nandd1224`)

---

## 🛠️ Quick Start & Running Locally

### Prerequisites
* **Node.js** (v18+) & **npm**
* **Python** (3.10+)

### 1. Start Backend API Server
```bash
# Navigate to backend and install dependencies
cd backend
pip install -r requirements.txt

# Start FastAPI server on port 8000
python serve_features.py
```
*API endpoints: `http://127.0.0.1:8000/manifest.json`, `/features/co2.json`, `/frames/co2/`, `/docs`.*

### 2. Start Frontend Dev Server
```bash
# Navigate to frontend and install dependencies
cd frontend
npm install

# Start Vite dev server on port 5173
npm run dev
```
*Open `http://localhost:5173` in your browser.*

### 3. Run Quality Assurance & Unit Tests
```bash
# Python Sonification Unit Tests (9/9 passing)
python -m pytest backend/sonification/tests -v

# Backend Pipeline Smoke Tests (All passing)
python backend/tests/smoke_test.py

# Frontend Linter (0 warnings, 0 errors)
cd frontend
npx oxlint

# Production Build
npm run build
```

---

## ⚖️ Citations & AI Disclosure
* **NASA Data Sources**: NASA Scientific Visualization Studio (SVS #5196, #4752, #3890, #4272, #4812, #5032); NASA Earth Information Center ([earth.gov](https://earth.gov)); NASA GMAO GEOS model data.
* **AI Disclosure**: Code structure and design synthesis were assisted by artificial intelligence. All mathematical mappings, unit test assertions, audio synthesis formulas, and NASA telemetry ingest pipelines are deterministic functions of scientific data. No NASA trademarks or official seals were modified.

**License**: Apache-2.0
