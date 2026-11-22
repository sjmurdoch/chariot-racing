import { describe, expect, it } from 'vitest';
import { startChariot, type ChariotParams } from './chariot';
import {
  ageWrecks,
  clearOf,
  crashIntoWreckage,
  hitsWreck,
  MAX_WRECKS,
  wreckFrom,
  type Wreck,
  type WreckageParams,
} from './wreckage';
import { advance, type TrackSpec } from './track';

const track: TrackSpec = { straightLength: 150, innerRadius: 8, width: 24, spinaClearance: 2 };
const params: ChariotParams = {
  maxTurnRate: Math.PI,
  response: 0.12,
  maxHeading: (80 * Math.PI) / 180,
  cruiseSpeed: 22,
  acceleration: 6,
  braking: 5,
  crashSpeed: 0,
  bounceAngle: (15 * Math.PI) / 180,
  crashClearance: 0.5,
};
const wreckage: WreckageParams = { lifetime: 30, minSpeed: 10 };

/** A wreck against the spina, `metres` along the home straight. */
function spinaWreck(metres: number, owner = 1): Wreck {
  return { progress: advance(track, 0, 0, metres), lane: 0, owner, age: 0 };
}

describe('wreckFrom', () => {
  const crashedAt = (lane: number) => ({ ...startChariot(0.5, lane, 0), crashes: 1 });

  it('leaves wreckage where a fast crash hit the spina or the wall', () => {
    const before = startChariot(0.5, 1, 20);
    expect(wreckFrom(track, before, crashedAt(0.5), 2, wreckage)).toEqual({
      progress: 0.5,
      lane: 0,
      owner: 2,
      age: 0,
    });
    expect(wreckFrom(track, startChariot(0.5, 23, 20), crashedAt(23.5), 2, wreckage)?.lane).toBe(24);
  });

  it('leaves nothing after a slow crash or no crash', () => {
    expect(wreckFrom(track, startChariot(0.5, 1, 5), crashedAt(0.5), 0, wreckage)).toBeNull();
    const before = startChariot(0.5, 6, 20);
    expect(wreckFrom(track, before, before, 0, wreckage)).toBeNull();
  });
});

describe('ageWrecks', () => {
  it('clears wreckage away after its lifetime', () => {
    const wrecks = [spinaWreck(20), { ...spinaWreck(40), age: 29.9 }];
    expect(ageWrecks(wrecks, 0.5, wreckage)).toHaveLength(1);
  });

  it('keeps only the newest wrecks', () => {
    const wrecks = Array.from({ length: MAX_WRECKS + 2 }, (_, i) => spinaWreck(10 * i));
    const kept = ageWrecks(wrecks, 0.1, wreckage);
    expect(kept).toHaveLength(MAX_WRECKS);
    expect(kept[0]!.progress).toBe(wrecks[2]!.progress);
  });
});

describe('hitsWreck', () => {
  const wreck = spinaWreck(50);
  const at = (metres: number, lane: number) => startChariot(advance(track, 0, lane, metres), lane, 22);

  it('is hit by a chariot on the inside line running into it', () => {
    expect(hitsWreck(track, at(48, 2), wreck)).toBe(true);
  });

  it('is missed by a chariot passing wide of it', () => {
    expect(hitsWreck(track, at(48, clearOf(track, wreck, 0.1)), wreck)).toBe(false);
  });

  it('is missed by a chariot still well short of it, or past it', () => {
    expect(hitsWreck(track, at(40, 2), wreck)).toBe(false);
    expect(hitsWreck(track, at(53, 2), wreck)).toBe(false);
  });
});

describe('crashIntoWreckage', () => {
  const wreck = spinaWreck(50, 1);
  const running = startChariot(advance(track, 0, 2, 48), 2, 22);

  it('crashes a chariot into wreckage and knocks it clear on the open side', () => {
    const after = crashIntoWreckage(track, running, 0, [wreck], params);
    expect(after.crashes).toBe(1);
    expect(after.speed).toBe(0);
    expect(after.lane).toBeCloseTo(clearOf(track, wreck) + 0.5);
    expect(after.heading).toBeGreaterThan(0);
    expect(hitsWreck(track, after, wreck)).toBe(false);
  });

  it('does not crash a chariot into its own wreckage', () => {
    expect(crashIntoWreckage(track, running, 1, [wreck], params)).toBe(running);
  });

  it('leaves a chariot that hits nothing alone', () => {
    const clear = startChariot(advance(track, 0, 8, 48), 8, 22);
    expect(crashIntoWreckage(track, clear, 0, [wreck], params)).toBe(clear);
  });
});
