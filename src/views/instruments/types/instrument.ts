import type { DeepReadonly, Ref } from 'vue';

export type TimbreId = 'piano' | 'violin' | 'flute';
export type Octave = 3 | 4 | 5;

export interface TimbreConfig {
  label: string;
  icon: string;
  detail: string;
  /** 正弦谐波系数；下标 0 为直流分量，下标 1 为基频。 */
  harmonics: readonly number[];
  /** 从零增益上升到峰值的时间，单位秒。 */
  attack: number;
  /** 起音两秒后的目标增益，不是持续时长。 */
  sustain: number;
}

export interface InstrumentNote {
  /** MIDI 音高编号，用于计算频率及作为声音索引。 */
  midi: number;
  name: string;
  /** 所属八度。 */
  row: Octave;
  /** 八度内的半音索引，范围 0–11。 */
  pitch: number;
  sharp: boolean;
  /** 以白键宽度为单位的横坐标；黑键以此为中心。 */
  position: number;
}

export interface InstrumentVoice {
  /** 调度松键衰减；重复调用不重复调度。 */
  release(): void;
  /** 立即停止并断开节点，允许重复调用。 */
  dispose(): void;
}

export interface InstrumentController {
  timbre: Readonly<Ref<TimbreId>>;
  volume: Readonly<Ref<number>>;
  error: Readonly<Ref<string>>;
  /** 仅对外提供只读集合；异步恢复中的请求不计入演奏状态。 */
  activeNotes: DeepReadonly<Ref<Set<number>>>;
  supported: boolean;
  play(note: number): Promise<void>;
  release(note: number): void;
  /** 清空待启动请求、停止声音并关闭音频会话。 */
  stopAll(): void;
  /** 切换音色时同步清理旧声音。 */
  setTimbre(value: TimbreId): void;
  /** 将有限数值限制在 0–1 并同步输出增益。 */
  setVolume(value: number): void;
}
