<script setup lang="ts">
import { computed } from 'vue';

import type { AmbienceLayerConfig } from '../types/ambience';

interface Props {
  config: AmbienceLayerConfig;
  /** 当前强度，0–1。 */
  intensity: number;
  active: boolean;
  disabled?: boolean;
}
interface Emits {
  (event: 'toggle'): void;
  (event: 'intensity-change', value: number): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const intensityLabel = computed(() => {
  const labels = props.config.intensityLabels;
  const index = Math.min(labels.length - 1, Math.floor(props.intensity * labels.length));
  return labels[Math.max(0, index)];
});

function handleIntensityInput(event: Event): void {
  if (event.target instanceof HTMLInputElement)
    emit('intensity-change', event.target.valueAsNumber);
}
function handleToggleClick(): void {
  emit('toggle');
}
</script>

<template>
  <article
    class="ambience-card"
    :class="{ 'active-card': active }"
  >
    <header class="card-heading">
      <span
        class="layer-icon"
        aria-hidden="true"
      >
        {{ config.icon }}
      </span>
      <div class="layer-copy">
        <h2 class="layer-title">{{ config.label }}</h2>
        <p class="layer-detail">{{ config.detail }}</p>
      </div>
      <button
        class="layer-toggle"
        type="button"
        :aria-pressed="active"
        :aria-label="`${active ? '停止' : '播放'}${config.label}`"
        :disabled="disabled"
        @click="handleToggleClick"
      >
        {{ active ? '停止' : '播放' }}
      </button>
    </header>

    <label class="intensity-control">
      <span class="intensity-heading">
        强度
        <strong class="intensity-value">{{ intensityLabel }}</strong>
      </span>
      <input
        class="intensity-slider"
        type="range"
        min="0"
        max="1"
        step="0.01"
        :value="intensity"
        :aria-label="`${config.label}强度`"
        :disabled="disabled"
        @input="handleIntensityInput"
      />
      <span class="intensity-range">
        <span>{{ config.intensityLabels[0] }}</span>
        <span>{{ config.intensityLabels[config.intensityLabels.length - 1] }}</span>
      </span>
    </label>
  </article>
</template>

<style scoped lang="scss">
// 声部卡片与激活状态
.ambience-card {
  display: flex;
  flex-direction: column;
  gap: 14px;

  padding: 16px;

  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);

  transition:
    border-color 0.15s,
    box-shadow 0.15s;

  &.active-card {
    border-color: var(--color-accent);
    box-shadow: inset 0 0 0 1px var(--color-accent-soft);
  }
}

// 声部标题与播放开关
.card-heading {
  display: flex;
  align-items: center;
  gap: 10px;

  .layer-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;

    width: 34px;
    height: 34px;

    border-radius: 9px;
    background: var(--color-accent-soft);

    font-size: 18px;
    color: var(--color-accent);
  }

  .layer-copy {
    flex: 1;
    min-width: 0;
  }

  .layer-title {
    font-size: 15px;
  }

  .layer-detail {
    overflow: hidden;

    font-size: 11px;
    color: var(--color-text-muted);
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .layer-toggle {
    flex-shrink: 0;

    padding: 5px 10px;

    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);

    font-size: 11px;
    color: var(--color-text);

    cursor: pointer;

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    &:not(:disabled):hover {
      filter: brightness(1.12);
    }
  }
}

.active-card .layer-toggle {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: var(--color-on-accent);
}

// 强度滑块与两端描述
.intensity-control {
  display: flex;
  flex-direction: column;
  gap: 6px;

  .intensity-heading {
    display: flex;
    justify-content: space-between;
    align-items: baseline;

    font-size: 11px;
    color: var(--color-text-muted);
  }

  .intensity-value {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-accent);
  }

  .intensity-slider {
    width: 100%;
    accent-color: var(--color-accent);
  }

  .intensity-range {
    display: flex;
    justify-content: space-between;

    font-size: 10px;
    color: var(--color-text-muted);
  }
}
</style>
