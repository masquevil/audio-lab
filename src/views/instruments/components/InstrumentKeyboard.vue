<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';

import { keyboardKeys as keys, notes, octaves } from '../constants/instruments';
import { createNoteInputState } from '../models/noteInputState';
import type { Octave } from '../types/instrument';
import type { NoteInputSource } from '../types/noteInput';

interface Props {
  octave: Octave;
  /** 实际已启动且尚未松开的音符，驱动琴键高亮。 */
  activeNotes: ReadonlySet<number>;
  supported: boolean;
}
interface Emits {
  (event: 'press', note: number): void;
  (event: 'release', note: number): void;
  (event: 'reset'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
const noteInput = createNoteInputState();

// 处理按键变化
function pressNote(source: NoteInputSource, note: number) {
  const pressedNote = noteInput.pressNote(source, note);
  if (pressedNote !== undefined) emit('press', pressedNote);
}
function releaseNote(source: NoteInputSource) {
  const releasedNote = noteInput.releaseNote(source);
  if (releasedNote !== undefined) emit('release', releasedNote);
}
function resetNotes(): void {
  noteInput.resetNotes();
  emit('reset');
}

function handlePointerDown(event: PointerEvent, note: number) {
  if (event.button !== 0 || !(event.currentTarget instanceof HTMLElement)) return;
  event.currentTarget.setPointerCapture(event.pointerId);
  pressNote({ kind: 'pointer', id: event.pointerId }, note);
}
function handlePointerRelease(event: PointerEvent) {
  releaseNote({ kind: 'pointer', id: event.pointerId });
}
function handleKeyboardDown(event: KeyboardEvent) {
  if (
    event.target instanceof HTMLElement &&
    event.target.closest('input, select, button:not(.note-key), a, [contenteditable]')
  )
    return;
  if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
  const index = keys.indexOf(event.key.toLowerCase());
  if (index < 0) return;
  event.preventDefault();
  const note = notes.find((item) => item.row === props.octave && item.pitch === index);
  if (note) pressNote({ kind: 'keyboard', id: event.code }, note.midi);
}
function handleKeyboardUp(event: KeyboardEvent) {
  releaseNote({ kind: 'keyboard', id: event.code });
}
function handleVisibilityChange() {
  if (document.hidden) resetNotes();
}
function handleWindowBlur() {
  resetNotes();
}

defineExpose({ clearHeldNotes: noteInput.resetNotes });

onMounted(() => {
  window.addEventListener('keydown', handleKeyboardDown);
  window.addEventListener('keyup', handleKeyboardUp);
  window.addEventListener('blur', handleWindowBlur);
  document.addEventListener('visibilitychange', handleVisibilityChange);
});
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyboardDown);
  window.removeEventListener('keyup', handleKeyboardUp);
  window.removeEventListener('blur', handleWindowBlur);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  resetNotes();
});
</script>

<template>
  <div
    class="keyboard-scroll keyboard-theme"
    aria-label="三个八度键盘，可横向滚动"
    tabindex="0"
  >
    <div class="note-grid">
      <button
        v-for="note in notes"
        :key="note.midi"
        class="note-key"
        :class="{
          'sharp-key': note.sharp,
          'active-key': activeNotes.has(note.midi),
        }"
        :style="{ '--key-position': note.position }"
        :disabled="!supported"
        :aria-label="note.name"
        :aria-pressed="activeNotes.has(note.midi)"
        @pointerdown="handlePointerDown($event, note.midi)"
        @pointerup="handlePointerRelease"
        @pointercancel="handlePointerRelease"
        @lostpointercapture="handlePointerRelease"
      >
        <span>{{ note.name }}</span>
        <small class="key-shortcut">{{
          note.row === octave ? keys[note.pitch]?.toUpperCase() : ''
        }}</small>
      </button>
    </div>
  </div>
  <div class="keyboard-caption">
    <span
      v-for="value in octaves"
      :key="value"
    >
      C{{ value }} — B{{ value }}
    </span>
  </div>
</template>

<style scoped lang="scss">
@use '@/assets/keyboard';

// 琴键容器
.keyboard-scroll {
  padding-bottom: 5px;
  overflow-x: auto;
}

.note-grid {
  position: relative;

  min-width: 700px;
  height: 176px;
  border-radius: 6px;
  overflow: hidden;
}

// 琴键外观与状态
.note-key {
  position: absolute;
  top: 0;
  left: calc(var(--key-position) * 100% / 21);

  display: flex;
  flex-direction: column;
  justify-content: end;
  align-items: center;

  width: calc(100% / 21);
  height: 172px;
  padding: 0 0 12px;

  border: 1px solid var(--color-key-edge);
  border-radius: 0 0 5px 5px;
  background: linear-gradient(var(--color-key-white), var(--color-key-bottom));
  box-shadow: inset 0 -4px 0 var(--color-key-shadow);

  font-size: 10px;
  color: var(--color-key-label);

  cursor: pointer;
  touch-action: pan-x;
  user-select: none;

  .key-shortcut {
    height: 12px;
    margin-top: 6px;
  }

  &.sharp-key {
    z-index: 1;
    transform: translateX(-50%);

    width: calc(100% / 21 * 0.62);
    height: 106px;
    padding-bottom: 8px;

    border-color: var(--color-key-black);
    background: linear-gradient(var(--color-key-black-top), var(--color-key-black));
    box-shadow: 0 4px 6px var(--color-shadow);

    font-size: 8px;
    color: var(--color-text-muted);
  }

  &.active-key {
    background: var(--color-accent);
    color: var(--color-on-accent);
  }
}

// 八度标识
.keyboard-caption {
  display: flex;
  justify-content: space-around;

  padding: 10px 0 14px;

  font-size: 10px;
  color: var(--color-text-muted);
}
</style>
