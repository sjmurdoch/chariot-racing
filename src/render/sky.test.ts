import { describe, expect, it } from 'vitest';
import { landHeight } from './sky';

describe('landHeight', () => {
  it('rises highest at the Palatine and then the Aventine', () => {
    const palatine = landHeight(0.5);
    const aventine = landHeight(0);
    const between = landHeight(0.25);
    expect(palatine).toBeGreaterThan(aventine);
    expect(aventine).toBeGreaterThan(between);
  });

  it('joins up where the band wraps round', () => {
    expect(landHeight(0)).toBeCloseTo(landHeight(1), 5);
    expect(landHeight(0.001)).toBeCloseTo(landHeight(0.999), 2);
  });

  it('stays within the band', () => {
    for (let u = 0; u <= 1; u += 0.01) {
      expect(landHeight(u)).toBeGreaterThan(0);
      expect(landHeight(u)).toBeLessThanOrEqual(0.95);
    }
  });
});
