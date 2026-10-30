/** 来源种类与标识类型的唯一契约，不使用可解析的字符串前缀。 */
export type NoteInputSource = { kind: 'keyboard'; id: string } | { kind: 'pointer'; id: number };

export type NoteInputKind = NoteInputSource['kind'];

export interface NoteInputState {
  /** 首个持有音符的来源返回音高，其余返回 undefined。 */
  pressNote(source: NoteInputSource, note: number): number | undefined;
  /** 最后一个来源释放时返回音高。 */
  releaseNote(source: NoteInputSource): number | undefined;
  resetNotes(): void;
}
