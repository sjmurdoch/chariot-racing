// Fixed-timestep clock: the simulation always advances in equal steps, so it
// behaves the same at any frame rate, and rendering interpolates between the
// last two steps so motion stays smooth on 60 Hz and 120 Hz screens alike.

export interface FixedClock {
  /** Seconds per simulation step. */
  readonly step: number;
  /**
   * Accounts for `elapsed` seconds of real time and returns how many steps to
   * run now. Long pauses (a backgrounded tab) are capped at `maxFrame`, so
   * the game resumes instead of fast-forwarding.
   */
  tick(elapsed: number): number;
  /** Fraction of a step left over, from 0 to 1, for interpolating rendering. */
  readonly alpha: number;
}

export function createFixedClock(step = 1 / 60, maxFrame = 0.25): FixedClock {
  let pending = 0;
  return {
    step,
    tick(elapsed: number): number {
      pending += Math.min(Math.max(elapsed, 0), maxFrame);
      const steps = Math.floor(pending / step);
      pending -= steps * step;
      return steps;
    },
    get alpha() {
      return pending / step;
    },
  };
}
