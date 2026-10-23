// A small music-box arrangement of "Happy Birthday" (public domain melody) plus an
// original arpeggio interlude, synthesised live with the Web Audio API. No audio files,
// so nothing can 404 or be blocked, and it loops seamlessly until paused.

type Voice = 'bell' | 'pad' | 'bass';
interface NoteEvent {
  beat: number;
  beats: number;
  freqs: number[];
  voice: Voice;
}

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, Bb: 10, B: 11 };

function hz(name: string): number {
  const m = /^([A-G]b?)(\d)$/.exec(name);
  if (!m) throw new Error(`Bad note ${name}`);
  const midi = SEMITONES[m[1]] + (Number(m[2]) + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const CHORDS: Record<string, string[]> = {
  F: ['F3', 'A3', 'C4'],
  C: ['E3', 'G3', 'C4'],
  Bb: ['F3', 'Bb3', 'D4'],
  Dm: ['F3', 'A3', 'D4'],
};
const BASS: Record<string, string> = { F: 'F2', C: 'C3', Bb: 'Bb2', Dm: 'D3' };

// [note, beats, chord change?]
const MELODY: [string, number, string?][] = [
  ['C5', 0.75, 'F'], ['C5', 0.25], ['D5', 1], ['C5', 1], ['F5', 1], ['E5', 2, 'C'],
  ['C5', 0.75], ['C5', 0.25], ['D5', 1], ['C5', 1], ['G5', 1], ['F5', 2, 'F'],
  ['C5', 0.75], ['C5', 0.25], ['C6', 1], ['A5', 1], ['F5', 1], ['E5', 1, 'Bb'], ['D5', 2],
  ['Bb5', 0.75, 'F'], ['Bb5', 0.25], ['A5', 1], ['F5', 1], ['G5', 1, 'C'], ['F5', 3, 'F'],
];

const INTERLUDE: [string, string[]][] = [
  ['F', ['F4', 'A4', 'C5', 'A4', 'C5', 'F5']],
  ['Dm', ['D4', 'F4', 'A4', 'F4', 'A4', 'D5']],
  ['Bb', ['Bb3', 'D4', 'F4', 'D4', 'F4', 'Bb4']],
  ['C', ['C4', 'E4', 'G4', 'E4', 'G4', 'C5']],
];

function buildSong(): { events: NoteEvent[]; length: number } {
  const events: NoteEvent[] = [];
  const chordMarks: [number, string][] = [];
  let beat = 0;
  for (const [note, beats, chord] of MELODY) {
    events.push({ beat, beats, freqs: [hz(note)], voice: 'bell' });
    if (chord) chordMarks.push([beat, chord]);
    beat += beats;
  }
  const melodyEnd = beat;
  chordMarks.forEach(([start, chord], i) => {
    const end = i + 1 < chordMarks.length ? chordMarks[i + 1][0] : melodyEnd;
    events.push({ beat: start, beats: end - start, freqs: CHORDS[chord].map(hz), voice: 'pad' });
    events.push({ beat: start, beats: Math.min(2, end - start), freqs: [hz(BASS[chord])], voice: 'bass' });
  });

  beat += 1; // breath before the interlude
  for (const [chord, arp] of INTERLUDE) {
    events.push({ beat, beats: 3, freqs: CHORDS[chord].map(hz), voice: 'pad' });
    events.push({ beat, beats: 2, freqs: [hz(BASS[chord])], voice: 'bass' });
    arp.forEach((n, i) => events.push({ beat: beat + i * 0.5, beats: 0.5, freqs: [hz(n)], voice: 'bell' }));
    beat += 3;
  }
  events.sort((a, b) => a.beat - b.beat);
  return { events, length: beat };
}

export class BirthdayMusic {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private song = buildSong();
  private secPerBeat = 60 / 84;
  private loopStart = 0;
  private index = 0;
  private wantPlaying = false;
  onStateChange: (playing: boolean) => void = () => {};

  get supported(): boolean {
    return typeof window !== 'undefined' && !!(window.AudioContext || (window as any).webkitAudioContext);
  }

  get playing(): boolean {
    return this.wantPlaying;
  }

  /** Must be called from inside a user gesture (click/tap). */
  start(): boolean {
    if (this.ctx) return this.resume();
    try {
      // Lets iOS Safari play Web Audio even when the ringer switch is on silent.
      const nav = navigator as any;
      if (nav.audioSession) nav.audioSession.type = 'playback';

      const Ctor: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctor();
      this.ctx = ctx;

      const compressor = ctx.createDynamicsCompressor();
      compressor.connect(ctx.destination);

      const master = ctx.createGain();
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.32, ctx.currentTime + 2.5);
      master.connect(compressor);

      const bus = ctx.createGain();
      bus.connect(master);
      const reverb = ctx.createConvolver();
      reverb.buffer = this.impulse(ctx, 2.6);
      const wet = ctx.createGain();
      wet.gain.value = 0.32;
      bus.connect(reverb).connect(wet).connect(master);
      this.bus = bus;

      void ctx.resume();
      this.loopStart = ctx.currentTime + 0.35;
      this.index = 0;
      this.wantPlaying = true;
      window.setInterval(this.tick, 90);
      this.tick();
      document.addEventListener('visibilitychange', this.onVisibility);
      this.onStateChange(true);
      return true;
    } catch (err) {
      console.warn('Birthday music unavailable:', err);
      this.ctx = null;
      return false;
    }
  }

  pause(): void {
    if (!this.ctx) return;
    this.wantPlaying = false;
    this.ctx.suspend().catch(() => {});
    this.onStateChange(false);
  }

  resume(): boolean {
    if (!this.ctx) return this.start();
    this.wantPlaying = true;
    this.ctx.resume().catch((err) => console.warn('Could not resume music:', err));
    this.onStateChange(true);
    return true;
  }

  toggle(): void {
    if (this.wantPlaying) this.pause();
    else this.resume();
  }

  // Pause while the tab is in the background (e.g. switching to WhatsApp), pick up where it left off.
  private onVisibility = (): void => {
    if (!this.ctx) return;
    if (document.hidden) this.ctx.suspend().catch(() => {});
    else if (this.wantPlaying) this.ctx.resume().catch(() => {});
  };

  private tick = (): void => {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const horizon = ctx.currentTime + 0.6;
    const { events, length } = this.song;
    // If we fell far behind (e.g. a throttled timer), skip ahead instead of firing a burst of notes.
    if (this.loopStart + events[this.index].beat * this.secPerBeat < ctx.currentTime - 0.25) {
      while (this.loopStart + events[this.index].beat * this.secPerBeat < ctx.currentTime) this.advance(length);
    }
    for (;;) {
      const ev = events[this.index];
      const t = this.loopStart + ev.beat * this.secPerBeat;
      if (t > horizon) break;
      this.play(ev, Math.max(t, ctx.currentTime));
      this.advance(length);
    }
  };

  private advance(length: number): void {
    this.index++;
    if (this.index >= this.song.events.length) {
      this.index = 0;
      this.loopStart += length * this.secPerBeat;
    }
  }

  private play(ev: NoteEvent, t: number): void {
    const dur = ev.beats * this.secPerBeat;
    for (const f of ev.freqs) {
      if (ev.voice === 'bell') this.bell(f, t);
      else if (ev.voice === 'pad') this.pad(f, t, dur);
      else this.bassNote(f, t, dur);
    }
  }

  private bell(f: number, t: number): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.42, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
    g.connect(this.bus!);
    const partials: [number, number][] = [[1, 1], [2, 0.22], [3.01, 0.08]];
    for (const [mult, amp] of partials) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * mult;
      const pg = ctx.createGain();
      pg.gain.value = amp;
      o.connect(pg).connect(g);
      o.start(t);
      o.stop(t + 2);
    }
  }

  private pad(f: number, t: number, dur: number): void {
    const ctx = this.ctx!;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const g = ctx.createGain();
    const end = t + dur;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.045, t + 0.45);
    g.gain.setValueAtTime(0.045, Math.max(t + 0.46, end - 0.3));
    g.gain.linearRampToValueAtTime(0.0001, end + 0.4);
    filter.connect(g).connect(this.bus!);
    for (const detune of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.detune.value = detune;
      o.connect(filter);
      o.start(t);
      o.stop(end + 0.5);
    }
  }

  private bassNote(f: number, t: number, dur: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.3);
    o.connect(g).connect(this.bus!);
    o.start(t);
    o.stop(t + dur + 0.4);
  }

  private impulse(ctx: AudioContext, seconds: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return buf;
  }
}
