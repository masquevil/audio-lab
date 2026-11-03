<script setup lang="ts">
import { RouterLink } from 'vue-router';

import LabPageBody from '@/components/LabPageBody.vue';
import PageHeader from '@/components/PageHeader.vue';
</script>

<template>
  <LabPageBody size="large">
    <PageHeader
      eyebrow="A SMALL LAB FOR SOUND"
      title="声音的可能，"
      accent="从这里开始。"
      size="large"
    />
    <p class="page-intro">演奏、聆听、探索。在浏览器里，做一点关于声音的实验。</p>
    <div class="feature-grid">
      <RouterLink
        class="feature-card linked-card"
        to="/instruments"
        aria-label="乐器演奏，开始演奏"
      >
        <div class="card-heading">
          <span
            class="feature-icon"
            aria-hidden="true"
          >
            ♬
          </span>
          <span class="feature-badge">已开放</span>
        </div>
        <h2 class="card-title">乐器演奏</h2>
        <p class="card-description">钢琴、小提琴、竹笛 · 三种合成音色 · 三个八度</p>
        <div
          class="mini-keyboard keyboard-theme"
          aria-hidden="true"
        >
          <i
            class="preview-key"
            v-for="key in 14"
            :key="key"
            :class="{ 'has-sharp': ![3, 7, 10, 14].includes(key) }"
          />
        </div>
        <span class="card-action">开始演奏 →</span>
      </RouterLink>
      <RouterLink
        class="feature-card linked-card"
        to="/voice"
        aria-label="人声基础模拟，开始实验"
      >
        <div class="card-heading">
          <span
            class="feature-icon"
            aria-hidden="true"
          >
            ∿
          </span>
          <span class="feature-badge">基础实验</span>
        </div>
        <h2 class="card-title">人声基础模拟</h2>
        <p class="card-description">六个元音 · 四个声调 · 男女声合成预设</p>
        <div class="vowel-preview">a · o · e · i · u · ü</div>
        <span class="card-action">开始实验 →</span>
      </RouterLink>
      <RouterLink
        class="feature-card linked-card"
        to="/ambience"
        aria-label="环境音模拟，开始实验"
      >
        <div class="card-heading">
          <span
            class="feature-icon"
            aria-hidden="true"
          >
            ≋
          </span>
          <span class="feature-badge">基础实验</span>
        </div>
        <h2 class="card-title">环境音模拟</h2>
        <p class="card-description">风雨雷火 · 实时合成 · 独立强度 · 混音录音</p>
        <div
          class="ambience-preview"
          aria-hidden="true"
        >
          <span>≋</span>
          <span>☂</span>
          <span>ϟ</span>
          <span>♨</span>
        </div>
        <span class="card-action">开始实验 →</span>
      </RouterLink>
    </div>
    <p class="page-footnote">WEB AUDIO API <span>无需安装 · 无需麦克风权限 · 不自动播放</span></p>
  </LabPageBody>
</template>

<style scoped lang="scss">
@use '@/assets/keyboard';

// 标题与介绍
.page-intro {
  font-size: var(--font-size-body);
  color: var(--color-text-secondary);
}

// 功能卡片
.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);

  margin: var(--space-8) 0;
}

.feature-card {
  padding: var(--space-6);

  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-bg-surface);

  // 卡片内容与状态

  &.linked-card {
    display: block;

    transition:
      border-color var(--motion-fast),
      box-shadow var(--motion-fast);

    color: var(--color-text-primary);
    text-decoration: none;
  }

  &.linked-card:hover,
  &.linked-card:focus-visible {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 1px var(--color-accent-subtle);
  }

  .card-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .feature-icon {
    font-size: var(--icon-size-lg);
    color: var(--color-accent);
  }

  .feature-badge {
    padding: var(--space-1) var(--space-2);

    border-radius: var(--radius-small);
    background: var(--color-accent-subtle);

    font-size: var(--font-size-caption);
    color: var(--color-accent);
  }

  .card-title {
    margin: var(--space-3) 0 var(--space-2);

    font-size: var(--font-size-heading);
    line-height: var(--line-height-title);
  }

  .card-description {
    // 描述区至少两行高，保证三张卡片的内容区对齐
    min-height: calc(2 * var(--font-size-caption) * var(--line-height-body));
    margin: 0;

    font-size: var(--font-size-caption);
    color: var(--color-text-secondary);
  }

  .card-action {
    font-size: var(--font-size-body);
    color: var(--color-accent);
    text-decoration: none;
  }

  .vowel-preview {
    display: flex;
    align-items: center;

    height: 96px;

    font-size: var(--font-size-caption);
    color: var(--color-text-secondary);
  }

  .ambience-preview {
    display: flex;
    align-items: center;
    gap: var(--space-4);

    height: 96px;

    font-size: var(--icon-size-lg);
    color: var(--color-text-secondary);
  }
}

// 卡片琴键预览
.mini-keyboard {
  display: flex;

  max-width: 280px;
  height: 62px;
  margin: var(--space-4) 0;
  border-radius: var(--radius-small);
  overflow: hidden;

  .preview-key {
    position: relative;

    flex: 1;

    border-right: 1px solid var(--color-key-edge);
    border-radius: 0 0 var(--radius-small) var(--radius-small);
    background: var(--color-key-bottom);
  }

  .has-sharp::after {
    position: absolute;
    right: -28%;
    z-index: 1;

    width: 58%;
    height: 60%;

    border-radius: 0 0 var(--radius-small) var(--radius-small);
    background: var(--color-key-black);
    content: '';
  }
}

// 页脚说明
.page-footnote {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);

  font-size: var(--font-size-caption);
  letter-spacing: 0.04em;
  color: var(--color-text-secondary);
}

// 窄屏布局
@media (max-width: 900px) {
  .feature-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .feature-grid {
    grid-template-columns: 1fr;
  }
}
</style>
