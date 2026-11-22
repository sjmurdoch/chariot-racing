import { describe, expect, it } from 'vitest';
import {
  interpolateChariot,
  startChariot,
  stepChariot,
  type ChariotState,
  type SteeringParams,
} from './chariot';
import { lapLength, type TrackSpec } from './track';

const track: TrackSpec = { straightLength: 150, innerRadius: 8, width: 24, spinaClearance: 2 };
const steering: SteeringParams = { maxLateralSpeed: 7, response: 0.15 };
const DT = 1 / 60;

function run(state: ChariotState, steer: number, seconds: number): ChariotState {
  let s = state;
  for (let i = 0; i < Math.round(seconds / DT); i++) s = stepChariot(s, steer, DT, track, steering);
  return s;
}

describe('stepChariot', () => {
  it('holds its lane with no steering', () => {
    const end = run(startChariot(0, 6, 22), 0, 2);
    expect(end.lane).toBe(6);
    expect(end.lateralVelocity).toBe(0);
  });

  it('moves outwards when steering right and inwards when steering left', () => {
    expect(run(startChariot(0, 10, 22), 1, 0.5).lane).toBeGreaterThan(10);
    expect(run(startChariot(0, 10, 22), -1, 0.5).lane).toBeLessThan(10);
  });

  it('approaches full sideways speed smoothly', () => {
    const quick = run(startChariot(0, 10, 22), 1, 0.15);
    expect(quick.lateralVelocity).toBeGreaterThan(0.55 * steering.maxLateralSpeed);
    expect(quick.lateralVelocity).toBeLessThan(0.7 * steering.maxLateralSpeed);
    const settled = run(startChariot(0, 2, 22), 1, 1);
    expect(settled.lateralVelocity).toBeCloseTo(steering.maxLateralSpeed, 1);
  });

  it('scales sideways speed with partial steering and clamps over-steer', () => {
    const half = run(startChariot(0, 2, 22), 0.5, 1);
    expect(half.lateralVelocity).toBeCloseTo(3.5, 1);
    const over = run(startChariot(0, 2, 22), 5, 1);
    expect(over.lateralVelocity).toBeCloseTo(7, 1);
  });

  it('stops at the spina and at the outer wall', () => {
    const inside = run(startChariot(0, 1, 22), -1, 2);
    expect(inside.lane).toBe(0);
    expect(inside.lateralVelocity).toBe(0);
    const outside = run(startChariot(0, 23, 22), 1, 2);
    expect(outside.lane).toBe(track.width);
  });

  it('behaves the same at different step sizes', () => {
    let a = startChariot(0, 10, 22);
    for (let i = 0; i < 60; i++) a = stepChariot(a, 1, 1 / 60, track, steering);
    let b = startChariot(0, 10, 22);
    for (let i = 0; i < 120; i++) b = stepChariot(b, 1, 1 / 120, track, steering);
    expect(b.lane).toBeCloseTo(a.lane, 1);
  });

  it('completes a lap of the lane it holds', () => {
    const seconds = lapLength(track, 6) / 22;
    const end = run(startChariot(0, 6, 22), 0, seconds);
    expect(end.progress).toBeCloseTo(4, 2);
  });
});

describe('interpolateChariot', () => {
  it('blends between two states', () => {
    const a = { progress: 1, lane: 4, lateralVelocity: 0, speed: 20 };
    const b = { progress: 2, lane: 6, lateralVelocity: 2, speed: 22 };
    expect(interpolateChariot(a, b, 0.25)).toEqual({
      progress: 1.25,
      lane: 4.5,
      lateralVelocity: 0.5,
      speed: 20.5,
    });
  });
});
