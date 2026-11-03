/*
 * 纹理入口：把参考包络与程序化噪声渲染成可循环的立体声音频数据。
 *
 * 本模块及其导入链会被 tools/sound/render-presets.mjs 以 Node 直接执行（不经构建），
 * 因此这条链上的相对导入必须写全 `.ts` 扩展名。
 */
import {
  createRandom,
  highpassInPlace,
  lowpassInPlace,
  normalizeLoudness,
  normalizePeak,
} from '../utils/dsp.ts';
import type { Random, StereoTexture } from '../utils/dsp.ts';

import { renderEnvelopeTexture } from './envelopeTexture.ts';
import { rainLightEnvelope } from './rainLightEnvelope.ts';
import { getCachedTexture } from './textureCache.ts';
import type { ThunderTextureSource } from './thunderTexture.ts';

export type RainTextureVariant = 'light' | 'heavy';

function randomBetween(random: Random, min: number, max: number): number {
  return min + random() * (max - min);
}

function fillPinkNoise(length: number, random: Random): Float32Array {
  const output = new Float32Array(length);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let index = 0; index < length; index += 1) {
    const white = random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    output[index] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return output;
}

interface BedOptions {
  /** 低通截止频率，Hz；应用两级一阶低通。 */
  cutoff: number;
  /** 高通截止频率，Hz；0 表示不做高通。 */
  highpass: number;
  /** 该层的线性增益。 */
  gain: number;
  /** 慢速幅度调制深度，0–1；省略时不调制。 */
  modulation?: number;
}

/** 铺一层带慢速起伏的粉噪声；多层使用不同截止频率与调制相位，避免整块听起来平。 */
function addPinkBed(
  left: Float32Array,
  right: Float32Array,
  rate: number,
  options: BedOptions,
  random: Random,
): void {
  const leftNoise = fillPinkNoise(left.length, random);
  const rightNoise = fillPinkNoise(right.length, random);
  for (const channel of [leftNoise, rightNoise]) {
    lowpassInPlace(channel, options.cutoff, rate);
    lowpassInPlace(channel, options.cutoff, rate);
    if (options.highpass > 0) highpassInPlace(channel, options.highpass, rate);
  }
  const modulation = options.modulation ?? 0;
  const mod1 = randomBetween(random, 0.08, 0.25);
  const mod2 = randomBetween(random, 0.2, 0.6);
  const phase1 = random() * Math.PI * 2;
  const phase2 = random() * Math.PI * 2;
  for (let index = 0; index < left.length; index += 1) {
    const time = index / rate;
    const amplitude =
      options.gain *
      (1 -
        modulation / 2 +
        (modulation / 2) * Math.sin(2 * Math.PI * mod1 * time + phase1) * 0.7 +
        (modulation / 2) * Math.sin(2 * Math.PI * mod2 * time + phase2) * 0.3);
    left[index] += leftNoise[index] * amplitude;
    right[index] += rightNoise[index] * amplitude;
  }
}

interface NoiseBurstOptions {
  /** 起始时间，秒。 */
  start: number;
  /** 持续时间，秒。 */
  duration: number;
  lowpass: number;
  highpass: number;
  gain: number;
  pan: number;
  /** 起音时间，秒；默认 10ms。 */
  attack?: number;
}

function addNoiseBurst(
  left: Float32Array,
  right: Float32Array,
  rate: number,
  options: NoiseBurstOptions,
  random: Random,
): void {
  const startSample = Math.round(options.start * rate);
  const length = Math.min(Math.round(options.duration * rate), left.length - startSample);
  if (length <= 0) return;
  const leftNoise = new Float32Array(length);
  const rightNoise = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    leftNoise[index] = random() * 2 - 1;
    rightNoise[index] = random() * 2 - 1;
  }
  for (const channel of [leftNoise, rightNoise]) {
    lowpassInPlace(channel, options.lowpass, rate);
    if (options.highpass > 0) highpassInPlace(channel, options.highpass, rate);
  }
  const panAngle = ((options.pan + 1) * Math.PI) / 4;
  const leftPan = Math.cos(panAngle);
  const rightPan = Math.sin(panAngle);
  const attack = Math.min(Math.round((options.attack ?? 0.01) * rate), length);
  for (let index = 0; index < length; index += 1) {
    const envelope =
      index < attack
        ? index / attack
        : Math.exp(-(index - attack) / (length * 0.4)) * (1 - index / length);
    left[startSample + index] += leftNoise[index] * envelope * options.gain * leftPan;
    right[startSample + index] += rightNoise[index] * envelope * options.gain * rightPan;
  }
}

