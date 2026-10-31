export type VowelId = 'a' | 'o' | 'e' | 'i' | 'u' | 'ü';
export type ToneId = 1 | 2 | 3 | 4;
export type VoicePresetId = 'male' | 'female';

/** 三点轮廓：起点、半程点、终点相对基频的倍率。 */
export type ThreePointContour = readonly [
  startValue: number,
  middleValue: number,
  endValue: number,
];

/** 参考录音可以是单音、组合音或任意片段，标签由调用方决定。 */
export interface ReferenceRecording {
  label: string;
  url: string;
}

export interface VoiceSynthesisOptions {
  vowel: VowelId;
  preset: VoicePresetId;
  /** 依次播放的声调，至少一项。 */
  tones: readonly [ToneId, ...ToneId[]];
  /** 单音时长，秒。 */
  duration: number;
  /** 输出增益，0–1。 */
  volume: number;
}

/** 生成单个元音所需的参数。 */
export type VowelSampleOptions = Pick<VoiceSynthesisOptions, 'vowel' | 'preset' | 'duration'>;
