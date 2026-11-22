import { describe, expect, it } from 'vitest';
import { startChariot, type ChariotState } from './chariot';
import { resolveContacts, separation, slipstream, slipstreamFor } from './pack';
import { advance, type TrackSpec } from './track';

const track: TrackSpec = { straightLength: 150, innerRadius: 8, width: 24, spinaClearance: 2 };

/** A chariot `metres` along the home straight from the start line. */
function at(metres: number, lane: number, speed = 22): ChariotState {
  return startChariot(advance(track, 0, lane, metres), lane, speed);
}

describe('separation', () => {
  it('measures along and across the track', () => {
    const gap = separation(track, at(20, 6), at(30, 9));
    expect(gap.along).toBeCloseTo(10);
    expect(gap.across).toBe(3);
  });

  it('is negative for a chariot behind', () => {
    expect(separation(track, at(30, 6), at(20, 6)).along).toBeCloseTo(-10);
  });

  it('works round a bend', () => {
    const a = startChariot(1.2, 6, 22);
    const b = startChariot(advance(track, 1.2, 6, 8), 6, 22);
    expect(separation(track, a, b).along).toBeGreaterThan(7);
    expect(separation(track, a, b).along).toBeLessThan(8.1);
  });

  it('treats chariots far apart as out of reach', () => {
    expect(separation(track, at(0, 6), at(140, 6)).along).toBe(Infinity);
  });
});

describe('slipstream', () => {
  it('is strongest just behind and fades with distance', () => {
    expect(slipstream({ along: 5.5, across: 0 })).toBeGreaterThan(0.9);
    expect(slipstream({ along: 10, across: 0 })).toBeCloseTo(0.5);
    expect(slipstream({ along: 16, across: 0 })).toBe(0);
  });

  it('needs to be lined up behind, not alongside or in front', () => {
    expect(slipstream({ along: 8, across: 2 })).toBe(0);
    expect(slipstream({ along: -8, across: 0 })).toBe(0);
    expect(slipstream({ along: 3, across: 0 })).toBe(0);
  });

  it('is the best slipstream from any chariot in the pack', () => {
    const pack = [at(20, 6), at(30, 6), at(28, 15)];
    expect(slipstreamFor(track, pack, 0)).toBeCloseTo(0.5);
    expect(slipstreamFor(track, pack, 1)).toBe(0);
  });
});

describe('resolveContacts', () => {
  it('leaves chariots that are not touching alone', () => {
    const pack = [at(20, 6), at(20, 10), at(40, 6)];
    expect(resolveContacts(track, pack)).toEqual(pack);
  });

  it('knocks chariots apart when they swerve into each other', () => {
    const swerving = { ...at(20, 6), heading: 0.1 };
    const [inner, outer] = resolveContacts(track, [swerving, at(21, 7.6)]);
    expect(outer!.lane - inner!.lane).toBeCloseTo(2.6);
    // Both are knocked to point away from each other.
    expect(inner!.heading).toBeLessThan(swerving.heading);
    expect(outer!.heading).toBeGreaterThan(0);
    expect(inner!.speed).toBeLessThan(22);
    expect(outer!.speed).toBeLessThan(22);
  });

  it('does not bump the same chariots again straight away', () => {
    const swerving = { ...at(20, 6), heading: 0.1 };
    const [inner, outer] = resolveContacts(track, [swerving, at(21, 7.6)]);
    const again = resolveContacts(track, [{ ...inner!, heading: 0.1, lane: 6 }, { ...outer!, lane: 7.6 }]);
    expect(again[0]!.speed).toBe(inner!.speed);
    expect(again[1]!.lane - again[0]!.lane).toBeCloseTo(2.6);
  });

  it('keeps chariots running alongside apart without bumping them', () => {
    const [inner, outer] = resolveContacts(track, [at(20, 6), at(21, 7.6)]);
    expect(outer!.lane - inner!.lane).toBeCloseTo(2.6);
    expect(inner!.heading).toBe(0);
    expect(inner!.speed).toBe(22);
    expect(outer!.speed).toBe(22);
  });

  it('checks a chariot that runs into the back of another', () => {
    const [behind, ahead] = resolveContacts(track, [at(20, 6, 22), at(23, 6.5, 18)]);
    expect(behind!.speed).toBeCloseTo(18 * 0.8);
    expect(ahead!.speed).toBe(18);
  });

  it('does not keep checking a chariot already dropping back', () => {
    const [behind] = resolveContacts(track, [at(20, 6, 15), at(23, 6.5, 18)]);
    expect(behind!.speed).toBe(15);
  });

  it('never pushes a chariot off the track', () => {
    const [inner] = resolveContacts(track, [at(20, 0.3), at(20, 1.5)]);
    expect(inner!.lane).toBe(0);
  });
});
