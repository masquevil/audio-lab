import type { AudioBusPipes } from '../types/audioBus';
import type { RecordingResult } from '../types/recorder';

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

export interface RecorderSession {
  /** 从总线开始录音；重复调用抛出异常。 */
  start(): void;
  /** 结束录音并返回文件；没有进行中的录音时拒绝。 */
  stop(): Promise<RecordingResult>;
  /** 取消录音并释放录音节点；挂起的停止请求会被拒绝。 */
  cancel(): void;
}

/** 一次录音从页面总线取流，不持有 Vue 状态，也不管理音频会话生命周期。 */
export function createRecorderSession(bus: AudioBusPipes): RecorderSession {
  let recorder: MediaRecorder | undefined;
  let destination: MediaStreamAudioDestinationNode | undefined;
  let chunks: Blob[] = [];
  let stopTask: Promise<RecordingResult> | undefined;
  let rejectStop: ((reason: unknown) => void) | undefined;

  function release(): void {
    recorder = undefined;
    chunks = [];
    if (!destination) return;
    try {
      bus.output.disconnect(destination);
    } catch {
      // 总线可能已随上下文销毁，此时无需再次断开。
    }
    for (const track of destination.stream.getTracks()) track.stop();
    destination = undefined;
  }

  function start(): void {
    if (recorder) throw new Error('录音已在进行中。');
    if (typeof MediaRecorder === 'undefined') throw new Error('当前浏览器不支持录音。');
    const nextDestination = bus.context.createMediaStreamDestination();
    let nextRecorder: MediaRecorder;
    try {
      const mimeType = pickRecordingMimeType();
      nextRecorder = mimeType
        ? new MediaRecorder(nextDestination.stream, { mimeType })
        : new MediaRecorder(nextDestination.stream);
    } catch (error) {
      for (const track of nextDestination.stream.getTracks()) track.stop();
      throw error;
    }
    chunks = [];
    nextRecorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    bus.output.connect(nextDestination);
    destination = nextDestination;
    recorder = nextRecorder;
    try {
      nextRecorder.start(250);
    } catch (error) {
      release();
      throw error;
    }
  }

  function stop(): Promise<RecordingResult> {
    if (stopTask) return stopTask;
    const current = recorder;
    if (!current || current.state === 'inactive') {
      return Promise.reject(new Error('当前没有进行中的录音。'));
    }
    stopTask = new Promise<RecordingResult>((resolve, reject) => {
      rejectStop = reject;
      current.onstop = () => {
        rejectStop = undefined;
        const mimeType = current.mimeType || chunks[0]?.type || 'audio/webm';
        const blob = new Blob(chunks, { type: mimeType });
        stopTask = undefined;
        release();
        if (!blob.size) {
          reject(new Error('没有录到声音，请先播放环境音再录音。'));
          return;
        }
        resolve({ blob, extension: getRecordingExtension(mimeType) });
      };
      current.onerror = () => {
        rejectStop = undefined;
        stopTask = undefined;
        release();
        reject(new Error('录音失败，请重试。'));
      };
      try {
        current.stop();
      } catch (error) {
        rejectStop = undefined;
        stopTask = undefined;
        release();
        reject(error);
      }
    });
    return stopTask;
  }

  function cancel(): void {
    // 取消时主动结束等待中的停止请求，避免调用方永久挂起。
    const pendingReject = rejectStop;
    rejectStop = undefined;
    stopTask = undefined;
    if (recorder) {
      const currentRecorder = recorder;
      currentRecorder.onstop = null;
      currentRecorder.onerror = null;
      try {
        if (currentRecorder.state !== 'inactive') currentRecorder.stop();
      } catch {
        // 关闭上下文前无需处理停止失败。
      }
      release();
    }
    pendingReject?.(new Error('录音已取消。'));
  }

  return { start, stop, cancel };
}
