<script setup lang="ts">
import { computed } from 'vue';

import LabButton from '@/components/LabButton.vue';
import LabNotes from '@/components/LabNotes.vue';
import LabPageBody from '@/components/LabPageBody.vue';
import PageHeader from '@/components/PageHeader.vue';

import AmbienceCard from './components/AmbienceCard.vue';
import {
  ambienceLayers,
  layerIds,
  maxRecordingSeconds,
  recordingFileNamePrefix,
} from './constants/ambience';
import { useAudioBus } from './hooks/useAudioBus';
import { useAmbience } from './hooks/useAmbience';
import { useRecorder } from './hooks/useRecorder';
import type { AmbienceLayerId } from './types/ambience';

// 实现说明：不参与音频生成。
const implementationNotes = [
  '风雨雷火由噪声、滤波器和 LFO 实时合成；强度同时改变纹理与响度，雷声随机触发。',
  '录音录制的是当前混音，文件格式由浏览器决定；离开页面会停止播放并中断未完成的录音。请先调低设备音量。',
];

const audioBus = useAudioBus();
const { supported, error: audioBusError } = audioBus;

const { intensities, activeLayers, error, toggleLayer, setIntensity } = useAmbience(audioBus);

// 录音作为独立消费者组合在页面层：只借用页面总线输出，不参与声部与总线生命周期。
const recorder = useRecorder(audioBus, {
  fileNamePrefix: recordingFileNamePrefix,
  maxSeconds: maxRecordingSeconds,
});

const {
  supported: recordingSupported,
  status: recordingStatus,
  seconds: recordingSeconds,
  result: recordingResult,
  error: recordingError,
  start: startRecording,
  stop: stopRecording,
  discard: discardRecording,
} = recorder;

const activeCount = computed(() => activeLayers.value.size);
const recordingButtonLabel = computed(() => {
  if (recordingStatus.value === 'recording') return '停止录音';
  if (recordingStatus.value === 'starting' || recordingStatus.value === 'processing') {
    return '处理中…';
  }
  return '开始录音';
});
const recordingButtonDisabled = computed(
  () =>
    !recordingSupported ||
    recordingStatus.value === 'starting' ||
    recordingStatus.value === 'processing',
);
const recorderStatusText = computed(() => {
  switch (recordingStatus.value) {
    case 'recording':
      // 计时由独立的 .recording-time 展示，状态文案不逐秒重复。
      return '正在录制';
    case 'starting':
      return '正在准备录音';
    case 'processing':
      return '正在生成文件';
    default:
      return activeCount.value
        ? `${activeCount.value} 个声部正在播放`
        : '就绪 · 点击播放任一环境音';
  }
});

