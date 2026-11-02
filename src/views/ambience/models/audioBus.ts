import type { AudioBusLease, AudioBusPipes } from '../types/audioBus';

/** 总线主增益，声源与消费者共用这一级输出。 */
const masterGainValue = 0.8;

/** 最后一个借用方归还后的淡出时长与等待时间，毫秒/秒。 */
const fadeOutSeconds = 0.12;
const fadeOutWait = 160;

/** 只做峰值保护：雷声等瞬态不能被压平，因此阈值高、启动慢、比例大。 */
const limiterConfig = {
  threshold: -6,
  knee: 6,
  ratio: 12,
  attack: 0.005,
  release: 0.2,
} as const;

export interface AudioBusOptions {
  /** 无法抛给借用方的问题（如释放失败）；由调用方决定如何提示。 */
  onError?(message: string): void;
}

interface BusInstance extends AudioBusPipes {
  readonly context: AudioContext;
  readonly input: GainNode;
  readonly output: AudioNode;
}

interface ManagedLease extends AudioBusLease {
  /** 实例销毁时由总线调用，借用方不能再归还。 */
  invalidate(): void;
}

export interface AudioBus {
  /** 取得总线；没有实例时创建并恢复上下文。 */
  acquire(): Promise<AudioBusLease | undefined>;
  /** 页面卸载：通知借用方并立即关闭，之后不再可用。 */
  dispose(): void;
}

/** 页面级音频总线：拥有上下文、限幅与租约，不感知具体声源。 */
export function createAudioBus(options: AudioBusOptions = {}): AudioBus {
  let instance: BusInstance | undefined;
  const leases = new Set<ManagedLease>();
  let disposed = false;

  function open(): BusInstance {
    const context = new AudioContext();
    try {
      const input = context.createGain();
      input.gain.value = masterGainValue;
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = limiterConfig.threshold;
      limiter.knee.value = limiterConfig.knee;
      limiter.ratio.value = limiterConfig.ratio;
      limiter.attack.value = limiterConfig.attack;
      limiter.release.value = limiterConfig.release;
      input.connect(limiter);
      limiter.connect(context.destination);
      return { context, input, output: limiter };
    } catch (error) {
      // 创建尚未完成，不能把半成品实例交给调用方管理。
      void context.close().catch(() => {
        // 保留原始初始化异常，不用清理异常覆盖它。
      });
      throw error;
    }
  }

  /** 关闭实例：正常停止先淡出，避免最后一段衰减被硬切。 */
  function close(immediate = false): void {
    const current = instance;
    instance = undefined;
    if (!current) return;
    void (async () => {
      try {
        if (!immediate && current.context.state === 'running') {
          const now = current.context.currentTime;
          const { gain } = current.input;
          if (typeof gain.cancelAndHoldAtTime === 'function') {
            gain.cancelAndHoldAtTime(now);
          } else {
            // Safari 未实现 cancelAndHoldAtTime：撤销未来事件并固定当前值，再从这里淡出。
            gain.cancelScheduledValues(now);
            gain.setValueAtTime(gain.value, now);
          }
          gain.linearRampToValueAtTime(0, now + fadeOutSeconds);
          await new Promise<void>((resolve) => setTimeout(resolve, fadeOutWait));
        }
      } finally {
        await current.context.close();
      }
    })().catch(() => {
      options.onError?.('音频释放失败，请刷新页面。');
    });
  }

  function releaseLease(lease: ManagedLease): void {
    leases.delete(lease);
    if (!leases.size) close();
  }

  function createLease(current: BusInstance): ManagedLease {
    let lostListener: (() => void) | undefined;
    let finished = false;
    const lease: ManagedLease = {
      context: current.context,
      input: current.input,
      output: current.output,
      onLost(listener) {
        lostListener = listener;
      },
      release() {
        if (finished) return;
        finished = true;
        releaseLease(lease);
      },
      invalidate() {
        if (finished) return;
        finished = true;
        lostListener?.();
      },
    };
    leases.add(lease);
    return lease;
  }

  async function acquire(): Promise<AudioBusLease | undefined> {
    if (disposed) return undefined;
    if (!instance) instance = open();
    const current = instance;
    if (current.context.state !== 'running') {
      try {
        await current.context.resume();
      } catch (reason) {
        // 没有其他借用方时，挂起的实例没有保留价值。
        if (!leases.size) close(true);
        throw reason;
      }
    }
    return createLease(current);
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    const pending = [...leases];
    leases.clear();
    // 先让借用方同步收尾（断开节点、中止录音），再关闭上下文。
    for (const lease of pending) lease.invalidate();
    close(true);
  }

  return { acquire, dispose };
}
