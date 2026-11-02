/**
 * 把产品预设渲染成 WAV，供 judge.py / acceptance.py 判定，或直接试听。
 * 与产品使用同一纹理入口（雷声含响度归一化），因此输出电平与页面一致。
 *
 *   node tools/sound/render-presets.mjs [--output /tmp/sound-out] [--textures]
 *
 * --textures 额外渲染雨/火纹理（不含雷）。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  getEmberBedTexture,
  getRainTexture,
  getThunderTexture,
} from '../../src/views/ambience/models/ambienceTexture.ts';
import { thunderAudioPresetIds } from '../../src/views/ambience/models/thunderEnvelope.ts';

const rate = 48_000;
const outputFlag = process.argv.indexOf('--output');
const outputDir = outputFlag > -1 ? process.argv[outputFlag + 1] : '/tmp/sound-out';
const withTextures = process.argv.includes('--textures');

function writeWav(path, texture) {
  const length = texture.left.length;
  const buffer = Buffer.alloc(44 + length * 4);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + length * 4, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22);
  buffer.writeUInt32LE(rate, 24);
  buffer.writeUInt32LE(rate * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(length * 4, 40);
  for (let index = 0; index < length; index += 1) {
    const left = Math.max(-1, Math.min(1, texture.left[index]));
    const right = Math.max(-1, Math.min(1, texture.right[index]));
    buffer.writeInt16LE(Math.round(left * 32767), 44 + index * 4);
    buffer.writeInt16LE(Math.round(right * 32767), 46 + index * 4);
  }
  writeFileSync(path, buffer);
}

function render(name, texture) {
  const path = resolve(outputDir, `${name}.wav`);
  mkdirSync(dirname(path), { recursive: true });
  writeWav(path, texture);
  console.log(`${path}: ${(texture.left.length / rate).toFixed(2)}s`);
}

mkdirSync(resolve(outputDir), { recursive: true });

if (withTextures) {
  render('rain-light', getRainTexture(rate, 'light'));
  render('rain-heavy', getRainTexture(rate, 'heavy'));
  render('fire-bed', getEmberBedTexture(rate));
} else {
  for (const name of thunderAudioPresetIds) {
    const start = performance.now();
    const texture = getThunderTexture(rate, name);
    render(`thunder-${name}`, texture);
    console.log(`  渲染 ${(performance.now() - start).toFixed(0)}ms`);
  }
}
