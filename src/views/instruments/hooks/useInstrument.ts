import { onUnmounted, readonly, ref } from 'vue';

import { notes } from '../constants/instruments';
import { createInstrumentSession } from '../models/instrumentSession';
import type { InstrumentSession } from '../models/instrumentSession';
import { createVoice } from '../models/instrumentVoice';
import type { InstrumentController, TimbreId } from '../types/instrument';

export function useInstrument(): InstrumentController {
  const timbre = ref<TimbreId>('piano');
  const volume = ref(0.7);
  const error = ref('');
  const activeNotes = ref(new Set<number>());
  const supported = typeof window.AudioContext === 'function';
  let session: InstrumentSession | undefined;
  let sessionVersion = 0;
  let disposed = false;

  function closeSession(immediate = false): void {
    const previous = session;
    session = undefined;
    activeNotes.value.clear();
    const version = sessionVersion;
    void previous?.close(immediate).catch(() => {
      if (!disposed && sessionVersion === version) error.value = '音频释放失败，请刷新页面。';
    });
  }

  function stopAll(): void {
    closeSession();
  }

  function closeIfIdle(current: InstrumentSession): void {
    if (session === current && !current.pendingNotes.size && !current.voices.size) stopAll();
  }

  async function play(note: number): Promise<void> {
    if (
      !supported ||
      disposed ||
      activeNotes.value.has(note) ||
      session?.pendingNotes.has(note) ||
      !notes.some((item) => item.midi === note)
    )
      return;
    error.value = '';
    let current: InstrumentSession | undefined;
    const request = Symbol();
    try {
      if (!session) {
        sessionVersion++;
        session = createInstrumentSession(volume.value);
      }
      current = session;
      current.pendingNotes.set(note, request);
      await current.context.resume();
      if (disposed || session !== current || current.pendingNotes.get(note) !== request) return;
      current.voices.get(note)?.dispose();
      const owner = current;
      const voice = createVoice(owner.context, owner.output, note, timbre.value, () => {
        if (session !== owner || owner.voices.get(note) !== voice) return;
        owner.voices.delete(note);
        activeNotes.value.delete(note);
        closeIfIdle(owner);
      });
      current.pendingNotes.delete(note);
      current.voices.set(note, voice);
      activeNotes.value.add(note);
    } catch {
      if (
        !disposed &&
        (!current || (session === current && current.pendingNotes.get(note) === request))
      ) {
        closeSession(true);
        error.value = '无法启动音频，请检查浏览器设置后重试。';
      }
    }
  }

  function release(note: number): void {
    activeNotes.value.delete(note);
    if (!session) return;
    session.pendingNotes.delete(note);
    session.voices.get(note)?.release();
    closeIfIdle(session);
  }

  function setTimbre(value: TimbreId): void {
    if (value === timbre.value) return;
    stopAll();
    timbre.value = value;
  }

  function setVolume(value: number): void {
    if (!Number.isFinite(value)) return;
    volume.value = Math.min(1, Math.max(0, value));
    if (session)
      session.output.gain.setTargetAtTime(volume.value, session.context.currentTime, 0.02);
  }

  onUnmounted(() => {
    disposed = true;
    stopAll();
  });
  return {
    timbre: readonly(timbre),
    volume: readonly(volume),
    error: readonly(error),
    activeNotes: readonly(activeNotes),
    supported,
    play,
    release,
    stopAll,
    setTimbre,
    setVolume,
  };
}
