#!/usr/bin/env python3
"""
make_mock.py — a hand-made placeholder features.json so teammates can build the
sonification engine and UI against the contract before the real NASA frames are
downloaded. It is a PLACEHOLDER, not NASA data — replace it with real output from
extract_features.py / ingest_netcdf.py before submitting.

    python make_mock.py --out public/features/mock.json
"""
from __future__ import annotations

import argparse
import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from eicjukebox import features_core as fc  # noqa: E402


def main():
    ap = argparse.ArgumentParser(description="Generate a placeholder features.json")
    ap.add_argument("--frames", type=int, default=28)
    ap.add_argument("--viz", default="mock-co2-rising")
    ap.add_argument("--fps", type=int, default=12)
    ap.add_argument("--out", default="public/features/mock.json")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    rng = random.Random(args.seed)
    n = args.frames
    frames = []
    for i in range(n):
        t = i / (n - 1)
        season = 0.12 * math.sin(t * math.pi * 3)
        frames.append({
            "i": i,
            "hue": round((210 - 170 * t) % 360, 1),
            "brightness": round(min(1, max(0, 0.25 + 0.6 * t + season + rng.uniform(-0.03, 0.03))), 4),
            "hot": round(min(1, max(0, 0.10 + 0.8 * t + season * 0.5 + rng.uniform(-0.02, 0.02))), 4),
            "panX": round(0.5 + 0.4 * math.sin(t * math.pi * 2), 4),
            "delta": round(0.9 if (i % 7 == 0 and i > 0) else min(1, 0.05 + abs(season) + rng.uniform(0, 0.05)), 4),
        })

    out = {
        "viz": args.viz,
        "title": "PLACEHOLDER - replace with real NASA extractor output",
        "description": "Hand-made placeholder data (NOT NASA data) for UI/engine development.",
        "source_url": "",
        "source": "mock",
        "fps": args.fps,
        "frame_count": n,
        "normalization": {},
        "captions": fc.describe_segments(frames, 6),
        "frames": frames,
    }
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(out, f, indent=2)
    print(f"[mock] wrote {args.out} ({n} frames) — PLACEHOLDER, not NASA data")


if __name__ == "__main__":
    main()
