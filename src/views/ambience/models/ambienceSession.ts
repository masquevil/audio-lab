import { defaultIntensities } from '../constants/ambience';
import type { AmbienceLayerId, AmbienceRecording } from '../types/ambience';

import { createAmbienceLayer } from './ambienceLayer';
import type { AmbienceLayer } from './ambienceLayer';
import { createReverbImpulse, toAudioBuffer } from './ambienceTexture';

export interface AmbienceSession {
  /** 在用户手势内恢复上下文，供调用方随后播放或录音。 */
  resume(): Promise<void>;
  /** 上下文是否正在运行；被中断或后台挂起后需要再次 resume。 */
  isRunning(): boolean;
  setLayerActive(id: AmbienceLayerId, active: boolean): void;
  setLayerIntensity(id: AmbienceLayerId, value: number): void;
  /** 从当前混音总线开始录音，重复调用抛出异常。 */
  startRecording(): void;
  /** 结束录音并返回音频文件；没有录音时拒绝。 */
  stopRecording(): Promise<AmbienceRecording>;
  /** 默认先淡出混音；初始化或播放失败时可立即销毁。 */
  close(immediate?: boolean): Promise<void>;
}

/** 按优先顺序探测可用的录音容器，实际格式由浏览器决定。 */
const recordingMimeTypes = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/mp4',
] as const;

function pickRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder.isTypeSupported !== 'function') return undefined;
  return recordingMimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
}

function getRecordingExtension(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

/** 一次环境音会话拥有混音总线和全部声部，不持有 Vue 状态。 */
export function createAmbienceSession(): AmbienceSession {
  const context = new AudioContext();
  const layers: Partial<Record<AmbienceLayerId, AmbienceLayer>> = {};
  const layerIntensities: Record<AmbienceLayerId, number> = { ...defaultIntensities };
  let masterGain: GainNode;
  let compressor: DynamicsCompressorNode;
  let reverb: ConvolverNode;
  let reverbWet: GainNode;

  try {
    masterGain = context.createGain();
    masterGain.gain.value = 0.8;
    compressor = context.createDynamicsCompressor();
    // 只做峰值保护：雷声的瞬态不能被压平，因此阈值高、启动慢、比例大。
    compressor.threshold.value = -6;
    compressor.knee.value = 6;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.2;
    reverb = context.createConvolver();
    reverb.buffer = toAudioBuffer(context, createReverbImpulse(context.sampleRate));
    reverbWet = context.createGain();
    reverbWet.gain.value = 0.12;
    masterGain.connect(compressor);
    masterGain.connect(reverbWet);
    reverbWet.connect(reverb);
    reverb.connect(compressor);
    compressor.connect(context.destination);
  } catch (error) {
    // 创建尚未完成，不能把半成品会话交给调用方管理。
    void context.close().catch(() => {
      // 保留原始初始化异常，不用清理异常覆盖它。
    });
    throw error;
  }

  let recorder: MediaRecorder | undefined;
  let recordingDestination: MediaStreamAudioDestinationNode | undefined;
  let recordingChunks: Blob[] = [];
  let recordingStop: Promise<AmbienceRecording> | undefined;
  let closing: Promise<void> | undefined;

  function releaseRecording(): void {
    recorder = undefined;
    recordingChunks = [];
    if (recordingDestination) {
      compressor.disconnect(recordingDestination);
      for (const track of recordingDestination.stream.getTracks()) track.stop();
      recordingDestination = undefined;
    }
  }

  function cancelRecording(): void {
    if (!recorder) return;
    const currentRecorder = recorder;
    try {
      currentRecorder.onstop = null;
      currentRecorder.onerror = null;
      if (currentRecorder.state !== 'inactive') currentRecorder.stop();
    } catch {
      // 关闭上下文前无需处理停止失败。
    }
    recordingStop = undefined;
    releaseRecording();
  }

  function startRecording(): void {
    if (recorder) throw new Error('录音已在进行中。');
    if (
      typeof MediaRecorder === 'undefined' ||
      typeof context.createMediaStreamDestination !== 'function'
    ) {
      throw new Error('当前浏览器不支持录音。');
    }
    const destination = context.createMediaStreamDestination();
    let nextRecorder: MediaRecorder;
    try {
      const mimeType = pickRecordingMimeType();
      nextRecorder = mimeType
        ? new MediaRecorder(destination.stream, { mimeType })
        : new MediaRecorder(destination.stream);
    } catch (error) {
      for (const track of destination.stream.getTracks()) track.stop();
      throw error;
    }
    recordingChunks = [];
    nextRecorder.ondataavailable = (event) => {
      if (event.data.size) recordingChunks.push(event.data);
    };
    compressor.connect(destination);
    recordingDestination = destination;
    recorder = nextRecorder;
    try {
      nextRecorder.start(250);
    } catch (error) {
      releaseRecording();
      throw error;
    }
  }

  function stopRecording(): Promise<AmbienceRecording> {
    if (recordingStop) return recordingStop;
    const currentRecorder = recorder;
    if (!currentRecorder || currentRecorder.state === 'inactive') {
      return Promise.reject(new Error('当前没有进行中的录音。'));
    }
    recordingStop = new Promise<AmbienceRecording>((resolve, reject) => {
      currentRecorder.onstop = () => {
        const mimeType = currentRecorder.mimeType || recordingChunks[0]?.type || 'audio/webm';
        const blob = new Blob(recordingChunks, { type: mimeType });
        recordingStop = undefined;
        releaseRecording();
        if (!blob.size) {
          reject(new Error('没有录到声音，请先播放环境音再录音。'));
          return;
        }
        resolve({ blob, extension: getRecordingExtension(mimeType) });
      };
      currentRecorder.onerror = () => {
        recordingStop = undefined;
        releaseRecording();
        reject(new Error('录音失败，请重试。'));
      };
      try {
        currentRecorder.stop();
      } catch (error) {
        recordingStop = undefined;
        releaseRecording();
        reject(error);
      }
    });
    return recordingStop;
  }

  async function releaseResources(immediate: boolean): Promise<void> {
    cancelRecording();
    try {
      if (!immediate && context.state === 'running') {
        const now = context.currentTime;
        masterGain.gain.cancelAndHoldAtTime(now);
        masterGain.gain.linearRampToValueAtTime(0, now + 0.12);
        await new Promise<void>((resolve) => setTimeout(resolve, 160));
      }
    } finally {
      for (const layer of Object.values(layers)) layer?.dispose();
      masterGain.disconnect();
      reverbWet.disconnect();
      reverb.disconnect();
      compressor.disconnect();
      if (context.state !== 'closed') await context.close();
    }
  }

  /** 重复关闭返回同一个释放任务，正常停止先淡出。 */
  function close(immediate = false): Promise<void> {
    closing ??= releaseResources(immediate);
    return closing;
  }

  /** 首次启用时生成该声部的程序化纹理，之后复用。 */
  function ensureLayer(id: AmbienceLayerId): AmbienceLayer {
    let layer = layers[id];
    if (!layer) {
      layer = createAmbienceLayer(id, context, masterGain);
      layer.setIntensity(layerIntensities[id]);
      layers[id] = layer;
    }
    return layer;
  }

  return {
    resume: () => context.resume(),
    isRunning: () => context.state === 'running',
    setLayerActive(id, active) {
      if (active) ensureLayer(id).setActive(true);
      else layers[id]?.setActive(false);
    },
    setLayerIntensity(id, value) {
      layerIntensities[id] = value;
      layers[id]?.setIntensity(value);
    },
    startRecording,
    stopRecording,
    close,
  };
}
