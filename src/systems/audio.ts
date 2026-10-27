/** Efeitos sonoros sintetizados com Web Audio (iniciados após um gesto do usuário). */
type Wave = OscillatorType;

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.25;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  private tone(
    freq: number,
    dur: number,
    wave: Wave = 'triangle',
    delay = 0,
    slideTo?: number,
    vol = 1,
  ): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.6 * vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  select(): void {
    this.tone(660, 0.08, 'triangle');
    this.tone(880, 0.08, 'triangle', 0.05);
  }
  step(): void {
    this.tone(220, 0.05, 'square', 0, undefined, 0.25);
  }
  cancel(): void {
    this.tone(440, 0.1, 'triangle', 0, 260);
  }
  hit(): void {
    this.tone(180, 0.14, 'square', 0, 70, 0.7);
    this.tone(90, 0.12, 'sine', 0.01);
  }
  shoot(): void {
    this.tone(900, 0.12, 'sawtooth', 0, 300, 0.3);
  }
  heal(): void {
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.18, 'sine', i * 0.07));
  }
  kill(): void {
    this.tone(300, 0.3, 'sawtooth', 0, 60, 0.5);
  }
  ability(): void {
    this.tone(392, 0.2, 'triangle', 0, 784);
  }
  turn(): void {
    this.tone(523, 0.12, 'triangle');
    this.tone(784, 0.16, 'triangle', 0.1);
  }
  enemyTurn(): void {
    this.tone(330, 0.14, 'triangle');
    this.tone(247, 0.2, 'triangle', 0.1);
  }
  win(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'triangle', i * 0.12));
  }
  lose(): void {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.35, 'triangle', i * 0.15));
  }
  deny(): void {
    this.tone(150, 0.12, 'square', 0, undefined, 0.4);
  }
}

export const sfx = new Sfx();
