"""
Core computer-vision math for the Earth Information Jukebox.

Everything here is pure functions over numpy arrays so it can be unit tested
without touching the network or the filesystem. The browser-side version in the
Team Build Guide computes the SAME quantities with getImageData(); producing them
in Python just means the heavy pixel work happens once, offline, and the frontend
loads a tiny features.json instead of crunching pixels on every device.

Feature contract (one object per frame), frozen with the sonification engine:
    { "i", "hue"(0-360), "brightness"(0-1), "hot"(0-1), "panX"(0-1), "delta"(0-1) }
"""

from __future__ import annotations

import numpy as np
from PIL import Image


# --------------------------------------------------------------------------- #
# Loading / downsampling
# --------------------------------------------------------------------------- #
def load_small(path: str, w: int = 96, h: int = 48) -> np.ndarray:
    """Load a frame and downsample to (h, w, 3) float RGB in 0..1.

    The downsample is the single most important performance trick: a full 1080p
    frame is ~2M pixels; at 96x48 it is ~4.6k. Averaging down preserves the
    colour/brightness story we care about at a fraction of the cost.
    """
    img = Image.open(path).convert("RGB").resize((w, h), Image.BILINEAR)
    return np.asarray(img, dtype=np.float32) / 255.0


# --------------------------------------------------------------------------- #
# Colour space
# --------------------------------------------------------------------------- #
def rgb_to_hsl(rgb: np.ndarray):
    """Vectorised RGB(0..1) -> (hue 0..360, sat 0..1, light 0..1), each HxW."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    d = mx - mn
    l = (mx + mn) / 2.0

    h = np.zeros_like(mx)
    nz = d > 1e-9
    # piecewise hue, guarded so we never divide by zero
    dd = np.where(nz, d, 1.0)
    rc = (mx - r) / dd
    gc = (mx - g) / dd
    bc = (mx - b) / dd
    h = np.where((mx == r) & nz, (bc - gc), h)
    h = np.where((mx == g) & nz, (2.0 + rc - bc), h)
    h = np.where((mx == b) & nz, (4.0 + gc - rc), h)
    h = (h / 6.0) % 1.0 * 360.0

    s = np.zeros_like(mx)
    denom = 1.0 - np.abs(2.0 * l - 1.0)
    s = np.where(nz & (denom > 1e-9), d / np.where(denom > 1e-9, denom, 1.0), s)
    return h, s, l


# --------------------------------------------------------------------------- #
# Per-frame features
# --------------------------------------------------------------------------- #
def dominant_hue(h, s, l, bins: int = 36, sat_min: float = 0.12) -> float:
    """Dominant colour family (0-360).

    Plain RGB averaging washes a varied map to grey, so instead we build a hue
    histogram over sufficiently-saturated pixels, weighted by saturation*light,
    and take the peak bin. Falls back to a circular mean when the frame is almost
    colourless (e.g. a near-black globe), so hue never jumps to a meaningless 0.
    """
    sel = s > sat_min
    if int(sel.sum()) < max(4, int(0.01 * h.size)):
        ang = np.deg2rad(h.ravel())
        return float(np.rad2deg(np.arctan2(np.sin(ang).mean(), np.cos(ang).mean())) % 360.0)
    weight = (s * (0.4 + 0.6 * l))[sel]
    hist, edges = np.histogram(h[sel], bins=bins, range=(0.0, 360.0), weights=weight)
    k = int(np.argmax(hist))
    return float((edges[k] + edges[k + 1]) / 2.0)


def brightness(l) -> float:
    """Average luminance, 0-1."""
    return float(l.mean())


def hot_mask(rgb, l, mode: str = "bright", thr: float = 0.6) -> np.ndarray:
    """Boolean mask of 'high value' pixels.

    mode='bright' : luminance above thr  -> good for maps where intensity reads as
                    brightness on a dark background (e.g. DYAMOND CO2 plumes,
                    night lights).
    mode='warm'   : red-dominant pixels  -> good for fire / black-carbon / aerosol
                    maps where the story lives in the reds.
    Tune thr by eyeballing a few frames; a good threshold is where the data-honesty (Validity) score is earned
    the 'Validity' score.
    """
    if mode == "warm":
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        return (r > 0.55) & (r > g + 0.12) & (r > b + 0.12)
    return l > thr


def hot_ratio(mask: np.ndarray) -> float:
    """Share of high-value pixels, 0-1 — often the strongest musical driver."""
    return float(mask.mean())


def pan_x(mask: np.ndarray) -> float:
    """Left-right centroid of the hot region, 0-1 (0.5 = centre when empty)."""
    xs = np.nonzero(mask.any(axis=0))[0] if mask.ndim == 2 else np.array([])
    if mask.any():
        _, cols = np.nonzero(mask)
        w = mask.shape[1]
        return float(cols.mean() / (w - 1)) if w > 1 else 0.5
    return 0.5


def frame_delta(prev_rgb, cur_rgb) -> float:
    """Mean absolute change vs the previous frame, raw (0-1 before auto-gain)."""
    if prev_rgb is None:
        return 0.0
    return float(np.abs(cur_rgb - prev_rgb).mean())


# --------------------------------------------------------------------------- #
# Sequence-level normalisation (auto-gain)
# --------------------------------------------------------------------------- #
def autogain(values):
    """Rescale a 1-D sequence to 0-1 by its own min/max.

    This is why the engine never has to retune between visualisations: a subtle
    dataset still spans the full musical range. Returns (scaled_list, (lo, hi)).
    Hue (cyclic, 0-360) and panX (geometric, 0.5=centre) are deliberately NOT
    auto-gained — rescaling them would destroy their meaning.
    """
    v = np.asarray(values, dtype=np.float64)
    lo, hi = float(v.min()), float(v.max())
    if hi - lo < 1e-9:
        return [0.0] * len(v), (lo, hi)
    return ((v - lo) / (hi - lo)).tolist(), (lo, hi)


# --------------------------------------------------------------------------- #
# Value -> hue (for gridded data that has no intrinsic colour)
# --------------------------------------------------------------------------- #
def value_to_hue(v: float) -> float:
    """Map a 0..1 data value to a hue 0..360 (low=blue 240 -> high=red 0).

    Raw NASA grids (netCDF/GeoTIFF) carry numbers, not colours, so when we
    sonify data values directly we derive hue from the value itself. This keeps
    the exact same feature contract the frame-based path produces, so the
    sonification engine is identical either way.
    """
    v = max(0.0, min(1.0, float(v)))
    return 240.0 * (1.0 - v)


# --------------------------------------------------------------------------- #
# Data accessibility: plain-language description of the data's movement
# --------------------------------------------------------------------------- #
def describe_segments(frames, n_segments: int = 6):
    """Turn the feature array into short, screen-reader-friendly captions.

    This is a data-accessibility feature: it states, in words, what the data is
    doing across the piece ("intensity rising, activity moving east, sharp
    change") so a blind or low-vision listener gets the same narrative a sighted
    viewer reads off the map. The frontend can show these and announce them via
    an aria-live region, timed to the frame ranges.
    """
    N = len(frames)
    if N == 0:
        return []
    n = max(1, min(n_segments, N))
    bounds = [round(k * N / n) for k in range(n + 1)]

    def trend(a, b):
        d = b - a
        if abs(d) < 0.08:
            return "steady"
        return "rising" if d > 0 else "falling"

    caps = []
    for k in range(n):
        s, e = bounds[k], max(bounds[k], bounds[k + 1] - 1)
        seg = frames[s:e + 1] or [frames[s]]
        b0, b1 = seg[0]["brightness"], seg[-1]["brightness"]
        h0, h1 = seg[0]["hot"], seg[-1]["hot"]
        px0, px1 = seg[0]["panX"], seg[-1]["panX"]
        maxd = max(f["delta"] for f in seg)
        parts = [f"intensity {trend(h0, h1)}", f"brightness {trend(b0, b1)}"]
        if px1 - px0 > 0.12:
            parts.append("activity moving right")
        elif px0 - px1 > 0.12:
            parts.append("activity moving left")
        if maxd > 0.6:
            parts.append("a sharp change")
        text = ", ".join(parts)
        caps.append({"start": s, "end": e, "text": text[:1].upper() + text[1:]})
    return caps
