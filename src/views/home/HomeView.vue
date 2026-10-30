<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <main class="home-page">
    <p class="page-eyebrow">A SMALL LAB FOR SOUND</p>
    <h1 class="page-title">声音的可能，<span class="title-accent">从这里开始。</span></h1>
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
      <section class="feature-card">
        <div class="card-heading">
          <span
            class="feature-icon"
            aria-hidden="true"
          >
            ∿
          </span>
          <span class="feature-badge planned-badge">规划中</span>
        </div>
        <h2 class="card-title">更多声音实验</h2>
        <p class="card-description">节奏、音色与声波可视化……未来方向仅作展示，暂未开放。</p>
        <div class="coming-soon">更多灵感，正在酝酿。</div>
      </section>
    </div>
    <p class="page-footnote">WEB AUDIO API <span>无需安装 · 无需麦克风权限 · 不自动播放</span></p>
  </main>
</template>

<style scoped lang="scss">
@use '@/assets/keyboard';

// 页面布局
.home-page {
  max-width: 1060px;
  margin: auto;
  padding: 38px 28px;
}

// 标题与介绍
.page-title {
  margin: 10px 0;

  font-size: clamp(23px, 3vw, 30px);
  line-height: 1.4;
}

.title-accent {
  color: var(--color-accent);
}

.page-eyebrow {
  font-size: 10px;
  letter-spacing: 0.16em;
  color: var(--color-text-muted);
}

.page-intro {
  font-size: 13px;
  color: var(--color-text-muted);
}

// 功能卡片
.feature-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;

  margin: 28px 0;
}

.feature-card {
  padding: 22px;

  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-surface);

  // 卡片内容与状态

  &.linked-card {
    display: block;

    transition:
      border-color 0.15s,
      box-shadow 0.15s;

    color: var(--color-text);
    text-decoration: none;
  }

  &.linked-card:hover,
  &.linked-card:focus-visible {
    border-color: var(--color-accent);
    box-shadow: 0 0 0 1px var(--color-accent-soft);
  }

  .card-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .feature-icon {
    font-size: 26px;
    color: var(--color-accent);
  }

  .feature-badge {
    padding: 3px 8px;

    border-radius: 5px;
    background: var(--color-accent-soft);

    font-size: 10px;
    color: var(--color-accent);
  }

  .planned-badge {
    background: var(--color-bg);

    color: var(--color-text-muted);
  }

  .card-title {
    margin: 12px 0 8px;

    font-size: 17px;
  }

  .card-description {
    min-height: 38px;
    margin: 0;

    font-size: 12px;
    color: var(--color-text-muted);
  }

  .card-action {
    font-size: 13px;
    color: var(--color-accent);
    text-decoration: none;
  }

  .coming-soon {
    display: flex;
    align-items: center;

    height: 96px;

    font-size: 12px;
    color: var(--color-text-muted);
  }
}

// 卡片琴键预览
.mini-keyboard {
  display: flex;

  max-width: 280px;
  height: 62px;
  margin: 16px 0;
  border-radius: 5px;
  overflow: hidden;

  .preview-key {
    position: relative;

    flex: 1;

    border-right: 1px solid var(--color-key-edge);
    border-radius: 0 0 3px 3px;
    background: var(--color-key-bottom);
  }

  .has-sharp::after {
    position: absolute;
    right: -28%;
    z-index: 1;

    width: 58%;
    height: 60%;

    border-radius: 0 0 2px 2px;
    background: var(--color-key-black);
    content: '';
  }
}

// 页脚说明
.page-footnote {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;

  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

// 窄屏布局
@media (max-width: 600px) {
  .home-page {
    padding: 26px 16px;
  }
  .feature-grid {
    grid-template-columns: 1fr;
  }
}
</style>
