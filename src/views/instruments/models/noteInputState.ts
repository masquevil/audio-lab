import type { NoteInputKind, NoteInputSource, NoteInputState } from '../types/noteInput';

export function createNoteInputState(): NoteInputState {
  const heldNotes = new Map<NoteInputKind, Map<string | number, number>>();
  heldNotes.set('keyboard', new Map());
  heldNotes.set('pointer', new Map());

  function isNoteHeld(note: number): boolean {
    return [...heldNotes.values()].some((sources) => [...sources.values()].includes(note));
  }

  function pressNote(source: NoteInputSource, note: number): number | undefined {
    const sources = heldNotes.get(source.kind)!;
    if (sources.has(source.id)) return;
    const alreadyHeld = isNoteHeld(note);
    sources.set(source.id, note);
    return alreadyHeld ? undefined : note;
  }

  function releaseNote(source: NoteInputSource): number | undefined {
    const sources = heldNotes.get(source.kind)!;
    const note = sources.get(source.id);
    sources.delete(source.id);
    return note !== undefined && !isNoteHeld(note) ? note : undefined;
  }

  function resetNotes(): void {
    heldNotes.forEach((sources) => sources.clear());
  }

  return { pressNote, releaseNote, resetNotes };
}
