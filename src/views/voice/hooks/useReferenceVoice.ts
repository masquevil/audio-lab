import { onUnmounted, readonly, ref } from 'vue';

import { createReferenceSession } from '../models/referenceSession';

/** 将参考录音会话绑定到 Vue 状态和组件生命周期。 */
export function useReferenceVoice() {
  // 展示状态与浏览器能力。
  const error = ref('');
  const active = ref('');
  const supported = typeof window.AudioContext === 'function';

  // 当前会话及异步结果归属。
  let session: ReturnType<typeof createReferenceSession> | undefined;
  let disposed = false;
  let version = 0;

  /** 立即撤销当前会话归属，资源层自行完成淡出和释放。 */
  function stop(immediate = false) {
    const requestVersion = ++version;
    const previousSession = session;
    session = undefined;
    active.value = '';
    void previousSession?.closeSession(immediate).catch(() => {
      if (!disposed && version === requestVersion) error.value = '音频释放失败，请刷新页面。';
    });
  }

  async function play(recordingUrl: string, label: string) {
    if (!supported || disposed) return;
    stop();
    const requestVersion = version;
    error.value = '';
    active.value = label;

    function reportFailure() {
      if (disposed || requestVersion !== version) return;
      stop(true);
      error.value = '参考录音加载或播放失败，请重试。';
    }

    try {
      const currentSession = createReferenceSession(
        recordingUrl,
        () => {
          if (session === currentSession) stop(true);
        },
        reportFailure,
      );
      session = currentSession;
      await currentSession.playRecording();
    } catch {
      reportFailure();
    }
  }

  // 生命周期：旧会话关闭失败不再写入卸载后的状态。
  onUnmounted(() => {
    disposed = true;
    stop();
  });

  return { error: readonly(error), active: readonly(active), play, stop };
}
