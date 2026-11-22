// The player's choices on the start screen: their faction and how hard the
// rivals are. Remembered in the browser for next time, where it allows.

import { isFactionId, type FactionId } from '../sim/factions';

export type Difficulty = 'easy' | 'normal' | 'hard';

/** How much each difficulty scales the rivals' speed. */
export const DIFFICULTIES: Record<Difficulty, { label: string; skill: number }> = {
  easy: { label: 'Easy', skill: 0.93 },
  normal: { label: 'Normal', skill: 1 },
  hard: { label: 'Hard', skill: 1.05 },
};

export function isDifficulty(value: string): value is Difficulty {
  return value in DIFFICULTIES;
}

export interface Choices {
  faction: FactionId;
  difficulty: Difficulty;
}

const STORAGE_KEY = 'circus-maximus.choices';

/** The parts of the Storage interface the choices need, so tests can fake it. */
export type ChoiceStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** The browser's local storage, or null where it is unavailable (some private modes). */
export function browserStorage(): ChoiceStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The starting choices: anything set explicitly (in the URL) wins, then what
 * the player chose last time, then the defaults.
 */
export function initialChoices(
  defaults: Choices,
  explicit: Partial<Choices>,
  storage: ChoiceStorage | null,
): Choices {
  let saved: Partial<Choices> = {};
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { faction?: unknown; difficulty?: unknown };
      if (typeof parsed.faction === 'string' && isFactionId(parsed.faction)) {
        saved.faction = parsed.faction;
      }
      if (typeof parsed.difficulty === 'string' && isDifficulty(parsed.difficulty)) {
        saved.difficulty = parsed.difficulty;
      }
    }
  } catch {
    saved = {};
  }
  return { ...defaults, ...saved, ...explicit };
}

/** Remembers the choices for next time; quietly does nothing if storage fails. */
export function saveChoices(choices: Choices, storage: ChoiceStorage | null): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(choices));
  } catch {
    // Storage full or blocked: the choice just isn't remembered.
  }
}
