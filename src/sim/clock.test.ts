import { describe, expect, it } from 'vitest';
import { createFixedClock } from './clock';

describe('createFixedClock', () => {
  it('runs one step per step of elapsed time', () => {
    const clock = createFixedClock(0.01);
    expect(clock.tick(0.035)).toBe(3);
    expect(clock.alpha).toBeCloseTo(0.5);
  });

  it('carries leftover time into the next tick', () => {
    const clock = createFixedClock(0.01);
    expect(clock.tick(0.006)).toBe(0);
    expect(clock.tick(0.006)).toBe(1);
    expect(clock.alpha).toBeCloseTo(0.2);
  });

  it('runs the same total steps at 60 Hz and 120 Hz', () => {
    const at60 = createFixedClock();
    const at120 = createFixedClock();
    let steps60 = 0;
    let steps120 = 0;
    for (let i = 0; i < 60; i++) steps60 += at60.tick(1 / 60);
    for (let i = 0; i < 120; i++) steps120 += at120.tick(1 / 120);
    expect(Math.abs(steps60 - steps120)).toBeLessThanOrEqual(1);
    expect(steps60).toBeGreaterThanOrEqual(59);
  });

  it('caps long pauses', () => {
    const clock = createFixedClock(0.01, 0.1);
    expect(clock.tick(5)).toBe(10);
  });

  it('ignores negative time', () => {
    const clock = createFixedClock(0.01);
    expect(clock.tick(-1)).toBe(0);
    expect(clock.alpha).toBe(0);
  });
});
