import { createRandom, normalizePeak } from '../utils/dsp.ts';
import type { StereoTexture } from '../utils/dsp.ts';

/** 由参考录音量化得到的时频能量模板；参数数据，不是音频。 */
export interface EnvelopeTemplate {
  /** 每帧毫秒数。 */
  readonly frameMs: number;
  /** 频段中心频率，Hz。 */
  readonly bandCenters: readonly number[];
  /** 模板时长，秒。 */
  readonly seconds: number;
  /** uint8：0 表示该帧最强，110 表示静音，中间为负 dB。按频段优先排列。 */
  readonly data: string;
}

export interface EnvelopeRenderOptions {
  /** 随机种子；不同种子产生不同的波形细节。 */
  seed: number;
  /** 整段的时间伸缩，1 为原速。 */
  timeScale?: number;
  /** 整段的频谱倾斜，dB/倍频程；正值更亮。 */
  tiltDbPerOctave?: number;
  /** 整段的增益，dB。 */
  gainDb?: number;
}

/** STFT 块长（点）。越小瞬态越清晰，代价是低频分辨率下降。 */
const stftBlockSize = 1024;
const stftHopSize = stftBlockSize / 4;

/** 把 base64 的 uint8 表解成线性幅度（0 = 最强，110 = 静音）。 */
function decodeEnvelope(template: EnvelopeTemplate): {
  data: Float32Array;
  bands: number;
  frames: number;
} {
  const binary = atob(template.data);
  const bands = template.bandCenters.length;
  const frames = Math.floor(binary.length / bands);
  const data = new Float32Array(bands * frames);
  for (let index = 0; index < data.length; index += 1) {
    data[index] = 10 ** (-binary.charCodeAt(index) / 20);
  }
  return { data, bands, frames };
}

/** 原地基 2 逆 FFT。 */
function inverseFft(real: Float64Array, imag: Float64Array): void {
  const size = real.length;
  for (let index = 1, target = 0; index < size; index += 1) {
    let bit = size >> 1;
    for (; target & bit; bit >>= 1) target ^= bit;
    target ^= bit;
    if (index < target) {
      [real[index], real[target]] = [real[target], real[index]];
      [imag[index], imag[target]] = [imag[target], imag[index]];
    }
  }
  for (let length = 2; length <= size; length <<= 1) {
    const angle = (2 * Math.PI) / length;
    const stepReal = Math.cos(angle);
    const stepImag = Math.sin(angle);
    for (let start = 0; start < size; start += length) {
      let weightReal = 1;
      let weightImag = 0;
      for (let offset = 0; offset < length / 2; offset += 1) {
        const leftIndex = start + offset;
        const rightIndex = leftIndex + length / 2;
        const rightReal = real[rightIndex] * weightReal - imag[rightIndex] * weightImag;
        const rightImag = real[rightIndex] * weightImag + imag[rightIndex] * weightReal;
        real[rightIndex] = real[leftIndex] - rightReal;
        imag[rightIndex] = imag[leftIndex] - rightImag;
        real[leftIndex] += rightReal;
        imag[leftIndex] += rightImag;
        const nextReal = weightReal * stepReal - weightImag * stepImag;
        weightImag = weightReal * stepImag + weightImag * stepReal;
        weightReal = nextReal;
      }
    }
  }
  // 逆变换的 1/N 归一化
  for (let index = 0; index < size; index += 1) {
    real[index] /= size;
    imag[index] /= size;
  }
}

/**
 * 用包络模板合成一段声音：按块把每个频段的能量铺成随机相位的频谱，
 * 逆变换后重叠相加。模板只提供能量包络，波形完全由运行时噪声生成。
 */
