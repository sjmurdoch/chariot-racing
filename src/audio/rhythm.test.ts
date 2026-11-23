import { describe, expect, it } from 'vitest';
import { STRIDE } from '../render/gait';
import { crowdLevel, fadeExcitement, gallopBeats, strideSeconds } from './rhythm';

describe('strideSeconds', () => {
  it('is quicker at speed', () => {
    expect(strideSeconds(22)).toBeCloseTo(STRIDE / 22);
    expect(strideSeconds(11)).toBeGreaterThan(strideSeconds(22));
  });

  it('is endless when standing', () => {
    expect(strideSeconds(0)).toBe(Infinity);
  });
});

describe('gallopBeats', () => {
  it('strikes four times per stride, three quick beats then a pause', () => {
    const beats = gallopBeats(10, 0.3);
    expect(beats).toHaveLength(4);
    expect(beats[0]).toBe(10);
    const gaps = beats.slice(1).map((t, i) => t - beats[i]!);
    const pause = 10.3 - beats[3]!;
    expect(Math.max(...gaps)).toBeLessThan(pause);
    expect(beats.every((t) => t >= 10 && t < 10.3)).toBe(true);
  });

  it('makes no sound when standing', () => {
    expect(gallopBeats(10, Infinity)).toEqual([]);
  });
});

describe('crowdLevel', () => {
  it('murmurs on the straight and gets louder in the turns', () => {
    expect(crowdLevel(true, 0)).toBeGreaterThan(crowdLevel(false, 0));
  });

  it('roars with excitement, up to full volume', () => {
    expect(crowdLevel(false, 0.5)).toBeGreaterThan(crowdLevel(false, 0));
    expect(crowdLevel(true, 5)).toBe(1);
  });
});

describe('fadeExcitement', () => {
  it('dies away over a few seconds', () => {
    expect(fadeExcitement(1, 1)).toBeCloseTo(0.4);
    expect(fadeExcitement(1, 5)).toBeLessThan(0.02);
  });
});
