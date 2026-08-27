let audioCtx: AudioContext | null = null;

function ctx(): AudioContext {
  if (!audioCtx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AC();
  }
  return audioCtx;
}

export function unlockAudio() {
  try {
    ctx();
  } catch {
    /* ignore */
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, gainPeak = 0.18) {
  const c = ctx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, c.currentTime + start);
  gain.gain.linearRampToValueAtTime(gainPeak, c.currentTime + start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + dur);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + dur + 0.05);
}

export type SfxName = "draw" | "join" | "win" | "lose";

export function sfx(name: SfxName, enabled: boolean) {
  if (!enabled) return;
  try {
    if (name === "draw") {
      tone(660, 0, 0.14, "triangle", 0.15);
      tone(880, 0.1, 0.18, "triangle", 0.12);
    } else if (name === "join") {
      tone(440, 0, 0.12, "sine", 0.14);
      tone(660, 0.1, 0.16, "sine", 0.14);
    } else if (name === "win") {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.12, 0.28, "triangle", 0.16));
    } else if (name === "lose") {
      tone(300, 0, 0.2, "sawtooth", 0.1);
      tone(220, 0.18, 0.3, "sawtooth", 0.1);
    }
  } catch {
    /* ignore */
  }
}
