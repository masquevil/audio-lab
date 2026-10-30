import { noteDuration, timbres } from '../constants/instruments';
import type { InstrumentVoice, TimbreId } from '../types/instrument';

export function createVoice(
  context: AudioContext,
  output: AudioNode,
  note: number,
  timbre: TimbreId,
  onEnd: () => void,
): InstrumentVoice {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const config = timbres[timbre];
  let disposed = false;
  let released = false;
  let started = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    oscillator.onended = null;
    if (started) oscillator.stop();
    oscillator.disconnect();
    gain.disconnect();
  }
  try {
    oscillator.setPeriodicWave(
      context.createPeriodicWave(
        new Float32Array(config.harmonics.length),
        new Float32Array(config.harmonics),
      ),
    );
    oscillator.frequency.value = 440 * 2 ** ((note - 69) / 12);
    const now = context.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.05, now + config.attack);
    gain.gain.exponentialRampToValueAtTime(config.sustain, now + 2);
    gain.gain.linearRampToValueAtTime(0, now + noteDuration);
    oscillator.connect(gain);
    gain.connect(output);
    oscillator.onended = () => {
      dispose();
      onEnd();
    };
    oscillator.start();
    started = true;
    oscillator.stop(now + noteDuration + 0.01);
  } catch (error) {
    dispose();
    throw error;
  }
  function release() {
    if (disposed || released) return;
    released = true;
    const now = context.currentTime;
    gain.gain.cancelAndHoldAtTime(now);
    gain.gain.linearRampToValueAtTime(0, now + 0.12);
    oscillator.stop(now + 0.13);
  }
  return { release, dispose };
}
