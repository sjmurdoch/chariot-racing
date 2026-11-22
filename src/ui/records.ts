// Best times, kept in the browser for each race length and difficulty.

import type { ChoiceStorage } from './choices';

const STORAGE_KEY = 'circus-maximus.best';

type Bests = Record<string, number>;

function key(laps: number, difficulty: string): string {
  return `${laps}:${difficulty}`;
}

function load(storage: ChoiceStorage | null): Bests {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (typeof parsed !== 'object' || parsed === null) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0,
      ),
    );
  } catch {
    return {};
  }
}

/** The best time so far for this race length and difficulty, or null. */
export function bestTime(storage: ChoiceStorage | null, laps: number, difficulty: string): number | null {
  return load(storage)[key(laps, difficulty)] ?? null;
}

export interface RecordResult {
  /** The best time before this race, or null if this was the first. */
  previous: number | null;
  /** Whether this race set a new best. */
  isBest: boolean;
}

/** Records a finishing time, keeping it if it is the best so far. */
export function recordTime(
  storage: ChoiceStorage | null,
  laps: number,
  difficulty: string,
  time: number,
): RecordResult {
  const bests = load(storage);
  const previous = bests[key(laps, difficulty)] ?? null;
  const isBest = previous === null || time < previous;
  if (isBest) {
    bests[key(laps, difficulty)] = time;
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(bests));
    } catch {
      // Storage full or blocked: the record just isn't kept.
    }
  }
  return { previous, isBest };
}
