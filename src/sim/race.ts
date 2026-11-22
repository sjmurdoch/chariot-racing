// The race: counting laps, timing, and finishing.
//
// Laps are counted from the start line (progress 0), as on the chalk line
// across the home straight. The race is won by completing the set number of
// laps; historically seven.

import { lapsCompleted, SEGMENTS_PER_LAP } from './track';

export type RacePhase = 'racing' | 'finished';

export interface RaceState {
  phase: RacePhase;
  /** Seconds since the start. Stops counting at the finish. */
  elapsed: number;
  /** Laps completed so far, capped at the race length. */
  lapsDone: number;
  /** Finishing time in seconds, once finished. */
  finishTime: number | null;
}

export function startRace(): RaceState {
  return { phase: 'racing', elapsed: 0, lapsDone: 0, finishTime: null };
}

/** Progress at which a race of `laps` laps is complete. */
export function finishProgress(laps: number): number {
  return laps * SEGMENTS_PER_LAP;
}

/**
 * Advances the race clock by `dt` seconds, given the chariot's progress
 * before and after the step. The finishing time is interpolated to the
 * moment the chariot crossed the line within the step.
 */
export function stepRace(
  race: RaceState,
  before: number,
  after: number,
  dt: number,
  laps: number,
): RaceState {
  if (race.phase === 'finished') return race;
  const line = finishProgress(laps);
  if (after >= line) {
    const fraction = after > before ? (line - before) / (after - before) : 1;
    const finishTime = race.elapsed + dt * Math.min(1, Math.max(0, fraction));
    return { phase: 'finished', elapsed: finishTime, lapsDone: laps, finishTime };
  }
  return {
    phase: 'racing',
    elapsed: race.elapsed + dt,
    lapsDone: Math.min(laps, Math.max(0, lapsCompleted(after))),
    finishTime: null,
  };
}

/** The lap being run, counting from 1, for display. */
export function currentLap(race: RaceState, laps: number): number {
  return Math.min(laps, race.lapsDone + 1);
}

/** Formats seconds as m:ss.t, for example 1:58.3. */
export function formatTime(seconds: number): string {
  const tenths = Math.floor(seconds * 10);
  const minutes = Math.floor(tenths / 600);
  const secs = Math.floor((tenths % 600) / 10);
  return `${minutes}:${String(secs).padStart(2, '0')}.${tenths % 10}`;
}

/** Writes a place in English, for example 2 as 2nd. */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  const suffix = ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return `${n}${suffix}`;
}

const NUMERALS: [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

/** Writes a positive whole number in Roman numerals, for example 7 as VII. */
export function roman(n: number): string {
  if (!Number.isInteger(n) || n < 1) return String(n);
  let rest = n;
  let out = '';
  for (const [value, letters] of NUMERALS) {
    while (rest >= value) {
      out += letters;
      rest -= value;
    }
  }
  return out;
}
