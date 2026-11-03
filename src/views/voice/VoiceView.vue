<script setup lang="ts">
import { computed, reactive } from 'vue';

import LabButton from '@/components/LabButton.vue';
import LabNotes from '@/components/LabNotes.vue';
import LabPageBody from '@/components/LabPageBody.vue';
import LabRadio from '@/components/lab-radio/LabRadio.vue';
import LabRadioGroup from '@/components/lab-radio/LabRadioGroup.vue';
import PageHeader from '@/components/PageHeader.vue';

import recordingUrlVowelE from './assets/e.ogg?url';
import recordingUrlVowelY from './assets/y.ogg?url';
import VoiceComparison from './components/VoiceComparison.vue';
import {
  presetIds,
  toneConfigs,
  toneIds,
  voicePresets,
  vowelFormants,
  vowelIds,
} from './constants/voice';
import { useReferenceVoice } from './hooks/useReferenceVoice';
import { useVoice } from './hooks/useVoice';
import type {
  ReferenceRecording,
  ThreePointContour,
  ToneId,
  VoicePresetId,
  VowelId,
} from './types/voice';

interface SliderConfig {
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

interface VoiceForm {
  vowel: VowelId;
  tone: ToneId;
  preset: VoicePresetId;
  /** 单音时长，秒。 */
  duration: number;
  /** 输出增益，0–1。 */
  volume: number;
}

const formConfigs: Record<'durationSlider' | 'volumeSlider', SliderConfig> = {
  durationSlider: { min: 0.4, max: 1.6, step: 0.1, defaultValue: 0.4 },
  volumeSlider: { min: 0, max: 1, step: 0.05, defaultValue: 0.5 },
};
// y.ogg 沿用上游文件名，对应闭前圆唇元音 ü。
const referenceRecordings: ReferenceRecording[] = [
  { label: 'e', url: recordingUrlVowelE },
  { label: 'ü', url: recordingUrlVowelY },
];
// 实现说明：不参与音频生成。
const implementationNotes = [
  '元音与声学参数为近似值，三声使用完整降升轮廓，不含语流变调。',
  '声音由实时合成生成，可能带有机械感；尚未实现辅音、拼音组合或任意文字朗读。',
];

// 试听参数：页面只持有用户选择，修改不影响正在播放的会话。
const voiceForm = reactive<VoiceForm>({
  vowel: 'a',
  tone: 1,
  preset: 'male',
  duration: formConfigs.durationSlider.defaultValue,
  volume: formConfigs.volumeSlider.defaultValue,
});

// 本页基频图几何，SVG 用户单位；坐标轴与折线共用左侧 20、底部 140 的绘图区。
const pitchChartConfig = {
  viewBox: '0 0 300 160',
  axisPath: 'M20 10V140H280',
  firstPointX: 20,
  pointStepX: 130,
  /** 倍率 1.0 的纵坐标。 */
  unitRatioY: 150,
  /** 倍率每增加 1 的纵向偏移。 */
  ratioHeight: 90,
};

/** 将三点轮廓映射为折线坐标：横坐标等距展开，纵坐标随倍率升高。 */
function mapContourToChartPoints(contour: ThreePointContour): string {
  return contour
    .map(
      (ratio, index) =>
        `${pitchChartConfig.firstPointX + index * pitchChartConfig.pointStepX},${pitchChartConfig.unitRatioY - ratio * pitchChartConfig.ratioHeight}`,
    )
    .join(' ');
}

// 声学展示：仅从当前选择推导，不参与音频生成或资源管理。
const acousticPreview = computed(() => {
  const presetConfig = voicePresets[voiceForm.preset];
  const toneContour = toneConfigs[voiceForm.tone].contour;

  return {
    presetLabel: presetConfig.label,
    formantFrequencies: vowelFormants[voiceForm.vowel].map((frequency) =>
      Math.round(frequency * presetConfig.formantScale),
    ),
    pitchFrequencies: toneContour.map((ratio) => Math.round(presetConfig.pitch * ratio)),
    pitchCurvePoints: mapContourToChartPoints(toneContour),
  };
});

// 页面持有两种播放状态，子组件只展示参考状态并上报用户事件。
const { playing, error, supported: audioSupported, play, stop } = useVoice();
const {
  active: referenceActive,
  error: referenceError,
  play: playReference,
  stop: stopReference,
} = useReferenceVoice();

// 事件协调：先停止另一播放源，再提交本次试听的参数快照。
function handleAudition(allTones = false) {
  stopReference();
  void play({
    vowel: voiceForm.vowel,
    preset: voiceForm.preset,
    tones: allTones ? toneIds : [voiceForm.tone],
    duration: voiceForm.duration,
    volume: voiceForm.volume,
  });
}

function handleReferencePlay(recording: ReferenceRecording) {
  stop();
  void playReference(recording.url, recording.label);
}

function handleReferenceStop() {
  stopReference();
}
</script>

<template>
  <LabPageBody>
    <PageHeader
      eyebrow="PLAYGROUND / 02"
      title="人声"
      accent="实验室"
      description="六个元音，四种声调，探索声音的形状。"
    />

    <div class="experiment-grid">
      <section
        class="voice-panel"
        aria-label="发声设置"
      >
        <LabRadioGroup
          class="voice-option-group"
          label="基础元音"
          name="vowel"
          stretch
          size="large"
          v-model="voiceForm.vowel"
        >
          <LabRadio
            v-for="vowelId in vowelIds"
            :key="vowelId"
            :value="vowelId"
            :label="vowelId"
          />
        </LabRadioGroup>

