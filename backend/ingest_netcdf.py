#!/usr/bin/env python3
"""
ingest_netcdf.py — OPTIONAL: sonify real NASA gridded DATA VALUES (netCDF) into
the exact same features.json contract the frame pipeline produces.

Use this when you have an actual NASA data file (a lat-lon gridded netCDF with a
time axis) and want the music driven by the numbers themselves, not by pixels of
a rendered video. Each time step becomes one frame; the field's own values drive
the features. Because the output contract is identical, the sonification engine
and frontend are unchanged.

Note on the raw DYAMOND Phase II files:
    The 3km run at https://portal.nccs.nasa.gov/datashare/G5NR/DYAMONDv2/03KM/ is a
    c2880 cubed-sphere grid with 181 vertical levels — multi-GB per variable per
    step and NOT a simple lat-lon grid, so it is impractical to feed here directly
    and is not "visual frames". For this challenge, prefer the SVS-rendered DYAMOND
    frames (svs_fetch.py 5196) and cite GMAO/NCCS as the scientific source. This
    tool is for tractable lat-lon NASA products (e.g. a regridded/ subset slice).

    pip install xarray netCDF4
    python ingest_netcdf.py --src data/raw/some_nasa.nc --var CO2 \
        --viz co2-values --title "NASA CO2 (data values)" \
        --source-url https://portal.nccs.nasa.gov/datashare/... \
        --out public/features/co2_values.json
"""
from __future__ import annotations

import argparse
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from eicjukebox import features_core as fc  # noqa: E402


def pick_dim(dims, candidates):
    for c in candidates:
        for d in dims:
            if c == d.lower():
                return d
    for c in candidates:
        for d in dims:
            if c in d.lower():
                return d
    return None


def main():
    ap = argparse.ArgumentParser(description="NASA gridded netCDF values -> features.json")
    ap.add_argument("--src", required=True, help="input .nc / .nc4 file")
    ap.add_argument("--var", required=True, help="variable name to sonify")
    ap.add_argument("--viz", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--title", default="")
    ap.add_argument("--description", default="")
    ap.add_argument("--source-url", default="")
    ap.add_argument("--fps", type=int, default=12)
    ap.add_argument("--level", type=int, default=-1,
                    help="vertical level index if the var has one; -1 = mean over levels")
    ap.add_argument("--hot-quantile", type=float, default=0.75,
                    help="'hot' = fraction of cells above this quantile of the field")
    ap.add_argument("--max-frames", type=int, default=0, help="0 = all time steps")
    ap.add_argument("--caption-segments", type=int, default=6)
    args = ap.parse_args()

    try:
        import xarray as xr
    except ImportError:
        sys.exit("Install deps first:  pip install xarray netCDF4")

    if not args.source_url:
        print("WARNING: --source-url empty; NASA requires every resource to be cited.",
              file=sys.stderr)

    ds = xr.open_dataset(args.src)
    if args.var not in ds.variables:
        sys.exit(f"Variable '{args.var}' not in file. Available: {list(ds.data_vars)}")
    da = ds[args.var]
    dims = list(da.dims)
    tdim = pick_dim(dims, ["time", "t"])
    latd = pick_dim(dims, ["lat", "latitude", "y"])
    lond = pick_dim(dims, ["lon", "longitude", "x"])
    levd = pick_dim(dims, ["lev", "level", "height", "z", "plev"])
    if not latd or not lond:
        sys.exit(f"Could not find lat/lon dims in {dims}")

    if levd and levd in da.dims:
        da = da.mean(levd) if args.level < 0 else da.isel({levd: args.level})

    # build the stack of 2D (lat, lon) slices
    if tdim and tdim in da.dims:
        n = da.sizes[tdim]
        if args.max_frames:
            n = min(n, args.max_frames)
        slices = [da.isel({tdim: i}).values.astype("float64") for i in range(n)]
    else:
        slices = [da.values.astype("float64")]
    print(f"[netcdf] {args.var}: {len(slices)} time step(s), grid "
          f"{slices[0].shape} (lat x lon)")

    # global normalization across the whole sequence (ignore NaNs)
    allv = np.concatenate([s[np.isfinite(s)].ravel() for s in slices]) if slices else np.array([0.0])
    vmin, vmax = float(np.nanmin(allv)), float(np.nanmax(allv))
    rng = (vmax - vmin) or 1.0

    def norm(s):
        out = (s - vmin) / rng
        return np.clip(np.nan_to_num(out, nan=0.0), 0.0, 1.0)

    # ONE fixed 'hot' threshold for the whole series (global quantile), so that
    # 'hot' grows as the real field intensifies instead of staying ~constant.
    thr = float(np.quantile((allv - vmin) / rng, args.hot_quantile))

    raw = {k: [] for k in ("hue", "brightness", "hot", "panX", "delta")}
    prev = None
    # lon is the last axis for a (lat, lon) slice
    for s in slices:
        f = norm(s)
        mask = f >= thr
        raw["brightness"].append(float(f.mean()))
        raw["hot"].append(float(mask.mean()))
        # horizontal (lon) centroid of hot cells, 0..1
        if mask.any():
            cols = np.nonzero(mask.any(axis=0))[0]
            _, cc = np.nonzero(mask)
            raw["panX"].append(float(cc.mean() / (f.shape[1] - 1)) if f.shape[1] > 1 else 0.5)
        else:
            raw["panX"].append(0.5)
        raw["hue"].append(fc.value_to_hue(float(f.mean())))
        raw["delta"].append(0.0 if prev is None else float(np.abs(f - prev).mean()))
        prev = f

    b_s, b_r = fc.autogain(raw["brightness"])
    h_s, h_r = fc.autogain(raw["hot"])
    d_s, d_r = fc.autogain(raw["delta"])

    def r(x, nd):
        return round(float(x), nd)

    frames = [{
        "i": i,
        "hue": r(raw["hue"][i], 1),
        "brightness": r(b_s[i], 4),
        "hot": r(h_s[i], 4),
        "panX": r(raw["panX"][i], 4),
        "delta": r(d_s[i], 4),
    } for i in range(len(slices))]

    out = {
        "viz": args.viz,
        "title": args.title,
        "description": args.description,
        "source_url": args.source_url,
        "source": "netcdf",
        "variable": args.var,
        "value_range": [r(vmin, 6), r(vmax, 6)],
        "fps": args.fps,
        "frame_count": len(frames),
        "normalization": {"brightness": [r(b_r[0], 6), r(b_r[1], 6)],
                          "hot": [r(h_r[0], 6), r(h_r[1], 6)],
                          "delta": [r(d_r[0], 6), r(d_r[1], 6)]},
        "captions": fc.describe_segments(frames, args.caption_segments),
        "frames": frames,
    }
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"[netcdf] wrote {args.out} ({len(frames)} frames) "
          f"value_range=[{vmin:.3g},{vmax:.3g}]")


if __name__ == "__main__":
    main()
