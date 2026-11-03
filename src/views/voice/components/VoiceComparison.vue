<script setup lang="ts">
import LabButton from '@/components/LabButton.vue';

import type { ReferenceRecording } from '../types/voice';

interface Props {
  recordings: readonly ReferenceRecording[];
  error: string;
  active: string;
  supported: boolean;
}
interface Emits {
  (event: 'play', recording: ReferenceRecording): void;
  /** 停止参考播放；合成播放由页面主面板控制。 */
  (event: 'stop'): void;
}

defineProps<Props>();
const emit = defineEmits<Emits>();

// 用户事件：只上报播放意图，播放协调与错误处理由页面及 hook 负责。
function handlePlay(recording: ReferenceRecording) {
  emit('play', recording);
}

function handleStopReference() {
  emit('stop');
}
</script>

<template>
  <section
    class="comparison-panel"
    aria-label="真人参考"
  >
    <div class="comparison-heading">
      <h2 class="comparison-title">参考声音</h2>
      <LabButton
        size="compact"
        :disabled="!active"
        @click="handleStopReference"
      >
        停止参考
      </LabButton>
    </div>

    <div
      class="comparison-row"
      v-for="recording in recordings"
      :key="recording.url"
    >
      <span>{{ recording.label }}</span>
      <LabButton
        size="compact"
        :disabled="!supported"
        @click="handlePlay(recording)"
      >
        试听参考 {{ recording.label }}
      </LabButton>
    </div>

    <div
      class="comparison-note"
      role="status"
    >
      {{ active ? `正在播放参考 ${active}` : '主面板已使用 Klatt；参考录音保留原始内容不做修改。' }}
    </div>

    <div
      v-if="error"
      role="alert"
    >
      {{ error }}
    </div>
  </section>
</template>

<style scoped lang="scss">
// 参考区域边界与行布局
.comparison-panel {
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

.comparison-heading,
.comparison-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);

  margin-bottom: var(--space-2);
}

.comparison-heading {
  justify-content: space-between;
}

// 标题与播放提示
.comparison-title {
  margin: 0;
  font-size: var(--font-size-body);
}

.comparison-note {
  margin: var(--space-1) 0;
  font-size: var(--font-size-caption);
  color: var(--color-text-secondary);
}
</style>