        <LabRadioGroup
          class="voice-option-group"
          label="声调"
          name="tone"
          v-model="voiceForm.tone"
        >
          <LabRadio
            v-for="toneId in toneIds"
            :key="toneId"
            :value="toneId"
            :label="toneConfigs[toneId].label"
          />
        </LabRadioGroup>

        <LabRadioGroup
          class="voice-option-group"
          label="合成音色"
          name="preset"
          v-model="voiceForm.preset"
        >
          <LabRadio
            v-for="presetId in presetIds"
            :key="presetId"
            :value="presetId"
            :label="voicePresets[presetId].label"
          />
        </LabRadioGroup>

        <label class="slider-label">
          单音时长 <span>{{ voiceForm.duration.toFixed(1) }} 秒</span>
          <input
            class="voice-slider"
            v-model.number="voiceForm.duration"
            type="range"
            :min="formConfigs.durationSlider.min"
            :max="formConfigs.durationSlider.max"
            :step="formConfigs.durationSlider.step"
          />
        </label>
        <label class="slider-label">
          输出音量 <span>{{ Math.round(voiceForm.volume * 100) }}%</span>
          <input
            class="voice-slider"
            v-model.number="voiceForm.volume"
            type="range"
            :min="formConfigs.volumeSlider.min"
            :max="formConfigs.volumeSlider.max"
            :step="formConfigs.volumeSlider.step"
          />
        </label>

        <div class="voice-description">设置在下次试听生效。请先调低设备音量。</div>
        <div class="voice-actions">
          <LabButton
            type="primary"
            :disabled="!audioSupported"
            @click="handleAudition()"
          >
            试听 {{ voiceForm.vowel }} · {{ voiceForm.tone }} 声
          </LabButton>
          <LabButton
            :disabled="!audioSupported"
            @click="handleAudition(true)"
          >
            连续对比四声
          </LabButton>
          <LabButton
            :disabled="!playing"
            @click="stop()"
          >
            停止
          </LabButton>
        </div>

        <div
          class="voice-description"
          role="status"
        >
          {{ playing ? '正在播放当前试听（再次试听将重新开始）' : '就绪 · 点击试听后发声' }}
        </div>

        <div
          v-if="!audioSupported"
          role="alert"
        >
          当前浏览器不支持 Web Audio，无法试听。
        </div>
        <div
          v-if="error"
          role="alert"
        >
          {{ error }}
        </div>
      </section>

      <section
        class="voice-panel"
        aria-label="声学参数"
      >
        <div class="sound-preview">
          {{ voiceForm.vowel }}
          <span class="preview-caption">
            {{ voiceForm.tone }} 声 / {{ acousticPreview.presetLabel }}
          </span>
        </div>

        <h3 class="panel-title">所选声调的基频轮廓</h3>
        <svg
          class="pitch-chart"
          :viewBox="pitchChartConfig.viewBox"
          role="img"
          aria-label="所选声调基频随时间的变化"
        >
          <path
            :d="pitchChartConfig.axisPath"
            class="chart-axis"
          />
          <polyline
            :points="acousticPreview.pitchCurvePoints"
            class="pitch-curve"
          />
        </svg>
        <div class="voice-description">
          时间 → · 基频 {{ acousticPreview.pitchFrequencies.join(' → ') }} Hz
        </div>

        <details>
          <summary>共振峰参数</summary>
          <dl>
            <div
              class="formant-row"
              v-for="(frequency, index) in acousticPreview.formantFrequencies"
              :key="index"
            >
              <dt>F{{ index + 1 }} 共振峰</dt>
              <dd class="formant-value">{{ frequency }} Hz</dd>
            </div>
          </dl>
        </details>

        <div class="voice-description">Klatt 自然声门源 → 六共振峰串联声道 → 包络</div>

        <VoiceComparison
          :recordings="referenceRecordings"
          :active="referenceActive"
          :error="referenceError"
          :supported="audioSupported"
          @play="handleReferencePlay"
          @stop="handleReferenceStop"
        />
      </section>
    </div>

    <LabNotes :paragraphs="implementationNotes" />
  </LabPageBody>
</template>

<style scoped lang="scss">
// 实验网格与面板容器
.experiment-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
  gap: var(--space-4);

  margin: 0 0 var(--space-4);
}

.voice-panel {
  padding: var(--space-4);

  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-bg-surface);
}

// 面板标题与辅助文案
.panel-title {
  font-size: var(--font-size-title);
  line-height: var(--line-height-title);
}

.voice-description {
  font-size: var(--font-size-caption);
  color: var(--color-text-secondary);
}

// 选项分组与操作区布局
.voice-option-group {
  margin-bottom: var(--space-3);
}

.voice-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

// 时长与音量滑块
.slider-label {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;

  margin: var(--space-2) 0;

  font-size: var(--font-size-caption);
}

.voice-slider {
  width: 100%;
  margin-top: var(--space-2);
}

// 当前发声预览
.sound-preview {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);

  margin: 0;

  font-size: var(--font-size-display);
  line-height: var(--line-height-heading);
  color: var(--color-accent);
}

.preview-caption {
  display: block;

  font-size: var(--font-size-body);
  color: var(--color-text-secondary);
}

// 基频轮廓图
.pitch-chart {
  width: 100%;
  height: 100px;
}

.chart-axis {
  fill: none;
  stroke: var(--color-border);
}

.pitch-curve {
  fill: none;
  stroke: var(--color-accent);
  stroke-width: 3;
}

// 共振峰参数列表
.formant-row {
  display: flex;
  justify-content: space-between;

  padding: var(--space-1) 0;

  border-bottom: 1px solid var(--color-border);
}

.formant-value {
  margin: 0;
}

// 窄屏布局
@media (max-width: 700px) {
  .experiment-grid {
    grid-template-columns: 1fr;
  }
}
</style>
