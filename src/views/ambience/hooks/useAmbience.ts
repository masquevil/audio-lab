import { onUnmounted, readonly, ref } from 'vue';

import { defaultIntensities, maxRecordingSeconds } from '../constants/ambience';
import { createAmbienceSession } from '../models/ambienceSession';
import type { AmbienceSession } from '../models/ambienceSession';
import { clearTextureCache } from '../models/ambienceTexture';
import type {
  AmbienceController,
  AmbienceLayerId,
  AmbienceRecording,
  RecordingStatus,
} from '../types/ambience';

function formatTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`,
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`,
  ].join('-');
}

/** 将环境音会话、混音状态和录音结果绑定到 Vue 生命周期。 */
export function useAmbience(): AmbienceController {
  const intensities = ref<Record<AmbienceLayerId, number>>({ ...defaultIntensities });
  const activeLayers = ref(new Set<AmbienceLayerId>());
  const error = ref('');
  const recordingStatus = ref<RecordingStatus>('idle');
  const recordingSeconds = ref(0);
  const recordingUrl = ref('');
  const recordingFileName = ref('');
  const supported = typeof window.AudioContext === 'function';
  const recordingSupported = supported && typeof window.MediaRecorder === 'function';

  let session: AmbienceSession | undefined;
  let sessionTask: Promise<AmbienceSession | undefined> | undefined;
  let disposed = false;
  let recordingTimer: ReturnType<typeof setInterval> | undefined;
  let recordingStartedAt = 0;

  function closeSession(immediate = false): void {
    const previousSession = session;
    session = undefined;
    sessionTask = undefined;
    if (!previousSession) return;
    void previousSession.close(immediate).catch(() => {
      if (!disposed) error.value = '音频释放失败，请刷新页面。';
    });
  }

  /**
   * 打开并恢复会话；同一时间只允许一个恢复任务。
   * 浏览器可能在后台或中断后挂起上下文，因此每次用户手势都确认它处于运行状态。
   */
  async function ensureSession(): Promise<AmbienceSession | undefined> {
    if (!sessionTask) {
      const task = openSession().catch((reason: unknown) => {
        if (sessionTask === task) sessionTask = undefined;
        throw reason;
      });
      sessionTask = task;
    }
    const current = await sessionTask;
    if (current && current === session && !current.isRunning()) await current.resume();
    return current;
  }

  async function openSession(): Promise<AmbienceSession | undefined> {
    const nextSession = createAmbienceSession();
    session = nextSession;
    try {
      await nextSession.resume();
    } catch (reason) {
      const isCurrentSession = session === nextSession;
      if (isCurrentSession) {
        session = undefined;
        sessionTask = undefined;
      }
      await nextSession.close(true).catch(() => {
        // 保留恢复失败的原始原因。
      });
      // 会话在恢复期间已被取消或替换，失败不属于当前状态。
      if (!isCurrentSession) return undefined;
      throw reason;
    }
    return nextSession;
  }

  function clearRecordingTimer(): void {
    if (!recordingTimer) return;
    clearInterval(recordingTimer);
    recordingTimer = undefined;
  }

  function discardRecording(): void {
    if (recordingUrl.value) URL.revokeObjectURL(recordingUrl.value);
    recordingUrl.value = '';
    recordingFileName.value = '';
  }

  function setRecordingResult(result: AmbienceRecording): void {
    discardRecording();
    recordingUrl.value = URL.createObjectURL(result.blob);
    recordingFileName.value = `ambience-mix-${formatTimestamp(new Date())}.${result.extension}`;
  }

  async function toggleLayer(id: AmbienceLayerId): Promise<void> {
    if (!supported || disposed) return;
    const nextActive = new Set(activeLayers.value);
    const enable = !nextActive.has(id);
    if (enable) nextActive.add(id);
    else nextActive.delete(id);
    activeLayers.value = nextActive;
    error.value = '';

    if (!enable) {
      session?.setLayerActive(id, false);
    } else {
      try {
        const current = await ensureSession();
        if (!current || disposed || current !== session) return;
        current.setLayerIntensity(id, intensities.value[id]);
        // 恢复期间用户可能已撤销选择，以最新状态为准。
        current.setLayerActive(id, activeLayers.value.has(id));
      } catch {
        if (disposed) return;
        // 上下文不可用时无法保证任何声部能发声，统一回到停止状态。
        error.value = '无法启动环境音，请检查浏览器音频设置后重试。';
        activeLayers.value = new Set();
        closeSession(true);
        return;
      }
    }

    if (!activeLayers.value.size && recordingStatus.value === 'idle') closeSession();
  }

  function setIntensity(id: AmbienceLayerId, value: number): void {
    if (!Number.isFinite(value)) return;
    const nextValue = Math.min(1, Math.max(0, value));
    intensities.value = { ...intensities.value, [id]: nextValue };
    session?.setLayerIntensity(id, nextValue);
  }

  function startRecording(): void {
    if (!recordingSupported || disposed || recordingStatus.value !== 'idle') return;
    error.value = '';
    recordingStatus.value = 'starting';
    void beginRecording();
  }

  async function beginRecording(): Promise<void> {
    try {
      const current = await ensureSession();
      if (!current || disposed || current !== session) {
        if (!disposed) recordingStatus.value = 'idle';
        return;
      }
      current.startRecording();
      recordingStatus.value = 'recording';
      recordingSeconds.value = 0;
      recordingStartedAt = Date.now();
      recordingTimer = setInterval(tickRecording, 250);
    } catch {
      if (disposed) return;
      recordingStatus.value = 'idle';
      error.value = '无法开始录音，请检查浏览器音频设置后重试。';
      if (!activeLayers.value.size) closeSession(true);
    }
  }

  function tickRecording(): void {
    if (recordingStatus.value !== 'recording') return;
    const elapsed = (Date.now() - recordingStartedAt) / 1000;
    recordingSeconds.value = Math.min(elapsed, maxRecordingSeconds);
    if (elapsed >= maxRecordingSeconds) void stopRecording();
  }

  async function stopRecording(): Promise<void> {
    const currentSession = session;
    if (recordingStatus.value !== 'recording' || !currentSession) return;
    recordingStatus.value = 'processing';
    clearRecordingTimer();
    try {
      const result = await currentSession.stopRecording();
      if (!disposed) setRecordingResult(result);
    } catch (reason) {
      if (!disposed) error.value = reason instanceof Error ? reason.message : '录音失败，请重试。';
    } finally {
      if (!disposed) {
        recordingStatus.value = 'idle';
        if (!activeLayers.value.size) closeSession();
      }
    }
  }

  onUnmounted(() => {
    disposed = true;
    clearRecordingTimer();
    discardRecording();
    closeSession(true);
    clearTextureCache();
  });

  return {
    intensities: readonly(intensities),
    activeLayers: readonly(activeLayers),
    error: readonly(error),
    supported,
    recordingSupported,
    recordingStatus: readonly(recordingStatus),
    recordingSeconds: readonly(recordingSeconds),
    recordingUrl: readonly(recordingUrl),
    recordingFileName: readonly(recordingFileName),
    toggleLayer,
    setIntensity,
    startRecording,
    stopRecording,
    discardRecording,
  };
}
