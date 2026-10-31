import type { ThreePointContour } from '../types/voice';

/** 按 0–1 的时间进度对三点轮廓分段线性插值；越界取端点，非有限进度抛出 RangeError。 */
export function interpolateContour(contour: ThreePointContour, progress: number): number {
  if (!Number.isFinite(progress)) throw new RangeError('轮廓进度必须为有限数值');
  const [startValue, middleValue, endValue] = contour;
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const isFirstHalf = clampedProgress <= 0.5;
  const segmentStart = isFirstHalf ? startValue : middleValue;
  const segmentEnd = isFirstHalf ? middleValue : endValue;
  const segmentProgress = isFirstHalf ? clampedProgress * 2 : (clampedProgress - 0.5) * 2;
  return segmentStart + (segmentEnd - segmentStart) * segmentProgress;
}
