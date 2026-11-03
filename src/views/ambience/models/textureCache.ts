import type { StereoTexture } from '../utils/dsp.ts';

const textureCache = new Map<string, StereoTexture>();

/** 同名纹理只渲染一次；播放、预热与后置加载的雷声共用同一份缓存。 */
export function getCachedTexture(key: string, create: () => StereoTexture): StereoTexture {
  const cached = textureCache.get(key);
  if (cached) return cached;

  const texture = create();
  textureCache.set(key, texture);
  return texture;
}

/** 页面卸载时释放缓存，避免长时间占用内存。 */
export function clearTextureCache(): void {
  textureCache.clear();
}
