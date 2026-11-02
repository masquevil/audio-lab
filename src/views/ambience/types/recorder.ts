import type { Ref } from 'vue';

export type RecordingStatus = 'idle' | 'starting' | 'recording' | 'processing';

/** 一次录音的原始结果，由资源层返回。 */
export interface RecordingResult {
  blob: Blob;
  /** 与 MIME 对应的文件扩展名。 */
  extension: string;
}

/** 供试听和下载的记录文件；地址与文件名同时创建、同时释放。 */
export interface RecordingFile {
  url: string;
  fileName: string;
}

export interface RecorderOptions {
  /** 下载文件名前缀，扩展名按实际录音容器补全。 */
  fileNamePrefix: string;
  /** 单次录音上限，秒；达到后自动停止。 */
  maxSeconds: number;
}

export interface RecorderController {
  supported: boolean;
  status: Readonly<Ref<RecordingStatus>>;
  /** 已录制时长，秒；达到上限后自动停止。 */
  seconds: Readonly<Ref<number>>;
  /** 最近一次录音结果；null 表示没有结果。 */
  result: Readonly<Ref<RecordingFile | null>>;
  error: Readonly<Ref<string>>;
  /** 向页面借用总线并开始录音；不支持、未就绪或已有录音时忽略。 */
  start(): void;
  /** 结束录音并生成结果；不在录制中时立即返回。 */
  stop(): Promise<void>;
  /** 清除最近一次录音结果。 */
  discard(): void;
}
