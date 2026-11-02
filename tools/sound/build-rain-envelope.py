"""Generate the light-rain envelope template from a reference recording.

Rain is stationary, so there is no A/B split: splitSeconds is 0 and the whole
template is the loop body plus a 1 s tail used to fold a seamless loop.

Usage:
    python3 tools/sound/build-rain-envelope.py <light-rain-reference> --out <file.ts>
"""

from __future__ import annotations

import argparse
import base64
import importlib.util
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from common import CENTERS, band_analysis, decode  # noqa: E402

# 轻雨的“清透感”主要来自 8kHz 以上：参考里 8k+ 只比总能量低 6.9dB，
# 而 24 段模板最高只到 6.3kHz，重建后高频是空的。这里补三档。
RAIN_CENTERS = [*CENTERS, 8000.0, 10000.0, 12500.0]


def load_helpers():
    path = Path(__file__).parent / "build-envelope-data.py"
    spec = importlib.util.spec_from_file_location("envelope_data", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("reference", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--seconds", type=float, default=21.0)
    arguments = parser.parse_args()

    helpers = load_helpers()
    samples = decode(arguments.reference)[: int(arguments.seconds * 48_000)]
    envelope = helpers.trim(band_analysis(samples, centers=RAIN_CENTERS))
    payload = helpers.quantise(envelope)
    encoded = base64.b64encode(payload).decode()
    chunks = [encoded[index : index + 120] for index in range(0, len(encoded), 120)]

    lines = [
        "/**",
        " * 轻雨包络模板：27 个 1/3 倍频程（到 12.5kHz）× 20ms 的能量包络，量化到 1dB 后 base64。",
        " * 参数数据，不是音频；由 tools/sound/build-rain-envelope.py 生成，不要手改。",
        " * 末 1 秒是循环接缝的交叉淡化余量，不是声音内容。",
        " */",
        "import type { EnvelopeTemplate } from './envelopeTexture.ts';",
        "",
        "export const rainLightEnvelope: EnvelopeTemplate = {",
        "  frameMs: 20,",
        f"  bandCenters: {RAIN_CENTERS},",
        f"  seconds: {envelope.shape[1] * 0.02:.2f},",
        "  data: [",
    ]
    lines.extend(f"    '{chunk}'," for chunk in chunks)
    lines.extend(["  ].join(''),", "};", ""])
    arguments.out.write_text("\n".join(lines))
    print(f"frames {envelope.shape[1]}, {len(payload)} bytes -> {arguments.out}")


if __name__ == "__main__":
    main()
