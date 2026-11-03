<script setup lang="ts" generic="RadioValue extends string | number">
import { computed, inject } from 'vue';

import { radioGroupKey } from './radioGroupContext';

interface Props {
  value: RadioValue;
  label: string;
  /** 独立使用时必填；在 LabRadioGroup 内由组统一提供。 */
  name?: string;
  size?: 'default' | 'large';
}

const props = defineProps<Props>();
const group = inject(radioGroupKey, undefined);
const standaloneValue = defineModel<RadioValue>();

const radioName = computed(() => group?.name ?? props.name);
const isChecked = computed(() =>
  group ? group.selectedValue.value === props.value : standaloneValue.value === props.value,
);
// 等宽由组的布局决定，选项自身不单独控制。
const isStretched = computed(() => group?.stretch ?? false);
const selectedSize = computed(() => props.size ?? group?.size ?? 'default');

function handleChange() {
  if (group) group.selectValue(props.value);
  else standaloneValue.value = props.value;
}
</script>

<template>
  <label
    class="lab-radio"
    :class="{ 'is-stretched': isStretched, 'is-large': selectedSize === 'large' }"
  >
    <input
      class="lab-radio-input"
      :checked="isChecked"
      type="radio"
      :name="radioName"
      :value="value"
      @change="handleChange"
    />

    <span class="lab-radio-label">{{ label }}</span>
  </label>
</template>

<style scoped lang="scss">
// 单个选项：原生控件隐藏，选中态与悬停由标签呈现
.lab-radio {
  position: relative;

  .lab-radio-input {
    position: absolute;
    width: 1px;
    height: 1px;

    opacity: 0;
  }

  .lab-radio-label {
    display: block;
    padding: var(--space-2) var(--space-3);

    border: 1px solid var(--color-border);
    border-radius: var(--radius-control);
    background: var(--color-bg-control);

    text-align: center;
    cursor: pointer;

    &:hover {
      background: var(--color-bg-control-hover);
    }
  }

  .lab-radio-input:checked + .lab-radio-label {
    border-color: var(--color-accent);
    background: var(--color-accent-subtle);

    color: var(--color-accent);

    // 选中态保持强调表面，只做提亮
    &:hover {
      filter: brightness(1.12);
    }
  }

  &.is-stretched {
    flex: 1;
  }

  &.is-large .lab-radio-label {
    font-size: var(--font-size-large);
  }
}
</style>
