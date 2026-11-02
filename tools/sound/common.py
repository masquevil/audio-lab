"""Shared helpers for reference-based sound synthesis.

Everything here works on recordings supplied locally (licences vary), so paths are
arguments rather than constants. See docs/sound-synthesis/method.md.
"""

from __future__ import annotations

import struct
import subprocess
from pathlib import Path

import numpy as np

RATE = 48_000
# 1/3 倍频程，覆盖 31.5Hz–6.3kHz。产品模板用的就是这组中心频率。
CENTERS = [
    31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400,
    500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300,
]


def decode(path: Path, channels: int = 1, rate: int = RATE) -> np.ndarray:
    """用 ffmpeg 解码成 float32；单声道返回一维，立体声返回 (n, 2)。"""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-ac", str(channels), "-ar", str(rate), "-f", "f32le", "-"],
        check=True,
        capture_output=True,
    ).stdout
    data = np.frombuffer(raw, dtype="<f4").astype(np.float64)
    if not len(data):
        raise ValueError(f"解码后没有音频：{path}")
    return data.reshape(-1, channels) if channels > 1 else data


def write_wav(path: Path, left: np.ndarray, right: np.ndarray | None = None, rate: int = RATE) -> None:
    """写 16bit PCM；默认把峰值归一到 0.9。"""
    if right is None:
        right = left
    peak = max(np.max(np.abs(left)), np.max(np.abs(right))) + 1e-12
    left = left / peak * 0.9
    right = right / peak * 0.9
    interleaved = np.empty(len(left) * 2, dtype="<i2")
    interleaved[0::2] = (np.clip(left, -1, 1) * 32767).astype("<i2")
    interleaved[1::2] = (np.clip(right, -1, 1) * 32767).astype("<i2")
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as file:
        file.write(b"RIFF")
        file.write(struct.pack("<I", 36 + interleaved.nbytes))
        file.write(b"WAVEfmt ")
        file.write(struct.pack("<IHHIIHH", 16, 1, 2, rate, rate * 4, 4, 16))
        file.write(b"data")
        file.write(struct.pack("<I", interleaved.nbytes))
        file.write(interleaved.tobytes())


def band_analysis(
    samples: np.ndarray,
    centers: list[float] = CENTERS,
    hop: int = 960,
    frame: int = 2048,
    rate: int = RATE,
    nearest_fallback: bool = False,
) -> np.ndarray:
    """逐帧的频段能量（幅度），返回 (bands, frames)。

    nearest_fallback=False 时，低于一个频点宽度的频段保持静音（与现有产品数据一致）；
    设为 True 会把最近的频点算进该频段。
    """
    window = np.hanning(frame)
    hz = np.fft.rfftfreq(frame, 1 / rate)
    frames = max(1, 1 + (len(samples) - frame) // hop)
    output = np.zeros((len(centers), frames))
    masks = []
    for center in centers:
        ratio = 2 ** (1 / 3)
        mask = (hz >= center / ratio) & (hz < center * ratio)
        if nearest_fallback and not mask.any():
            nearest = int(np.argmin(np.abs(hz - center)))
            mask = np.zeros_like(hz, dtype=bool)
            mask[nearest] = True
        masks.append(mask)
    for index in range(frames):
        start = index * hop
        chunk = samples[start : start + frame]
        if len(chunk) < frame:
            chunk = np.pad(chunk, (0, frame - len(chunk)))
        magnitude = np.abs(np.fft.rfft(chunk * window))
        for band, mask in enumerate(masks):
            output[band, index] = np.sqrt(np.sum(magnitude[mask] ** 2))
    return output


def resynthesize(
    envelope: np.ndarray,
    length: int,
    random: np.random.Generator,
    centers: list[float] = CENTERS,
    hop_seconds: float = 0.02,
    rate: int = RATE,
    gains: np.ndarray | None = None,
) -> np.ndarray:
    """按频段包络铺随机相位的噪声：这是“模板 → 新波形”的核心。

    每个频段独立随机相位，谱能量由包络决定，因此波形是新的实例而不是原录音。
    gains 是可选的整体频段增益（用于最小二乘电平校准）。
    """
    hz = np.fft.rfftfreq(length, 1 / rate)
    output = np.zeros(length)
    positions = np.arange(envelope.shape[1]) * hop_seconds * rate
    sample_positions = np.arange(length)
    for index, center in enumerate(centers):
        ratio = 2 ** (1 / 3)
        mask = (hz >= center / ratio) & (hz < center * ratio)
        if not mask.any():
            continue
        noise = random.normal(size=length)
        spectrum = np.fft.rfft(noise)
        spectrum[~mask] = 0
        band_noise = np.fft.irfft(spectrum, n=length)
        band_noise /= np.sqrt(np.mean(band_noise**2)) + 1e-12
        scale = 1.0 if gains is None else float(gains[index])
        gain = np.interp(sample_positions, positions, envelope[index]) * scale
        output += band_noise * gain
    return output


def envelope_db(samples: np.ndarray, seconds: float = 0.01, rate: int = RATE) -> np.ndarray:
    size = max(1, int(seconds * rate))
    count = max(1, len(samples) // size)
    if len(samples) < count * size:
        samples = np.pad(samples, (0, count * size - len(samples)))
    energy = np.sqrt(np.mean(samples[: count * size].reshape(count, size) ** 2, axis=1))
    return 20 * np.log10(energy + 1e-12)


def band_shares(samples: np.ndarray, edges: list[tuple[int, int]], rate: int = RATE) -> list[float]:
    """各频段能量占比（dB，相对总能量）。"""
    size, hop = 4096, 2048
    hz = np.fft.rfftfreq(size, 1 / rate)
    window = np.hanning(size)
    total = np.zeros(len(hz))
    for start in range(0, max(1, len(samples) - size), hop):
        chunk = samples[start : start + size]
        if len(chunk) < size:
            chunk = np.pad(chunk, (0, size - len(chunk)))
        total += np.abs(np.fft.rfft(chunk * window)) ** 2
    values = [float(total[(hz >= low) & (hz < high)].sum()) for low, high in edges]
    power = sum(values) + 1e-20
    return [10 * np.log10(value / power + 1e-12) for value in values]


def tonality(samples: np.ndarray, rate: int = RATE) -> dict[str, float]:
    """80–600Hz 的自相关峰值：稳定音高（锣、鼓）会显著抬高它。"""
    spectrum = np.fft.rfft(samples)
    hz = np.fft.rfftfreq(len(samples), 1 / rate)
    spectrum[(hz < 80) | (hz > 600)] = 0
    filtered = np.fft.irfft(spectrum, n=len(samples))
    size = int(0.2 * rate)
    peaks = []
    for start in range(0, len(filtered) - size, int(0.1 * rate)):
        frame = filtered[start : start + size]
        energy = float(np.dot(frame, frame))
        if energy < 1e-6:
            continue
        correlation = np.correlate(frame, frame, mode="full")[size - 1 :] / energy
        window = correlation[int(0.002 * rate) : int(0.03 * rate)]
        peaks.append(float(np.max(window)))
    if not peaks:
        return {"median": 0.0, "frames_over_half": 0.0}
    values = np.array(peaks)
    return {"median": float(np.median(values)), "frames_over_half": float(np.mean(values > 0.5))}
