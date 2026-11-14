#!/usr/bin/env python3
"""
make_manifest.py — build public/manifest.json: the index the UI's picker loads
and the submission cites. Scans the features + frames you've produced and records, per
visualization: id, title, fps, frame count, the frame filename pattern, a one-line
description, and the NASA source URL (for captions AND citations — same string).

    python make_manifest.py --features-dir public/features --frames-dir public/frames \
        --out public/manifest.json
"""
from __future__ import annotations

import argparse
import glob
import json
import os


def frame_pattern(frames_dir: str, viz: str):
    folder = os.path.join(frames_dir, viz)
    if not os.path.isdir(folder):
        return None, 0
    imgs = sorted(f for f in os.listdir(folder) if f.endswith((".jpg", ".png", ".webp")))
    if not imgs:
        return None, 0
    first = imgs[0]
    # turn co2_0000.jpg -> frames/co2/co2_%04d.jpg
    import re
    m = re.match(r"(.*?)(\d+)(\.\w+)$", first)
    pat = f"{m.group(1)}%0{len(m.group(2))}d{m.group(3)}" if m else first
    rel = os.path.join(os.path.basename(frames_dir.rstrip('/')), viz, pat)
    return rel.replace(os.sep, "/"), len(imgs)


def main():
    ap = argparse.ArgumentParser(description="Build picker manifest.json")
    ap.add_argument("--features-dir", default="public/features")
    ap.add_argument("--frames-dir", default="public/frames")
    ap.add_argument("--out", default="public/manifest.json")
    ap.add_argument("--include-mock", action="store_true")
    args = ap.parse_args()

    entries = []
    for fpath in sorted(glob.glob(os.path.join(args.features_dir, "*.json"))):
        name = os.path.splitext(os.path.basename(fpath))[0]
        if name == "mock" and not args.include_mock:
            continue
        with open(fpath) as f:
            feat = json.load(f)
        viz = feat.get("viz", name)
        pat, count = frame_pattern(args.frames_dir, name)
        entries.append({
            "id": name,
            "viz": viz,
            "title": feat.get("title", name),
            "description": feat.get("description", feat.get("title", "")),
            "fps": feat.get("fps", 12),
            "frame_count": feat.get("frame_count", count),
            "source": feat.get("source", "frames"),
            "has_captions": bool(feat.get("captions")),
            "features": os.path.relpath(fpath, os.path.dirname(args.out) or ".").replace(os.sep, "/"),
            "frame_pattern": pat,
            "source_url": feat.get("source_url", ""),
        })

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump({"visualizations": entries}, f, indent=2)
    print(f"[manifest] wrote {args.out} with {len(entries)} visualization(s)")
    for e in entries:
        print(f"   - {e['id']}: {e['frame_count']} frames, src={e['source_url'] or '(set --source-url!)'}")


if __name__ == "__main__":
    main()
