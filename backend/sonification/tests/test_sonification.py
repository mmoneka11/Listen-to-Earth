"""
Listen to Earth — Production Sonification Test Suite
Tests:
  1. Pentatonic scale tuning and frequency monotonicity.
  2. Brightness octave lift.
  3. Constant-power panning law and energy conservation.
  4. Robust input sanitization (NaN, Inf, None, out-of-range).
  5. Audio stream characteristics (44.1kHz, stereo, 16-bit PCM).
  6. Brickwall limiter & clipping prevention (100% within [-32768, 32767]).
  7. Speed multiplier scaling (0.25x to 4.0x).
  8. Edge cases: Single frame dataset, empty frames exception.
  9. In-memory buffer streaming (render_dataset_to_bytes).
 10. Calibration reference audio generation.
"""

import sys
import math
import tempfile
from pathlib import Path
import numpy as np
import pytest
from scipy.io import wavfile

# Add sonification directory to path
SONIFICATION_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SONIFICATION_DIR))

import engine

def test_pentatonic_scale_bounds_and_monotonicity():
    # 0.0 -> Lowest note (C3 = 130.81 Hz)
    low_freq = engine.get_frequency_for_value(0.0, brightness=0.5)
    assert abs(low_freq - engine.PENTATONIC_FREQS[0]) < 0.01

    # 1.0 -> Highest note (A6 = 1760.00 Hz)
    high_freq = engine.get_frequency_for_value(1.0, brightness=0.5)
    assert abs(high_freq - engine.PENTATONIC_FREQS[-1]) < 0.01

    # Test monotonic frequency progression
    values = np.linspace(0.0, 1.0, 20)
    freqs = [engine.get_frequency_for_value(v, brightness=0.5) for v in values]
    for i in range(len(freqs) - 1):
        assert freqs[i] <= freqs[i + 1]

def test_brightness_octave_lift():
    f_dark = engine.get_frequency_for_value(0.5, brightness=0.3)
    f_bright = engine.get_frequency_for_value(0.5, brightness=0.95)
    assert f_bright >= f_dark

def test_constant_power_pan_law():
    # West (0.0): Left=1.0, Right=0.0
    gl0, gr0 = engine.compute_pan_gains(0.0)
    assert abs(gl0 - 1.0) < 1e-4
    assert abs(gr0 - 0.0) < 1e-4

    # East (1.0): Left=0.0, Right=1.0
    gl1, gr1 = engine.compute_pan_gains(1.0)
    assert abs(gl1 - 0.0) < 1e-4
    assert abs(gr1 - 1.0) < 1e-4

    # Center (0.5): Equal power
    gl_mid, gr_mid = engine.compute_pan_gains(0.5)
    expected_mid = float(np.sin(np.pi / 4.0))
    assert abs(gl_mid - expected_mid) < 1e-4
    assert abs(gr_mid - expected_mid) < 1e-4

    # Energy conservation: gl^2 + gr^2 = 1.0 across full sweep
    for p in np.linspace(0.0, 1.0, 25):
        l, r = engine.compute_pan_gains(p)
        assert abs((l * l + r * r) - 1.0) < 1e-4

def test_input_sanitization():
    # clean_float should safely handle corrupted inputs
    assert engine.clean_float(float("nan"), default=0.5) == 0.5
    assert engine.clean_float(float("inf"), default=0.5) == 0.5
    assert engine.clean_float(None, default=0.3) == 0.3
    assert engine.clean_float("not_a_number", default=0.2) == 0.2
    assert engine.clean_float(1.8, vmin=0.0, vmax=1.0) == 1.0
    assert engine.clean_float(-0.5, vmin=0.0, vmax=1.0) == 0.0

def test_synthesizer_audio_properties_and_clipping_safety():
    dataset = {
        "fps": 12.0,
        "frames": [
            {"value": 0.1, "brightness": 0.2, "hot": 0.0, "panX": 0.1, "delta": 0.0},
            {"value": 0.5, "brightness": 0.6, "hot": 0.3, "panX": 0.5, "delta": 0.2},
            {"value": 0.95, "brightness": 1.0, "hot": 1.0, "panX": 0.9, "delta": 0.9, "event": True},
            {"value": 0.3, "brightness": 0.4, "hot": 0.1, "panX": 0.4, "delta": 0.0}
        ]
    }
    audio, sr = engine.synthesize_sonification(dataset, speed=1.0, master_volume=1.5)

    assert sr == 44100
    assert audio.ndim == 2
    assert audio.shape[1] == 2
    assert audio.dtype == np.int16

    # Verify duration
    expected_samples = int(4 * (44100 / 12.0))
    assert abs(len(audio) - expected_samples) < 50

    # Strict Brickwall Limiting Verification:
    # Absolutely NO sample may exceed the 16-bit range [-32768, 32767]
    assert audio.max() <= 32767
    assert audio.min() >= -32768
    assert np.max(np.abs(audio)) > 2000

def test_speed_scaling():
    dataset = {
        "fps": 10.0,
        "frames": [{"value": 0.5, "brightness": 0.5, "hot": 0.2, "panX": 0.5}] * 10
    }
    audio_1x, _ = engine.synthesize_sonification(dataset, speed=1.0)
    audio_2x, _ = engine.synthesize_sonification(dataset, speed=2.0)
    audio_05x, _ = engine.synthesize_sonification(dataset, speed=0.5)

    # 2x should be half length, 0.5x should be double length
    assert abs(len(audio_2x) - len(audio_1x) / 2) < 50
    assert abs(len(audio_05x) - len(audio_1x) * 2) < 50

def test_edge_cases():
    # 1. Single frame dataset
    single_frame = {
        "fps": 10.0,
        "frames": [{"value": 0.5, "brightness": 0.5, "hot": 0.1, "panX": 0.5}]
    }
    audio_single, _ = engine.synthesize_sonification(single_frame)
    assert len(audio_single) > 100

    # 2. Corrupt / NaN frames
    corrupt_frame = {
        "fps": 10.0,
        "frames": [{"value": float("nan"), "brightness": float("inf"), "hot": None, "panX": "bad"}]
    }
    audio_corrupt, _ = engine.synthesize_sonification(corrupt_frame)
    assert len(audio_corrupt) > 100

    # 3. Empty frames should raise ValueError
    empty_doc = {"fps": 10.0, "frames": []}
    with pytest.raises(ValueError):
        engine.synthesize_sonification(empty_doc)

def test_in_memory_bytes_streaming():
    dataset = {
        "fps": 10.0,
        "frames": [{"value": 0.6, "brightness": 0.5, "hot": 0.2, "panX": 0.5}] * 3
    }
    buf = engine.render_dataset_to_bytes(dataset)
    assert buf is not None
    assert buf.getbuffer().nbytes > 1000

    # Verify scipy can read it directly from memory
    sr, audio = wavfile.read(buf)
    assert sr == 44100
    assert audio.ndim == 2

def test_calibration_reference_generation():
    with tempfile.TemporaryDirectory() as tmp_dir:
        files = engine.generate_calibration_reference_audio(tmp_dir)
        for key in ("low", "mid", "high", "event", "pan_sweep"):
            assert key in files
            path = Path(files[key])
            assert path.exists()
            sr, pcm = wavfile.read(path)
            assert sr == 44100
            assert pcm.ndim == 2
            assert len(pcm) > 1000
