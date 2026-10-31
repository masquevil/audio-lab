/** 淡出与释放等待时长，单位毫秒；等待略长于淡出，确保排程完成后再断开节点。 */
const fadeOutTiming = { ramp: 25, releaseDelay: 50 };

/** 音频时钟排程淡出；定时器仅用于等待后释放资源，不参与声音生成。 */
export async function fadeOut(context: AudioContext, output: GainNode): Promise<void> {
  if (context.state !== 'running') return;
  const now = context.currentTime;
  output.gain.cancelAndHoldAtTime(now);
  output.gain.linearRampToValueAtTime(0, now + fadeOutTiming.ramp / 1000);
  await new Promise<void>((resolve) => window.setTimeout(resolve, fadeOutTiming.releaseDelay));
}
