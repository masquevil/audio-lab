/** 纹理生成共用的可复现随机数与一阶/二阶滤波原语。 */

export type Random = () => number;

/** 立体声浮点纹理；长度按采样点数计。 */
export interface StereoTexture {
  left: Float32Array<ArrayBuffer>;
  right: Float32Array<ArrayBuffer>;
}

/** 可复现的伪随机数，便于离线对比和回归。 */
export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function lowpassInPlace(samples: Float32Array, cutoff: number, rate: number): void {
  const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / rate);
  let state = 0;
  for (let index = 0; index < samples.length; index += 1) {
    state += alpha * (samples[index] - state);
    samples[index] = state;
  }
}

export function highpassInPlace(samples: Float32Array, cutoff: number, rate: number): void {
  const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / rate);
  let state = 0;
  for (let index = 0; index < samples.length; index += 1) {
    state += alpha * (samples[index] - state);
    samples[index] -= state;
  }
}

export function normalizePeak(left: Float32Array, right: Float32Array, target: number): void {
  let peak = 0;
  for (let index = 0; index < left.length; index += 1) {
    peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index]));
  }
  if (peak <= 0) return;
  const scale = target / peak;
  for (let index = 0; index < left.length; index += 1) {
    left[index] *= scale;
    right[index] *= scale;
  }
}

/**
 * 把纹理统一到同一响度基准：先按 RMS 调整到目标电平，再只在峰值超限时向下压。
 * 这样不同声部的纹理可以在同一 maxGain 下比较，而不是靠各自归一化到峰值。
 */
export function normalizeLoudness(
  left: Float32Array,
  right: Float32Array,
  targetRmsDb: number,
  maxPeak: number,
): void {
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) {
    sum += left[index] * left[index] + right[index] * right[index];
  }
  const rms = Math.sqrt(sum / (left.length * 2));
  if (rms <= 0) return;
  const scale = 10 ** (targetRmsDb / 20) / rms;
  let peak = 0;
  for (let index = 0; index < left.length; index += 1) {
    left[index] *= scale;
    right[index] *= scale;
    peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index]));
  }
  if (peak <= maxPeak) return;
  const clamp = maxPeak / peak;
  for (let index = 0; index < left.length; index += 1) {
    left[index] *= clamp;
    right[index] *= clamp;
  }
}