/**
 * 用纹理末尾的 `crossfadeSeconds` 与开头做等功率交叉淡化，返回可无缝循环的片段。
 * 调用方需保证纹理比循环长度多出这段余量。
 */
function makeSeamlessLoop(
  left: Float32Array,
  right: Float32Array,
  loopSeconds: number,
  crossfadeSeconds: number,
  rate: number,
): StereoTexture {
  const loopLength = Math.round(loopSeconds * rate);
  const fadeLength = Math.round(crossfadeSeconds * rate);
  const loopLeft = new Float32Array(loopLength);
  const loopRight = new Float32Array(loopLength);
  for (let index = 0; index < loopLength; index += 1) {
    if (index < fadeLength) {
      // 两个不相关噪声做线性交叉淡化会在中点掉 3 dB，形成固定周期的音量凹陷。
      // 使用等功率权重，并让循环开头接住尾部（采样连续），避免接缝处跳变。
      const angle = (Math.PI / 2) * (index / fadeLength);
      const tailWeight = Math.cos(angle);
      const headWeight = Math.sin(angle);
      loopLeft[index] = left[loopLength + index] * tailWeight + left[index] * headWeight;
      loopRight[index] = right[loopLength + index] * tailWeight + right[index] * headWeight;
    } else {
      loopLeft[index] = left[index];
      loopRight[index] = right[index];
    }
  }
  return { left: loopLeft, right: loopRight };
}

/** 程序化暴雨：低中频雨幕 + 稀疏雨滴撞击，立体声，可无缝循环。 */
function createHeavyRainTexture(rate: number, seed = 12): StereoTexture {
  const random = createRandom(seed);
  const loopSeconds = 20;
  const crossfade = 1;
  const length = Math.round((loopSeconds + crossfade) * rate);
  const left = new Float32Array(length);
  const right = new Float32Array(length);

  addPinkBed(
    left,
    right,
    rate,
    { cutoff: 6000, highpass: 250, gain: 0.55, modulation: 0.15 },
    random,
  );
  addPinkBed(
    left,
    right,
    rate,
    { cutoff: 12000, highpass: 3000, gain: 0.18, modulation: 0.1 },
    random,
  );
  addPinkBed(
    left,
    right,
    rate,
    { cutoff: 1800, highpass: 250, gain: 0.06, modulation: 0.2 },
    random,
  );

  const addDroplet = (start: number) => {
    addNoiseBurst(
      left,
      right,
      rate,
      {
        start,
        duration: randomBetween(random, 0.02, 0.08),
        lowpass: 6000,
        highpass: 300,
        gain: randomBetween(random, 0.03, 0.09),
        pan: random() * 2 - 1,
        attack: 0.004,
      },
      random,
    );
  };

  const dripCount = Math.round(60 * loopSeconds);
  for (let index = 0; index < dripCount; index += 1) addDroplet(random() * loopSeconds);

  const clusterCount = Math.round(0.5 * loopSeconds);
  for (let index = 0; index < clusterCount; index += 1) {
    let offset = random() * loopSeconds;
    const burstCount = 2 + Math.floor(random() * 3);
    for (let burst = 0; burst < burstCount; burst += 1) {
      addDroplet(offset);
      offset += randomBetween(random, 0.02, 0.12);
    }
  }

  const thumpCount = Math.round(1.1 * loopSeconds);
  for (let index = 0; index < thumpCount; index += 1) {
    addNoiseBurst(
      left,
      right,
      rate,
      {
        start: random() * loopSeconds,
        duration: randomBetween(random, 0.05, 0.15),
        lowpass: 600,
        highpass: 150,
        gain: randomBetween(random, 0.05, 0.1),
        pan: random() * 2 - 1,
        attack: 0.01,
      },
      random,
    );
  }

  lowpassInPlace(left, 12000, rate);
  lowpassInPlace(right, 12000, rate);
  highpassInPlace(left, 300, rate);
  highpassInPlace(right, 300, rate);
  addPinkBed(
    left,
    right,
    rate,
    { cutoff: 12000, highpass: 3000, gain: 0.02, modulation: 0.1 },
    random,
  );
  addPinkBed(
    left,
    right,
    rate,
    { cutoff: 16000, highpass: 8000, gain: 0.1, modulation: 0.1 },
    random,
  );
  normalizePeak(left, right, 0.8);
  return makeSeamlessLoop(left, right, loopSeconds, crossfade, rate);
}

