#!/usr/bin/env python3
"""
Offline smoke test for the data pipeline. Generates tiny SYNTHETIC inputs
(NOT NASA data — just fixtures) and checks that both the frame path and the
netCDF path produce a valid feature contract with moving, normalized values and
accessibility captions. Run: python tests/smoke_test.py
"""
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REQUIRED = {"i", "hue", "brightness", "hot", "panX", "delta"}


def check_contract(path, min_frames=3):
    d = json.load(open(path))
    assert d["frames"], "no frames"
    assert len(d["frames"]) >= min_frames
    for fr in d["frames"]:
        assert REQUIRED <= set(fr), f"missing fields: {REQUIRED - set(fr)}"
        assert 0 <= fr["hue"] <= 360
        for k in ("brightness", "hot", "panX", "delta"):
            assert 0.0 <= fr[k] <= 1.0, f"{k} out of range: {fr[k]}"
    assert d.get("captions"), "no accessibility captions"
    spreads = {k: max(f[k] for f in d["frames"]) - min(f[k] for f in d["frames"])
               for k in ("brightness", "hot", "panX")}
    assert any(v > 0.1 for v in spreads.values()), f"features do not move: {spreads}"
    return d


def main():
    tmp = tempfile.mkdtemp()
    # --- frame path ---
    import numpy as np
    from PIL import Image
    fdir = os.path.join(tmp, "frames")
    os.makedirs(fdir)
    for i in range(16):
        t = i / 15
        img = np.zeros((120, 200, 3), np.uint8)
        img[:, :, 2] = int((0.15 + 0.1 * t) * 255)
        cx = int(200 * (0.2 + 0.6 * t)); rad = int(8 + 40 * t)
        yy, xx = np.mgrid[0:120, 0:200]
        blob = (xx - cx) ** 2 + (yy - 60) ** 2 < rad * rad
        img[blob] = (220, int(60 + 60 * t), 20)
        Image.fromarray(img).save(os.path.join(fdir, f"f_{i:04d}.png"))
    out1 = os.path.join(tmp, "frames.json")
    subprocess.run([sys.executable, os.path.join(ROOT, "extract_features.py"),
                    "--frames", fdir, "--viz", "smoke-frames", "--source-url", "https://svs.gsfc.nasa.gov/5196",
                    "--hot-mode", "warm", "--hue-region", "hot", "--out", out1], check=True)
    check_contract(out1)
    print("PASS  frame path -> valid contract + captions")

    # --- netcdf path ---
    import xarray as xr
    T, LA, LO = 12, 60, 120
    data = np.zeros((T, LA, LO))
    for t in range(T):
        cx = int(LO * (0.2 + 0.6 * t / (T - 1))); rad = 6 + 20 * t / (T - 1)
        yy, xx = np.mgrid[0:LA, 0:LO]
        data[t] = 380 + 40 * t / (T - 1) + 50 * np.exp(-((xx - cx) ** 2 + (yy - 30) ** 2) / (2 * rad * rad))
    nc = os.path.join(tmp, "s.nc")
    xr.Dataset({"CO2": (["time", "lat", "lon"], data)},
               coords={"time": np.arange(T), "lat": np.linspace(-89, 89, LA),
                       "lon": np.linspace(-179, 179, LO)}).to_netcdf(nc)
    out2 = os.path.join(tmp, "nc.json")
    subprocess.run([sys.executable, os.path.join(ROOT, "ingest_netcdf.py"),
                    "--src", nc, "--var", "CO2", "--viz", "smoke-nc",
                    "--source-url", "https://portal.nccs.nasa.gov/datashare/G5NR/DYAMONDv2/03KM/",
                    "--out", out2], check=True)
    check_contract(out2)
    print("PASS  netcdf path -> valid contract + captions")
    print("\nALL SMOKE TESTS PASSED")


if __name__ == "__main__":
    main()
