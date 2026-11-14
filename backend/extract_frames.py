#!/usr/bin/env python3
"""
extract_frames.py — pull a numbered, downsampled frame sequence from an mp4.

One committed frame set serves two jobs: the UI displays it on the canvas, and
extract_features.py reads it (downsampling further in-memory). Keep it light so
the repo stays small — the Team Build Guide's rule is 'commit a downsampled copy
or every Nth frame'.

Requires ffmpeg on PATH.

Example:
    python extract_frames.py --src data/raw/dyamond_orbit_1080p30_h265.mp4 \
        --viz co2 --out public/frames/co2 \
        --fps 8 --scale 640x360 --format jpg --max-frames 320
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys


def main():
    ap = argparse.ArgumentParser(description="mp4 -> numbered frames via ffmpeg")
    ap.add_argument("--src", required=True, help="input mp4")
    ap.add_argument("--viz", required=True, help="viz name (used in filenames)")
    ap.add_argument("--out", required=True, help="output frames folder")
    ap.add_argument("--fps", type=int, default=8, help="frames per second to sample")
    ap.add_argument("--scale", default="640x360", help="output WxH for display frames")
    ap.add_argument("--format", choices=["png", "jpg"], default="jpg")
    ap.add_argument("--quality", type=int, default=4, help="jpg quality 2(best)-31(worst)")
    ap.add_argument("--max-frames", type=int, default=0, help="0 = all")
    ap.add_argument("--start", default="", help="start time, e.g. 00:00:05")
    ap.add_argument("--duration", default="", help="seconds/HH:MM:SS to keep")
    args = ap.parse_args()

    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg not found on PATH. Install it (brew install ffmpeg / "
                 "apt install ffmpeg) and retry.")
    if not os.path.exists(args.src):
        sys.exit(f"Input not found: {args.src}")

    os.makedirs(args.out, exist_ok=True)
    # clear old frames so re-runs are clean
    for f in os.listdir(args.out):
        if f.startswith(args.viz + "_") and f.endswith((".png", ".jpg")):
            os.remove(os.path.join(args.out, f))

    w, h = args.scale.lower().split("x")
    vf = f"fps={args.fps},scale={w}:{h}:flags=area"
    pattern = os.path.join(args.out, f"{args.viz}_%04d.{args.format}")

    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"]
    if args.start:
        cmd += ["-ss", args.start]
    cmd += ["-i", args.src]
    if args.duration:
        cmd += ["-t", args.duration]
    if args.max_frames:
        cmd += ["-frames:v", str(args.max_frames)]
    cmd += ["-vf", vf, "-start_number", "0"]
    if args.format == "jpg":
        cmd += ["-q:v", str(args.quality)]
    cmd += [pattern]

    print("[frames] " + " ".join(cmd))
    subprocess.run(cmd, check=True)

    frames = sorted(f for f in os.listdir(args.out)
                    if f.startswith(args.viz + "_") and f.endswith(args.format))
    total = sum(os.path.getsize(os.path.join(args.out, f)) for f in frames)
    print(f"[frames] wrote {len(frames)} frames to {args.out} "
          f"({total/1e6:.1f} MB total, {args.scale})")
    if total > 20e6:
        print("[frames] WARNING: >20 MB. Lower --fps, --scale, or --quality, or "
              "use --max-frames to keep the repo light.")


if __name__ == "__main__":
    main()
