#!/usr/bin/env python3
"""
verify_output.py — validate the backend's output before you ship/submit.

Checks every features.json referenced by the manifest (and any loose ones) against
the frozen contract: field names/ranges, frame_count, sequential indices, a
non-empty accessibility caption track, a NASA citation (source_url), that the
features actually move, and — for frame-sourced vizzes — that the frame images
exist. Prints a per-visualization report and exits non-zero on any failure, so it
doubles as a CI gate.

    python verify_output.py                 # checks ./public
    python verify_output.py --dir public --include-mock
"""
from __future__ import annotations

import argparse
import glob
import json
import os
import sys

REQUIRED = {"i", "hue", "brightness", "hot", "panX", "delta"}
UNIT = ("brightness", "hot", "panX", "delta")


class Report:
    def __init__(self):
        self.fail = 0
        self.warn = 0

    def ok(self, msg):
        print(f"   \033[32m✓\033[0m {msg}")

    def bad(self, msg):
        self.fail += 1
        print(f"   \033[31m✗ {msg}\033[0m")

    def warning(self, msg):
        self.warn += 1
        print(f"   \033[33m! {msg}\033[0m")


def check_features(path, rep: Report, frames_root=None, frame_pattern=None):
    print(f"\n• {os.path.relpath(path)}")
    try:
        d = json.load(open(path))
    except Exception as e:
        rep.bad(f"not valid JSON: {e}")
        return
    frames = d.get("frames")
    if not frames:
        rep.bad("no frames array")
        return

    # per-frame contract
    bad_fields = bad_range = 0
    for n, fr in enumerate(frames):
        if not REQUIRED <= set(fr):
            bad_fields += 1
        if not (0 <= fr.get("hue", -1) <= 360):
            bad_range += 1
        for k in UNIT:
            v = fr.get(k, -1)
            if not (0.0 <= v <= 1.0):
                bad_range += 1
        if fr.get("i") != n:
            bad_fields += 1
    rep.ok(f"{len(frames)} frames") if not bad_fields else rep.bad(f"{bad_fields} frames with wrong/missing fields or index")
    rep.ok("all values in range (hue 0-360, others 0-1)") if not bad_range else rep.bad(f"{bad_range} values out of range")

    if d.get("frame_count") == len(frames):
        rep.ok(f"frame_count matches ({len(frames)})")
    else:
        rep.bad(f"frame_count={d.get('frame_count')} != {len(frames)} frames")

    # citation
    su = d.get("source_url", "")
    if su.startswith("http"):
        rep.ok(f"NASA citation present: {su}")
    else:
        rep.bad("source_url empty — NASA requires every resource to be cited")

    # accessibility captions
    caps = d.get("captions")
    rep.ok(f"accessibility captions present ({len(caps)} segments)") if caps else rep.bad("no accessibility captions")

    # movement
    spreads = {k: max(f[k] for f in frames) - min(f[k] for f in frames) for k in UNIT}
    if any(v > 0.1 for v in spreads.values()):
        rep.ok("features move: " + ", ".join(f"{k} {spreads[k]:.2f}" for k in UNIT))
    else:
        rep.warning("features barely move — retune --hot-mode/--hot-threshold/--hue-region: "
                    + ", ".join(f"{k} {spreads[k]:.2f}" for k in UNIT))

    # frames exist (frame-sourced only)
    if d.get("source", "frames") == "frames" and frame_pattern and frames_root:
        first = os.path.join(frames_root, frame_pattern % 0)
        last = os.path.join(frames_root, frame_pattern % (len(frames) - 1))
        if os.path.exists(first) and os.path.exists(last):
            rep.ok("referenced frame images exist")
        else:
            rep.bad(f"frame images missing (expected {os.path.relpath(first)} … {os.path.relpath(last)})")


def main():
    ap = argparse.ArgumentParser(description="Validate backend output")
    ap.add_argument("--dir", default="public")
    ap.add_argument("--include-mock", action="store_true")
    args = ap.parse_args()
    rep = Report()

    man = os.path.join(args.dir, "manifest.json")
    checked = set()
    if os.path.exists(man):
        print(f"Reading {man}")
        m = json.load(open(man))
        vizzes = m.get("visualizations", [])
        print(f"   manifest lists {len(vizzes)} visualization(s)")
        for v in vizzes:
            fpath = os.path.join(args.dir, v.get("features", ""))
            pat = v.get("frame_pattern")
            froot = args.dir if pat else None
            check_features(fpath, rep, frames_root=froot, frame_pattern=pat)
            checked.add(os.path.abspath(fpath))
    else:
        rep.warning(f"no manifest.json in {args.dir} (run make_manifest.py)")

    for fpath in sorted(glob.glob(os.path.join(args.dir, "features", "*.json"))):
        if os.path.abspath(fpath) in checked:
            continue
        name = os.path.splitext(os.path.basename(fpath))[0]
        if name == "mock" and not args.include_mock:
            print(f"\n• {os.path.relpath(fpath)}  (placeholder — skipped; use --include-mock)")
            continue
        check_features(fpath, rep)

    print("\n" + "=" * 56)
    if rep.fail:
        print(f"RESULT: \033[31mFAIL\033[0m  ({rep.fail} error(s), {rep.warn} warning(s))")
        sys.exit(1)
    print(f"RESULT: \033[32mPASS\033[0m  ({rep.warn} warning(s))")


if __name__ == "__main__":
    main()
