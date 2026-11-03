import { setThunderTextureSource } from './ambienceTexture';

let loading: Promise<void> | undefined;

/**
 * 装载雷声模板与纹理实现；页面挂载后立即调用，把约 56KB 的模板数据挪出首屏 chunk。
 * 成功后重复调用直接复用；失败会清空任务，下次点击可重试。
 */
export function loadThunderAssets(): Promise<void> {
  loading ??= import('./thunderTexture')
    .then((module) => {
      setThunderTextureSource(module.thunderTextureSource);
    })
    .catch((reason: unknown) => {
      loading = undefined;
      throw reason;
    });
  return loading;
}
