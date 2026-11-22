import { describe, expect, it } from 'vitest';
import { chooseSteer, halvesSteer, keysSteer } from './steering';

describe('keysSteer', () => {
  it('is null with no steering keys held', () => {
    expect(keysSteer(new Set())).toBeNull();
    expect(keysSteer(new Set(['Space']))).toBeNull();
  });

  it('steers with arrows and A/D', () => {
    expect(keysSteer(new Set(['ArrowLeft']))).toBe(-1);
    expect(keysSteer(new Set(['KeyD']))).toBe(1);
  });

  it('cancels out when both directions are held', () => {
    expect(keysSteer(new Set(['ArrowLeft', 'KeyD']))).toBe(0);
  });
});

describe('halvesSteer', () => {
  it('is null when nothing is held', () => {
    expect(halvesSteer([], 800)).toBeNull();
  });

  it('steers towards the held half', () => {
    expect(halvesSteer([100], 800)).toBe(-1);
    expect(halvesSteer([700], 800)).toBe(1);
  });

  it('cancels out when both halves are held', () => {
    expect(halvesSteer([100, 700], 800)).toBe(0);
  });

  it('stays within full lock with several fingers', () => {
    expect(halvesSteer([600, 650, 700], 800)).toBe(1);
  });
});

describe('chooseSteer', () => {
  it('prefers keyboard, then touch, then tilt', () => {
    expect(chooseSteer({ keyboard: 1, touch: -1, tilt: 0.3 })).toEqual({
      steer: 1,
      source: 'keyboard',
    });
    expect(chooseSteer({ keyboard: null, touch: -1, tilt: 0.3 })).toEqual({
      steer: -1,
      source: 'touch',
    });
    expect(chooseSteer({ keyboard: null, touch: null, tilt: 0.3 })).toEqual({
      steer: 0.3,
      source: 'tilt',
    });
  });

  it('treats a held-but-cancelled input as active', () => {
    expect(chooseSteer({ keyboard: 0, tilt: 0.5 })).toEqual({ steer: 0, source: 'keyboard' });
  });

  it('reports no source when nothing is active', () => {
    expect(chooseSteer({})).toEqual({ steer: 0, source: 'none' });
  });
});
