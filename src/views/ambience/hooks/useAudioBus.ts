import { onUnmounted, readonly, ref } from 'vue';

import { createAudioBus } from '../models/audioBus';
import type { AcquireAudioBus, AudioBusController } from '../types/audioBus';

/** 不支持 Web Audio 时统一返回空借用，调用方据此停用声源。 */
async function acquireNothing(): Promise<undefined> {
  return undefined;
}

/**
 * 页面级唯一音频总线：上下文、限幅与租约都在这里管理。
 * 页面内所有声源与消费者共享它，最后一个借用方归还后释放实例。
 */
export function useAudioBus(): AudioBusController {
  const supported = typeof window.AudioContext === 'function';
  const error = ref('');
  const bus = supported
    ? createAudioBus({
        onError: (message) => {
          error.value = message;
        },
      })
    : undefined;

  onUnmounted(() => bus?.dispose());

  // 上一次释放失败不影响新实例；重新取用成功即清掉旧提示。
  const acquire: AcquireAudioBus = bus
    ? async () => {
        const lease = await bus.acquire();
        if (lease) error.value = '';
        return lease;
      }
    : acquireNothing;
  return { supported, error: readonly(error), acquire };
}
