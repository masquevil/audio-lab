import { onUnmounted, readonly, ref } from 'vue';

import { defaultIntensities } from '../constants/ambience';
import { createAmbienceMix } from '../models/ambienceMix';
import type { AmbienceMix } from '../models/ambienceMix';
import { clearTextureCache, textureWarmupTasks } from '../models/ambienceTexture';
import type { AmbienceController, AmbienceLayerId } from '../types/ambience';
import type { AudioBusHost, AudioBusLease } from '../types/audioBus';

/** 预生成纹理时假设的采样率；多数设备为 48kHz，不一致时首次播放会重新生成。 */
const warmupSampleRate = 48_000;

/** 空闲回调；不支持时退化为短延时，避免阻塞交互。 */
function scheduleIdle(callback: () => void): number {
  if (typeof window.requestIdleCallback === 'function') {
    return window.requestIdleCallback(callback);
  }
  return window.setTimeout(callback, 200);
}

function cancelIdle(handle: number): void {
  if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(handle);
  else window.clearTimeout(handle);
}

/** 将声部状态绑定到 Vue 生命周期；上下文与限幅由页面总线负责。 */
export function useAmbience(host: AudioBusHost): AmbienceController {
  const intensities = ref<Record<AmbienceLayerId, number>>({ ...defaultIntensities });
  const activeLayers = ref(new Set<AmbienceLayerId>());
  const error = ref('');

  let mix: AmbienceMix | undefined;
  let mixTask: Promise<AmbienceMix | undefined> | undefined;
  let lease: AudioBusLease | undefined;
  let disposed = false;
  let idleHandle: number | undefined;

  function stopWarmup(): void {
    if (idleHandle === undefined) return;
    cancelIdle(idleHandle);
    idleHandle = undefined;
  }

  /**
   * 用页面空闲时间分批预生成首次播放会用到的纹理，避免第一次点击时才渲染。
   * 一旦建立会话（真实采样率已确定）就停止：此时要么已命中缓存，
   * 要么需要按真实采样率重新生成，继续预生成没有意义。
   */
  function warmupTextures(): void {
    const tasks = textureWarmupTasks(warmupSampleRate);
    const run = (): void => {
      idleHandle = undefined;
      if (disposed || mix) return;
      const task = tasks.shift();
      if (!task) return;
      try {
        task();
      } catch {
        return; // 预生成失败不影响正常播放，点击时会重新尝试
      }
      if (tasks.length) idleHandle = scheduleIdle(run);
    };
    idleHandle = scheduleIdle(run);
  }

  /** 总线被销毁时，声部图与租约同时失效，面板回到停止状态。 */
  function handleLeaseLost(): void {
    activeLayers.value = new Set();
    releaseMix(true);
  }

  /** 释放声部图并归还总线；最后一个借用方会让总线淡出并关闭实例。 */
  function releaseMix(immediate = false): void {
    const currentLease = lease;
    const currentMix = mix;
    lease = undefined;
    mix = undefined;
    // 仍在创建中的任务保持复用，避免并发点击产生两个声部图。
    if (currentMix) mixTask = undefined;
    currentMix?.dispose(immediate);
    currentLease?.release();
  }

  /** 取得总线并建立本页声部图；同一时间只允许一个创建任务。 */
  async function openMix(): Promise<AmbienceMix | undefined> {
    const nextLease = await host.acquire();
    if (!nextLease) return undefined;
    if (disposed) {
      nextLease.release();
      return undefined;
    }
    let nextMix: AmbienceMix;
    try {
      nextMix = createAmbienceMix(nextLease.context, nextLease.input);
    } catch (reason) {
      // 建立失败时归还总线，避免留下无人使用的实例。
      nextLease.release();
      throw reason;
    }
    nextLease.onLost(handleLeaseLost);
    lease = nextLease;
    mix = nextMix;
    return nextMix;
  }

  function ensureMix(): Promise<AmbienceMix | undefined> {
    mixTask ??= openMix()
      .then((current) => {
        // 本次未取得总线（被取消或页面已卸载）时允许下次重试。
        if (!current) mixTask = undefined;
        return current;
      })
      .catch((reason: unknown) => {
        mixTask = undefined;
        throw reason;
      });
    return mixTask;
  }

  async function toggleLayer(id: AmbienceLayerId): Promise<void> {
    if (!host.supported || disposed) return;
    const nextActive = new Set(activeLayers.value);
    const enable = !nextActive.has(id);
    if (enable) nextActive.add(id);
    else nextActive.delete(id);
    activeLayers.value = nextActive;
    error.value = '';

    if (!enable) {
      mix?.setLayerActive(id, false);
      if (!nextActive.size) releaseMix();
      return;
    }

    try {
      const current = await ensureMix();
      if (!current || disposed) return;
      current.setLayerIntensity(id, intensities.value[id]);
      // 等待总线期间用户可能已撤销选择，以最新状态为准。
      current.setLayerActive(id, activeLayers.value.has(id));
      // 等待期间用户可能已关闭全部声部，此时不再保留空转的声部图。
      if (!activeLayers.value.size) releaseMix();
    } catch {
      if (disposed) return;
      // 上下文不可用时无法保证任何声部能发声，统一回到停止状态。
      activeLayers.value = new Set();
      error.value = '无法启动环境音，请检查浏览器音频设置后重试。';
      releaseMix();
    }
  }

  function setIntensity(id: AmbienceLayerId, value: number): void {
    if (!Number.isFinite(value)) return;
    const nextValue = Math.min(1, Math.max(0, value));
    intensities.value = { ...intensities.value, [id]: nextValue };
    mix?.setLayerIntensity(id, nextValue);
  }

  onUnmounted(() => {
    disposed = true;
    stopWarmup();
    releaseMix(true);
    clearTextureCache();
  });

  if (host.supported) warmupTextures();

  return {
    intensities: readonly(intensities),
    activeLayers: readonly(activeLayers),
    error: readonly(error),
    toggleLayer,
    setIntensity,
  };
}
