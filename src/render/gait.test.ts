import { describe, expect, it } from 'vitest';
import { advanceGait, bodyBob, headNod, legSwing, STRIDE, type Gait } from './gait';

const standing: Gait = { phase: 0, strength: 0 };

describe('advanceGait', () => {
  it('completes one stride per stride length travelled', () => {
    const g = advanceGait({ phase: 0, strength: 1 }, STRIDE / 4, 1);
    expect(g.phase).toBeCloseTo(Math.PI / 2);
  });

  it('gallops faster at speed', () => {
    const slow = advanceGait(standing, 5, 0.1);
    const fast = advanceGait(standing, 20, 0.1);
    expect(fast.phase).toBeGreaterThan(slow.phase);
  });

  it('builds up to a full gallop with speed', () => {
    expect(advanceGait(standing, 0, 0.1).strength).toBe(0);
    expect(advanceGait(standing, 4, 0.1).strength).toBeCloseTo(0.5);
    expect(advanceGait(standing, 22, 0.1).strength).toBe(1);
  });

  it('keeps the phase within one stride', () => {
    let g = standing;
    for (let i = 0; i < 1000; i++) g = advanceGait(g, 22, 1 / 60);
    expect(g.phase).toBeGreaterThanOrEqual(0);
    expect(g.phase).toBeLessThan(2 * Math.PI);
  });
});

describe('a galloping horse', () => {
  const gallop: Gait = { phase: 1, strength: 1 };

  it('stands still when not moving', () => {
    expect(legSwing(standing, 0, true)).toBe(0);
    expect(bodyBob(standing, 0)).toBe(0);
    expect(headNod(standing, 0)).toBe(0);
  });

  it('swings its front and hind legs in opposite directions', () => {
    expect(Math.sign(legSwing(gallop, 0, true))).toBe(-Math.sign(legSwing(gallop, 0, false)));
  });

  it('keeps its swing, bob and nod within bounds', () => {
    for (let p = 0; p < 2 * Math.PI; p += 0.1) {
      const g = { phase: p, strength: 1 };
      expect(Math.abs(legSwing(g, 2, true))).toBeLessThanOrEqual(0.55);
      expect(bodyBob(g, 2)).toBeGreaterThanOrEqual(0);
      expect(bodyBob(g, 2)).toBeLessThanOrEqual(0.08);
      expect(Math.abs(headNod(g, 2))).toBeLessThanOrEqual(0.12);
    }
  });

  it('moves slightly out of step with the horse beside it', () => {
    expect(legSwing(gallop, 0, true)).not.toBeCloseTo(legSwing(gallop, 1, true));
  });
});
