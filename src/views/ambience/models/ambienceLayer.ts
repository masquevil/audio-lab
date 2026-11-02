import { ambienceLayers } from '../constants/ambience';
import type { AmbienceLayerConfig, AmbienceLayerId } from '../types/ambience';
import { createNoiseBuffer } from '../utils/noise';

import {
  getEmberBedTexture,
  getRainTexture,
  getThunderTexture,
  toAudioBuffer,
} from './ambienceTexture';
import { buildFireTimbre, fireClusterOffsets, nextFireDelay, pickFireTimbre } from './fireTimbre';
import { thunderAudioPresetIds } from './thunderEnvelope';
import type { ThunderAudioPreset } from './thunderEnvelope';

export interface AmbienceLayer {
  /** 强度 0–1，同时改变纹理和输出电平。 */
  setIntensity(value: number): void;
  /** 启用或停用声部；停用后不再排程随机事件。 */
  setActive(active: boolean): void;
  /** 停止并断开全部节点，允许重复调用。 */
  dispose(): void;
}

interface BurstOptions {
  /** 上下文时间；省略时立即播放。 */
  when?: number;
  /** 噪声缓冲的起始位置，秒。 */
  offset?: number;
  /** 播放时长，秒；省略时播到缓冲结束。 */
  duration?: number;
  /** 播放结束后的回调，在节点断开之后调用。 */
  onEnded?: () => void;
}

interface LayerCore {
  context: AudioContext;
  output: GainNode;
  /** 当前强度，由各声部读取以更新滤波器和 LFO 参数。 */
  intensity: number;
  /** 当前是否应发声；随机事件的回调以此为准。 */
  active: boolean;
  /** 各声部注册的强度变化回调。 */
  updateSound?: () => void;
  /** 各声部注册的启停回调，用于开始或收拾随机事件。 */
  onActiveChange?: (active: boolean) => void;
  setIntensity(value: number): void;
  setActive(active: boolean): void;
  /** 安排一次性随机事件，停用或销毁时自动取消。 */
  schedule(delay: number, task: () => void): void;
  /** 启动常驻循环音源。 */
  startSource(source: AudioScheduledSourceNode): void;
  /** 启动常驻噪声源；offset 用于让共享噪声缓冲去相关。 */
  startBufferSource(source: AudioBufferSourceNode, offset: number): void;
  /** 播放一次性噪声片段，结束后断开自身及附属节点。 */
  playBurst(
    source: AudioBufferSourceNode,
    attachedNodes: readonly AudioNode[],
    options?: BurstOptions,
  ): void;
  /** 登记需要统一断开的非音源节点。 */
  keep(nodes: readonly AudioNode[]): void;
  dispose(): void;
}

