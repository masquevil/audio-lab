<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue';
import type { Component } from 'vue';

import LabButton from './LabButton.vue';
import LabPageBody from './LabPageBody.vue';

interface Props {
  /** 页面视图的动态加载器，由路由页在自己的 chunk 内声明。 */
  loader: () => Promise<{ default: Component }>;
}

const props = defineProps<Props>();

const view = shallowRef<Component>();
const failed = ref(false);
let loadVersion = 0;

/** 加载视图；旧请求的结果不写入当前状态。 */
async function loadView(): Promise<void> {
  const version = ++loadVersion;
  failed.value = false;
  try {
    const module = await props.loader();
    if (version === loadVersion) view.value = module.default;
  } catch {
    if (version === loadVersion) failed.value = true;
  }
}

watch(() => props.loader, loadView, { immediate: true });
</script>

<template>
  <component
    :is="view"
    v-if="view"
  />
  <LabPageBody v-else>
    <div class="route-status">
      <p>{{ failed ? '页面加载失败，请检查网络后重试。' : '正在加载页面…' }}</p>
      <LabButton
        v-if="failed"
        type="primary"
        @click="loadView"
      >
        重试
      </LabButton>
    </div>
  </LabPageBody>
</template>

<style scoped lang="scss">
// 视图加载与失败提示
.route-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);

  padding-block: var(--space-10);

  font-size: var(--font-size-body);
  color: var(--color-text-secondary);
  text-align: center;
}
</style>
