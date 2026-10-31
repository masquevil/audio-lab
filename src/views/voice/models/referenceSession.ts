import { fadeOut } from '../utils/fadeOut';

/** 参考录音的固定回放增益，与页面音量相互独立。 */
const referencePlaybackGain = 0.5;

/** 单份录音的媒体资源，负责加载、播放、淡出及释放，不管理展示状态。 */
export function createReferenceSession(
  recordingUrl: string,
  onEnd: () => void,
  onError: () => void,
) {
  const audioContext = new AudioContext();
  const audioElement = new Audio(recordingUrl);
  let outputGain: GainNode | undefined;
  let sourceNode: MediaElementAudioSourceNode | undefined;
  let closePromise: Promise<void> | undefined;
  try {
    outputGain = audioContext.createGain();
    sourceNode = audioContext.createMediaElementSource(audioElement);
    outputGain.gain.value = referencePlaybackGain;
    sourceNode.connect(outputGain);
    outputGain.connect(audioContext.destination);
    audioElement.onended = onEnd;
    audioElement.onerror = onError;
  } catch (error) {
    audioElement.removeAttribute('src');
    audioElement.load();
    sourceNode?.disconnect();
    outputGain?.disconnect();
    void audioContext.close().catch(() => {});
    throw error;
  }

  async function releaseResources(immediate: boolean) {
    audioElement.onended = null;
    audioElement.onerror = null;
    try {
      if (!immediate && outputGain) await fadeOut(audioContext, outputGain);
    } finally {
      audioElement.pause();
      audioElement.removeAttribute('src');
      audioElement.load();
      sourceNode?.disconnect();
      outputGain?.disconnect();
      await audioContext.close();
    }
  }

  function closeSession(immediate = false) {
    closePromise ??= releaseResources(immediate);
    return closePromise;
  }

  async function playRecording() {
    if (closePromise) return;
    await Promise.all([audioContext.resume(), audioElement.play()]);
  }

  return { playRecording, closeSession };
}
