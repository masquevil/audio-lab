<script setup lang="ts">
import { computed, reactive } from 'vue';

import LabRadio from '@/components/lab-radio/LabRadio.vue';
import LabRadioGroup from '@/components/lab-radio/LabRadioGroup.vue';

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
  <main class="voice-page">
    <header class="page-heading">
      <div>
        <div class="page-eyebrow">PLAYGROUND / 02</div>
        <h1 class="page-title">人声<span class="title-accent">实验室</span></h1>
      </div>
      <div class="heading-description">六个元音，四种声调，探索声音的形状。</div>
    </header>

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
          <button
            class="voice-button primary-button"
            :disabled="!audioSupported"
            @click="handleAudition()"
          >
            试听 {{ voiceForm.vowel }} · {{ voiceForm.tone }} 声
          </button>
          <button
            class="voice-button"
            :disabled="!audioSupported"
            @click="handleAudition(true)"
          >
            连续对比四声
          </button>
          <button
            class="voice-button"
            :disabled="!playing"
            @click="stop()"
          >
            停止
          </button>
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

    <details class="voice-limitations">
      <summary>实验说明与限制</summary>
      <div>
        验证元音、基频声调与音色参数能否独立控制。男声/女声仅为两组声学预设，不代表真实个体；元音为近似值，三声使用完整降升轮廓，不含语流变调。
      </div>
      <div>
        声音可能带有机械感。尚未实现辅音、拼音组合或任意文字朗读；自然中文还需要音素过渡、韵律与文本处理，不能由本原型直接推断效果。
      </div>
    </details>
  </main>
</template>

<style scoped lang="scss">
// 页面布局与面板容器
.voice-page {
  max-width: 1060px;
  margin: auto;
  padding: 18px 28px;
}

.experiment-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
  gap: 16px;

  margin: 14px 0;
}

.voice-panel {
  padding: 16px;

  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);
}

// 页头标题与简介
.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: end;
  flex-wrap: wrap;
  gap: 12px;

  margin-bottom: 10px;

  .page-title {
    margin: 5px 0 0;

    font-size: 28px;
    letter-spacing: -0.04em;
  }

  .title-accent {
    color: var(--color-accent);
  }

  .heading-description,
  .page-eyebrow {
    margin: 0;

    font-size: 12px;
    color: var(--color-text-muted);
  }

  .page-eyebrow {
    font-size: 10px;
    letter-spacing: 0.16em;
  }
}

// 面板标题与辅助文案
.panel-title {
  font-size: 15px;
}

.voice-description,
.voice-limitations {
  font-size: 12px;
  color: var(--color-text-muted);
}

// 选项分组与操作区布局
.voice-option-group {
  margin-bottom: 12px;
}

.voice-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

// 操作按钮及其可用状态
.voice-button {
  padding: 7px 10px;

  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg);

  cursor: pointer;

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    filter: brightness(1.12);
  }
}

.primary-button {
  background: var(--color-accent);

  color: var(--color-on-accent);
}

// 时长与音量滑块
.slider-label {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;

  margin: 10px 0;

  font-size: 12px;
}

.voice-slider {
  width: 100%;
  margin-top: 10px;

  accent-color: var(--color-accent);
}

// 当前发声预览
.sound-preview {
  display: flex;
  align-items: baseline;
  gap: 14px;

  margin: 0;

  font-size: 40px;
  color: var(--color-accent);
}

.preview-caption {
  display: block;

  font-size: 13px;
  color: var(--color-text-muted);
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

  padding: 4px 0;

  border-bottom: 1px solid var(--color-border);
}

.formant-value {
  margin: 0;
}

// 窄屏布局
@media (max-width: 700px) {
  .voice-page {
    padding: 24px 16px;
  }

  .experiment-grid {
    grid-template-columns: 1fr;
  }
}
</style>
