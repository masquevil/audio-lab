<script setup lang="ts">
import { computed } from 'vue';

import LabButton from '@/components/LabButton.vue';

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
  <div
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
      <LabButton
        v-if="active"
        type="primary"
        size="compact"
        :disabled="disabled"
        @click="handleToggleClick"
      >
        停止
      </LabButton>
      <LabButton
        v-else
        size="compact"
        :disabled="disabled"
        @click="handleToggleClick"
      >
        播放
      </LabButton>
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
  </div>
</template>

<style scoped lang="scss">
// 声部卡片与激活状态
.ambience-card {
  // 声部图标盒尺寸：组件内维护，不占用全局间距刻度
  --layer-icon-size: 32px;

  display: flex;
  flex-direction: column;
  gap: var(--space-3);

  padding: var(--space-4);

  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-bg-surface);

  transition:
    border-color var(--motion-fast),
    box-shadow var(--motion-fast);

  &.active-card {
    border-color: var(--color-accent);
    box-shadow: inset 0 0 0 1px var(--color-accent-subtle);
  }
}

// 声部标题与播放开关
.card-heading {
  display: flex;
  align-items: center;
  gap: var(--space-3);

  .layer-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;

    width: var(--layer-icon-size);
    height: var(--layer-icon-size);

    border-radius: var(--radius-control);
    background: var(--color-accent-subtle);

    font-size: var(--icon-size-sm);
    color: var(--color-accent);
  }

  .layer-copy {
    flex: 1;
    min-width: 0;
  }

  .layer-title {
    font-size: var(--font-size-title);
    line-height: var(--line-height-title);
  }

  .layer-detail {
    overflow: hidden;

    font-size: var(--font-size-caption);
    color: var(--color-text-secondary);
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}

// 强度滑块与两端描述
.intensity-control {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);

  .intensity-heading {
    display: flex;
    justify-content: space-between;
    align-items: baseline;

    font-size: var(--font-size-caption);
    color: var(--color-text-secondary);
  }

  .intensity-value {
    font-size: var(--font-size-caption);
    font-weight: 600;
    color: var(--color-accent);
  }

  .intensity-slider {
    width: 100%;
  }

  .intensity-range {
    display: flex;
    justify-content: space-between;

    font-size: var(--font-size-caption);
    color: var(--color-text-secondary);
  }
}
</style>
