"""Acceptance test: is a generated clip inside the range spanned by real recordings?

The task is "a new instance of the same class", so a fixed threshold is meaningless;
the acceptance window is what the reference set itself covers on each dimension.
A candidate can pass this and still sound wrong — it is necessary, not sufficient.

Usage:
    python3 tools/sound/acceptance.py <candidate.wav>... --references <dir-or-files>
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from common import band_shares, decode, envelope_db, tonality  # noqa: E402

EDGES = [(20, 60), (60, 120), (120, 250), (250, 500), (500, 1000), (1000, 2000), (2000, 4000), (4000, 16000)]


def features(path: Path) -> dict[str, float]:
    samples = decode(path)
    level = envelope_db(samples, 0.01)
    slow = envelope_db(samples, 0.1)
    slow = slow / (slow.max() + 1e-12)
    shares = band_shares(samples, EDGES)
    spectrum = np.abs(np.fft.rfft(level - level.mean())) ** 2
    hz = np.fft.rfftfreq(len(level), 0.01)
    total = spectrum.sum() + 1e-20
    tonal = tonality(samples)
    return {
        "duration": len(samples) / 48_000,
        "crest_db": float(20 * np.log10((np.max(np.abs(samples)) + 1e-12) / (np.sqrt(np.mean(samples**2)) + 1e-12))),
        "env_cv": float(np.std(slow) / (np.mean(slow) + 1e-12)),
        "slow_mod": float(spectrum[(hz >= 0.15) & (hz < 3)].sum() / total),
        "tonal": tonal["median"],
        "tonal_frames": tonal["frames_over_half"],
        "b20_60": shares[0],
        "b60_120": shares[1],
        "b120_250": shares[2],
        "b250_500": shares[3],
        "b500_1k": shares[4],
        "b1_2k": shares[5],
        "b2_4k": shares[6],
        "b4_16k": shares[7],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("candidates", nargs="+", type=Path)
    parser.add_argument("--references", nargs="+", type=Path, required=True)
    arguments = parser.parse_args()

    reference_paths: list[Path] = []
    for entry in arguments.references:
        reference_paths.extend(sorted(entry.glob("*.wav")) if entry.is_dir() else [entry])
    references = {}
    for path in reference_paths:
        try:
            references[path.name] = features(path)
        except ValueError as error:
            print(f"skip {path.name}: {error}", file=sys.stderr)
    if not references:
        parser.error("参考集里没有可用音频")
    candidates = {path.name: features(path) for path in arguments.candidates}
    keys = list(next(iter(references.values())).keys())

    header = f"{'feature':14s}{'min':>9s}{'median':>9s}{'max':>9s}   " + "  ".join(
        f"{name[-12:]:>13s}" for name in candidates
    )
    print(header)
    outside = {name: 0 for name in candidates}
    for key in keys:
        values = np.array([row[key] for row in references.values()])
        low, mid, high = float(values.min()), float(np.median(values)), float(values.max())
        cells = []
        for name, row in candidates.items():
            value = row[key]
            out = value < low or value > high
            outside[name] += int(out)
            cells.append(f"{value:10.3f}{'*' if out else ' '}")
        print(f"{key:14s}{low:9.3f}{mid:9.3f}{high:9.3f}   " + "  ".join(cells))

    print("\n* = 落在参考取值范围之外")
    for name, count in outside.items():
        print(f"  {name:34s} {count}/{len(keys)} 项越界")


if __name__ == "__main__":
    main()
