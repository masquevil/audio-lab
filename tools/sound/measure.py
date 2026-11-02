"""Measure the structure of reference recordings: A (strike) / B (sustain), and
the loudness-modulation spectrum that tells you where the movement lives.

Usage:
    python3 tools/sound/measure.py <wav>... [--json]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from common import RATE, band_analysis, band_shares, decode, envelope_db  # noqa: E402

FRAME_SECONDS = 0.01
SAMPLES_PER_FRAME = int(FRAME_SECONDS * RATE)
BANDS = [(25, 50), (50, 100), (100, 200), (200, 400), (400, 800), (800, 1600), (1600, 3200), (3200, 8000)]
MOD_EDGES = [0.1, 0.2, 0.4, 0.8, 1.6, 3.2, 6.4, 12.8, 25.6, 51.2]


def split_point(level: np.ndarray) -> int:
    """A 段结束：峰值之后第一次跌到峰值 25% 以下（在幅度域比较，不能在 dB 域）。"""
    amplitude = 10 ** (level / 20)
    peak_index = int(np.argmax(amplitude))
    peak = amplitude[peak_index]
    for index in range(peak_index, len(amplitude)):
        if amplitude[index] < peak * 0.25:
            return index
    return len(amplitude) - 1


def analyse(path: Path) -> dict[str, float]:
    samples = decode(path)
    level = envelope_db(samples, FRAME_SECONDS)
    envelope = band_analysis(samples, hop=960)
    split = split_point(level)
    # 连续声（雨、火、风）不会跌到 25%，此时没有 A/B 之分，整段按 B 处理
    if split >= envelope.shape[1] - 10:
        split = 0
    peak_index = int(np.argmax(level))

    modulation = np.abs(np.fft.rfft(level - level.mean())) ** 2
    hz = np.fft.rfftfreq(len(level), 0.01)
    total = modulation.sum() + 1e-20
    mod = [float(modulation[(hz >= low) & (hz < high)].sum() / total) for low, high in zip(MOD_EDGES[:-1], MOD_EDGES[1:])]

    a_shares = band_shares(samples[: split * SAMPLES_PER_FRAME], BANDS)
    b_shares = band_shares(samples[split * SAMPLES_PER_FRAME :], BANDS)

    # 每个频段相对低频的衰减率（B 段）
    band_decay = []
    time = np.arange(envelope.shape[1]) * 0.02
    for band in range(envelope.shape[0]):
        row = 20 * np.log10(np.maximum(envelope[band, split:], 1e-9))
        active = row > row.max() - 40
        band_decay.append(float(np.polyfit(time[split:][active], row[active], 1)[0]) if active.sum() > 10 else 0.0)

    b_level = level[split:]
    b_time = np.arange(len(b_level)) * 0.01
    b_decay = float(np.polyfit(b_time, b_level, 1)[0]) if len(b_level) > 10 else 0.0

    return {
        "duration": len(samples) / RATE,
        "attack_ms": peak_index * 10.0,
        "a_seconds": (split - peak_index) * 0.01,
        "b_decay_db_s": b_decay,
        "mod_low": mod[0] + mod[1],
        "mod_high": mod[-2] + mod[-1],
        "a_100_200": a_shares[2],
        "a_200_400": a_shares[3],
        "a_3200_8000": a_shares[7],
        "b_100_200": b_shares[2],
        "b_200_400": b_shares[3],
        "b_3200_8000": b_shares[7],
        "band_decay_2k8k": float(np.mean(band_decay[-2:])),
        "band_decay_low": float(np.mean(band_decay[:4])),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+", type=Path)
    parser.add_argument("--json", action="store_true")
    arguments = parser.parse_args()
    rows = {}
    for path in arguments.files:
        try:
            rows[path.name] = analyse(path)
        except ValueError as error:
            print(f"skip {path.name}: {error}", file=sys.stderr)
    if not rows:
        parser.error("没有可分析的音频")
    if arguments.json:
        print(json.dumps(rows, indent=2, ensure_ascii=False))
    else:
        keys = list(next(iter(rows.values())).keys())
        print(f"{'file':26s}" + "".join(f"{key:>16s}" for key in keys))
        for name, row in rows.items():
            print(f"{name:26s}" + "".join(f"{row[key]:16.3f}" for key in keys))
