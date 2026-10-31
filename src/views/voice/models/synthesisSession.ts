import type { VoiceSynthesisOptions } from '../types/voice';
import { fadeOut } from '../utils/fadeOut';

import { createVowelSamples } from './vowelSamples';

export interface VoiceSynthesisSession {
  /** 在用户手势内恢复上下文，供调用方随后开始播放。 */
  resume: () => Promise<void>;
  playToneSequence: (options: VoiceSynthesisOptions, onSequenceEnd: () => void) => void;
  closeSession: (immediate?: boolean) => Promise<void>;
}

/** 排程时序：起始提前量与相邻声调间隔，秒。 */
const playbackTiming = { leadTime: 0.03, toneGap: 0.18 };

/** 一次试听独占上下文，负责声调序列播放及节点释放，不持有 Vue 状态。 */
export function createSynthesisSession(): VoiceSynthesisSession {
  const audioContext = new AudioContext();
  const audioNodes: AudioNode[] = [];
  const startedSources = new Set<AudioBufferSourceNode>();
  let closePromise: Promise<void> | undefined;
  let outputGain: GainNode | undefined;

  async function releaseResources(immediate: boolean) {
    try {
      if (!immediate && outputGain && startedSources.size) await fadeOut(audioContext, outputGain);
    } finally {
      for (const sourceNode of startedSources) {
        sourceNode.onended = null;
        sourceNode.stop();
      }
      for (const audioNode of audioNodes) audioNode.disconnect();
      await audioContext.close();
    }
  }

  /** 重复关闭返回同一个释放任务，正常停止先淡出。 */
  function closeSession(immediate = false) {
    closePromise ??= releaseResources(immediate);
    return closePromise;
  }

  function resume() {
    return audioContext.resume();
  }

  /** 将各声调 PCM 装入缓冲区，按固定间隔播放，末音结束后通知调用方。 */
  function playToneSequence(options: VoiceSynthesisOptions, onSequenceEnd: () => void) {
    if (closePromise) return;
    const toneBuffers = options.tones.map((toneId) => {
      const vowelSamples = createVowelSamples(audioContext.sampleRate, options, toneId);
      const toneBuffer = audioContext.createBuffer(1, vowelSamples.length, audioContext.sampleRate);
      toneBuffer.copyToChannel(vowelSamples, 0);
      return toneBuffer;
    });
    const masterGain = audioContext.createGain();
    outputGain = masterGain;
    audioNodes.push(masterGain);
    masterGain.gain.value = options.volume;
    masterGain.connect(audioContext.destination);

    let nextStartTime = audioContext.currentTime + playbackTiming.leadTime;
    toneBuffers.forEach((toneBuffer, bufferIndex) => {
      const sourceNode = audioContext.createBufferSource();
      audioNodes.push(sourceNode);
      sourceNode.buffer = toneBuffer;
      sourceNode.connect(masterGain);
      if (bufferIndex === toneBuffers.length - 1) sourceNode.onended = onSequenceEnd;
      sourceNode.start(nextStartTime);
      startedSources.add(sourceNode);
      nextStartTime += toneBuffer.duration + playbackTiming.toneGap;
    });
  }

  return { resume, playToneSequence, closeSession };
}
