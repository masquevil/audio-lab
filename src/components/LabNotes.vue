<script setup lang="ts">
interface Props {
  /** 每个段落一段文字。 */
  paragraphs: string[];
}

defineProps<Props>();
</script>

<template>
  <details class="lab-notes">
    <summary class="notes-summary">实现说明</summary>
    <p
      v-for="(paragraph, index) in paragraphs"
      :key="index"
      class="notes-body"
    >
      {{ paragraph }}
    </p>
  </details>
</template>

<style scoped lang="scss">
// 实现说明折叠区
.lab-notes {
  margin-top: var(--space-4);

  font-size: var(--font-size-caption);
  color: var(--color-text-secondary);

  .notes-summary {
    cursor: pointer;
  }

  .notes-body + .notes-body {
    margin-top: var(--space-2);
  }
}
</style>
