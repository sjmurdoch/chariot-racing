import { describe, expect, it } from 'vitest';
import {
  advance,
  lapLength,
  lapsCompleted,
  poseAt,
  segmentLength,
  type TrackSpec,
} from './track';

const track: TrackSpec = { straightLength: 150, innerRadius: 12, width: 24, spinaClearance: 2 };
const EPS = 1e-9;

describe('lap length', () => {
  it('is two straights plus a full circle at the lane radius', () => {
    expect(lapLength(track, 0)).toBeCloseTo(300 + 2 * Math.PI * 12);
    expect(lapLength(track, 10)).toBeCloseTo(300 + 2 * Math.PI * 22);
  });

  it('is shorter on the inside line', () => {
    expect(lapLength(track, 2)).toBeLessThan(lapLength(track, 20));
  });

  it('sums the segment lengths', () => {
    const total = [0, 1, 2, 3].reduce((sum, s) => sum + segmentLength(track, s, 5), 0);
    expect(total).toBeCloseTo(lapLength(track, 5));
  });
});

describe('poseAt', () => {
  it('starts the lap at the near end of the home straight', () => {
    const pose = poseAt(track, 0, 4);
    expect(pose).toEqual({ x: -75, z: 16, forwardX: 1, forwardZ: 0 });
  });

  it('is continuous across every segment boundary', () => {
    for (const boundary of [1, 2, 3, 4]) {
      const before = poseAt(track, boundary - EPS, 6);
      const after = poseAt(track, boundary, 6);
      expect(after.x).toBeCloseTo(before.x, 6);
      expect(after.z).toBeCloseTo(before.z, 6);
      expect(after.forwardX).toBeCloseTo(before.forwardX, 6);
      expect(after.forwardZ).toBeCloseTo(before.forwardZ, 6);
    }
  });

  it('repeats every lap', () => {
    const later = poseAt(track, 9.3, 3);
    const first = poseAt(track, 1.3, 3);
    expect(later.x).toBeCloseTo(first.x);
    expect(later.z).toBeCloseTo(first.z);
    expect(later.forwardX).toBeCloseTo(first.forwardX);
    expect(later.forwardZ).toBeCloseTo(first.forwardZ);
  });

  it('keeps turn positions at the lane radius from the meta', () => {
    for (const progress of [1.1, 1.5, 1.9]) {
      const { x, z } = poseAt(track, progress, 8);
      expect(Math.hypot(x - 75, z)).toBeCloseTo(20);
    }
    for (const progress of [3.1, 3.5, 3.9]) {
      const { x, z } = poseAt(track, progress, 8);
      expect(Math.hypot(x + 75, z)).toBeCloseTo(20);
    }
  });

  it('races anticlockwise with the spina on the left', () => {
    for (const progress of [0.5, 1.5, 2.5, 3.5]) {
      const pose = poseAt(track, progress, 5);
      // Left of the direction of travel, with Y up, is (forwardZ, -forwardX).
      const leftX = pose.forwardZ;
      const leftZ = -pose.forwardX;
      // Looking left should point back towards the spina's axis (z = 0).
      const towardsAxisZ = -pose.z;
      const nearestSpinaX = Math.max(-75, Math.min(75, pose.x));
      const towardsAxisX = nearestSpinaX - pose.x;
      expect(leftX * towardsAxisX + leftZ * towardsAxisZ).toBeGreaterThan(0);
    }
  });

  it('has unit-length forward vectors', () => {
    for (const progress of [0.2, 1.3, 2.7, 3.8]) {
      const { forwardX, forwardZ } = poseAt(track, progress, 5);
      expect(Math.hypot(forwardX, forwardZ)).toBeCloseTo(1);
    }
  });
});

describe('advance', () => {
  it('moves within a straight', () => {
    expect(advance(track, 0, 5, 75)).toBeCloseTo(0.5);
  });

  it('crosses into a turn', () => {
    const turn = segmentLength(track, 1, 5);
    expect(advance(track, 0.5, 5, 75 + turn / 2)).toBeCloseTo(1.5);
  });

  it('completes a lap after one lap length of the lane', () => {
    for (const offset of [0, 5, 20]) {
      expect(advance(track, 0.25, offset, lapLength(track, offset))).toBeCloseTo(4.25);
    }
  });

  it('gains ground on the inside line for the same distance', () => {
    const distance = 200;
    expect(advance(track, 0.8, 1, distance)).toBeGreaterThan(advance(track, 0.8, 20, distance));
  });

  it('does not move for zero distance', () => {
    expect(advance(track, 2.4, 5, 0)).toBe(2.4);
  });
});

describe('lapsCompleted', () => {
  it('counts whole laps', () => {
    expect(lapsCompleted(0)).toBe(0);
    expect(lapsCompleted(3.99)).toBe(0);
    expect(lapsCompleted(4)).toBe(1);
    expect(lapsCompleted(28.5)).toBe(7);
  });
});
