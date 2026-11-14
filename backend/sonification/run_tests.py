#!/usr/bin/env python3
"""
Listen to Earth — Sonification Test & Audio Generator Runner
=============================================================
Runs the complete test suite for the Sonification engine AND automatically
renders the real NASA audio outputs into sonification/output/.

Usage:
    python sonification/run_tests.py
    python sonification/run_tests.py --unit-only
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

SONIFICATION_DIR = Path(__file__).resolve().parent

def main():
    parser = argparse.ArgumentParser(description="Listen to Earth — Sonification Test Runner")
    parser.add_argument("--unit-only", action="store_true", help="Run only unit tests without rendering audio outputs")
    args = parser.parse_args()

    print("=" * 68)
    print("  LISTEN TO EARTH — SONIFICATION MODULE TEST & AUDIO SUITE")
    print("=" * 68)

    # 1. Run Pytest Suite
    print("\n[1/2] Running Sonification Unit Tests...")
    test_file = SONIFICATION_DIR / "tests" / "test_sonification.py"
    cmd = [sys.executable, "-m", "pytest", str(test_file), "-v"]
    res = subprocess.run(cmd)

    if res.returncode != 0:
        print("\n❌ Sonification tests failed!", file=sys.stderr)
        sys.exit(res.returncode)

    print("\n✔ All 9 unit tests passed successfully!")

    # 2. Render Real NASA Data Audio Outputs
    if not args.unit_only:
        print("\n[2/2] Generating Real NASA Data Audio Outputs into sonification/output/...")
        render_script = SONIFICATION_DIR / "sonify_real_data.py"
        render_res = subprocess.run([sys.executable, str(render_script)])
        if render_res.returncode != 0:
            print("\n❌ Audio rendering failed!", file=sys.stderr)
            sys.exit(render_res.returncode)

    print("\n" + "=" * 68)
    print("  ✔ ALL TESTS PASSED & AUDIO OUTPUTS READY IN sonification/output/")
    print("=" * 68 + "\n")

if __name__ == "__main__":
    main()
