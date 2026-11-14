#!/usr/bin/env python3
"""
render_audio.py — render a features.json into an actual stereo WAV offline.

Why this lives in the backend: it gives the project a guaranteed, deterministic
audio artifact (for the 30-second demo video and as a fallback if the live Tone.js
app has any trouble during judging), and it is the *reference* sonification mapping
the browser engine mirrors. Pure numpy + the stdlib `wave` module — no network.

The mapping (same rules the Tone.js engine uses):
  hue  (0-360) -> which note in a major pentatonic scale  (always consonant)
  brightness   -> octave + loudness
  hot          -> harmonic richness (adds overtones / a pad)
  panX (0-1)   -> stereo position (equal-power pan)
  delta        -> a short accent when the scene changes sharply

    python render_audio.py --features public/features/co2.json --out public/audio/co2.wav
    python render_audio.py --features public/features/co2.json --step-ms 120 --max-seconds 30 --out public/audio/co2_demo.wav

SI/AI disclosure: this code was written with AI assistance. The audio it produces
is a deterministic function of NASA-derived features — it is NOT AI-generated audio.
"""
from __future__ import annotations

import argparse
import json
import os
import wave

import numpy as np

SR = 44100
PENTATONIC = [0, 2, 4, 7, 9]      # C major pentatonic (semitone offsets)
BASE_MIDI = 48                    # C3
OCT_MIN, OCT_SPAN = 0, 4          # brightness maps to octaves 0..4 above base


def midi_to_freq(m: float) -> float:
    return 440.0 * (2.0 ** ((m - 69) / 12.0))


def note_for(hue: float, brightness: float) -> float:
    deg = int(round((hue % 360) / 360.0 * (len(PENTATONIC) - 1)))
    octave = OCT_MIN + int(round(brightness * OCT_SPAN))
    return midi_to_freq(BASE_MIDI + 12 * octave + PENTATONIC[deg])


def env(n: int, attack=0.02, release=0.25) -> np.ndarray:
    """Simple attack/release envelope to avoid clicks between notes."""
    e = np.ones(n)
    a = max(1, int(SR * attack)); r = max(1, int(SR * release))
    a = min(a, n // 2); r = min(r, n // 2)
    e[:a] = np.linspace(0, 1, a)
    e[-r:] = np.linspace(1, 0, r)
    return e


def main():
    ap = argparse.ArgumentParser(description="features.json -> stereo WAV")
    ap.add_argument("--features", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--step-ms", type=int, default=150, help="duration per frame/note")
    ap.add_argument("--max-seconds", type=float, default=0, help="0 = no cap")
    ap.add_argument("--max-frames", type=int, default=0, help="0 = all")
    ap.add_argument("--gain", type=float, default=0.8, help="master gain 0-1")
    args = ap.parse_args()

    d = json.load(open(args.features))
    frames = d["frames"]
    if args.max_frames:
        frames = frames[: args.max_frames]
    if args.max_seconds:
        frames = frames[: max(1, int(args.max_seconds * 1000 / args.step_ms))]

    step = int(SR * args.step_ms / 1000)
    total = step * len(frames)
    left = np.zeros(total, dtype=np.float64)
    right = np.zeros(total, dtype=np.float64)
    t = np.arange(step) / SR

    for k, fr in enumerate(frames):
        hue = float(fr["hue"]); bright = float(fr["brightness"])
        hot = float(fr["hot"]); pan = float(fr["panX"]); delta = float(fr["delta"])
        f0 = note_for(hue, bright)
        amp = 0.12 + 0.6 * bright

        # fundamental + hot-weighted overtones
        voice = np.sin(2 * np.pi * f0 * t)
        voice += (0.5 * hot) * np.sin(2 * np.pi * 2 * f0 * t)
        voice += (0.3 * hot) * np.sin(2 * np.pi * 3 * f0 * t)
        voice *= amp * env(step)

        # delta accent: short bright pluck an octave up
        if delta > 0.5:
            acc_len = min(step, int(SR * 0.08))
            acc = (0.4 * delta) * np.sin(2 * np.pi * (f0 * 2) * t[:acc_len]) * env(acc_len, 0.002, 0.06)
            voice[:acc_len] += acc

        # equal-power stereo pan from panX
        lg = np.sqrt(max(0.0, 1.0 - pan)); rg = np.sqrt(max(0.0, pan))
        s = k * step
        left[s:s + step] += voice * lg
        right[s:s + step] += voice * rg

    # normalize to avoid clipping, apply master gain, 16-bit PCM
    peak = max(1e-9, float(np.max(np.abs(np.concatenate([left, right])))))
    scale = args.gain / peak
    inter = np.empty(total * 2, dtype=np.int16)
    inter[0::2] = np.clip(left * scale, -1, 1) * 32767
    inter[1::2] = np.clip(right * scale, -1, 1) * 32767

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with wave.open(args.out, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(inter.tobytes())

    dur = total / SR
    print(f"[audio] wrote {args.out}  ({dur:.1f}s, {len(frames)} notes, "
          f"{os.path.getsize(args.out)/1e6:.2f} MB, stereo {SR} Hz)")


if __name__ == "__main__":
    main()
