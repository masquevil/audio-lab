"""Third-party perceptual judge: AudioSet classes from a human-labelled model.

This is the only check that reflects "what people call this sound", but it is a
proxy, not an ear: real thunder scores 0.001-0.9 across recordings, so compare a
candidate against the reference clips, never against a fixed threshold.

Usage:
    python3 tools/sound/judge.py <wav>... [--watch Thunder,Rain,...]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import RATE, decode  # noqa: E402

MODEL = "MIT/ast-finetuned-audioset-10-10-0.4593"
SAMPLE_RATE = 16_000
WINDOW_SECONDS = 10.0
DEFAULT_WATCH = ["Thunder", "Thunderstorm", "Explosion", "Eruption", "Rumble", "Rain", "Wind", "Music", "Drum", "Gong"]


def load_model():
    import torch
    from transformers import ASTFeatureExtractor, ASTForAudioClassification

    extractor = ASTFeatureExtractor.from_pretrained(MODEL)
    model = ASTForAudioClassification.from_pretrained(MODEL).eval()
    return torch, extractor, model


def score(path: Path, torch, extractor, model, watch: dict[str, int]) -> dict[str, float]:
    samples = decode(path, rate=SAMPLE_RATE)
    size = int(WINDOW_SECONDS * SAMPLE_RATE)
    chunks = [samples] if len(samples) <= size else [
        samples[start : start + size] for start in range(0, len(samples) - size + 1, size)
    ]
    values = {name: 0.0 for name in watch}
    with torch.no_grad():
        for chunk in chunks:
            inputs = extractor(chunk.astype("float32"), sampling_rate=SAMPLE_RATE, return_tensors="pt")
            probabilities = torch.sigmoid(model(**inputs).logits)[0]
            for name, index in watch.items():
                values[name] += float(probabilities[index])
    return {name: value / len(chunks) for name, value in values.items()}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="+", type=Path)
    parser.add_argument("--watch", default=",".join(DEFAULT_WATCH))
    arguments = parser.parse_args()

    torch, extractor, model = load_model()
    wanted = [name.strip() for name in arguments.watch.split(",") if name.strip()]
    watch: dict[str, int] = {}
    for index, name in model.config.id2label.items():
        if name in wanted:
            watch[name] = index
    print("labels:", ", ".join(watch))

    header = f"{'file':34s}" + "".join(f"{name[:9]:>10s}" for name in watch)
    print(header)
    for path in arguments.files:
        values = score(path, torch, extractor, model, watch)
        line = f"{path.name:34s}" + "".join(f"{values[name]:10.3f}" for name in watch)
        print(line)


if __name__ == "__main__":
    main()