/** 生成卷积混响用的指数衰减脉冲；左右声道独立噪声，带 6kHz 低通。 */
export function createReverbImpulse(rate: number, seconds = 2.2): StereoTexture {
  const random = createRandom(73);
  const length = Math.round(seconds * rate);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    const decay = (1 - index / length) ** 2.6;
    left[index] = (random() * 2 - 1) * decay;
    right[index] = (random() * 2 - 1) * decay;
  }
  lowpassInPlace(left, 6000, rate);
  lowpassInPlace(right, 6000, rate);
  normalizePeak(left, right, 0.7);
  return { left, right };
}

/** 把程序化纹理装入 Web Audio 缓冲，交给 AudioBufferSourceNode 播放。 */
export function toAudioBuffer(context: BaseAudioContext, texture: StereoTexture): AudioBuffer {
  const buffer = context.createBuffer(2, texture.left.length, context.sampleRate);
  buffer.copyToChannel(texture.left, 0);
  buffer.copyToChannel(texture.right, 1);
  return buffer;
}

/**
 * 篝火“底纹”：密集的极短微爆，不是噪声层。
 *
 * 参考 Moodist Campfire 的实测：底纹是每秒约 80 次、时长约 2ms、2–8kHz 的微爆，
 * 整体比响爆低约 15dB，并带有慢速起伏；若用噪声层去补，会立刻听出“噪声感”。
 * 因此这里只铺微爆：够密（彼此重叠）才会像“持续燃烧”，而不是一串响指。
 */
function createEmberBedTexture(rate: number, seconds = 20, seed = 41): StereoTexture {
  const random = createRandom(seed);
  const crossfade = 1;
  const length = Math.round((seconds + crossfade) * rate);
  const left = new Float32Array(length);
  const right = new Float32Array(length);

  const burst = (options: NoiseBurstOptions) => addNoiseBurst(left, right, rate, options, random);

  // 连续层：参考底纹在 1ms 分辨率上不会掉到静音（p20 只比中位低 2dB），
  // 说明微爆下面垫着一层连续的底。参考的频谱重心在 500Hz 附近、2kHz 以上低约 15dB，
  // 所以这里以低中频为主，只留一点点高频——高频太多会听成“毛茸茸的嘶”。
  addPinkBed(left, right, rate, { cutoff: 1200, highpass: 250, gain: 0.05 }, random);
  addPinkBed(left, right, rate, { cutoff: 2500, highpass: 600, gain: 0.015 }, random);
  addPinkBed(left, right, rate, { cutoff: 3800, highpass: 1200, gain: 0.006 }, random);

  // 主体：参考底纹是“很稳的连续底 + 偶尔几颗小颗粒”，密到每秒 80 次就会听成“毛茸茸”。
  // 因此只保留每秒约 30 次、稍长一点的颗粒，其余交给下面的连续层。
  const count = Math.round(30 * seconds);
  for (let index = 0; index < count; index += 1) {
    const weight = random() ** 1.8;
    burst({
      start: random() * (seconds + crossfade),
      duration: randomBetween(random, 0.0015, 0.004),
      lowpass: randomBetween(random, 2500, 6000),
      highpass: randomBetween(random, 500, 1500),
      gain: 0.01 + 0.12 * weight,
      pan: random() * 1.2 - 0.6,
      attack: 0.0003,
    });
  }

  // 稀一点的中频“木炭碎裂”，让底纹有木头而不是沙粒的感觉。
  const midCount = Math.round(6 * seconds);
  for (let index = 0; index < midCount; index += 1) {
    burst({
      start: random() * (seconds + crossfade),
      duration: randomBetween(random, 0.004, 0.012),
      lowpass: randomBetween(random, 1500, 3200),
      highpass: randomBetween(random, 300, 700),
      gain: randomBetween(random, 0.03, 0.08),
      pan: random() * 2 - 1,
      attack: 0.0004,
    });
  }

  normalizePeak(left, right, 0.9);
  lowpassInPlace(left, 12000, rate);
  lowpassInPlace(right, 12000, rate);
  highpassInPlace(left, 60, rate);
  highpassInPlace(right, 60, rate);
  return makeSeamlessLoop(left, right, seconds, crossfade, rate);
}

