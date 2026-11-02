import type { Ref } from 'vue';

/** 页面总线的两端：声源从 `input` 接入，消费者从 `output` 取流。 */
export interface AudioBusPipes {
  /** 与全部节点同源的上下文，声源与消费者都用它创建节点。 */
  readonly context: AudioContext;
  /** 混音入口，位于限幅之前。 */
  readonly input: AudioNode;
  /** 总线最终输出，录音等消费者从这里取流。 */
  readonly output: AudioNode;
}

/** 借用的总线；归还或销毁前，页面不会释放这个实例。 */
export interface AudioBusLease extends AudioBusPipes {
  /** 总线被销毁或替换时触发，借用方必须停止使用并复位。 */
  onLost(listener: () => void): void;
  /** 归还管道；最后一个归还的人触发实例释放。 */
  release(): void;
}

/** 取得总线租约；返回 undefined 表示本次取用被取消，抛出表示无法取得。 */
export type AcquireAudioBus = () => Promise<AudioBusLease | undefined>;

/** 声源与消费者需要的总线能力，由 useAudioBus 提供。 */
export interface AudioBusHost {
  readonly supported: boolean;
  readonly acquire: AcquireAudioBus;
}

/** 页面持有总线时的完整契约，额外包含总线自身的错误。 */
export interface AudioBusController extends AudioBusHost {
  /** 创建或释放总线失败；借用方的错误由各自模块报告。 */
  readonly error: Readonly<Ref<string>>;
}