function formatDuration(seconds: number): string {
  const total = Math.floor(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function handleToggleLayer(id: AmbienceLayerId): void {
  void toggleLayer(id);
}
function handleIntensityChange(id: AmbienceLayerId, value: number): void {
  setIntensity(id, value);
}
function handleRecordingToggle(): void {
  if (recordingStatus.value === 'recording') void stopRecording();
  else if (recordingStatus.value === 'idle') startRecording();
}
</script>

<template>
  <LabPageBody>
    <PageHeader
      eyebrow="PLAYGROUND / 03"
      title="环境音"
      accent="模拟"
      description="风、雨、雷与篝火，拼一段自己的天气。"
    />

    <p
      v-if="!supported"
      class="audio-alert"
      role="alert"
    >
      当前浏览器不支持 Web Audio API，无法播放环境音。
    </p>
    <p
      v-if="error"
      class="audio-alert"
      role="alert"
    >
      {{ error }}
    </p>
    <p
      v-if="audioBusError"
      class="audio-alert"
      role="alert"
    >
      {{ audioBusError }}
    </p>
    <p
      v-if="recordingError"
      class="audio-alert"
      role="alert"
    >
      {{ recordingError }}
    </p>

    <section
      class="mixer-grid"
      aria-label="环境音声部"
    >
      <AmbienceCard
        v-for="id in layerIds"
        :key="id"
        :config="ambienceLayers[id]"
        :intensity="intensities[id]"
        :active="activeLayers.has(id)"
        :disabled="!supported"
        @toggle="handleToggleLayer(id)"
        @intensity-change="handleIntensityChange(id, $event)"
      />
    </section>

    <section
      class="recorder-panel"
      aria-label="混音录音"
    >
      <div class="recorder-heading">
        <div>
          <h2 class="panel-title">混音录音</h2>
          <p class="recorder-description">录制当前正在播放的环境音混音，不获取麦克风权限。</p>
        </div>
        <p
          class="recorder-status"
          role="status"
        >
          <span
            v-if="recordingStatus === 'recording'"
            class="recording-indicator"
            aria-hidden="true"
          />
          {{ recorderStatusText }}
        </p>
      </div>

      <div class="recorder-actions">
        <LabButton
          type="primary"
          :disabled="recordingButtonDisabled"
          @click="handleRecordingToggle"
        >
          {{ recordingButtonLabel }}
        </LabButton>
        <span
          v-if="recordingStatus === 'recording'"
          class="recording-time"
        >
          {{ formatDuration(recordingSeconds) }}
        </span>
        <span
          v-else-if="!recordingSupported"
          class="recorder-note"
        >
          当前浏览器不支持录音，环境音仍可播放。
        </span>
        <span
          v-else
          class="recorder-note"
        >
          最长 {{ maxRecordingSeconds / 60 }} 分钟，停止后生成音频文件。
        </span>
      </div>

      <div
        v-if="recordingResult"
        class="recording-result"
      >
        <audio
          class="recording-player"
          :src="recordingResult.url"
          controls
          preload="metadata"
        />
        <div class="recording-links">
          <a
            class="recording-download"
            :href="recordingResult.url"
            :download="recordingResult.fileName"
          >
            下载录音
          </a>
          <LabButton @click="discardRecording"> 清除结果 </LabButton>
        </div>
      </div>
    </section>

    <LabNotes :paragraphs="implementationNotes" />
  </LabPageBody>
</template>

<style scoped lang="scss">
.audio-alert {
  margin: var(--space-2) 0;

  font-size: var(--font-size-caption);
  color: var(--color-danger);
}

// 声部混音网格
.mixer-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-3);

  margin: 0 0 var(--space-4);
}

// 录音面板
.recorder-panel {
  padding: var(--space-4);

  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-bg-surface);

  .panel-title {
    font-size: var(--font-size-title);
    line-height: var(--line-height-title);
  }

  .recorder-heading {
    display: flex;
    justify-content: space-between;
    align-items: start;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .recorder-description {
    margin-top: var(--space-1);

    font-size: var(--font-size-caption);
    color: var(--color-text-secondary);
  }

  .recorder-status {
    display: flex;
    align-items: center;
    gap: var(--space-2);

    font-size: var(--font-size-caption);
    color: var(--color-text-secondary);
  }

  .recorder-actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-3);

    margin-top: var(--space-3);
  }

  .recorder-note,
  .recording-time {
    font-size: var(--font-size-caption);
    color: var(--color-text-secondary);
  }

  .recording-time {
    font-variant-numeric: tabular-nums;
    color: var(--color-accent);
  }
}

// 录音状态与操作按钮
.recording-indicator {
  width: 8px;
  height: 8px;

  border-radius: 50%;
  background: var(--color-danger);

  animation: recording-pulse 1.1s ease-in-out infinite;
}

@keyframes recording-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.25;
  }
}

// 录音结果试听与下载
.recording-result {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);

  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);

  .recording-player {
    flex: 1;
    min-width: 220px;
    height: 36px;
  }

  .recording-links {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .recording-download {
    font-size: var(--font-size-caption);
    color: var(--color-accent);

    &:hover {
      text-decoration: underline;
    }
  }
}

// 窄屏布局
@media (max-width: 960px) {
  .mixer-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .mixer-grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .recording-indicator {
    animation: none;
  }
}
</style>
