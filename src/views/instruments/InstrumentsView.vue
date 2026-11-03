<script setup lang="ts">
import { ref } from 'vue';

import LabPageBody from '@/components/LabPageBody.vue';
import PageHeader from '@/components/PageHeader.vue';

import InstrumentKeyboard from './components/InstrumentKeyboard.vue';
import { keyboardKeys, octaves, timbres } from './constants/instruments';
import { useInstrument } from './hooks/useInstrument';
import type { Octave, TimbreId } from './types/instrument';

const {
  timbre,
  volume,
  error,
  activeNotes,
  supported,
  play,
  release,
  stopAll,
  setTimbre,
  setVolume,
} = useInstrument();
const octave = ref<Octave>(4);
const keyboard = ref<InstanceType<typeof InstrumentKeyboard>>();

function handleTimbreChange(value: TimbreId): void {
  if (value === timbre.value) return;
  keyboard.value?.clearHeldNotes();
  setTimbre(value);
}
function handleOctaveChange(event: Event): void {
  if (!(event.target instanceof HTMLSelectElement)) return;
  const selectedValue = Number(event.target.value);
  const value = octaves.find((item) => item === selectedValue);
  if (value === undefined || value === octave.value) return;
  keyboard.value?.clearHeldNotes();
  stopAll();
  octave.value = value;
}
function handleVolumeChange(event: Event): void {
  if (event.target instanceof HTMLInputElement) setVolume(event.target.valueAsNumber);
}
</script>

<template>
  <LabPageBody>
    <PageHeader
      eyebrow="PLAYGROUND / 01"
      title="乐器"
      accent="演奏室"
      description="选一种音色，让灵感从指尖开始。"
    />
    <div
      class="timbre-tabs"
      role="group"
      aria-label="音色"
    >
      <button
        v-for="(tone, id) in timbres"
        :key="id"
        class="timbre-tab"
        :class="{ 'selected-tab': timbre === id }"
        :aria-pressed="timbre === id"
        @click="handleTimbreChange(id)"
      >
        <span
          class="timbre-icon"
          aria-hidden="true"
        >
          {{ tone.icon }}
        </span>
        <span>
          {{ tone.label }}<span class="timbre-detail">{{ tone.detail }}</span>
        </span>
      </button>
    </div>
    <section
      class="instrument-panel"
      aria-label="演奏控制"
    >
      <div class="control-row">
        <label class="control-label">
          音量 {{ Math.round(volume * 100) }}%
          <input
            class="volume-slider"
            :value="volume"
            type="range"
            min="0"
            max="1"
            step="0.01"
            @input="handleVolumeChange"
          />
        </label>
        <label class="control-label">
          电脑键盘八度
          <select
            class="octave-select"
            :value="octave"
            @change="handleOctaveChange"
          >
            <option
              v-for="value in octaves"
              :key="value"
              :value="value"
            >
              C{{ value }}–B{{ value }}
            </option>
          </select>
        </label>
      </div>
      <p
        v-if="!supported"
        role="alert"
      >
        当前浏览器不支持 Web Audio API，请使用现代浏览器。
      </p>
      <p
        v-if="error"
        role="alert"
      >
        {{ error }}
      </p>
      <p
        class="play-status"
        role="status"
      >
        {{ activeNotes.size ? `正在演奏 ${activeNotes.size} 个音符` : '准备就绪' }}
      </p>
      <InstrumentKeyboard
        ref="keyboard"
        :octave="octave"
        :active-notes="activeNotes"
        :supported="supported"
        @press="play"
        @release="release"
        @reset="stopAll"
      />
      <footer class="playing-guide">
        <span>按住发声，松开停止 · 单音最长 8 秒</span>
        <span
          >键盘
          <kbd class="keyboard-shortcuts">{{ keyboardKeys.join(' ').toUpperCase() }}</kbd></span
        >
      </footer>
    </section>
    <p class="audio-notice">Web Audio 实时合成 · 无需麦克风权限 · 请先调低设备音量</p>
  </LabPageBody>
</template>

<style scoped lang="scss">
.instrument-panel {
  padding: var(--space-4);

  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-bg-surface);
}

// 音色选择
.timbre-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);

  margin-bottom: var(--space-4);

  .timbre-tab {
    display: flex;
    align-items: center;
    gap: var(--space-3);

    padding: var(--space-3) var(--space-4);

    border: 1px solid var(--color-border);
    border-radius: var(--radius-panel);
    background: var(--color-bg-surface);

    text-align: left;
    color: var(--color-text-secondary);

    cursor: pointer;
  }

  .timbre-detail {
    display: block;

    margin-top: var(--space-1);
    opacity: 0.75;

    font-size: var(--font-size-caption);
  }

  .timbre-icon {
    font-size: var(--icon-size-lg);
  }

  .selected-tab {
    border-color: var(--color-accent);
    background: var(--color-accent-subtle);

    color: var(--color-accent);
  }
}

// 演奏控制
.control-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-6);

  padding-bottom: var(--space-3);

  font-size: var(--font-size-caption);

  .control-label {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);

    color: var(--color-text-secondary);
  }

  .octave-select {
    padding: var(--space-2) var(--space-3);

    border: 1px solid var(--color-border);
    border-radius: var(--radius-control);
    background: var(--color-bg-control);

    font-size: var(--font-size-caption);
    color: var(--color-text-primary);
  }

  .volume-slider {
    width: 100px;
  }
}

// 状态与演奏说明
.play-status {
  margin: 0 0 var(--space-3);

  font-size: var(--font-size-caption);
  color: var(--color-accent);
}

.playing-guide {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-2);

  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);

  font-size: var(--font-size-caption);
  color: var(--color-text-secondary);
}

.keyboard-shortcuts {
  letter-spacing: 0.08em;
}

.audio-notice {
  margin-top: var(--space-4);

  font-size: var(--font-size-caption);
  text-align: center;
  color: var(--color-text-secondary);
}

// 窄屏布局
@media (max-width: 600px) {
  .instrument-panel {
    padding: var(--space-3);
  }
  .timbre-tabs {
    .timbre-tab {
      justify-content: center;
      gap: var(--space-2);

      padding: var(--space-3);
    }

    .timbre-detail {
      display: none;
    }

    .timbre-icon {
      font-size: var(--icon-size-md);
    }
  }
  .control-row {
    gap: var(--space-3);
  }
}
</style>
