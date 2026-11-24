// Procedural audio built on the Web Audio API: no audio files are needed.
class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private engineGain!: GainNode;
  private engineOsc!: OscillatorNode;
  private ambienceFilter!: BiquadFilterNode;
  private alarmTimer: number | null = null;
  private whaleTimer: number | null = null;
  private bubbleTimer: number | null = null;
  private volume = 0.6;

  /** Must be called from a user gesture (a click) to satisfy browser autoplay rules. */
  init() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);

    // Ambience: looping brown noise through a low-pass filter whose cutoff follows depth.
    const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; data[i] = last * 3.5; }
    const noise = ctx.createBufferSource();
    noise.buffer = buf; noise.loop = true;
    this.ambienceFilter = ctx.createBiquadFilter();
    this.ambienceFilter.type = 'lowpass'; this.ambienceFilter.frequency.value = 700;
    const ambGain = ctx.createGain(); ambGain.gain.value = 0.35;
    noise.connect(this.ambienceFilter).connect(ambGain).connect(this.master);
    noise.start();

    // Engine: a low sawtooth hum whose pitch and level follow speed.
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 48;
    const engFilter = ctx.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 260;
    this.engineGain = ctx.createGain(); this.engineGain.gain.value = 0;
    this.engineOsc.connect(engFilter).connect(this.engineGain).connect(this.master);
    this.engineOsc.start();

    this.scheduleWhale();
    this.scheduleBubbles();
  }

  setVolume(v: number) { this.volume = v; if (this.master && this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }

  update(speedNorm: number, depth: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(44 + speedNorm * 60, t, 0.15);
    this.engineGain.gain.setTargetAtTime(0.03 + speedNorm * 0.14, t, 0.2);
    this.ambienceFilter.frequency.setTargetAtTime(Math.max(180, 800 - depth * 3), t, 0.5);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, endFreq?: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  ping() { this.tone(1500, 1.1, 'sine', 0.22, 700); this.tone(750, 1.6, 'sine', 0.08, 350); }
  scanTick() { this.tone(980 + Math.random() * 120, 0.07, 'triangle', 0.05); }
  discovery() { [0, 0.11, 0.22].forEach((d, i) => window.setTimeout(() => this.tone([660, 880, 1320][i], 0.35, 'sine', 0.16), d * 1000)); }
  click() { this.tone(520, 0.06, 'square', 0.04); }
  collect() { this.tone(420, 0.12, 'triangle', 0.12, 840); }
  thud() { this.tone(90, 0.3, 'sine', 0.3, 40); }

  setAlarm(on: boolean) {
    if (on && this.alarmTimer === null) this.alarmTimer = window.setInterval(() => this.tone(880, 0.18, 'square', 0.07), 700);
    if (!on && this.alarmTimer !== null) { clearInterval(this.alarmTimer); this.alarmTimer = null; }
  }

  private scheduleWhale() {
    this.whaleTimer = window.setTimeout(() => {
      // Distant whale call: a slow, falling glide with a soft second voice.
      this.tone(220, 3.2, 'sine', 0.05, 130);
      this.tone(330, 3.6, 'sine', 0.03, 190);
      this.scheduleWhale();
    }, 25000 + Math.random() * 40000);
  }

  private scheduleBubbles() {
    this.bubbleTimer = window.setTimeout(() => {
      this.tone(500 + Math.random() * 500, 0.08, 'sine', 0.03, 1200);
      this.scheduleBubbles();
    }, 1500 + Math.random() * 3500);
  }

  stopAll() {
    this.setAlarm(false);
    if (this.whaleTimer !== null) clearTimeout(this.whaleTimer);
    if (this.bubbleTimer !== null) clearTimeout(this.bubbleTimer);
    this.whaleTimer = null; this.bubbleTimer = null;
  }
}

export const audio = new AudioEngine();
