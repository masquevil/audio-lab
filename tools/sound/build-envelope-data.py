"""Generate the compact envelope data module used by the runtime synthesiser.

The module holds band-energy envelopes (24 x 1/3-octave bands, 20 ms frames,
quantised to 1 dB, base64) — parameter data, not audio. Rendering happens at
runtime in src/views/ambience/models/envelopeTexture.ts.

Usage:
    python3 tools/sound/build-envelope-data.py --references <dir> --out <file.ts>

Reference layout (all local, licences vary):
    <dir>/event-1.wav    -> near
    <dir>/event-3.wav    -> mid
    <dir>/thunder-1300.wav -> far
"""

from __future__ import annotations

import argparse
import base64
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from common import CENTERS, band_analysis, decode  # noqa: E402

FRAME_MS = 20
# 名称 → (文件名, 清洗参数)。清洗只作用于高频段的固定底噪（雨/风），避免削薄主体。
TEMPLATES = [
    ("near", "event-1.wav", None),
    ("mid", "event-3.wav", None),
    ("far", "thunder-1300.wav", (20, 1.0, 800)),
]


def trim(envelope: np.ndarray) -> np.ndarray:
    total = envelope.sum(axis=0)
    active = np.where(total > total.max() * 0.02)[0]
    if not len(active):
        return envelope
    return envelope[:, max(0, int(active[0]) - 10) : int(active[-1]) + 30]


def subtract_floor(envelope: np.ndarray, percentile: float, strength: float, only_above: float) -> np.ndarray:
    total = envelope.sum(axis=0)
    active = total > total.max() * 0.05
    if not active.any():
        return envelope
    floor = np.percentile(envelope[:, active], percentile, axis=1, keepdims=True)
    weights = np.array([1.0 if center >= only_above else 0.0 for center in CENTERS])[:, None]
    return np.maximum(envelope - floor * strength * weights, 0)


def quantise(envelope: np.ndarray) -> bytes:
    peak = envelope.max() + 1e-12
    db = np.clip(20 * np.log10(np.maximum(envelope / peak, 1e-9)), -110, 0)
    return np.round(-db).astype(np.uint8).tobytes()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--references", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    arguments = parser.parse_args()

    lines = [
        "/**",
        " * 雷声包络模板：24 个 1/3 倍频程频段 × 20ms 的能量包络，量化到 1dB 后按 base64 存放。",
        " * 这是参数数据，不是音频：只用于在运行时驱动带通噪声合成，不能直接播放。",
        " * 由 tools/sound/build-envelope-data.py 生成，不要手改。",
        " */",
        "import type { EnvelopeTemplate } from './envelopeTexture.ts';",
        "",
        f"export const thunderEnvelopeBandCenters: readonly number[] = {CENTERS};",
        "",
        "export const thunderEnvelopeTemplates = {",
    ]
    for name, filename, cleanup in TEMPLATES:
        envelope = trim(band_analysis(decode(arguments.references / filename)))
        if cleanup:
            envelope = subtract_floor(envelope, cleanup[0], cleanup[1], cleanup[2])
        payload = quantise(envelope)
        encoded = base64.b64encode(payload).decode()
        chunks = [encoded[index : index + 120] for index in range(0, len(encoded), 120)]
        lines.append(f"  {name}: {{")
        lines.append(f"    frameMs: {FRAME_MS},")
        lines.append("    bandCenters: thunderEnvelopeBandCenters,")
        lines.append(f"    seconds: {envelope.shape[1] * FRAME_MS / 1000:.2f},")
        lines.append("    data: [")
        lines.extend(f"      '{chunk}'," for chunk in chunks)
        lines.append("    ].join(''),")
        lines.append("  },")
        print(f"{name}: {envelope.shape[1]} frames, {len(payload)} bytes")
    lines.append("} as const satisfies Record<string, EnvelopeTemplate>;")
    arguments.out.parent.mkdir(parents=True, exist_ok=True)
    arguments.out.write_text("\n".join(lines) + "\n")
    print(f"wrote {arguments.out}")


if __name__ == "__main__":
    main()
