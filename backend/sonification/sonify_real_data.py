#!/usr/bin/env python3
"""
Listen to Earth — Real NASA Data Sonification Generator
========================================================
Sonifies real NASA Earth Science datasets into production-grade 44.1kHz stereo audio:
  1. NASA SVS 5196 DYAMOND Global CO2 (314 frames from official NASA SVS animation)
  2. NASA GMAO DYAMOND Phase II CO2 NetCDF (60 time steps of raw 3km simulation values)
  3. Reference Calibration Audio Tones (Low, Mid, High, Event, Pan Sweep)

Usage:
    python sonification/sonify_real_data.py
    python sonification/sonify_real_data.py --speed 1.5
    python sonification/sonify_real_data.py --dataset co2
    python sonification/sonify_real_data.py --dataset gmao_co2_netcdf
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
import numpy as np
from scipy.io import wavfile

# Ensure sonification root is on sys.path
SONIFICATION_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SONIFICATION_DIR))

import engine

BACKEND_DIR = SONIFICATION_DIR.parent
FEATURES_DIR = BACKEND_DIR / "public" / "features"
OUTPUT_DIR = SONIFICATION_DIR / "output"

def sonify_dataset(dataset_id: str, features_path: Path, output_wav: Path, speed: float = 1.0) -> None:
    """Sonifies a real NASA features JSON dataset to a 44.1kHz stereo WAV file."""
    if not features_path.exists():
        print(f"❌ Error: Features file not found: {features_path}", file=sys.stderr)
        return

    with open(features_path, "r", encoding="utf-8") as f:
        doc = json.load(f)

    title = doc.get("title") or doc.get("name") or dataset_id
    frames = doc.get("frames", [])
    fps = doc.get("fps", 12.0)
    source_url = doc.get("source_url", "")

    print(f"\n▶ Sonifying: {title}")
    print(f"  • Source URL: {source_url}")
    print(f"  • Frame Count: {len(frames)} frames @ {fps} fps (Speed: {speed}x)")

    # Synthesize audio using the production engine
    audio_pcm, sr = engine.synthesize_sonification(doc, speed=speed)

    # Save to disk
    output_wav.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(str(output_wav), sr, audio_pcm)

    # Audio metrics
    duration = len(audio_pcm) / sr
    file_size_mb = output_wav.stat().st_size / (1024 * 1024)
    peak_val = np.max(np.abs(audio_pcm))
    peak_db = 20 * np.log10(peak_val / 32767.0 + 1e-9)

    print(f"  ✔ Saved: {output_wav.resolve()}")
    print(f"  ✔ Duration: {duration:.2f}s | Size: {file_size_mb:.2f} MB | Peak: {peak_db:.1f} dBFS | 44.1kHz 16-bit Stereo")

def main():
    parser = argparse.ArgumentParser(description="Sonify Real NASA Earth Science Data")
    parser.add_argument("--speed", type=float, default=1.0, help="Playback speed multiplier (default: 1.0)")
    parser.add_argument("--dataset", choices=["all", "co2", "gmao_co2_netcdf"], default="all",
                        help="Select dataset to sonify (default: all)")
    parser.add_argument("--out-dir", type=str, default=str(OUTPUT_DIR),
                        help=f"Output directory for rendered WAV files (default: {OUTPUT_DIR})")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 70)
    print("  LISTEN TO EARTH — REAL NASA DATA SONIFICATION PIPELINE")
    print("  NASA Space Apps Challenge 2026: The Earth Information Jukebox")
    print("=" * 70)

    # 1. Real NASA SVS 5196 DYAMOND Global CO2
    if args.dataset in ("all", "co2"):
        co2_features = FEATURES_DIR / "co2.json"
        co2_wav = out_dir / "real_nasa_svs5196_co2.wav"
        sonify_dataset("co2", co2_features, co2_wav, speed=args.speed)

    # 2. Real NASA GMAO DYAMOND Phase II CO2 NetCDF (Raw Data Values)
    if args.dataset in ("all", "gmao_co2_netcdf"):
        netcdf_features = FEATURES_DIR / "gmao_co2_netcdf.json"
        netcdf_wav = out_dir / "real_nasa_gmao_netcdf_co2.wav"
        sonify_dataset("gmao_co2_netcdf", netcdf_features, netcdf_wav, speed=args.speed)

    # 3. Accessibility Calibration Reference Tones
    print(f"\n▶ Generating Calibration Reference Audio...")
    calib_files = engine.generate_calibration_reference_audio(out_dir)
    for name, path in calib_files.items():
        sr, audio = wavfile.read(path)
        dur = len(audio) / sr
        print(f"  • {name:12s} -> {path.name} ({dur:.2f}s)")

    print("\n" + "=" * 70)
    print("  ✔ ALL REAL NASA DATA SONIFICATIONS GENERATED SUCCESSFULLY!")
    print(f"  Audio outputs ready in: {out_dir.resolve()}")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    main()