function clampIntensity(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** 声部共用的电平、启停、随机调度与节点清理。 */
function createLayerCore(
  context: AudioContext,
  destination: AudioNode,
  config: AmbienceLayerConfig,
): LayerCore {
  const output = context.createGain();
  output.gain.value = 0;
  output.connect(destination);

  const timers = new Set<ReturnType<typeof setTimeout>>();
  const sources = new Set<AudioScheduledSourceNode>();
  const ownedNodes = new Set<AudioNode>();
  let disposed = false;

  function clearTimers(): void {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
  }

  function updateLevel(): void {
    const now = context.currentTime;
    // 默认曲线：maxGain × 强度^曲线（强度 0 即静音）。
    // 配了 minLevelRatio 的声部（篝火）把电平下限抬高，音量几乎不随强度变化。
    const floor = config.minLevelRatio ?? 0;
    const shaped = floor + (1 - floor) * core.intensity ** config.gainCurve;
    output.gain.cancelScheduledValues(now);
    output.gain.setTargetAtTime(core.active ? config.maxGain * shaped : 0, now, 0.12);
  }

  const core: LayerCore = {
    context,
    output,
    intensity: clampIntensity(config.defaultValue),
    active: false,
    setIntensity(value) {
      if (disposed) return;
      core.intensity = clampIntensity(value);
      core.updateSound?.();
      updateLevel();
    },
    setActive(active) {
      if (disposed || core.active === active) return;
      core.active = active;
      if (!active) clearTimers();
      core.onActiveChange?.(active);
      updateLevel();
    },
    schedule(delay, task) {
      if (disposed) return;
      const timer = setTimeout(
        () => {
          timers.delete(timer);
          if (!disposed && core.active) task();
        },
        Math.max(0, delay) * 1000,
      );
      timers.add(timer);
    },
    startSource(source) {
      ownedNodes.add(source);
      sources.add(source);
      source.start(context.currentTime);
    },
    startBufferSource(source, offset) {
      ownedNodes.add(source);
      sources.add(source);
      source.start(context.currentTime, offset);
    },
    playBurst(source, attachedNodes, options) {
      const when = options?.when ?? context.currentTime;
      ownedNodes.add(source);
      sources.add(source);
      for (const node of attachedNodes) ownedNodes.add(node);
      source.onended = () => {
        sources.delete(source);
        ownedNodes.delete(source);
        source.disconnect();
        for (const node of attachedNodes) {
          ownedNodes.delete(node);
          node.disconnect();
        }
        options?.onEnded?.();
      };
      source.start(when, options?.offset ?? 0);
      if (options?.duration !== undefined) source.stop(when + options.duration);
    },
    keep(nodes) {
      for (const node of nodes) ownedNodes.add(node);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimers();
      for (const source of sources) {
        source.onended = null;
        try {
          source.stop();
        } catch {
          // 已经结束的音源无需再次停止。
        }
      }
      for (const node of ownedNodes) node.disconnect();
      sources.clear();
      ownedNodes.clear();
      output.disconnect();
    },
  };

  return core;
}

/** 创建循环播放的程序化纹理音源。 */
function createLoopSource(context: AudioContext, buffer: AudioBuffer): AudioBufferSourceNode {
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

function createFilter(
  context: AudioContext,
  type: BiquadFilterType,
  frequency: number,
  q = 0.7,
): BiquadFilterNode {
  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  return filter;
}

function createLfo(context: AudioContext, frequency: number, phase = 0): OscillatorNode {
  const lfo = context.createOscillator();
  const real = new Float32Array([0, Math.sin(phase)]);
  const imag = new Float32Array([0, Math.cos(phase)]);
  lfo.setPeriodicWave(context.createPeriodicWave(real, imag));
  lfo.frequency.value = frequency;
  return lfo;
}

/** 单阵风的形状；`at` 相对触发时刻，秒。 */
interface HowlSwell {
  at: number;
  /** 上升到峰值的时长，秒。 */
  rise: number;
  /** 从峰值回落的时长，秒。 */
  fall: number;
  /** 啸叫门峰值电平。 */
  level: number;
  /** 共振中心的起始频率，Hz；峰值与结束频率在此附近随机。 */
  center: number;
}

/** 风声：多层独立噪声叠加，强度越高层数越多、层间起伏互相补位。 */
function createWindLayer(core: LayerCore): AmbienceLayer {
  const context = core.context;
  const noiseBuffer = createNoiseBuffer(context, 4);
  const voiceCount = 3;
  const cutoffMultipliers = [1, 0.82, 1.16];
  const panPositions = [-0.65, 0.65, 0];
  const lfoRates = [0.043, 0.061, 0.089];
  const lfoPhases = [0, 2.1, 4.4];
  // 阵风：整层风量随阵风起伏（参考录音里呼啸时段整体风量比中位高约 8dB）。
  const gustGain = context.createGain();
  gustGain.gain.value = 1;
  gustGain.connect(core.output);
  core.keep([gustGain]);
  const voices = Array.from({ length: voiceCount }, (_, index) => {
    const source = createLoopSource(context, noiseBuffer);
    const highpass = createFilter(context, 'highpass', 110);
    const lowpass = createFilter(context, 'lowpass', 600, 2.8);
    const modulation = context.createGain();
    const trim = context.createGain();
    trim.gain.value = 0;
    const panner = context.createStereoPanner();
    panner.pan.value = panPositions[index] ?? 0;

    const cutoffLfo = createLfo(context, lfoRates[index] ?? 0.06, lfoPhases[index] ?? 0);
    const cutoffDepth = context.createGain();
    cutoffLfo.connect(cutoffDepth);
    cutoffDepth.connect(lowpass.frequency);

    const gainLfo = createLfo(
      context,
      (lfoRates[index] ?? 0.06) * 0.7,
      (lfoPhases[index] ?? 0) + 1.2,
    );
    const gainDepth = context.createGain();
    gainLfo.connect(gainDepth);
    gainDepth.connect(modulation.gain);

    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(modulation);
    modulation.connect(trim);
    trim.connect(panner);
    panner.connect(gustGain);

    core.keep([highpass, lowpass, modulation, trim, panner, cutoffDepth, gainDepth]);
    core.startBufferSource(source, index * 0.9);
    core.startSource(cutoffLfo);
    core.startSource(gainLfo);

    return { lowpass, modulation, trim, cutoffDepth, cutoffLfo, gainDepth, gainLfo };
  });

  // 单独的啸叫事件轨：不用振荡器，避免变成笛子/口哨；
  // 用两段相邻的窄带噪声 + 少量宽带气流模拟风穿过缝隙的共鸣。
  const whistleSource = createLoopSource(context, noiseBuffer);
  const whistleFilter = createFilter(context, 'bandpass', 1050, 10);
  const whistleHarmonic = createFilter(context, 'bandpass', 1600, 8);
  const whistleGain = context.createGain();
  whistleGain.gain.value = 0.75;
  const harmonicGain = context.createGain();
  harmonicGain.gain.value = 0.28;
  const airHighpass = createFilter(context, 'highpass', 300);
  const airLowpass = createFilter(context, 'lowpass', 2600);
  const airGain = context.createGain();
  airGain.gain.value = 0.025;
  const howlGate = context.createGain();
  howlGate.gain.value = 0;
  whistleSource.connect(whistleFilter);
  whistleFilter.connect(whistleGain);
  whistleGain.connect(howlGate);
  whistleSource.connect(whistleHarmonic);
  whistleHarmonic.connect(harmonicGain);
  harmonicGain.connect(howlGate);
  whistleSource.connect(airHighpass);
  airHighpass.connect(airLowpass);
  airLowpass.connect(airGain);
  airGain.connect(howlGate);
  howlGate.connect(core.output);

  const howlDrift = createLfo(context, 1.1, 0.8);
  const howlDriftDepth = context.createGain();
  howlDriftDepth.gain.value = 18;
  howlDrift.connect(howlDriftDepth);
  howlDriftDepth.connect(whistleFilter.frequency);
  howlDriftDepth.connect(whistleHarmonic.frequency);
  core.keep([
    whistleFilter,
    whistleHarmonic,
    whistleGain,
    harmonicGain,
    airHighpass,
    airLowpass,
    airGain,
    howlGate,
    howlDriftDepth,
  ]);
  core.startBufferSource(whistleSource, 2.4);
  core.startSource(howlDrift);

  /** 只有最强风才允许啸叫；弱风/中风只保留主风层。 */
  const howlThreshold = 0.8;

  /**
   * 撤销已排入未来的阵风自动化，把啸叫门与整体风量收回静止值。
   * 停用或强度降到阈值以下时必须调用：残留的 setTargetAtTime 会在之后
   * 重新抬高啸叫门与风量，听感上“啸叫消失后又冒出来”。
   */
  function cancelHowlAutomation(gateRelease: number): void {
    const now = context.currentTime;
    howlGate.gain.cancelScheduledValues(now);
    howlGate.gain.setTargetAtTime(0, now, gateRelease);
    gustGain.gain.cancelScheduledValues(now);
    gustGain.gain.setTargetAtTime(1, now, 0.3);
    // 共振中心也按阵风排程；取消后停在最后取值，等下一次阵风重新上扫。
    whistleFilter.frequency.cancelScheduledValues(now);
    whistleHarmonic.frequency.cancelScheduledValues(now);
  }

  function updateSound(): void {
    const intensity = core.intensity;
    const now = context.currentTime;
    if (intensity < howlThreshold) cancelHowlAutomation(0.18);
    const activeVoices = intensity < 0.35 ? 1 : intensity < 0.7 ? 2 : 3;
    // 多层风各自起伏；保留最低电平，飓风时不会所有层同时归零。
    const baseGain = 0.65 + 0.15 * intensity;
    const gainDepth = 0.35 - 0.05 * intensity;
    const voiceTrim = 0.9 / Math.sqrt(activeVoices);
    const cutoff = 300 + 850 * intensity;

    voices.forEach((voice, index) => {
      const active = index < activeVoices;
      const multiplier = cutoffMultipliers[index] ?? 1;
      voice.modulation.gain.setTargetAtTime(baseGain, now, 0.45);
      voice.gainDepth.gain.setTargetAtTime(gainDepth, now, 0.45);
      voice.trim.gain.setTargetAtTime(active ? voiceTrim : 0, now, 0.8);
      voice.lowpass.frequency.setTargetAtTime(cutoff * multiplier, now, 0.35);
      voice.lowpass.Q.setTargetAtTime(1.8 + 2.4 * intensity, now, 0.35);
      voice.cutoffDepth.gain.setTargetAtTime(
        cutoff * multiplier * (0.18 + 0.02 * intensity),
        now,
        0.35,
      );
      voice.cutoffLfo.frequency.setTargetAtTime(
        (0.045 + index * 0.017) * (0.8 + 0.5 * intensity),
        now,
        0.35,
      );
      voice.gainLfo.frequency.setTargetAtTime(
        (0.035 + index * 0.014) * (0.8 + 0.5 * intensity),
        now,
        0.35,
      );
    });

    whistleFilter.Q.setTargetAtTime(22 + 10 * intensity, now, 0.35);
    whistleHarmonic.Q.setTargetAtTime(14 + 6 * intensity, now, 0.35);
    whistleGain.gain.setTargetAtTime(0.9 + 0.1 * intensity, now, 0.35);
    harmonicGain.gain.setTargetAtTime(0.2 + 0.12 * intensity, now, 0.35);
    airGain.gain.setTargetAtTime(0.02 + 0.01 * intensity, now, 0.35);
  }

  core.updateSound = updateSound;
  updateSound();

  /**
   * 一阵风结束后的随机等待，随强度收紧：阈值（0.8）时 4–10 秒，满强度时 1.2–4.8 秒。
   */
  function howlInterval(intensity: number): { min: number; max: number } {
    const span = Math.max(1e-3, 1 - howlThreshold);
    const t = Math.max(0, Math.min(1, (intensity - howlThreshold) / span));
    return { min: 4 - 2.8 * t, max: 10 - 5.2 * t };
  }

  /** 下一阵风的起始时间；0 表示还没有排程，由 `scheduleHowl` 重新抽随机延迟。 */
  let nextHowlAt = 0;

  /**
   * 排入一阵风：整层风量（`gustGain`）与啸叫门（`howlGate`）同步起伏，
   * 共振中心随阵风上扫，结束时回到静音。返回这一阵结束的上下文时间。
   */
  function scheduleSwell(now: number, swell: HowlSwell): number {
    const start = now + swell.at;
    const gate = howlGate.gain;
    const gust = gustGain.gain;

    // 上升分 4 级推上去，避免“从很低一下跳到很高”；下降分 3 级退回。
    const riseSteps = 4;
    for (let step = 1; step <= riseSteps; step += 1) {
      const k = step / riseSteps;
      const at = start + (swell.rise * step) / riseSteps;
      gate.setTargetAtTime(swell.level * (0.14 + 0.86 * k), at, 0.3);
      gust.setTargetAtTime(1.1 + 1.3 * k, at, 0.32);
    }
    const fallSteps = 3;
    for (let step = 1; step <= fallSteps; step += 1) {
      const k = 1 - step / fallSteps;
      const at = start + swell.rise + (swell.fall * step) / fallSteps;
      gate.setTargetAtTime(swell.level * (0.1 + 0.9 * k), at, 0.42);
      gust.setTargetAtTime(1 + 1.4 * k, at, 0.5);
    }

    // 这一阵结束后回到静音与基准风量，下一次起伏才是独立的一阵。
    const end = start + swell.rise + swell.fall;
    gate.setTargetAtTime(0, end, 0.35);
    gust.setTargetAtTime(1, end, 0.4);

    // 共振中心随阵风上扫；每个起伏各扫一次，形成独立的呼啸。
    const peak = swell.center + randomBetween(120, 340);
    const endHz = swell.center + randomBetween(-120, 220);
    const glide = (parameter: AudioParam, multiplier: number) => {
      parameter.cancelScheduledValues(start);
      parameter.setTargetAtTime(peak * multiplier, start + swell.rise * 0.7, 0.25);
      parameter.setTargetAtTime(endHz * multiplier, start + swell.rise + swell.fall * 0.85, 0.4);
    };
    glide(whistleFilter.frequency, 1);
    glide(whistleHarmonic.frequency, 1.55);

    return end;
  }

  /**
   * 单阵基准时长（秒）：随强度变长，并在 0.65–1.35 倍之间随机。
   * 基准 2.2 秒（阈值附近）→ 3.2 秒（满强度），随机后约为 1.4–3.0 / 2.1–4.3 秒；
   * 再乘以下面的上升/下降比例，得到每阵的最终时长。
   */
  function swellBaseLength(intensity: number): number {
    const span = Math.max(1e-3, 1 - howlThreshold);
    const t = Math.max(0, Math.min(1, (intensity - howlThreshold) / span));
    return (2.2 + 1.0 * t) * randomBetween(0.65, 1.35);
  }

  /** 把一段基准时长拆成上升与下降（约 35–50% / 50–65%）。 */
  function swellShape(base: number): { rise: number; fall: number } {
    return {
      rise: base * randomBetween(0.35, 0.5),
      fall: base * randomBetween(0.5, 0.65),
    };
  }

  /**
   * 触发一次阵风：先起 1 阵，约三成概率再起 1 阵（第二阵更轻）。
   *
   * 参考 howling-wind 的实测形状是“轻微呼啸 → 风量激增、呼啸变明显 → 快速回落 → 消失”，
   * 约三分之一的事件有第二次起伏。每阵各有自己的上升/下降与共振上扫，
   * 阵间回到静音；下一阵在本阵结束后重新随机等待，不会被下一次触发截断。
   */
  function triggerHowl(): void {
    if (core.intensity < howlThreshold) return;
    const intensity = core.intensity;
    const now = context.currentTime + 0.05;
    const interval = howlInterval(intensity);
    const level = randomBetween(2.2, 2.9) + intensity * 0.8;
    const center = randomBetween(1000, 1150) + intensity * 220;

    howlGate.gain.cancelScheduledValues(now);
    gustGain.gain.cancelScheduledValues(now);

    const base = swellBaseLength(intensity);
    let end = scheduleSwell(now, { at: 0, ...swellShape(base), level, center });

    if (Math.random() < 0.33) {
      const gap = randomBetween(0.4, 1.0);
      end = scheduleSwell(now, {
        at: end + gap - now,
        ...swellShape(base * randomBetween(0.5, 0.8)),
        // 第二阵比第一阵轻，保持参考里“第二次起伏较弱”的关系。
        level: level * 0.85,
        center: center + randomBetween(-80, 120),
      });
    }

    // 下一阵从本阵结束后重新等待，两次起伏不会把事件顶到下一阵。
    nextHowlAt = end + randomBetween(interval.min, interval.max);
  }

  function scheduleHowl(): void {
    const intensity = core.intensity;
    if (intensity < howlThreshold) {
      core.schedule(0.6, scheduleHowl);
      return;
    }
    // nextHowlAt 还没安排或已经过期时，重新抽一个随机延迟，不再固定等 0.3 秒。
    const wait =
      nextHowlAt > context.currentTime ? nextHowlAt - context.currentTime : randomBetween(1, 4);
    core.schedule(wait, () => {
      if (!core.active) return;
      triggerHowl();
      scheduleHowl();
    });
  }

  core.onActiveChange = (active) => {
    if (active) {
      nextHowlAt = 0;
      scheduleHowl();
    } else {
      // 停用同样要撤销已排入未来的阵风，否则重新启用时会先冒出上一阵的尾巴。
      cancelHowlAutomation(0.15);
    }
  };

  return core;
}

/** 雨声：轻/重双纹理交叉淡化，强度决定混合比例。 */
function createRainLayer(core: LayerCore): AmbienceLayer {
  const context = core.context;
  const lightSource = createLoopSource(
    context,
    toAudioBuffer(context, getRainTexture(context.sampleRate, 'light')),
  );
  const heavySource = createLoopSource(
    context,
    toAudioBuffer(context, getRainTexture(context.sampleRate, 'heavy')),
  );
  const lightGain = context.createGain();
  const heavyGain = context.createGain();

  /** 0–1 的雨强映射：0.3 以下只保留轻雨，0.3–0.8 进入暴雨，0.8 起完全关闭轻雨。 */
  function rainMix(intensity: number): { light: number; heavy: number } {
    if (intensity >= 0.8) return { light: 0, heavy: 1 };
    const raw = Math.min(1, Math.max(0, (intensity - 0.3) / 0.5));
    const blend = raw * raw * (3 - 2 * raw);
    const angle = (blend * Math.PI) / 2;
    return { light: Math.cos(angle), heavy: Math.sin(angle) };
  }

  const initialMix = rainMix(core.intensity);
  lightGain.gain.value = initialMix.light;
  heavyGain.gain.value = initialMix.heavy;
  lightSource.connect(lightGain);
  lightGain.connect(core.output);
  heavySource.connect(heavyGain);
  heavyGain.connect(core.output);
  core.keep([lightGain, heavyGain]);

  function updateSound(): void {
    const now = context.currentTime;
    const mix = rainMix(core.intensity);
    lightGain.gain.setTargetAtTime(mix.light, now, 0.35);
    heavyGain.gain.setTargetAtTime(mix.heavy, now, 0.35);
  }

  core.updateSound = updateSound;
  updateSound();
  core.startBufferSource(lightSource, 0);
  core.startBufferSource(heavySource, 0);

  return core;
}

/** 雷声距离档，决定取用的模板与变体。 */
type ThunderDistance = 'near' | 'mid' | 'far';

/** 雷声：按强度选择近/中/远变体，播放包络模板合成的雷声纹理。 */
function createThunderLayer(core: LayerCore): AmbienceLayer {
  const context = core.context;
  const buffers = new Map<ThunderAudioPreset, AudioBuffer>();
  const activeStrikes = new Set<AudioBufferSourceNode>();

  /** 首次用到某个变体时才生成纹理，单个约 30–110ms。 */
  function bufferFor(preset: ThunderAudioPreset): AudioBuffer {
    let buffer = buffers.get(preset);
    if (!buffer) {
      buffer = toAudioBuffer(context, getThunderTexture(context.sampleRate, preset));
      buffers.set(preset, buffer);
    }
    return buffer;
  }

  function chooseDistance(): ThunderDistance {
    const intensity = core.intensity;
    if (intensity < 0.25) return Math.random() < 0.7 ? 'far' : 'mid';
    if (intensity > 0.65) return Math.random() < 0.65 ? 'near' : 'mid';
    return Math.random() < 0.45 ? 'near' : 'mid';
  }

  function choosePreset(distance: ThunderDistance, wantCrack: boolean): ThunderAudioPreset {
    if (distance === 'near') return wantCrack ? 'nearCrack' : 'nearRoll';
    if (distance === 'mid') return wantCrack ? 'midCrack' : 'midRoll';
    return 'farRoll';
  }

  function strike(buffer: AudioBuffer, when: number, gainScale: number, pan: number): void {
    const source = context.createBufferSource();
    source.buffer = buffer;
    const playbackRate = randomBetween(0.97, 1.03);
    source.playbackRate.value = playbackRate;
    // 包络与停止时间都要按实际播放速率换算，否则快放时会在淡出未结束处硬切。
    const duration = buffer.duration / playbackRate;
    const gain = context.createGain();
    const level = randomBetween(0.75, 1) * gainScale;
    const fadeOut = Math.min(1.2, duration * 0.3);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(level, when + 0.008);
    gain.gain.setValueAtTime(level, when + Math.max(0.05, duration - fadeOut));
    gain.gain.linearRampToValueAtTime(0, when + duration);
    const panner = context.createStereoPanner();
    panner.pan.value = pan;
    source.connect(gain);
    gain.connect(panner);
    panner.connect(core.output);
    activeStrikes.add(source);
    core.playBurst(source, [gain, panner], {
      when,
      duration,
      onEnded: () => activeStrikes.delete(source),
    });
  }

  function triggerStrike(delay = randomBetween(0.08, 0.45)): void {
    const intensity = core.intensity;
    const distance = chooseDistance();
    const wantCrack = distance !== 'far' && Math.random() < 0.12 + 0.28 * intensity;
    // 首次用到某个变体需要先生成纹理，排程时间要在生成之后取，避免落到过去。
    const buffer = bufferFor(choosePreset(distance, wantCrack));
    strike(
      buffer,
      context.currentTime + delay,
      randomBetween(0.8, 1.15),
      randomBetween(-0.65, 0.65),
    );
  }

  function triggerCluster(): void {
    // 强度越高允许更多层同时存在：低强度是单发远雷，高强度接近连续雷暴。
    const intensity = core.intensity;
    const maxOverlap = intensity >= 0.85 ? 3 : intensity >= 0.5 ? 2 : 1;
    if (activeStrikes.size >= maxOverlap) return;
    triggerStrike(0.05 + randomBetween(0, 0.5));
  }

  /**
   * 强度决定事件密度：最低约 12 秒一次（稀疏远雷），最高约 1 秒一次（连续雷暴）。
   * 抖动也随强度收紧，避免低强度听起来像节拍器。
   */
  function scheduleStorm(): void {
    const intensity = core.intensity;
    const gap = 0.8 + 11.2 * (1 - intensity) ** 1.6 + randomBetween(0, 0.6 + 2 * (1 - intensity));
    core.schedule(gap, () => {
      if (!core.active) return;
      triggerCluster();
      scheduleStorm();
    });
  }

  core.onActiveChange = (active) => {
    if (!active) {
      for (const source of activeStrikes) {
        try {
          source.stop();
        } catch {
          // 已经结束或尚未开始的音源无需再次停止。
        }
      }
      activeStrikes.clear();
      return;
    }
    core.schedule(randomBetween(0.15, 0.45), () => {
      triggerCluster();
      scheduleStorm();
    });
    // 错开生成其余变体，把渲染成本摊到播放过程中，避免一次冻结主线程。
    thunderAudioPresetIds.forEach((preset, index) => {
      core.schedule(1.2 + index * 1.5, () => bufferFor(preset));
    });
  };

  return {
    setIntensity: core.setIntensity,
    setActive: core.setActive,
    dispose() {
      // 销毁时不再触发 onEnded，这里主动释放对仍存活音源的引用。
      activeStrikes.clear();
      core.dispose();
    },
  };
}

/**
 * 篝火：运行时随机排程的噼/啪/噗，加一层很轻的连续底纹。
 *
 * 强度只影响两件事：
 * - 响爆频率：差异很大（约 0.2→8 次/秒，强火时自己就构成“持续柴火声”）；
 * - 响爆音量：差异很小（0.75→0.9）。
 * 底纹只负责“一直在烧”的连续感，电平固定比响爆低约 16dB。
 */
function createFireLayer(core: LayerCore): AmbienceLayer {
  const context = core.context;
  const noiseBuffer = createNoiseBuffer(context, 2);

  // 底纹：中频连续层 + 每秒约 30 次微爆的循环纹理，只负责“一直在烧”的连续感。
  const bedSource = createLoopSource(
    context,
    toAudioBuffer(context, getEmberBedTexture(context.sampleRate)),
  );
  const bedGain = context.createGain();
  bedGain.gain.value = 0.06;
  bedSource.connect(bedGain);
  bedGain.connect(core.output);
  core.keep([bedGain]);
  core.startBufferSource(bedSource, 0);

  function updateBed(): void {
    // 底纹只做“几乎听不到”的连续底：比响爆低约 16dB。
    bedGain.gain.setTargetAtTime(0.06 + 0.02 * core.intensity, context.currentTime, 0.4);
  }
  core.updateSound = updateBed;
  updateBed();

  /** 触发一次随机音色的响爆；音色与响度补偿定义在 fireTimbre 模块。 */
  function triggerCrackle(): void {
    const when = context.currentTime + 0.01;
    const burst = buildFireTimbre(
      context,
      noiseBuffer,
      core.output,
      pickFireTimbre(),
      core.intensity,
      when,
    );
    core.playBurst(burst.source, burst.nodes, {
      when: burst.when,
      duration: burst.duration,
      offset: burst.offset,
    });
  }

  /**
   * 响爆排程：密度与间隔由 fireTimbre 的 `fireCrackleRate` / `nextFireDelay` / `fireClusterOffsets` 定义。
   * 密度随强度大幅上升（弱火约 0.2 次/秒、强火约 8 次/秒），间隔不规则并偶发成簇。
   */
  function scheduleCrackle(): void {
    core.schedule(nextFireDelay(core.intensity), () => {
      if (!core.active) return;
      triggerCrackle();
      for (const offset of fireClusterOffsets()) {
        core.schedule(offset, () => {
          if (core.active) triggerCrackle();
        });
      }
      scheduleCrackle();
    });
  }

  core.onActiveChange = (active) => {
    if (!active) return;
    scheduleCrackle();
  };

  return core;
}

export function createAmbienceLayer(
  id: AmbienceLayerId,
  context: AudioContext,
  destination: AudioNode,
): AmbienceLayer {
  const core = createLayerCore(context, destination, ambienceLayers[id]);
  switch (id) {
    case 'wind':
      return createWindLayer(core);
    case 'rain':
      return createRainLayer(core);
    case 'thunder':
      return createThunderLayer(core);
    case 'fire':
      return createFireLayer(core);
  }
}
