/**
 * 篝火的单次响爆音色。
 *
 * 每个函数返回“已经连好、还没启动”的脉冲列表，由调用方决定启动方式和回收策略：
 * 播放层交给 `core.playBurst`（随声部销毁统一回收）。
 */

export type FireTimbreKind = 'pop' | 'creak' | 'crackle' | 'tick';

export interface FireBurst {
  source: AudioBufferSourceNode;
  nodes: AudioNode[];
  when: number;
  duration: number;
  offset: number;
}

export interface FireTimbreInfo {
  kind: FireTimbreKind;
  /** 在随机排程里出现的概率，0–1。 */
  probability: number;
  /**
   * 响度补偿：低通越低，噪声被削掉的能量越多。
   * 这些系数让四种音色的峰值大致落在同一量级（离线性测量得出）。
   */
  boost: number;
}

export const fireTimbreInfos: readonly FireTimbreInfo[] = [
  { kind: 'pop', probability: 0.15, boost: 1.8 },
  { kind: 'creak', probability: 0.13, boost: 3.5 },
  { kind: 'crackle', probability: 0.64, boost: 1 },
  { kind: 'tick', probability: 0.08, boost: 1.7 },
];

/**
 * 响爆密度（次/秒），与产品一致：弱火约 0.2、默认强度约 0.7、强火约 8。
 */
export function fireCrackleRate(intensity: number): number {
  return 0.2 + 7.8 * intensity ** 3;
}

/** 到下一次响爆的等待秒数：0.45–1.7 倍平均间隔，形成不规则的疏密。 */
export function nextFireDelay(intensity: number, random: () => number = Math.random): number {
  return randomBetween(0.45, 1.7, random) / fireCrackleRate(intensity);
}

/** 偶发成簇：10% 概率在几十毫秒内再补 2–4 声，返回它们的相对时间（秒）。 */
export function fireClusterOffsets(random: () => number = Math.random): number[] {
  if (random() >= 0.1) return [];
  const count = 2 + Math.floor(random() * 3);
  const offsets: number[] = [];
  let offset = 0.02;
  for (let index = 0; index < count; index += 1) {
    offsets.push(offset);
    offset += randomBetween(0.01, 0.12, random);
  }
  return offsets;
}

/**
 * 按固定概率抽取音色（概率和为 1，直接累加阈值即可）。
 */
export function pickFireTimbre(random: () => number = Math.random): FireTimbreKind {
  const roll = random();
  let threshold = 0;
  for (const info of fireTimbreInfos) {
    threshold += info.probability;
    if (roll < threshold) return info.kind;
  }
  return 'crackle';
}

function randomBetween(min: number, max: number, random: () => number = Math.random): number {
  return min + random() * (max - min);
}

/** 单个噪声脉冲。 */
function emitBurst(
  context: BaseAudioContext,
  noiseBuffer: AudioBuffer,
  destination: AudioNode,
  when: number,
  options: {
    duration: number;
    lowpass: number;
    highpass: number;
    level: number;
    attack: number;
    pan?: number;
  },
): FireBurst {
  const source = context.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = true;
  const lowpass = context.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = options.lowpass;
  const highpass = context.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = options.highpass;
  const gain = context.createGain();
  const panner = context.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, options.pan ?? randomBetween(-0.85, 0.85)));
  source.connect(lowpass);
  lowpass.connect(highpass);
  highpass.connect(gain);
  gain.connect(panner);
  panner.connect(destination);

  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(options.level, when + options.attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + options.duration);

  return {
    source,
    nodes: [lowpass, highpass, gain, panner],
    when,
    duration: options.duration,
    offset: Math.random() * 1.5,
  };
}

/**
 * 按音色构造一次响爆（可能包含多个脉冲）。
 * `intensity` 0–1 只影响音量倍率（0.75→0.9），密度由排程控制；
 * 音色本身不随强度变化，这样"最高和最低的音量差很小，主要差在频率"。
 */
export function buildFireTimbre(
  context: BaseAudioContext,
  noiseBuffer: AudioBuffer,
  destination: AudioNode,
  kind: FireTimbreKind,
  intensity: number,
  when: number,
): FireBurst[] {
  const scale = 0.75 + 0.15 * intensity;
  const boost = fireTimbreInfos.find((info) => info.kind === kind)?.boost ?? 1;
  const levelScale = scale * boost;
  const bursts: FireBurst[] = [];

  const cutoff = kind === 'pop' ? 500 : kind === 'creak' ? 900 : kind === 'tick' ? 12000 : 5000;
  const highpass = kind === 'pop' ? 80 : kind === 'creak' ? 150 : kind === 'tick' ? 4000 : 600;
  const duration =
    kind === 'pop'
      ? randomBetween(0.05, 0.15)
      : kind === 'creak'
        ? randomBetween(0.08, 0.2)
        : kind === 'tick'
          ? randomBetween(0.003, 0.015)
          : randomBetween(0.01, 0.06);
  const level =
    (kind === 'pop'
      ? randomBetween(0.3, 0.62)
      : kind === 'creak'
        ? randomBetween(0.16, 0.34)
        : kind === 'tick'
          ? randomBetween(0.08, 0.18)
          : randomBetween(0.2, 0.55)) * levelScale;

  bursts.push(
    emitBurst(context, noiseBuffer, destination, when, {
      duration,
      lowpass: cutoff,
      highpass,
      level,
      attack: kind === 'tick' ? 0.0005 : 0.001,
    }),
  );
  return bursts;
}
