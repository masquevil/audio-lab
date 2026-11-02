import type { StereoTexture } from '../utils/dsp.ts';

import { renderEnvelopeTexture } from './envelopeTexture.ts';
import type { EnvelopeRenderOptions } from './envelopeTexture.ts';
import { thunderEnvelopeTemplates } from './thunderEnvelopes.ts';

export type ThunderEnvelopePreset = keyof typeof thunderEnvelopeTemplates;

export interface ThunderEnvelopeOptions extends EnvelopeRenderOptions {
  preset: ThunderEnvelopePreset;
}

/** 页面使用的五个雷声变体：模板 + 变形参数。 */
export const thunderAudioPresets = {
  nearRoll: { preset: 'near', seed: 11, timeScale: 1, tiltDbPerOctave: 0, gainDb: 0 },
  nearCrack: { preset: 'near', seed: 29, timeScale: 0.95, tiltDbPerOctave: 0.5, gainDb: -0.5 },
  midRoll: { preset: 'mid', seed: 37, timeScale: 1, tiltDbPerOctave: 0, gainDb: 0 },
  midCrack: { preset: 'mid', seed: 43, timeScale: 0.85, tiltDbPerOctave: 1.5, gainDb: -1 },
  farRoll: { preset: 'far', seed: 53, timeScale: 1.1, tiltDbPerOctave: -1.5, gainDb: -2 },
} as const satisfies Record<string, ThunderEnvelopeOptions>;

export type ThunderAudioPreset = keyof typeof thunderAudioPresets;

/** 按预设合成雷声纹理。 */
export function createThunderEnvelopeTexture(
  rate: number,
  options: ThunderEnvelopeOptions,
): StereoTexture {
  return renderEnvelopeTexture(rate, thunderEnvelopeTemplates[options.preset], options);
}
