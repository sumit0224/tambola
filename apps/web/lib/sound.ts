let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (audioContext) {
    return audioContext;
  }

  const ContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!ContextCtor) {
    return null;
  }

  audioContext = new ContextCtor();
  return audioContext;
}

async function ensureAudioReady(): Promise<AudioContext | null> {
  const ctx = getAudioContext();
  if (!ctx) {
    return null;
  }

  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return null;
    }
  }

  return ctx;
}

function scheduleTone(
  ctx: AudioContext,
  startAt: number,
  frequency: number,
  durationSeconds: number,
  type: OscillatorType,
  gainPeak: number
): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(gainPeak, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSeconds);

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start(startAt);
  oscillator.stop(startAt + durationSeconds + 0.01);
}

export async function unlockAnnouncementAudio(): Promise<void> {
  await ensureAudioReady();
}

export async function playNumberAnnouncementSound(number: number): Promise<void> {
  const ctx = await ensureAudioReady();
  if (!ctx) {
    return;
  }

  const base = 280;
  const span = 520;
  const normalized = Math.max(1, Math.min(90, number)) / 90;
  const freq = base + span * normalized;
  const now = ctx.currentTime;

  scheduleTone(ctx, now, freq, 0.14, "triangle", 0.06);
  scheduleTone(ctx, now + 0.16, freq * 1.08, 0.12, "sine", 0.045);
}

export async function playWinnerAnnouncementSound(): Promise<void> {
  const ctx = await ensureAudioReady();
  if (!ctx) {
    return;
  }

  const now = ctx.currentTime;
  scheduleTone(ctx, now, 523.25, 0.16, "triangle", 0.06);
  scheduleTone(ctx, now + 0.17, 659.25, 0.18, "triangle", 0.06);
  scheduleTone(ctx, now + 0.36, 783.99, 0.22, "triangle", 0.07);
}

export async function playGameStartSound(): Promise<void> {
  const ctx = await ensureAudioReady();
  if (!ctx) {
    return;
  }

  const now = ctx.currentTime;
  scheduleTone(ctx, now, 392, 0.12, "sine", 0.05);
  scheduleTone(ctx, now + 0.13, 493.88, 0.12, "sine", 0.05);
}