export function renderEnvelopeTexture(
  rate: number,
  template: EnvelopeTemplate,
  options: EnvelopeRenderOptions,
): StereoTexture {
  const { data, bands, frames: sourceFrames } = decodeEnvelope(template);
  const sampleScale = options.timeScale ?? 1;
  const frames = Math.max(2, Math.round(sourceFrames * sampleScale));
  const tilt = options.tiltDbPerOctave ?? 0;
  const gain = 10 ** ((options.gainDb ?? 0) / 20);

  const random = createRandom(options.seed);
  const frameSeconds = template.frameMs / 1000;
  const length = Math.round(frames * frameSeconds * rate);
  const left = new Float64Array(length + stftBlockSize);
  const right = new Float64Array(length + stftBlockSize);

  const binCount = stftBlockSize / 2 + 1;
  const binHz = rate / stftBlockSize;
  const bandOfBin = new Int8Array(binCount).fill(-1);
  const binCountOfBand = new Float64Array(bands);
  for (let band = 0; band < bands; band += 1) {
    const center = template.bandCenters[band] ?? 500;
    const ratio = 2 ** (1 / 3);
    const low = Math.max(1, Math.floor(center / ratio / binHz));
    const high = Math.min(binCount - 1, Math.ceil((center * ratio) / binHz));
    for (let bin = low; bin <= high; bin += 1) {
      if (bandOfBin[bin] < 0) bandOfBin[bin] = band;
      binCountOfBand[band] += 1;
    }
  }

  const envelopeAt = (band: number, timeSeconds: number): number => {
    const source = timeSeconds / frameSeconds / sampleScale;
    const index = Math.max(0, Math.min(sourceFrames - 1, Math.floor(source)));
    const next = Math.min(sourceFrames - 1, index + 1);
    const mix = Math.max(0, Math.min(1, source - Math.floor(source)));
    const start = band * sourceFrames;
    return data[start + index] * (1 - mix) + data[start + next] * mix;
  };

  const window = new Float64Array(stftBlockSize);
  for (let index = 0; index < stftBlockSize; index += 1) {
    window[index] = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (stftBlockSize - 1));
  }

  const panLeft = new Float64Array(bands);
  const panRight = new Float64Array(bands);
  for (let band = 0; band < bands; band += 1) {
    const center = template.bandCenters[band] ?? 500;
    const pan = (random() * 2 - 1) * 0.5;
    const tiltFactor = 10 ** ((tilt * Math.log2(center / 500)) / 20) * gain;
    panLeft[band] = Math.cos(((pan + 1) * Math.PI) / 4) * tiltFactor;
    panRight[band] = Math.sin(((pan + 1) * Math.PI) / 4) * tiltFactor;
  }

  const real = new Float64Array(stftBlockSize);
  const imag = new Float64Array(stftBlockSize);
  const amplitudes = new Float64Array(bands);

  const renderBlock = (target: Float64Array, start: number, pans: Float64Array): void => {
    const time = start / rate;
    for (let band = 0; band < bands; band += 1) {
      amplitudes[band] = envelopeAt(band, time) / Math.sqrt(Math.max(1, binCountOfBand[band]));
    }
    real.fill(0);
    imag.fill(0);
    for (let bin = 1; bin < binCount - 1; bin += 1) {
      const band = bandOfBin[bin];
      if (band < 0) continue;
      const magnitude = amplitudes[band] * pans[band];
      if (magnitude <= 0) continue;
      const phase = random() * Math.PI * 2;
      const valueReal = Math.cos(phase) * magnitude;
      const valueImag = Math.sin(phase) * magnitude;
      real[bin] = valueReal;
      imag[bin] = valueImag;
      real[stftBlockSize - bin] = valueReal;
      imag[stftBlockSize - bin] = -valueImag;
    }
    inverseFft(real, imag);
    for (let index = 0; index < stftBlockSize; index += 1) {
      target[start + index] += real[index] * window[index];
    }
  };

  for (let start = 0; start < length; start += stftHopSize) {
    renderBlock(left, start, panLeft);
    renderBlock(right, start, panRight);
  }

  const textureLeft = new Float32Array(length);
  const textureRight = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    textureLeft[index] = left[index];
    textureRight[index] = right[index];
  }
  normalizePeak(textureLeft, textureRight, 0.74);
  return { left: textureLeft, right: textureRight };
}
