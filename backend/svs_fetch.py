#!/usr/bin/env python3
"""
svs_fetch.py — fetch NASA Scientific Visualization Studio assets by page id.

How NASA download works (the part you asked about):
  Every SVS visualization has a machine-readable JSON manifest at
      https://svs.gsfc.nasa.gov/api/<ID>
  where <ID> is the number in the page URL (e.g. 5196 for
  https://svs.gsfc.nasa.gov/5196 = "DYAMOND Global Carbon Dioxide").
  Inside it, media_groups[].items[].instance lists every downloadable asset
  with a direct `url` and a `media_type` of "Movie", "Frames", "Image", etc.
  This script reads that manifest, so you never guess a URL.

Two media types matter to us:
  * "Movie"  -> a single .mp4. BEST for a hackathon: one small GET, then let
               ffmpeg (extract_frames.py) pull the frames. Pick a low resolution.
  * "Frames" -> a server directory of full-res PNGs (often 5760x3240 hyperwall).
               Huge. Only use if you specifically need original PNGs; grab with
               `wget -r -np -nH --cut-dirs=6 -A png <dir-url>`.

Pure stdlib, no pip install needed.

  List everything (do this first):
      python svs_fetch.py 5196 --list
  Download a small movie (<=1080p, smallest file) into data/raw/:
      python svs_fetch.py 5196 --max-height 1080 --out-dir data/raw
  Pick a specific asset by filename substring:
      python svs_fetch.py 5196 --pick orbit_1080p30_h265
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.request

API = "https://svs.gsfc.nasa.gov/api/{}"
UA = "Mozilla/5.0 (EIC-Jukebox/1.0; NASA Space Apps 2026) Python-urllib"
SIZE_RE = re.compile(r"([^|()\[\]]+?)\s*\((\d+)x(\d+)\)\s*\[([\d.]+\s*[KMGT]?B)\]")


def https(url: str) -> str:
    return "https://" + url[len("http://"):] if url.startswith("http://") else url


def get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def human_sizes(description: str) -> dict:
    """Map filename -> human size string parsed from the page description blob."""
    out = {}
    for m in SIZE_RE.finditer(description or ""):
        name = m.group(1).strip().split("/")[-1]
        out[name] = m.group(4).replace(" ", "")
    return out


def collect(manifest: dict):
    """Return (movies, frame_dirs) as lists of dicts {filename,url,w,h,pixels,size}."""
    sizes = human_sizes(manifest.get("description", ""))
    movies, frames = [], []
    for grp in manifest.get("media_groups", []):
        for item in grp.get("items", []):
            inst = item.get("instance") or {}
            mt = inst.get("media_type")
            if mt not in ("Movie", "Frames"):
                continue
            fn = inst.get("filename", "")
            rec = {
                "filename": fn,
                "url": https(inst.get("url", "")),
                "w": inst.get("width") or 0,
                "h": inst.get("height") or 0,
                "pixels": inst.get("pixels") or 0,
                "size": sizes.get(os.path.basename(inst.get("url", "").rstrip("/")), sizes.get(fn, "?")),
            }
            (movies if mt == "Movie" else frames).append(rec)
    # de-dup movies by url
    seen, uniq = set(), []
    for m in movies:
        if m["url"] not in seen:
            seen.add(m["url"]); uniq.append(m)
    uniq.sort(key=lambda r: (r["h"], r["pixels"]))
    return uniq, frames


def download(url: str, out_dir: str) -> str:
    os.makedirs(out_dir, exist_ok=True)
    dest = os.path.join(out_dir, os.path.basename(url))
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=120) as r:
        total = int(r.headers.get("Content-Length", 0))
        done = 0
        with open(dest, "wb") as f:
            while True:
                chunk = r.read(1 << 16)
                if not chunk:
                    break
                f.write(chunk)
                done += len(chunk)
                if total:
                    pct = 100 * done / total
                    print(f"\r  downloading {os.path.basename(url)} {pct:5.1f}% "
                          f"({done/1e6:.1f}/{total/1e6:.1f} MB)", end="", flush=True)
        print()
    return dest


def main():
    ap = argparse.ArgumentParser(description="Fetch NASA SVS assets by page id")
    ap.add_argument("svs_id", help="SVS page id, e.g. 5196")
    ap.add_argument("--list", action="store_true", help="list assets and exit")
    ap.add_argument("--out-dir", default="data/raw")
    ap.add_argument("--max-height", type=int, default=1080, help="cap movie height")
    ap.add_argument("--min-height", type=int, default=480, help="floor movie height")
    ap.add_argument("--pick", default="", help="download the movie whose filename contains this")
    args = ap.parse_args()

    manifest = get_json(API.format(args.svs_id))
    page = https(manifest.get("url", f"https://svs.gsfc.nasa.gov/{args.svs_id}/")).rstrip("/")
    print(f"# {manifest.get('title','(untitled)')}")
    print(f"# source page (cite this): {page}")
    movies, frames = collect(manifest)

    if args.list or (not args.pick and not movies):
        print("\nMOVIES (prefer these — one file, ffmpeg extracts frames):")
        for m in movies:
            print(f"  [{m['h']:>5}p] {m['size']:>8}  {m['filename']}\n           {m['url']}")
        print("\nFRAME DIRECTORIES (full-res PNG sequences — usually huge):")
        for fr in frames:
            dim = f"{fr['w']}x{fr['h']}" if fr["w"] else "?"
            print(f"  [{dim:>11}] {fr['url']}")
        if args.list:
            return

    # choose a movie
    chosen = None
    if args.pick:
        cands = [m for m in movies if args.pick in m["filename"]]
        chosen = cands[0] if cands else None
        if not chosen:
            sys.exit(f"No movie matched --pick '{args.pick}'")
    else:
        inrange = [m for m in movies if args.min_height <= m["h"] <= args.max_height]
        chosen = inrange[0] if inrange else (movies[0] if movies else None)
    if not chosen:
        sys.exit("No movie assets found; use --list and grab a Frames dir with wget.")

    print(f"\nChosen: [{chosen['h']}p] {chosen['size']} {chosen['filename']}")
    dest = download(chosen["url"], args.out_dir)
    print(f"Saved -> {dest}")
    try:
        with open(os.path.join(args.out_dir, ".latest"), "w") as _f:
            _f.write(dest)
    except OSError:
        pass
    print("\nNext:")
    print(f"  python extract_frames.py --src {dest} --viz <name> --out public/frames/<name>")


if __name__ == "__main__":
    main()
