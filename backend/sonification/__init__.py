"""
Listen to Earth — Sonification Engine Package
Production-grade audio sonification for NASA Earth Science data.
"""

from .engine import (
    synthesize_sonification,
    render_dataset_to_wav,
    get_frequency_for_value,
    compute_pan_gains,
    generate_calibration_reference_audio,
    PENTATONIC_FREQS,
    DEFAULT_SAMPLE_RATE,
)

__version__ = "2.0.0"
__all__ = [
    "synthesize_sonification",
    "render_dataset_to_wav",
    "get_frequency_for_value",
    "compute_pan_gains",
    "generate_calibration_reference_audio",
    "PENTATONIC_FREQS",
    "DEFAULT_SAMPLE_RATE",
]
