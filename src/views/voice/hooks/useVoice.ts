import { onUnmounted, readonly, ref } from 'vue';

import { createSynthesisSession } from '../models/synthesisSession';
import type { VoiceSynthesisSession } from '../models/synthesisSession';
import type { VoiceSynthesisOptions } from '../types/voice';

/** 将合成会话绑定到 Vue 状态和组件生命周期。 */
export function useVoice() {
  // 展示状态与浏览器能力。
  const playing = ref(false);
  const error = ref('');
  const supported = typeof window.AudioContext === 'function';

  // 当前会话及异步结果归属。
  let session: VoiceSynthesisSession | undefined;
  let disposed = false;
  let version = 0;

  /** 立即撤销当前会话归属，资源层自行完成淡出和释放。 */
  function stop(immediate = false) {
    const requestVersion = ++version;
    const previousSession = session;
    session = undefined;
    playing.value = false;
    void previousSession?.closeSession(immediate).catch(() => {
      if (!disposed && version === requestVersion) error.value = '音频释放失败，请刷新页面。';
    });
  }

  async function play(options: VoiceSynthesisOptions) {
    if (!supported || disposed) return;
    stop();
    const requestVersion = version;
    error.value = '';
    playing.value = true;
    try {
      const currentSession = createSynthesisSession();
      session = currentSession;
      await currentSession.resume();
      if (disposed || session !== currentSession) return;
      currentSession.playToneSequence(options, () => {
        if (session === currentSession) stop(true);
      });
    } catch {
      if (!disposed && requestVersion === version) {
        stop(true);
        error.value = '无法启动音频，请检查浏览器音频设置后重试。';
      }
    }
  }

  // 生命周期：旧会话关闭失败不再写入卸载后的状态。
  onUnmounted(() => {
    disposed = true;
    stop();
  });

  return { playing: readonly(playing), error: readonly(error), supported, play, stop };
}
