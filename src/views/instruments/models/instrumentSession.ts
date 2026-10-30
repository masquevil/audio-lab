import type { InstrumentVoice } from '../types/instrument';

/** 一次音频会话拥有节点和单音状态，不持有 Vue 状态或组件回调。 */
export interface InstrumentSession {
  context: AudioContext;
  output: GainNode;
  /** 正在恢复音频的启动请求；启动成功后移除。 */
  pendingNotes: Map<number, symbol>;
  /** 含仍在松键衰减的声音，结束后移除。 */
  voices: Map<number, InstrumentVoice>;
  /** 默认先淡出；初始化或播放失败时可立即销毁。 */
  close(immediate?: boolean): Promise<void>;
}

export function createInstrumentSession(volume: number): InstrumentSession {
  const context = new AudioContext();
  let output: GainNode;
  try {
    output = context.createGain();
    output.gain.value = volume;
    output.connect(context.destination);
  } catch (error) {
    // 创建尚未完成，不能把半成品会话交给调用方管理。
    void context.close().catch(() => {
      // 保留原始初始化异常，不用清理异常覆盖它。
    });
    throw error;
  }
  const pendingNotes = new Map<number, symbol>();
  const voices = new Map<number, InstrumentVoice>();
  let closing: Promise<void> | undefined;

  async function disposeResources(): Promise<void> {
    try {
      for (const voice of voices.values()) voice.dispose();
    } finally {
      voices.clear();
      output.disconnect();
      if (context.state !== 'closed') await context.close();
    }
  }

  async function finishClose(immediate: boolean): Promise<void> {
    try {
      if (!immediate && voices.size && context.state === 'running') {
        const now = context.currentTime;
        output.gain.cancelAndHoldAtTime(now);
        output.gain.linearRampToValueAtTime(0, now + 0.02);
        await new Promise<void>((resolve) => setTimeout(resolve, 30));
      }
    } finally {
      await disposeResources();
    }
  }

  function close(immediate = false): Promise<void> {
    if (closing) return closing;
    pendingNotes.clear();
    closing = finishClose(immediate);
    return closing;
  }

  return { context, output, pendingNotes, voices, close };
}
