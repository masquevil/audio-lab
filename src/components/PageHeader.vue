<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  eyebrow: string;
  title: string;
  /** 标题中跟随强调色的部分。 */
  accent: string;
  description?: string;
  /** 入口页可使用大标题，内页保持默认。 */
  size?: 'default' | 'large';
}

const props = withDefaults(defineProps<Props>(), { size: 'default' });
const headingClass = computed(() => ({ 'is-large': props.size === 'large' }));
</script>

<template>
  <header
    class="page-heading"
    :class="headingClass"
  >
    <div>
      <p class="page-eyebrow">{{ eyebrow }}</p>
      <h1 class="page-title">
        {{ title }}<span class="title-accent">{{ accent }}</span>
      </h1>
    </div>
    <p
      v-if="description"
      class="heading-description"
    >
      {{ description }}
    </p>
  </header>
</template>

<style scoped lang="scss">
// 页头：标题组在左，简介在右；窄屏自动换行
.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: end;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);

  margin-bottom: var(--space-6);

  .page-eyebrow {
    margin: 0;

    font-size: var(--font-size-caption);
    letter-spacing: 0.16em;
    color: var(--color-text-secondary);
  }

  .page-title {
    margin: var(--space-2) 0 0;

    font-size: var(--font-size-page-title);
    line-height: var(--line-height-heading);
    letter-spacing: -0.04em;
  }

  .title-accent {
    color: var(--color-accent);
  }

  .heading-description {
    margin: 0;

    font-size: var(--font-size-caption);
    color: var(--color-text-secondary);
  }

  // 入口页大标题
  &.is-large .page-title {
    font-size: var(--font-size-hero);
  }
}

// 窄屏改为上下排列；断点与 --page-gutter-horizontal 保持一致
@media (max-width: 700px) {
  .page-heading {
    align-items: start;
    flex-direction: column;
    gap: var(--space-2);
  }

  .page-heading.is-large .page-title {
    font-size: var(--font-size-page-title);
  }
}
</style>
