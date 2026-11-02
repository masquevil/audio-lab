/** 生成可循环的白噪声缓冲，供风声滤波与篝火噪声脉冲使用。 */
export function createNoiseBuffer(context: BaseAudioContext, seconds: number): AudioBuffer {
  const sampleCount = Math.floor(context.sampleRate * seconds);
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < sampleCount; index += 1) samples[index] = Math.random() * 2 - 1;
  return buffer;
}