export function getEmberBedTexture(rate: number): StereoTexture {
  return getCachedTexture(`ember-bed:${rate}`, () => {
    const texture = createEmberBedTexture(rate);
    normalizeLoudness(texture.left, texture.right, -30, 0.98);
    return texture;
  });
}

/** 上一版最终暴雨/轻雨纹理；轻雨改用 Moodist 轻雨的包络模板重建。 */
export function getRainTexture(rate: number, variant: RainTextureVariant): StereoTexture {
  return getCachedTexture(`rain:${rate}:${variant}`, () => {
    const texture =
      variant === 'light' ? createRainLightTexture(rate, 11) : createHeavyRainTexture(rate);
    // 轻雨与暴雨统一到同一响度基准后由强度曲线控制电平；轻雨再低 3dB，
    // 因为它几乎全是高频，等 RMS 时听感更响。
    normalizeLoudness(texture.left, texture.right, variant === 'light' ? -23 : -20, 0.98);
    return texture;
  });
}

/**
 * 轻雨：按参考录音的包络模板重建波形，再用末 1 秒与开头做等功率交叉淡化，
 * 得到可无缝循环的 20 秒纹理。
 */
function createRainLightTexture(rate: number, seed: number): StereoTexture {
  const rendered = renderEnvelopeTexture(rate, rainLightEnvelope, { seed });
  const loopSeconds = rainLightEnvelope.seconds - 1;
  // 参考录音左右相关约 0.49；模板重建的两声道完全独立（相关 0），会显得“空、散”。
  // 混入一部分共同成分把相关度拉回 0.45 左右，立体声仍有宽度但更“聚焦”。
  const left = rendered.left;
  const right = rendered.right;
  for (let index = 0; index < left.length; index += 1) {
    const mid = (left[index] + right[index]) * 0.5;
    left[index] = left[index] * 0.8 + mid * 0.5;
    right[index] = right[index] * 0.8 + mid * 0.5;
  }
  return makeSeamlessLoop(rendered.left, rendered.right, loopSeconds, 1, rate);
}

/**
 * 雷声模板约 56KB，单独成 chunk 由 `loadThunderAssets` 在页面挂载后装入；
 * 声部只在装入完成后创建，因此这里没有数据时直接报错而不是静默降级。
 */
let thunderTextureSource: ThunderTextureSource | undefined;

export function setThunderTextureSource(source: ThunderTextureSource): void {
  thunderTextureSource = source;
}

export function getThunderTextureSource(): ThunderTextureSource {
  if (!thunderTextureSource) throw new Error('雷声数据尚未加载');
  return thunderTextureSource;
}

/**
 * 首次播放会用到的纹理，按建议顺序返回生成函数。
 * 调用方负责分批执行（空闲时间），避免一次占用主线程。
 *
 * 采样率必须与播放时的 `AudioContext.sampleRate` 一致才能命中缓存；
 * 预生成用的采样率与实际不符时，首次播放会按真实采样率重新生成。
 */
export function textureWarmupTasks(rate: number): (() => void)[] {
  return [
    () => getRainTexture(rate, 'light'),
    () => getRainTexture(rate, 'heavy'),
    () => getEmberBedTexture(rate),
  ];
}
