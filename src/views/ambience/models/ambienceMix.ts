import { defaultIntensities } from '../constants/ambience';
import type { AmbienceLayerId } from '../types/ambience';

import { createAmbienceLayer } from './ambienceLayer';
import type { AmbienceLayer } from './ambienceLayer';
import { createReverbImpulse, toAudioBuffer } from './ambienceTexture';

/** 环境音混响的湿声比例；干声与湿声都接到页面总线入口。 */
const reverbWetValue = 0.12;

/** 最后一段衰减由页面总线完成，延迟断开节点避免硬切，毫秒。 */
const releaseDelay = 160;

export interface AmbienceMix {
  setLayerActive(id: AmbienceLayerId, active: boolean): void;
  setLayerIntensity(id: AmbienceLayerId, value: number): void;
  /** 断开并释放声部与混响节点；`immediate` 用于会话已失效或页面卸载。 */
  dispose(immediate?: boolean): void;
}

/** 环境音的声部图与专属混响，输出接到页面总线入口，不持有 Vue 状态。 */
export function createAmbienceMix(context: AudioContext, destination: AudioNode): AmbienceMix {
  const layers: Partial<Record<AmbienceLayerId, AmbienceLayer>> = {};
  const layerIntensities: Record<AmbienceLayerId, number> = { ...defaultIntensities };
  const output = context.createGain();
  const reverb = context.createConvolver();
  const reverbWet = context.createGain();
  let disposed = false;

  try {
    reverb.buffer = toAudioBuffer(context, createReverbImpulse(context.sampleRate));
    reverbWet.gain.value = reverbWetValue;
    output.connect(destination);
    output.connect(reverbWet);
    reverbWet.connect(reverb);
    reverb.connect(destination);
  } catch (error) {
    output.disconnect();
    reverbWet.disconnect();
    reverb.disconnect();
    throw error;
  }

  /** 首次启用时生成该声部的程序化纹理，之后复用。 */
  function ensureLayer(id: AmbienceLayerId): AmbienceLayer {
    let layer = layers[id];
    if (!layer) {
      layer = createAmbienceLayer(id, context, output);
      layer.setIntensity(layerIntensities[id]);
      layers[id] = layer;
    }
    return layer;
  }

  function releaseNodes(): void {
    for (const layer of Object.values(layers)) layer?.dispose();
    output.disconnect();
    reverbWet.disconnect();
    reverb.disconnect();
  }

  function dispose(immediate = false): void {
    if (disposed) return;
    disposed = true;
    if (immediate) {
      releaseNodes();
      return;
    }
    setTimeout(releaseNodes, releaseDelay);
  }

  return {
    setLayerActive(id, active) {
      if (disposed) return;
      if (active) ensureLayer(id).setActive(true);
      else layers[id]?.setActive(false);
    },
    setLayerIntensity(id, value) {
      layerIntensities[id] = value;
      if (disposed) return;
      layers[id]?.setIntensity(value);
    },
    dispose,
  };
}
