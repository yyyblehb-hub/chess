/**
 * Move sound, synthesised so it costs nothing to load and fires the same frame
 * the piece lands: a short wooden knock (noise tick + low body).
 */

let context: AudioContext | null = null;

type AudioContextConstructor = typeof AudioContext;

function audioContext(): AudioContext | null {
  if (context) return context;
  const ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  if (!ctor) return null;
  try {
    context = new ctor();
  } catch {
    return null;
  }
  return context;
}

let noiseBuffer: AudioBuffer | null = null;

function noise(ctx: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const length = Math.floor(ctx.sampleRate * 0.05);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = ctx.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
  }
  noiseBuffer = buffer;
  return buffer;
}

/**
 * The sniper round, from myinstants. It is streamed from their CDN because the
 * file is far larger than the repository upload path can carry; both players
 * hear it, since both get the shot frame.
 */
const SHOT_URL = 'https://www.myinstants.com/media/sounds/sniper-shot.mp3';

let shot: HTMLAudioElement | null = null;

export function playShotSound() {
  if (!shot) {
    shot = new Audio(SHOT_URL);
    shot.preload = 'auto';
    shot.volume = 0.65;
  }
  try {
    shot.currentTime = 0;
  } catch {
    /* not seekable yet; play() restarts it anyway */
  }
  void shot.play().catch(() => undefined);
}

export function playMoveSound(capture = false) {
  const ctx = audioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();

  const now = ctx.currentTime + 0.001;

  // tick of contact
  const tick = ctx.createBufferSource();
  tick.buffer = noise(ctx);
  const tickFilter = ctx.createBiquadFilter();
  tickFilter.type = 'bandpass';
  tickFilter.frequency.value = capture ? 2400 : 1900;
  tickFilter.Q.value = 0.9;
  const tickGain = ctx.createGain();
  tickGain.gain.setValueAtTime(capture ? 0.5 : 0.36, now);
  tickGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.045);
  tick.connect(tickFilter).connect(tickGain).connect(ctx.destination);
  tick.start(now);
  tick.stop(now + 0.06);

  // body of the piece settling on the square
  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(capture ? 210 : 175, now);
  body.frequency.exponentialRampToValueAtTime(capture ? 96 : 84, now + 0.07);
  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(0.0001, now);
  bodyGain.gain.exponentialRampToValueAtTime(capture ? 0.24 : 0.17, now + 0.004);
  bodyGain.gain.exponentialRampToValueAtTime(0.0002, now + 0.09);
  body.connect(bodyGain).connect(ctx.destination);
  body.start(now);
  body.stop(now + 0.1);
}
