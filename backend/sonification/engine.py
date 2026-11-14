#!/usr/bin/env python3
"""
Listen to Earth — Production-Grade Sonification Engine
NASA Space Apps Challenge 2026: The Earth Information Jukebox

Converts NASA Earth science visual frames and multidimensional climate arrays
into studio-quality 44.1kHz stereo soundscapes.

Mapping Specification:
  1. Value / Hue        -> C Major Pentatonic Scale Pitch (C3 to A6, always consonant)
  2. Brightness         -> Octave transposition & low-pass formant filter cutoff
  3. Hot / Coverage     -> Rhythmic pulse subdivision layers (2, 4, 8 pulses per frame)
  4. Centroid Longitude -> Constant-power binaural stereo panning (West Left <-> East Right)
  5. Delta / Event Flag -> Dual harmonic chime (A5/A6) & shaped transient noise
  6. Sub-Drone          -> Continuous 65.41 Hz (C2) grounding fundamental
  7. Master Dynamics    -> Soft-knee brickwall limiter preventing digital clipping
"""

from __future__ import annotations

import os
import sys
import json
import math
import io
import logging
from pathlib import Path
from typing import Dict, Any, List, Tuple, Union, Optional
import numpy as np
from scipy.io import wavfile

# Configure logger
logger = logging.getLogger("sonification")
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter("[%(levelname)s] %(name)s: %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

# Default fallback config if mapping_config.json is missing
DEFAULT_PENTATONIC_FREQS = [
    130.81, 146.83, 164.81, 196.00, 220.00,  # C3 - A3
    261.63, 293.66, 329.63, 392.00, 440.00,  # C4 - A4 (Mid C)
    523.25, 587.33, 659.25, 783.99, 880.00,  # C5 - A5
    1046.50, 1174.66, 1318.51, 1567.98, 1760.00  # C6 - A6
]

CONFIG_FILE = Path(__file__).resolve().parent / "mapping_config.json"
MAPPING_CONFIG: Dict[str, Any] = {}
if CONFIG_FILE.exists():
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            MAPPING_CONFIG = json.load(f)
    except Exception as e:
        logger.warning("Could not parse mapping_config.json: %s. Using defaults.", e)

PENTATONIC_FREQS: List[float] = MAPPING_CONFIG.get("scale", {}).get("frequencies_hz", DEFAULT_PENTATONIC_FREQS)
DEFAULT_SAMPLE_RATE: int = int(MAPPING_CONFIG.get("master", {}).get("sample_rate", 44100))

def clean_float(val: Any, default: float = 0.5, vmin: float = 0.0, vmax: float = 1.0) -> float:
    """Sanitizes incoming numerical values, catching None, NaN, and Inf."""
    if val is None:
        return default
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return default
        return float(np.clip(f, vmin, vmax))
    except (ValueError, TypeError):
        return default

def get_frequency_for_value(val_norm: float, brightness: float = 0.5) -> float:
    """
    Maps normalized data value [0.0, 1.0] to a consonant note frequency on the pentatonic scale.
    High brightness applies a subtle harmonic octave lift.
    """
    v = clean_float(val_norm, default=0.5, vmin=0.0, vmax=1.0)
    b = clean_float(brightness, default=0.5, vmin=0.0, vmax=1.0)
    num_notes = len(PENTATONIC_FREQS)
    note_idx = int(v * (num_notes - 1))
    
    if b > 0.75 and note_idx < num_notes - 2:
        note_idx = min(num_notes - 1, note_idx + 1)
        
    return PENTATONIC_FREQS[note_idx]

def compute_pan_gains(pan_x: float) -> Tuple[float, float]:
    """
    Computes left and right channel gains using the constant-power panning law.
    pan_x = 0.0 -> 100% Left
    pan_x = 0.5 -> Center (equal power -3dB on both)
    pan_x = 1.0 -> 100% Right
    """
    clamped = clean_float(pan_x, default=0.5, vmin=0.0, vmax=1.0)
    angle = clamped * (math.pi / 2.0)
    gain_left = math.cos(angle)
    gain_right = math.sin(angle)
    return float(gain_left), float(gain_right)

def synthesize_sonification(
    dataset_doc: Dict[str, Any],
    speed: float = 1.0,
    sample_rate: int = DEFAULT_SAMPLE_RATE,
    enable_drone: bool = True,
    master_volume: float = 1.0
) -> Tuple[np.ndarray, int]:
    """
    Synthesizes the complete audio stream for a dataset document.
    Returns: (stereo_pcm_int16 array [N, 2], sample_rate)
    """
    if not isinstance(dataset_doc, dict):
        raise TypeError(f"Expected dataset_doc to be a dict, got {type(dataset_doc)}")

    frames: List[Dict[str, Any]] = dataset_doc.get("frames", [])
    if not isinstance(frames, list) or len(frames) == 0:
        raise ValueError("Dataset document contains no frames to sonify.")

    clamped_speed = clean_float(speed, default=1.0, vmin=0.2, vmax=5.0)
    fps = clean_float(dataset_doc.get("fps", 12.0), default=12.0, vmin=0.5, vmax=60.0) * clamped_speed
    sec_per_frame = 1.0 / fps
    samples_per_frame = max(16, int(sample_rate * sec_per_frame))
    total_frames = len(frames)
    total_samples = total_frames * samples_per_frame

    # Allocate 32-bit float stereo channels
    left_ch = np.zeros(total_samples, dtype=np.float32)
    right_ch = np.zeros(total_samples, dtype=np.float32)

    t_global = np.arange(total_samples, dtype=np.float32) / sample_rate

    # 1. Continuous Sub-Drone (65.41 Hz C2 + 2nd harmonic)
    if enable_drone:
        drone_cfg = MAPPING_CONFIG.get("drone", {})
        drone_freq = clean_float(drone_cfg.get("frequency_hz", 65.41), default=65.41, vmin=20.0, vmax=200.0)
        drone_vol = clean_float(drone_cfg.get("volume", 0.08), default=0.08, vmin=0.0, vmax=0.3)
        drone_h2 = clean_float(drone_cfg.get("harmonic2_gain", 0.35), default=0.35, vmin=0.0, vmax=1.0)
        
        drone_sig = drone_vol * (
            np.sin(2 * np.pi * drone_freq * t_global) +
            drone_h2 * np.sin(2 * np.pi * drone_freq * 2 * t_global)
        )
        left_ch += drone_sig
        right_ch += drone_sig

    # 2. Frame-by-Frame Synthesizer
    current_phase = 0.0
    last_event_sample = -999999
    min_event_cooldown = int(sample_rate * 0.35)

    for idx, f in enumerate(frames):
        if not isinstance(f, dict):
            continue

        start_idx = idx * samples_per_frame
        end_idx = min(total_samples, start_idx + samples_per_frame)
        frame_len = end_idx - start_idx
        if frame_len <= 0:
            continue

        t_frame = np.arange(frame_len, dtype=np.float32) / sample_rate

        # Extract features (handling both naming conventions with sanitization)
        if "value" in f:
            val = clean_float(f["value"], default=0.5)
        elif "hue" in f:
            h = clean_float(f["hue"], default=180.0, vmin=0.0, vmax=360.0)
            val = (h % 360.0) / 360.0
        else:
            val = 0.5

        brightness = clean_float(f.get("brightness", 0.5), default=0.5)
        hot = clean_float(f.get("hot", f.get("coverage", 0.0)), default=0.0)
        pan_x = clean_float(f.get("panX", f.get("centroid_x", 0.5)), default=0.5)
        delta = clean_float(f.get("delta", f.get("change", 0.0)), default=0.0)
        is_event = bool(f.get("event", delta > 0.65))

        # A. Lead Pentatonic Frequency
        freq = get_frequency_for_value(val, brightness)

        # B. Lead Tone & Envelope
        melody_vol = 0.22 * (0.3 + 0.7 * brightness)
        phase_arr = current_phase + 2 * np.pi * freq * t_frame
        current_phase = float(phase_arr[-1] % (2 * math.pi))

        tone = melody_vol * np.sin(phase_arr)

        # Smooth envelope prevents boundary clicks
        fade = min(int(sample_rate * 0.012), max(2, frame_len // 4))
        if fade > 1:
            env = np.ones(frame_len, dtype=np.float32)
            env[:fade] = np.linspace(0.0, 1.0, fade)
            env[-fade:] = np.linspace(1.0, 0.0, fade)
            tone *= env

        # C. Rhythmic Pulse Subdivisions (Hot / Plume Coverage)
        if hot > 0.12:
            subdiv_count = 2 if hot < 0.4 else (4 if hot < 0.7 else 8)
            pulse_freq = freq * 2.0
            pulse_mod = np.maximum(0.0, np.sin(2 * np.pi * subdiv_count * fps * t_frame)) ** 4
            pulse_tone = 0.16 * hot * pulse_mod * np.sin(2 * np.pi * pulse_freq * t_frame)
            tone += pulse_tone

        # D. Binaural Constant-Power Panning
        gain_l, gain_r = compute_pan_gains(pan_x)
        left_ch[start_idx:end_idx] += tone * gain_l
        right_ch[start_idx:end_idx] += tone * gain_r

        # E. Episodic Plume Burst Chimes (Events)
        if is_event and (start_idx - last_event_sample > min_event_cooldown):
            last_event_sample = start_idx
            accent_samples = min(int(sample_rate * 0.3), total_samples - start_idx)
            if accent_samples > 0:
                t_acc = np.arange(accent_samples, dtype=np.float32) / sample_rate
                decay = np.exp(-15.0 * t_acc)
                chime = 0.30 * (np.sin(2 * np.pi * 880.0 * t_acc) + 0.5 * np.sin(2 * np.pi * 1760.0 * t_acc))
                noise = 0.07 * (np.random.rand(accent_samples).astype(np.float32) * 2.0 - 1.0)
                accent_sig = (chime + noise) * decay

                acc_l, acc_r = compute_pan_gains(pan_x)
                left_ch[start_idx:start_idx + accent_samples] += accent_sig * (0.3 + 0.7 * acc_l)
                right_ch[start_idx:start_idx + accent_samples] += accent_sig * (0.3 + 0.7 * acc_r)

    # 3. Master Volume Scaling
    if master_volume != 1.0:
        vol = clean_float(master_volume, default=1.0, vmin=0.0, vmax=2.0)
        left_ch *= vol
        right_ch *= vol

    # 4. Master Brickwall Limiter & Soft Saturation (Ear Protection)
    peak = max(float(np.max(np.abs(left_ch))), float(np.max(np.abs(right_ch))))
    if peak > 0.90:
        left_ch = (left_ch / peak) * 0.90
        right_ch = (right_ch / peak) * 0.90

    # Soft tanh saturation (gentle analog tape character, avoids hard digital clipping)
    left_ch = np.tanh(left_ch * 1.08) * 0.92
    right_ch = np.tanh(right_ch * 1.08) * 0.92

    # 5. Quantize to 16-bit PCM Signed Integer
    l_i16 = (np.clip(left_ch, -1.0, 1.0) * 32767.0).astype(np.int16)
    r_i16 = (np.clip(right_ch, -1.0, 1.0) * 32767.0).astype(np.int16)
    stereo_pcm = np.column_stack((l_i16, r_i16))

    return stereo_pcm, sample_rate

def render_dataset_to_wav(
    dataset_source: Union[str, Path, Dict[str, Any]],
    output_wav_path: Union[str, Path],
    speed: float = 1.0,
    sample_rate: int = DEFAULT_SAMPLE_RATE
) -> Path:
    """
    Renders a dataset features file or dictionary directly to an audio WAV file on disk.
    """
    if isinstance(dataset_source, (str, Path)):
        p = Path(dataset_source)
        if not p.exists():
            raise FileNotFoundError(f"Features file not found: {p}")
        with open(p, "r", encoding="utf-8") as f:
            doc = json.load(f)
    elif isinstance(dataset_source, dict):
        doc = dataset_source
    else:
        raise TypeError(f"Invalid dataset_source type: {type(dataset_source)}")

    audio_pcm, sr = synthesize_sonification(doc, speed=speed, sample_rate=sample_rate)
    out_p = Path(output_wav_path)
    out_p.parent.mkdir(parents=True, exist_ok=True)
    wavfile.write(str(out_p), sr, audio_pcm)
    logger.info("Rendered sonification: %s (%.1f KB)", out_p, out_p.stat().st_size / 1024)
    return out_p

def render_dataset_to_bytes(
    dataset_source: Union[str, Path, Dict[str, Any]],
    speed: float = 1.0,
    sample_rate: int = DEFAULT_SAMPLE_RATE
) -> io.BytesIO:
    """
    Renders sonification to an in-memory BytesIO buffer (ideal for FastAPI streaming responses).
    """
    if isinstance(dataset_source, (str, Path)):
        with open(dataset_source, "r", encoding="utf-8") as f:
            doc = json.load(f)
    else:
        doc = dataset_source

    audio_pcm, sr = synthesize_sonification(doc, speed=speed, sample_rate=sample_rate)
    buffer = io.BytesIO()
    wavfile.write(buffer, sr, audio_pcm)
    buffer.seek(0)
    return buffer

def generate_calibration_reference_audio(output_dir: Union[str, Path]) -> Dict[str, Path]:
    """
    Generates reference audio WAV files for the calibration mode:
      - calibration_low.wav
      - calibration_mid.wav
      - calibration_high.wav
      - calibration_event.wav
      - calibration_pan_sweep.wav
    """
    out_base = Path(output_dir)
    out_base.mkdir(parents=True, exist_ok=True)
    results = {}

    calib_profiles = MAPPING_CONFIG.get("calibration", {})
    for key, prof in calib_profiles.items():
        doc = {
            "fps": 5.0,
            "frames": [
                {
                    "value": prof["value"],
                    "brightness": prof["brightness"],
                    "hot": prof["hot"],
                    "panX": prof["panX"],
                    "delta": prof["delta"],
                    "event": prof["event"]
                }
                for _ in range(8)
            ]
        }
        wav_file = out_base / f"calibration_{key}.wav"
        render_dataset_to_wav(doc, wav_file, speed=1.0)
        results[key] = wav_file

    # Stereo Pan Sweep (West -> East)
    sweep_doc = {
        "fps": 4.0,
        "frames": [
            {"value": 0.55, "brightness": 0.6, "hot": 0.2, "panX": float(p), "delta": 0.05, "event": False}
            for p in np.linspace(0.1, 0.9, 12)
        ]
    }
    sweep_file = out_base / "calibration_pan_sweep.wav"
    render_dataset_to_wav(sweep_doc, sweep_file, speed=1.0)
    results["pan_sweep"] = sweep_file

    return results

def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="Listen to Earth — Production Sonification CLI",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    parser.add_argument("--features", required=True, help="Path to input features JSON file")
    parser.add_argument("--out", required=True, help="Path for rendered output .wav file")
    parser.add_argument("--speed", type=float, default=1.0, help="Playback speed multiplier (0.25x to 4.0x)")
    parser.add_argument("--sample-rate", type=int, default=DEFAULT_SAMPLE_RATE, help="Output sample rate in Hz")
    parser.add_argument("--volume", type=float, default=1.0, help="Master output gain multiplier")
    parser.add_argument("--no-drone", action="store_true", help="Disable the continuous sub-drone")
    parser.add_argument("--quiet", action="store_true", help="Suppress progress logging")

    args = parser.parse_args()
    if args.quiet:
        logger.setLevel(logging.WARNING)

    try:
        out = render_dataset_to_wav(
            dataset_source=args.features,
            output_wav_path=args.out,
            speed=args.speed,
            sample_rate=args.sample_rate
        )
        print(f"✅ Successfully rendered sonification: {out}")
    except Exception as e:
        print(f"❌ Error during sonification: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
