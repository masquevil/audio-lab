import { demoFrameParms, generateSound } from 'klatt-syn';
import type { FrameParms } from 'klatt-syn';

import { toneConfigs, voicePresets, vowelFormants } from '../constants/voice';
import type { ToneId, VowelSampleOptions } from '../types/voice';
import { interpolateContour } from '../utils/interpolateContour';

// 参数帧时长（秒）与整音调幅目标。
const synthesisConfig = {
  frameDuration: 0.01,
  targetRms: 0.15,
  peakLimit: 0.9,
  attackDuration: 0.03,
  releaseDuration: 0.08,
} as const;

/** 六个共振峰的带宽，Hz。 */
const formantBandwidths = [70, 100, 140, 180, 250, 300];

/**
 * 本项目显式使用的声源音色基线，与库演示值一致。
 * 其余帧参数（声道、并联与摩擦分支）沿用库的演示默认值，并联分支保持关闭，oralFormantDb 不参与输出。
 */
const sourceFrameParms = {
  flutterLevel: 0.25,
  openPhaseRatio: 0.7,
  breathinessDb: -25,
  tiltDb: 0,
} satisfies Partial<FrameParms>;

/** 库未导出运行时枚举，1 对应 natural 声门源。 */
const naturalGlottalSource = 1;

/**
 * 将声学参数转换成带包络的 PCM；不创建上下文、节点或播放状态。
 * 单音时长须为正数秒，非法值抛出 RangeError。
 */
export function createVowelSamples(
  sampleRate: number,
  options: VowelSampleOptions,
  toneId: ToneId,
): Float32Array<ArrayBuffer> {
  if (!Number.isFinite(options.duration) || options.duration <= 0)
    throw new RangeError('单音时长必须为正数');

  const presetConfig = voicePresets[options.preset];
  const pitchContour = toneConfigs[toneId].contour;
  const frameCount = Math.ceil(options.duration / synthesisConfig.frameDuration);
  const lastFrameIndex = frameCount - 1;
  const parameterFrames: FrameParms[] = Array.from({ length: frameCount }, (_, frameIndex) => ({
    ...demoFrameParms,
    ...sourceFrameParms,
    duration: options.duration / frameCount,
    f0:
      presetConfig.pitch *
      interpolateContour(pitchContour, lastFrameIndex > 0 ? frameIndex / lastFrameIndex : 1),
    oralFormantFreq: vowelFormants[options.vowel].map(
      (frequency) => frequency * presetConfig.formantScale,
    ),
    oralFormantBw: [...formantBandwidths],
    // 整音统一调幅，不逐帧归一化。
    gainDb: 0,
    agcRmsLevel: 0,
  }));
  const rawSamples = generateSound(
    { sampleRate, glottalSourceType: naturalGlottalSource },
    parameterFrames,
  );
  let squaredAmplitudeSum = 0;
  let peakAmplitude = 0;
  for (const sampleValue of rawSamples) {
    if (!Number.isFinite(sampleValue)) throw new Error('Klatt 输出无效');
    squaredAmplitudeSum += sampleValue * sampleValue;
    peakAmplitude = Math.max(peakAmplitude, Math.abs(sampleValue));
  }
  const rmsAmplitude = Math.sqrt(squaredAmplitudeSum / rawSamples.length);
  const amplitudeScale =
    rmsAmplitude > 0
      ? Math.min(
          synthesisConfig.targetRms / rmsAmplitude,
          synthesisConfig.peakLimit / peakAmplitude,
        )
      : 0;
  return Float32Array.from(
    rawSamples,
    (sampleValue, sampleIndex) =>
      sampleValue *
      amplitudeScale *
      Math.min(
        1,
        sampleIndex / (sampleRate * synthesisConfig.attackDuration),
        (rawSamples.length - 1 - sampleIndex) / (sampleRate * synthesisConfig.releaseDuration),
      ),
  );
}
