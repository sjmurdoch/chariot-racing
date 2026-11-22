import { describe, expect, it } from 'vitest';
import type { ChoiceStorage } from './choices';
import { bestTime, recordTime } from './records';

function memoryStorage(initial: Record<string, string> = {}): ChoiceStorage {
  const data = { ...initial };
  return {
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe('recordTime', () => {
  it('keeps the first time as the best', () => {
    const storage = memoryStorage();
    expect(recordTime(storage, 7, 'normal', 125.3)).toEqual({ previous: null, isBest: true });
    expect(bestTime(storage, 7, 'normal')).toBe(125.3);
  });

  it('replaces the best only with a faster time', () => {
    const storage = memoryStorage();
    recordTime(storage, 7, 'normal', 125.3);
    expect(recordTime(storage, 7, 'normal', 130)).toEqual({ previous: 125.3, isBest: false });
    expect(bestTime(storage, 7, 'normal')).toBe(125.3);
    expect(recordTime(storage, 7, 'normal', 120.1)).toEqual({ previous: 125.3, isBest: true });
    expect(bestTime(storage, 7, 'normal')).toBe(120.1);
  });

  it('keeps separate bests for each race length and difficulty', () => {
    const storage = memoryStorage();
    recordTime(storage, 7, 'normal', 125);
    recordTime(storage, 7, 'hard', 128);
    recordTime(storage, 3, 'normal', 50);
    expect(bestTime(storage, 7, 'normal')).toBe(125);
    expect(bestTime(storage, 7, 'hard')).toBe(128);
    expect(bestTime(storage, 3, 'normal')).toBe(50);
    expect(bestTime(storage, 3, 'easy')).toBeNull();
  });

  it('copes with corrupt, odd or unavailable storage', () => {
    expect(bestTime(memoryStorage({ 'circus-maximus.best': '{bad' }), 7, 'normal')).toBeNull();
    expect(
      bestTime(memoryStorage({ 'circus-maximus.best': '{"7:normal":"fast"}' }), 7, 'normal'),
    ).toBeNull();
    expect(bestTime(null, 7, 'normal')).toBeNull();
    expect(recordTime(null, 7, 'normal', 100)).toEqual({ previous: null, isBest: true });
  });
});
