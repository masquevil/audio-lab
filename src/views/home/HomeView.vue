<script setup lang="ts">
import { onUnmounted, ref } from 'vue';

const isPlaying = ref(false);
const isStarting = ref(false);
const error = ref('');
const isSupported = typeof window.AudioContext === 'function';
let context: AudioContext | undefined;
let oscillator: OscillatorNode | undefined;
let gain: GainNode | undefined;
let disposed = false;

async function stop() {
  if (oscillator) {
    oscillator.onended = null;
    oscillator.stop();
    oscillator.disconnect();
  }
  gain?.disconnect();
  oscillator = undefined;
  gain = undefined;
  const previous = context;
  context = undefined;
  isPlaying.value = false;
  try {
    if (previous && previous.state !== 'closed') await previous.close();
  } catch {
    error.value = '音频资源释放失败，请刷新页面重试。';
  }
}

async function play() {
  if (!isSupported || isStarting.value || isPlaying.value || disposed) return;
  isStarting.value = true;
  error.value = '';
  try {
    const active = new AudioContext();
    context = active;
    await active.resume();
    if (disposed) return;
    oscillator = active.createOscillator();
    gain = active.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 440;
    // 小幅度输出并渐入渐出；实际响度仍取决于设备音量。
    const now = active.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.03);
    gain.gain.setValueAtTime(0.05, now + 1.95);
    gain.gain.linearRampToValueAtTime(0, now + 2);
    oscillator.connect(gain);
    gain.connect(active.destination);
    oscillator.start();
    isPlaying.value = true;
    oscillator.onended = () => void stop();
    oscillator.stop(now + 2);
  } catch {
    error.value = '无法启动音频，请检查浏览器权限后重试。';
    await stop();
  } finally {
    isStarting.value = false;
  }
}

onUnmounted(() => {
  disposed = true;
  void stop();
});
</script>

<template>
  <main class="home-page">
    <p class="page-eyebrow">AUDIO LAB / 实验 001</p>
    <h1 class="page-title">从一束声波开始。</h1>
    <p>一个基于 Web Audio API 的声音实验室。先听见声音，再探索更多可能。</p>
    <section
      class="tone-panel"
      aria-labelledby="tone-title"
    >
      <span
        class="tone-wave"
        aria-hidden="true"
        >∿</span
      >
      <h2 id="tone-title">Hello, sound.</h2>
      <p>440 Hz · 正弦波 · 2 秒</p>
      <p>请先调低设备音量。页面不会自动播放，也不需要麦克风权限。</p>
      <div class="tone-actions">
        <button
          class="tone-button"
          :disabled="!isSupported || isPlaying || isStarting"
          @click="play"
        >
          {{ isStarting ? '正在启动…' : '播放声音' }}
        </button>
        <button
          class="tone-button tone-button-secondary"
          :disabled="!isPlaying"
          @click="stop"
        >
          停止
        </button>
      </div>
      <p
        role="status"
        aria-live="polite"
      >
        {{
          !isSupported
            ? '当前浏览器不支持 Web Audio API，请使用现代浏览器。'
            : isPlaying
              ? '正在播放…'
              : '准备就绪'
        }}
      </p>
      <p
        v-if="error"
        role="alert"
      >
        {{ error }}
      </p>
    </section>
    <footer class="signal-path">OscillatorNode → GainNode → AudioDestinationNode</footer>
  </main>
</template>

<style scoped lang="scss">
.home-page {
  max-width: 800px;
  margin: auto;
  padding: 64px 24px;
}
.page-eyebrow {
  color: var(--color-accent);
  letter-spacing: 0.16em;
  font-size: 0.8rem;
}
.page-title {
  font-size: clamp(2rem, 6vw, 3.5rem);
  line-height: 1.2;
}
.tone-panel {
  margin: 40px 0;
  padding: 32px;
  border: 1px solid var(--color-border);
  border-radius: 20px;
  background: var(--color-surface);
}
.tone-wave {
  font-size: 4rem;
  line-height: 1;
  color: var(--color-accent);
}
.tone-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}
.tone-button {
  font: inherit;
  padding: 10px 22px;
  border: 1px solid var(--color-accent);
  border-radius: 10px;
  background: var(--color-accent);
  color: var(--color-on-accent);
  cursor: pointer;
}
.tone-button.tone-button-secondary {
  background: transparent;
  color: var(--color-text);
}
.tone-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.tone-button:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 4px;
}
.signal-path {
  color: var(--color-text-muted);
  font-size: 0.8rem;
  overflow-wrap: anywhere;
}
</style>
