<script setup lang="ts">
import { ref } from 'vue';

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
  <main class="instrument-page">
    <header class="page-heading">
      <div>
        <p class="page-eyebrow">PLAYGROUND / 01</p>
        <h1 class="page-title">乐器<span class="title-accent">演奏室</span></h1>
      </div>
      <p class="heading-description">选一种音色，让灵感从指尖开始。</p>
    </header>
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
          {{ tone.label }}<small class="timbre-detail">{{ tone.detail }}</small>
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
    <p class="audio-notice">
      Web Audio 实时合成 · 非真实乐器采样 · 无需麦克风权限 · 请先调低设备音量
    </p>
  </main>
</template>

<style scoped lang="scss">
// 页面布局
.instrument-page {
  max-width: 1060px;
  margin: auto;
  padding: 28px;
}

.instrument-panel {
  padding: 20px;

  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
}

// 页面标题
.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 16px;

  margin-bottom: 24px;

  .page-title {
    margin: 5px 0 0;

    font-size: 28px;
    letter-spacing: -0.04em;
  }

  .title-accent {
    color: var(--color-accent);
  }

  .heading-description,
  .page-eyebrow {
    margin: 0;

    font-size: 12px;
    color: var(--color-text-muted);
  }

  .page-eyebrow {
    font-size: 10px;
    letter-spacing: 0.16em;
  }
}

// 音色选择
.timbre-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;

  margin-bottom: 18px;

  .timbre-tab {
    display: flex;
    align-items: center;
    gap: 14px;

    padding: 13px 18px;

    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: var(--color-surface);

    text-align: left;
    color: var(--color-text-muted);

    cursor: pointer;
  }

  .timbre-detail {
    display: block;

    margin-top: 3px;
    opacity: 0.75;

    font-size: 11px;
  }

  .timbre-icon {
    font-size: 26px;
  }

  .selected-tab {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);

    color: var(--color-accent);
  }
}

// 演奏控制
.control-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20px;

  padding-bottom: 12px;

  font-size: 12px;

  .control-label {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;

    color: var(--color-text-muted);
  }

  .octave-select {
    padding: 5px 9px;

    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);

    font-size: 12px;
    color: var(--color-text);
  }

  .volume-slider {
    width: 100px;
    accent-color: var(--color-accent);
  }
}

// 状态与演奏说明
.play-status {
  margin: 0 0 12px;

  font-size: 11px;
  color: var(--color-accent);
}

.playing-guide {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;

  padding-top: 14px;
  border-top: 1px solid var(--color-border);

  font-size: 11px;
  color: var(--color-text-muted);
}

.keyboard-shortcuts {
  letter-spacing: 0.08em;
}

.audio-notice {
  margin-top: 18px;

  font-size: 11px;
  text-align: center;
  color: var(--color-text-muted);
}

// 窄屏布局
@media (max-width: 600px) {
  .instrument-page {
    padding: 24px 12px;
  }
  .instrument-panel {
    padding: 12px;
  }
  .page-heading {
    align-items: start;
    flex-direction: column;
    gap: 8px;
  }
  .timbre-tabs {
    .timbre-tab {
      justify-content: center;
      gap: 6px;

      padding: 10px;
    }

    .timbre-detail {
      display: none;
    }

    .timbre-icon {
      font-size: 20px;
    }
  }
  .control-row {
    gap: 12px;
  }
}
</style>
