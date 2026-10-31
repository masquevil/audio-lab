<script setup lang="ts" generic="ChoiceValue extends string | number">
import { computed, provide } from 'vue';

import { radioGroupKey } from './radioGroupContext';

interface Props {
  /** 原生 radio 组名，页面内需唯一。 */
  name: string;
  label: string;
  /** 组内选项的默认等分宽度。 */
  stretch?: boolean;
  /** 组内选项的默认字号，单个选项可覆盖。 */
  size?: 'medium' | 'large';
}

const props = defineProps<Props>();
const modelValue = defineModel<ChoiceValue>({ required: true });

provide(radioGroupKey, {
  selectedValue: computed(() => modelValue.value),
  selectValue: (value) => {
    // 选项值由使用方传入的 LabRadio 决定，组的泛型约束自身 v-model 的类型。
    modelValue.value = value as ChoiceValue;
  },
  get name() {
    return props.name;
  },
  get stretch() {
    return props.stretch;
  },
  get size() {
    return props.size;
  },
});
</script>

<template>
  <div class="lab-radio-group">
    <div class="lab-radio-title">{{ label }}</div>

    <div
      class="lab-radio-options"
      role="radiogroup"
      :aria-label="label"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
// 组标题与选项排布
.lab-radio-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.lab-radio-title {
  font-size: 12px;
  color: var(--color-text-muted);
}

.lab-radio-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
