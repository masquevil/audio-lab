"""Imitation check: can a pure synthesis reproduce one recording's time–frequency
structure? Reports per-band envelope correlation and overall envelope error.

Usage:
    python3 tools/sound/imitate.py <recording.wav> [--output /tmp/sound-out]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from common import band_analysis, decode, envelope_db, resynthesize, write_wav  # noqa: E402


def fidelity(reference: np.ndarray, replica: np.ndarray) -> dict[str, float]:
    original = band_analysis(reference)
    rebuilt = band_analysis(replica)
    raw, smoothed = [], []
    kernel = np.ones(11) / 11
    for band in range(original.shape[0]):
        first, second = original[band], rebuilt[band]
        if first.std() < 1e-9 or second.std() < 1e-9:
            continue
        raw.append(float(np.corrcoef(first, second)[0, 1]))
        smoothed.append(
            float(np.corrcoef(np.convolve(first, kernel, "same"), np.convolve(second, kernel, "same"))[0, 1])
        )
    first_env, second_env = envelope_db(reference), envelope_db(replica)
    size = min(len(first_env), len(second_env))
    first_env, second_env = first_env[:size], second_env[:size]
    active = first_env > -40
    offset = float(np.mean(first_env[active] - second_env[active]))
    return {
        "band_corr_raw": float(np.median(raw)) if raw else 0.0,
        "band_corr_smoothed": float(np.median(smoothed)) if smoothed else 0.0,
        "envelope_mae_db": float(np.mean(np.abs(first_env[active] - (second_env[active] + offset)))),
        "envelope_corr": float(np.corrcoef(first_env[active], second_env[active])[0, 1]),
    }


def imitate_file(source: Path, output: Path) -> dict[str, float]:
    data = decode(source, channels=2)
    left, right = data[:, 0], data[:, 1]
    random = np.random.default_rng(5)
    reference = (left + right) / 2
    replica_left = resynthesize(band_analysis(left), len(left), random)
    replica_right = resynthesize(band_analysis(right), len(right), random)
    # 一次性最小二乘增益，抵消“频谱能量 → 时域幅度”的换算差
    original, rebuilt = band_analysis(reference), band_analysis((replica_left + replica_right) / 2)
    gains = np.ones(original.shape[0])
    for band in range(original.shape[0]):
        gains[band] = float(np.dot(original[band], rebuilt[band])) / (
            float(np.dot(rebuilt[band], rebuilt[band])) + 1e-12
        )
    replica_left = resynthesize(band_analysis(left), len(left), random, gains=gains)
    replica_right = resynthesize(band_analysis(right), len(right), random, gains=gains)
    write_wav(output, replica_left, replica_right)
    return fidelity(reference, (replica_left + replica_right) / 2)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("recordings", nargs="+", type=Path)
    parser.add_argument("--output", type=Path, default=Path("/tmp/sound-out"))
    arguments = parser.parse_args()
    for recording in arguments.recordings:
        target = arguments.output / f"imitate-{recording.stem}.wav"
        metrics = imitate_file(recording, target)
        print(f"\n{recording.name} -> {target}")
        for key, value in metrics.items():
            print(f"  {key}: {value:.4f}")
