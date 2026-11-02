import { onUnmounted, readonly, ref } from 'vue';

import { createRecorderSession } from '../models/recorderSession';
import type { RecorderSession } from '../models/recorderSession';
import type { AudioBusHost, AudioBusLease } from '../types/audioBus';
import type {
  RecorderController,
  RecorderOptions,
  RecordingFile,
  RecordingResult,
  RecordingStatus,
} from '../types/recorder';

/** 计时刷新间隔，毫秒。 */
const tickInterval = 250;

function formatTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`,
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`,
  ].join('-');
}

/**
 * 将录音会话绑定到 Vue 状态和组件生命周期。
 * 录音只录制借到的这一条混音输出；借用期间页面不会释放总线实例，
 * 实例被销毁时通过租约的 lost 通知中止录音。
 */
export function useRecorder(host: AudioBusHost, options: RecorderOptions): RecorderController {
  const supported = host.supported && typeof window.MediaRecorder === 'function';
  const status = ref<RecordingStatus>('idle');
  const seconds = ref(0);
  const result = ref<RecordingFile | null>(null);
  const error = ref('');

  let session: RecorderSession | undefined;
  let lease: AudioBusLease | undefined;
  // 启动期间可能被取消或替换，用版本号判定异步结果归属。
  let startVersion = 0;
  let disposed = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let startedAt = 0;

  function clearTimer(): void {
    if (!timer) return;
    clearInterval(timer);
    timer = undefined;
  }

  function clearResult(): void {
    if (result.value) URL.revokeObjectURL(result.value.url);
    result.value = null;
  }

  function setResult(recording: RecordingResult): void {
    clearResult();
    result.value = {
      url: URL.createObjectURL(recording.blob),
      fileName: `${options.fileNamePrefix}-${formatTimestamp(new Date())}.${recording.extension}`,
    };
  }

  /** 归还总线；页面据此释放已空转的会话。 */
  function releaseBus(): void {
    const current = lease;
    lease = undefined;
    current?.release();
  }

  /** 结束计时并回到空闲；总线由调用方决定何时归还。 */
  function finishRecording(): void {
    clearTimer();
    status.value = 'idle';
  }

  function start(): void {
    if (!supported || disposed || status.value !== 'idle') return;
    const version = ++startVersion;
    error.value = '';
    status.value = 'starting';
    void begin(version);
  }

  async function begin(version: number): Promise<void> {
    let acquired: AudioBusLease | undefined;
    try {
      acquired = await host.acquire();
    } catch {
      if (disposed || version !== startVersion) return;
      finishRecording();
      error.value = '无法开始录音，请检查浏览器音频设置后重试。';
      return;
    }
    // 等待期间已被取消：归还刚借到的总线，状态已由 cancel 复位。
    if (disposed || version !== startVersion) {
      acquired?.release();
      return;
    }
    if (!acquired) {
      finishRecording();
      return;
    }
    try {
      const nextSession = createRecorderSession(acquired);
      nextSession.start();
      session = nextSession;
      lease = acquired;
      acquired.onLost(cancel);
      status.value = 'recording';
      seconds.value = 0;
      startedAt = Date.now();
      timer = setInterval(tick, tickInterval);
    } catch {
      session = undefined;
      finishRecording();
      acquired.release();
      if (!disposed) error.value = '无法开始录音，请检查浏览器音频设置后重试。';
    }
  }

  function tick(): void {
    if (status.value !== 'recording') return;
    const elapsed = (Date.now() - startedAt) / 1000;
    seconds.value = Math.min(elapsed, options.maxSeconds);
    if (elapsed >= options.maxSeconds) void stop();
  }

  async function stop(): Promise<void> {
    if (status.value !== 'recording') return;
    clearTimer();
    const current = session;
    if (!current) {
      finishRecording();
      releaseBus();
      return;
    }
    status.value = 'processing';
    try {
      const recording = await current.stop();
      if (!disposed && session === current) setResult(recording);
    } catch (reason) {
      if (disposed || session !== current) return;
      error.value = reason instanceof Error ? reason.message : '录音失败，请重试。';
    } finally {
      // 会话已被取消时状态由 cancel 复位，不能覆盖新录音的状态。
      if (!disposed && session === current) {
        session = undefined;
        finishRecording();
        releaseBus();
      }
    }
  }

  /** 取消进行中的录音并归还总线；会话被销毁或页面卸载时也会走这里。 */
  function cancel(): void {
    startVersion++;
    const current = session;
    session = undefined;
    current?.cancel();
    clearTimer();
    if (status.value !== 'idle') status.value = 'idle';
    releaseBus();
  }

  function discard(): void {
    clearResult();
  }

  onUnmounted(() => {
    disposed = true;
    cancel();
    clearResult();
  });

  return {
    supported,
    status: readonly(status),
    seconds: readonly(seconds),
    result: readonly(result),
    error: readonly(error),
    start,
    stop,
    discard,
  };
}
