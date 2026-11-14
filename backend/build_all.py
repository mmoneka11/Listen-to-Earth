#!/usr/bin/env python3
"""
build_all.py — build every visualization declared in datasets.yaml, end to end.

For each entry: fetch the NASA movie -> extract frames -> extract features
(-> optionally render audio). Then rebuild the manifest and run the verifier once.
This is the single command that produces the whole public/ payload for the app.

    python build_all.py                 # build everything in datasets.yaml
    python build_all.py --audio         # also render a WAV per visualization
    python build_all.py --skip-fetch    # reuse already-downloaded movies
    python build_all.py --dry-run       # print the commands without running
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys

import yaml

PY = sys.executable
RAW = "data/raw"


def run(cmd, dry):
    print("  $ " + " ".join(cmd))
    if not dry:
        subprocess.run(cmd, check=True)


def main():
    ap = argparse.ArgumentParser(description="Build all visualizations from datasets.yaml")
    ap.add_argument("--config", default="datasets.yaml")
    ap.add_argument("--audio", action="store_true", help="also render a WAV per viz")
    ap.add_argument("--skip-fetch", action="store_true", help="reuse downloaded movies")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    cfg = yaml.safe_load(open(args.config))
    vizzes = cfg.get("visualizations", [])
    if not vizzes:
        sys.exit("No visualizations in config.")
    print(f"Building {len(vizzes)} visualization(s) from {args.config}\n")

    for v in vizzes:
        vid, viz = str(v["id"]), v["viz"]
        print(f"=== {viz} (SVS {vid}) ===")
        if not args.skip_fetch:
            run([PY, "svs_fetch.py", vid, "--out-dir", RAW], args.dry_run)
        latest = os.path.join(RAW, ".latest")
        src = open(latest).read().strip() if (os.path.exists(latest) and not args.dry_run) \
            else f"{RAW}/<downloaded_{vid}.mp4>"
        run([PY, "extract_frames.py", "--src", src, "--viz", viz,
             "--out", f"public/frames/{viz}", "--fps", str(v.get("fps", 12)),
             "--scale", v.get("scale", "640x360"), "--format", "jpg",
             "--max-frames", str(v.get("max_frames", 320))], args.dry_run)
        feat_cmd = [PY, "extract_features.py", "--frames", f"public/frames/{viz}",
                    "--viz", f"{viz}-svs{vid}", "--title", v.get("title", viz),
                    "--description", v.get("description", ""),
                    "--source-url", v.get("source_url", ""),
                    "--fps", str(v.get("fps", 12)),
                    "--hot-mode", v.get("hot_mode", "bright"),
                    "--hot-threshold", str(v.get("hot_threshold", 0.6)),
                    "--hue-region", v.get("hue_region", "frame"),
                    "--out", f"public/features/{viz}.json"]
        run(feat_cmd, args.dry_run)
        if args.audio:
            run([PY, "render_audio.py", "--features", f"public/features/{viz}.json",
                 "--out", f"public/audio/{viz}.wav"], args.dry_run)
        print()

    print("=== manifest + verify ===")
    run([PY, "make_manifest.py"], args.dry_run)
    run([PY, "verify_output.py"], args.dry_run)


if __name__ == "__main__":
    main()
