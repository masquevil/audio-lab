<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  /** 视觉主次；原生按钮类型固定为 button。 */
  type?: 'primary' | 'secondary';
  /** 面板内的紧凑密度。 */
  size?: 'default' | 'compact';
}

const props = withDefaults(defineProps<Props>(), {
  type: 'secondary',
  size: 'default',
});
const buttonClass = computed(() => ({
  'is-primary': props.type === 'primary',
  'is-compact': props.size === 'compact',
}));
</script>

<template>
  <button
    class="lab-button"
    :class="buttonClass"
    type="button"
  >
    <slot />
  </button>
</template>

<style scoped lang="scss">
// 按钮表面、主次与禁用状态
.lab-button {
  flex-shrink: 0;

  padding: var(--space-2) var(--space-3);

  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-bg-control);

  color: var(--color-text-primary);

  cursor: pointer;

  &:disabled {
    opacity: var(--opacity-disabled);
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    background: var(--color-bg-control-hover);
  }

  &.is-primary {
    border-color: var(--color-accent);
    background: var(--color-accent);

    color: var(--color-on-accent);

    // 强调底色上保持填充，只做提亮
    &:not(:disabled):hover {
      background: var(--color-accent);
      filter: brightness(1.12);
    }
  }

  &.is-compact {
    padding: var(--space-1) var(--space-3);

    font-size: var(--font-size-caption);
  }
}
</style>
