// The sound of the circus, made with Web Audio rather than recordings, so
// there is nothing to download: hooves, the rumble of wheels on sand, and a
// crowd that swells in the turns, roars at the start, gasps at a crash and
// cheers at the finish.
//
// Browsers only let a page start sound from a tap or key press, so the audio
// is set up by unlock(), called from the start button.

import { crowdLevel, fadeExcitement, gallopBeats, strideSeconds } from './rhythm';

export interface Sound {
  /** "off", "suspended", "running" or "closed": the state of the audio. */
  readonly state: string;
  /** Sets up the audio. Call from inside a tap or key press. */
  unlock(): void;
  /** Turns all sound on or off. */
  setEnabled(enabled: boolean): void;
  /**
   * Follows the race: the player's speed (m/s), whether they're in a turn,
   * and how fast cruising speed is. Call every frame.
   */
  update(speed: number, cruiseSpeed: number, inTurn: boolean, dt: number): void;
  /** The crowd roars as the mappa drops. */
  roar(): void;
  /** A blast on the tuba, the straight Roman trumpet sounded at the start. */
  tuba(): void;
  /** A crash: a thump, splintering, and a gasp from the crowd. */
  crash(): void;
  /** The crowd cheers the finish, louder for a win. */
  cheer(won: boolean): void;
}

/** How far ahead hoofbeats are scheduled, in seconds. */
const SCHEDULE_AHEAD = 0.12;

export function createSound(volume: number, enabled: boolean): Sound {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let crowdGain: GainNode | null = null;
  let rumbleGain: GainNode | null = null;
  let on = enabled;
  let excitement = 0;
  let nextStride = 0;

  function makeNoise(context: AudioContext): AudioBuffer {
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = buffer.getChannelData(0);
    // Brownish noise: smoother and less hissy than white noise.
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    return buffer;
  }

  /** A looping noise source through a filter into a gain, for steady sounds. */
  function loop(context: AudioContext, filter: BiquadFilterNode, to: AudioNode): GainNode {
    const source = context.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    source.loopStart = Math.random();
    const gain = context.createGain();
    gain.gain.value = 0;
    source.connect(filter).connect(gain).connect(to);
    source.start();
    return gain;
  }

  /** A short burst of filtered noise, for hooves and crashes. */
  function burst(at: number, frequency: number, q: number, peak: number, length: number): void {
    if (!ctx || !master || !noise) return;
    const source = ctx.createBufferSource();
    source.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(peak, at + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
    source.connect(filter).connect(gain).connect(master);
    source.start(at, Math.random() * 1.5, length + 0.05);
  }

  /** A low thud whose pitch drops, for a crash. */
  function thump(at: number): void {
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, at);
    osc.frequency.exponentialRampToValueAtTime(38, at + 0.35);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.9, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
    osc.connect(gain).connect(master);
    osc.start(at);
    osc.stop(at + 0.5);
  }

  return {
    get state() {
      return ctx ? ctx.state : 'off';
    },
    unlock() {
      if (ctx) {
        void ctx.resume();
        return;
      }
      const Context =
        window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) {
        console.debug('sound unavailable: no Web Audio');
        return;
      }
      try {
        ctx = new Context();
      } catch (error) {
        console.debug('sound unavailable: %s', error);
        return;
      }
      noise = makeNoise(ctx);
      master = ctx.createGain();
      master.gain.value = on ? volume : 0;
      master.connect(ctx.destination);

      const crowdFilter = ctx.createBiquadFilter();
      crowdFilter.type = 'bandpass';
      crowdFilter.frequency.value = 700;
      crowdFilter.Q.value = 0.6;
      crowdGain = loop(ctx, crowdFilter, master);

      const rumbleFilter = ctx.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.value = 140;
      rumbleGain = loop(ctx, rumbleFilter, master);
      void ctx.resume();
    },
    setEnabled(enabled) {
      on = enabled;
      if (ctx && master) master.gain.setTargetAtTime(on ? volume : 0, ctx.currentTime, 0.05);
    },
    update(speed, cruiseSpeed, inTurn, dt) {
      if (!ctx || !crowdGain || !rumbleGain) return;
      const now = ctx.currentTime;
      excitement = fadeExcitement(excitement, dt);
      crowdGain.gain.setTargetAtTime(0.35 * crowdLevel(inTurn, excitement), now, 0.3);
      rumbleGain.gain.setTargetAtTime(0.5 * Math.min(1, speed / cruiseSpeed), now, 0.1);

      // Schedule the hoofbeats of the next stride a little ahead of time.
      const stride = strideSeconds(speed);
      if (!Number.isFinite(stride)) {
        nextStride = now;
        return;
      }
      if (nextStride < now) nextStride = now;
      while (nextStride < now + SCHEDULE_AHEAD) {
        for (const beat of gallopBeats(nextStride, stride)) {
          burst(beat, 260 + Math.random() * 120, 1.4, 0.35, 0.07);
        }
        nextStride += stride;
      }
    },
    roar() {
      excitement = Math.max(excitement, 1);
    },
    tuba() {
      if (!ctx || !master) return;
      const now = ctx.currentTime;
      // Two slightly detuned saws through a low-pass filter: a bright,
      // brassy note, swelling in and dying away.
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(700, now);
      filter.frequency.linearRampToValueAtTime(1800, now + 0.15);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.06);
      gain.gain.setValueAtTime(0.28, now + 0.75);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
      filter.connect(gain).connect(master);
      for (const detune of [-6, 6]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(233, now);
        osc.detune.value = detune;
        osc.connect(filter);
        osc.start(now);
        osc.stop(now + 1.15);
      }
    },
    crash() {
      if (!ctx) return;
      const now = ctx.currentTime;
      thump(now);
      burst(now, 1800, 0.8, 0.5, 0.35);
      burst(now + 0.05, 900, 0.7, 0.4, 0.5);
      excitement = Math.max(excitement, 0.8);
    },
    cheer(won) {
      excitement = Math.max(excitement, won ? 1.6 : 0.9);
    },
  };
}
