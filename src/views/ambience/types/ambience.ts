import type { DeepReadonly, Ref } from 'vue';

export type AmbienceLayerId = 'wind' | 'rain' | 'thunder' | 'fire';

export interface AmbienceLayerConfig {
  label: string;
  icon: string;
  /** 卡片副标题，说明该声音的听感来源。 */
  detail: string;
  /** 强度由低到高的描述词，按等分区间取用。 */
  intensityLabels: readonly string[];
  /** 默认强度，0–1。 */
  defaultValue: number;
  /** 该声部的最大输出增益，为多声部混音保留余量。 */
  maxGain: number;
  /** 输出电平随强度增长的指数；小于 1 时低强度更响。 */
  gainCurve: number;
  /**
   * 强度最低时的电平占比，默认 0（强度 0 即静音）。
   * 篝火这类“音量随强度几乎不变、主要靠密度变化”的声部设为接近 1，
   * 这样低强度仍有声音，只是更稀疏。
   */
  minLevelRatio?: number;
}

export interface AmbienceController {
  intensities: DeepReadonly<Ref<Record<AmbienceLayerId, number>>>;
  activeLayers: DeepReadonly<Ref<Set<AmbienceLayerId>>>;
  /** 声部启动与混音错误；总线与录音的错误由各自模块报告。 */
  error: Readonly<Ref<string>>;
  toggleLayer(id: AmbienceLayerId): Promise<void>;
  setIntensity(id: AmbienceLayerId, value: number): void;
}
