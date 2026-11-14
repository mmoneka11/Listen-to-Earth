#!/usr/bin/env python3
"""
extract_features.py — turn a folder of NASA EIC frames into features.json.

This is the heart of the data pipeline. It reads the downsampled frames of a
NASA Earth Information Center visualization (fetched with svs_fetch.py +
extract_frames.py) and computes one normalized feature object per frame — the
contract the sonification engine and frontend consume. The computer vision is
done once, offline, so the browser loads a tiny JSON and runs on any device
(itself an accessibility win).

It also emits plain-language, data-driven captions (see --caption-segments) so a
blind or low-vision listener gets the same narrative a sighted viewer reads off
the map.

Example:
    python extract_features.py \
        --frames public/frames/co2 \
        --viz co2-dyamond-svs5196 \
        --title "DYAMOND Global Carbon Dioxide (NASA SVS 5196)" \
        --description "Global CO2 moving through the atmosphere, Jan-Mar 2020 (GEOS DYAMOND model)." \
        --source-url https://svs.gsfc.nasa.gov/5196 \
        --fps 12 --size 96x48 --hot-mode bright --hot-threshold 0.6 \
        --out public/features/co2.json

SI/AI disclosure: this analysis code was written with AI assistance (see README).
The data it processes is NASA's; the features and audio are deterministic outputs
of this code, not AI-generated.
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from eicjukebox import features_core as fc  # noqa: E402

FRAME_EXT = ("*.png", "*.jpg", "*.jpeg", "*.webp")


def find_frames(folder: str):
    files = []
    for pat in FRAME_EXT:
        files.extend(glob.glob(os.path.join(folder, pat)))
    return sorted(files)  # zero-padded names sort correctly as strings


def parse_size(s: str):
    w, h = s.lower().split("x")
    return int(w), int(h)


def main():
    ap = argparse.ArgumentParser(description="NASA EIC frames -> features.json")
    ap.add_argument("--frames", required=True, help="folder of numbered frame images")
    ap.add_argument("--viz", required=True, help="viz id, e.g. co2-dyamond-svs5196")
    ap.add_argument("--out", required=True, help="output features.json path")
    ap.add_argument("--title", default="", help="human title (for captions/UI)")
    ap.add_argument("--description", default="", help="one-line plain-language description")
    ap.add_argument("--source-url", default="", help="NASA source page (REQUIRED for citation)")
    ap.add_argument("--fps", type=int, default=12, help="playback fps the engine steps frames at")
    ap.add_argument("--size", default="96x48", help="downsample WxH for analysis")
    ap.add_argument("--hot-mode", choices=["bright", "warm"], default="bright")
    ap.add_argument("--hot-threshold", type=float, default=0.6)
    ap.add_argument(
        "--hue-region", choices=["frame", "hot"], default="frame",
        help="compute dominant hue over the whole frame, or only the active region",
    )
    ap.add_argument("--max-frames", type=int, default=0, help="0 = all")
    ap.add_argument("--stride", type=int, default=1, help="use every Nth frame")
    ap.add_argument("--caption-segments", type=int, default=6,
                    help="number of plain-language caption segments (accessibility)")
    ap.add_argument(
        "--normalize", default="brightness,hot,delta",
        help="comma list of features to auto-gain (hue & panX never are)",
    )
    args = ap.parse_args()

    if not args.source_url:
        print("WARNING: --source-url is empty. NASA requires every resource to be "
              "cited; set it to the NASA page you downloaded from.", file=sys.stderr)

    w, h = parse_size(args.size)
    files = find_frames(args.frames)
    if args.stride > 1:
        files = files[:: args.stride]
    if args.max_frames:
        files = files[: args.max_frames]
    if not files:
        sys.exit(f"No frames found in {args.frames}")

    print(f"[features] {len(files)} frames from {args.frames} @ {w}x{h}")

    raw = {k: [] for k in ("hue", "brightness", "hot", "panX", "delta")}
    prev = None
    for n, path in enumerate(files):
        rgb = fc.load_small(path, w, h)
        hh, ss, ll = fc.rgb_to_hsl(rgb)
        mask = fc.hot_mask(rgb, ll, mode=args.hot_mode, thr=args.hot_threshold)
        if args.hue_region == "hot" and mask.any():
            raw["hue"].append(fc.dominant_hue(hh[mask], ss[mask], ll[mask]))
        else:
            raw["hue"].append(fc.dominant_hue(hh, ss, ll))
        raw["brightness"].append(fc.brightness(ll))
        raw["hot"].append(fc.hot_ratio(mask))
        raw["panX"].append(fc.pan_x(mask))
        raw["delta"].append(fc.frame_delta(prev, rgb))
        prev = rgb
        if (n + 1) % 50 == 0 or n + 1 == len(files):
            print(f"  ...{n + 1}/{len(files)}")

    to_norm = {x.strip() for x in args.normalize.split(",") if x.strip()}
    norm_ranges = {}
    scaled = dict(raw)
    for key in ("brightness", "hot", "delta"):
        if key in to_norm:
            scaled[key], norm_ranges[key] = fc.autogain(raw[key])

    def r(x, nd):
        return round(float(x), nd)

    frames = [
        {
            "i": i,
            "hue": r(scaled["hue"][i], 1),
            "brightness": r(scaled["brightness"][i], 4),
            "hot": r(scaled["hot"][i], 4),
            "panX": r(scaled["panX"][i], 4),
            "delta": r(scaled["delta"][i], 4),
        }
        for i in range(len(files))
    ]

    captions = fc.describe_segments(frames, args.caption_segments)

    out = {
        "viz": args.viz,
        "title": args.title,
        "description": args.description,
        "source_url": args.source_url,
        "source": "frames",
        "fps": args.fps,
        "frame_count": len(frames),
        "analysis_size": [w, h],
        "hot_mode": args.hot_mode,
        "normalization": {k: [r(v[0], 6), r(v[1], 6)] for k, v in norm_ranges.items()},
        "captions": captions,
        "frames": frames,
    }

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    size_kb = os.path.getsize(args.out) / 1024
    print(f"[features] wrote {args.out} ({len(frames)} frames, {size_kb:.1f} KB)")

    for k in ("hue", "brightness", "hot", "panX", "delta"):
        col = [fr[k] for fr in frames]
        print(f"   {k:<10} min={min(col):.3f}  max={max(col):.3f}  spread={max(col)-min(col):.3f}")
    print(f"   captions: {len(captions)} segments")


if __name__ == "__main__":
    main()
