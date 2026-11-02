import type { AmbienceLayerConfig, AmbienceLayerId } from '../types/ambience';

export const layerIds: readonly AmbienceLayerId[] = ['wind', 'rain', 'thunder', 'fire'];

export const ambienceLayers: Record<AmbienceLayerId, AmbienceLayerConfig> = {
  wind: {
    label: '风声',
    icon: '≋',
    detail: '阵风穿过旷野',
    intensityLabels: ['微风', '轻风', '强风', '疾风', '飓风'],
    defaultValue: 0.4,
    maxGain: 0.75,
    gainCurve: 0.7,
  },
  rain: {
    label: '雨声',
    icon: '☂',
    detail: '雨点落在水泥地上',
    intensityLabels: ['细雨', '小雨', '中雨', '大雨', '暴雨'],
    defaultValue: 0.35,
    maxGain: 0.78,
    gainCurve: 0.8,
  },
  thunder: {
    label: '雷声',
    icon: 'ϟ',
    detail: '远处滚动的雷暴',
    intensityLabels: ['远雷', '闷雷', '近雷', '雷暴', '惊雷'],
    defaultValue: 0.3,
    maxGain: 1.05,
    gainCurve: 0.45,
  },
  fire: {
    label: '篝火',
    icon: '♨',
    detail: '木柴噼啪作响',
    intensityLabels: ['余烬', '火苗', '篝火', '旺火', '烈焰'],
    defaultValue: 0.4,
    // 滑块两端各 20% 对篝火没有有效变化（更低太稀、更高太密）：
    // 于是把 0.2–0.8 映射成原来 0–1 的效果，超出部分按端点处理。
    intensityRange: [0.2, 0.8],
    // 篝火的音量随强度只做很小的变化（响爆电平 0.75→0.9），主要靠密度区分；
    // 所以输出电平几乎不随强度变（下限 92%），低强度也要能听见，不能静音。
    minLevelRatio: 0.92,
    maxGain: 2.2,
    gainCurve: 0.6,
  },
};

/** 各声部的默认强度，0–1；页面状态与会话都以它为初值。 */
export const defaultIntensities: Record<AmbienceLayerId, number> = {
  wind: ambienceLayers.wind.defaultValue,
  rain: ambienceLayers.rain.defaultValue,
  thunder: ambienceLayers.thunder.defaultValue,
  fire: ambienceLayers.fire.defaultValue,
};

/** 录音上限，秒；避免长时间占据内存。 */
export const maxRecordingSeconds = 300;
