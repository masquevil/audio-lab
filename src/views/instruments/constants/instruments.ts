import type { InstrumentNote, Octave, TimbreConfig, TimbreId } from '../types/instrument';

export const timbres: Record<TimbreId, TimbreConfig> = {
  piano: {
    label: '钢琴',
    icon: '♬',
    detail: '清晰起音，自然衰减',
    harmonics: [0, 1, 0.45, 0.2, 0.1],
    attack: 0.008,
    sustain: 0.001,
  },
  violin: {
    label: '小提琴',
    icon: '𝄞',
    detail: '柔和渐入，丰富泛音',
    harmonics: [0, 1, 0.65, 0.45, 0.3, 0.2, 0.12],
    attack: 0.1,
    sustain: 0.035,
  },
  flute: {
    label: '竹笛',
    icon: '♫',
    detail: '轻盈纯净，悠长气息',
    harmonics: [0, 1, 0.12, 0.07],
    attack: 0.1,
    sustain: 0.035,
  },
};
export const keyboardKeys = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j'];
export const octaves: readonly Octave[] = [3, 4, 5];
export const noteDuration = 8;
interface PitchConfig {
  name: string;
  /** 当前八度内，以白键宽度为单位的位置。 */
  position: number;
}
const pitches: PitchConfig[] = [
  { name: 'C', position: 0 },
  { name: 'C♯', position: 1 },
  { name: 'D', position: 1 },
  { name: 'D♯', position: 2 },
  { name: 'E', position: 2 },
  { name: 'F', position: 3 },
  { name: 'F♯', position: 4 },
  { name: 'G', position: 4 },
  { name: 'G♯', position: 5 },
  { name: 'A', position: 5 },
  { name: 'A♯', position: 6 },
  { name: 'B', position: 6 },
];
export const notes: InstrumentNote[] = octaves.flatMap((row, octaveIndex) =>
  pitches.map((config, pitch): InstrumentNote => ({
    midi: (row + 1) * pitches.length + pitch,
    name: `${config.name}${row}`,
    row,
    pitch,
    sharp: config.name.includes('♯'),
    position: octaveIndex * 7 + config.position,
  })),
);
