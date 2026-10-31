import type { ThreePointContour, ToneId, VoicePresetId, VowelId } from '../types/voice';

interface ToneConfig {
  label: string;
  contour: ThreePointContour;
}

interface VoicePresetConfig {
  label: string;
  /** 基准音高，Hz。 */
  pitch: number;
  formantScale: number;
}

type FormantFrequencies = readonly [number, number, number, number, number, number];

// 展示顺序，与下方配置的键一一对应。
export const vowelIds = ['a', 'o', 'e', 'i', 'u', 'ü'] as const satisfies readonly VowelId[];
export const toneIds = [1, 2, 3, 4] as const satisfies readonly ToneId[];
export const presetIds = ['male', 'female'] as const satisfies readonly VoicePresetId[];

/** 六个元音的共振峰频率，Hz。 */
export const vowelFormants: Record<VowelId, FormantFrequencies> = {
  a: [800, 1150, 2900, 3900, 4200, 5000],
  o: [450, 800, 2830, 3500, 4200, 5000],
  e: [500, 1500, 2700, 3300, 4200, 5000],
  i: [280, 2300, 3000, 3700, 4200, 5000],
  u: [325, 700, 2530, 3500, 4200, 5000],
  ü: [300, 1800, 2500, 3500, 4200, 5000],
};

/** 四声的基频变化轮廓。 */
export const toneConfigs: Record<ToneId, ToneConfig> = {
  1: { label: '一声 · 高平', contour: [1.2, 1.2, 1.2] },
  2: { label: '二声 · 上扬', contour: [0.85, 1, 1.25] },
  3: { label: '三声 · 降升', contour: [0.9, 0.65, 1.05] },
  4: { label: '四声 · 下降', contour: [1.3, 0.95, 0.65] },
};

/** 男女声预设：基准音高 Hz 与共振峰缩放系数。 */
export const voicePresets: Record<VoicePresetId, VoicePresetConfig> = {
  male: { label: '男声预设', pitch: 125, formantScale: 1 },
  female: { label: '女声预设', pitch: 210, formantScale: 1.15 },
};
