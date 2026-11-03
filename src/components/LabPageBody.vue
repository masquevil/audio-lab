<script setup lang="ts">
interface Props {
  /** 入口页保留更大的顶部留白。 */
  size?: 'default' | 'large';
}

withDefaults(defineProps<Props>(), { size: 'default' });
</script>

<template>
  <main
    class="lab-page-body"
    :class="{ 'is-large': size === 'large' }"
  >
    <slot />
  </main>
</template>

<style scoped lang="scss">
// 页面容器：与导航共用同一栅格
.lab-page-body {
  max-width: var(--page-max-width);
  margin-inline: auto;
  padding-block: var(--page-padding-top) var(--page-padding-bottom);
  padding-inline: var(--page-gutter-horizontal);

  // 入口页作为首页保留更大的顶部留白
  &.is-large {
    --page-padding-top: var(--space-8);
  }
}
</style>
