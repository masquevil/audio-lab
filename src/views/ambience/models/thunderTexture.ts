/*
 * 雷声模板与纹理：由 `loadThunderAssets` 动态加载，不进入页面首屏 chunk。
 * 本模块及其导入链会被 tools/sound/render-presets.mjs 以 Node 直接执行（不经构建），
 * 因此相对导入必须写全 `.ts` 扩展名。
 */
import { normalizeLoudness } from '../utils/dsp.ts';
import type { StereoTexture } from '../utils/dsp.ts';

import { getCachedTexture } from './textureCache.ts';
import {
  createThunderEnvelopeTexture,
  thunderAudioPresetIds,
  thunderAudioPresets,
} from './thunderEnvelope.ts';
import type { ThunderAudioPreset } from './thunderEnvelope.ts';

/** 雷声模板与纹理的访问入口，装入后由纹理入口保存引用。 */
export interface ThunderTextureSource {
  /** 全部变体，供声部按顺序预热。 */
  presetIds: readonly ThunderAudioPreset[];
  /** 按采样率与变体取纹理；同一组合只渲染一次。 */
  getTexture(rate: number, preset: ThunderAudioPreset): StereoTexture;
}

export const thunderTextureSource: ThunderTextureSource = {
  presetIds: thunderAudioPresetIds,
  getTexture(rate, preset) {
    return getCachedTexture(`thunder-envelope:${rate}:${preset}`, () => {
      const texture = createThunderEnvelopeTexture(rate, thunderAudioPresets[preset]);
      normalizeLoudness(texture.left, texture.right, -20, 0.98);
      return texture;
    });
  },
};
