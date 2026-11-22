import { describe, expect, it } from 'vitest';
import {
  interpolateChariot,
  lateralVelocity,
  startChariot,
  stepChariot,
  type ChariotState,
  type ChariotParams,
} from './chariot';
import { lapLength, laneRadius, poseAt, travelDirection, type TrackSpec } from './track';

const track: TrackSpec = { straightLength: 150, innerRadius: 8, width: 24, spinaClearance: 2 };
const SPEED = 22;
const steering: ChariotParams = {
  maxTurnRate: Math.PI,
  response: 0.12,
  maxHeading: (80 * Math.PI) / 180,
  cruiseSpeed: SPEED,
  acceleration: 6,
  braking: 5,
  crashSpeed: 0,
  bounceAngle: (15 * Math.PI) / 180,
  crashClearance: 0.5,
};
const DT = 1 / 60;

type Driver = (s: ChariotState) => number;

function run(state: ChariotState, steer: number | Driver, seconds: number): ChariotState {
  const driver = typeof steer === 'number' ? () => steer : steer;
  let s = state;
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    s = stepChariot(s, driver(s), DT, track, steering);
  }
  return s;
}

/** The constant steering that follows the lane round a turn at this speed. */
function steerToHold(lane: number): number {
  return -SPEED / laneRadius(track, lane) / steering.maxTurnRate;
}

/** A simple driver that steers to hold `target` lane, as a player would. */
function holdLane(target: number): Driver {
  return (s) => {
    const bendAhead = s.progress % 2 >= 1 ? steerToHold(s.lane) : 0;
    return bendAhead + 0.15 * (target - s.lane) - 1.2 * s.heading;
  };
}

describe('on the straight', () => {
  it('holds its lane with no steering', () => {
    const end = run(startChariot(0, 6, SPEED), 0, 2);
    expect(end.lane).toBe(6);
    expect(end.heading).toBe(0);
  });

  it('moves outwards when steering right and inwards when steering left', () => {
    expect(run(startChariot(0, 10, SPEED), 1, 0.5).lane).toBeGreaterThan(10);
    expect(run(startChariot(0, 10, SPEED), -1, 0.5).lane).toBeLessThan(10);
  });

  it('keeps its new angle after a swerve until steered back', () => {
    const turned = run(startChariot(0, 6, SPEED), 0.3, 0.2);
    // Let the turning rate die away after letting go.
    const coasting = run(turned, 0, 1.5);
    expect(coasting.heading).toBeGreaterThan(0.02);
    const later = run(coasting, 0, 0.2);
    expect(later.heading).toBeCloseTo(coasting.heading, 4);
    expect(later.lane).toBeGreaterThan(coasting.lane);
  });

  it('never turns further than the largest heading', () => {
    const end = run(startChariot(0, 2, SPEED), 1, 0.4);
    expect(end.heading).toBeLessThanOrEqual(steering.maxHeading);
  });
});

describe('at a turn', () => {
  it('goes in a straight line across the ground without steering', () => {
    let s = startChariot(0.95, 6, SPEED);
    const start = poseAt(track, s.progress, s.lane);
    const before = travelDirection(start, s.heading);
    for (let i = 0; i < 60; i++) {
      s = stepChariot(s, 0, DT, track, steering);
      const pose = poseAt(track, s.progress, s.lane);
      const direction = travelDirection(pose, s.heading);
      expect(direction.x).toBeCloseTo(before.x, 3);
      expect(direction.z).toBeCloseTo(before.z, 3);
      // Every position lies on the starting line of travel (z stays put),
      // to within 10 cm of integration error.
      expect(Math.abs(pose.z - start.z)).toBeLessThan(0.1);
    }
    expect(s.progress).toBeGreaterThan(1);
  });

  it('runs wide into the wall without steering', () => {
    const end = run(startChariot(1, 6, SPEED), 0, 1.5);
    expect(end.crashes).toBe(1);
  });

  it('follows the lane round the turn with steady steering', () => {
    for (const lane of [4, 10, 18]) {
      const turnSeconds = (Math.PI * laneRadius(track, lane)) / SPEED;
      const start = { ...startChariot(1, lane, SPEED), turnRate: steerToHold(lane) * steering.maxTurnRate };
      const end = run(start, steerToHold(lane), turnSeconds * 0.95);
      expect(end.progress).toBeGreaterThan(1.9);
      expect(Math.abs(end.lane - lane)).toBeLessThan(0.5);
    }
  });

  it('needs nearly full lock on the inside line, less further out', () => {
    expect(Math.abs(steerToHold(0))).toBeGreaterThan(0.8);
    expect(Math.abs(steerToHold(0))).toBeLessThanOrEqual(1);
    expect(Math.abs(steerToHold(20))).toBeLessThan(0.3);
  });

  it('cuts into the spina when steering too hard', () => {
    const end = run(startChariot(1, 4, SPEED), -1, 1);
    expect(end.crashes).toBeGreaterThanOrEqual(1);
  });
});

describe('a whole lap', () => {
  it('completes a lap when the player steers round both turns', () => {
    const seconds = lapLength(track, 6) / SPEED;
    const end = run(startChariot(0, 6, SPEED), holdLane(6), seconds * 1.02);
    expect(end.progress).toBeGreaterThan(4);
    expect(end.progress).toBeLessThan(4.1);
  });

  it('behaves the same at different step sizes', () => {
    let a = startChariot(0.9, 10, SPEED);
    for (let i = 0; i < 60; i++) a = stepChariot(a, -0.4, 1 / 60, track, steering);
    let b = startChariot(0.9, 10, SPEED);
    for (let i = 0; i < 120; i++) b = stepChariot(b, -0.4, 1 / 120, track, steering);
    expect(b.lane).toBeCloseTo(a.lane, 0);
    expect(b.progress).toBeCloseTo(a.progress, 2);
  });
});

describe('speed', () => {
  it('accelerates from a standstill to cruising speed', () => {
    const start = startChariot(0, 6);
    expect(start.speed).toBe(0);
    expect(run(start, 0, 1).speed).toBeCloseTo(6);
    expect(run(start, 0, 5).speed).toBe(SPEED);
  });

  it('brakes gradually to a lower target speed', () => {
    const stopping = { ...steering, cruiseSpeed: 0 };
    let s = startChariot(0, 6, SPEED);
    for (let i = 0; i < 60; i++) s = stepChariot(s, 0, DT, track, stopping);
    expect(s.speed).toBeCloseTo(SPEED - 5);
    for (let i = 0; i < 600; i++) s = stepChariot(s, 0, DT, track, stopping);
    expect(s.speed).toBe(0);
  });
});

describe('crashes', () => {
  /** Steps until the first crash, and returns the state just after it. */
  function crashInto(state: ChariotState, steer: number): ChariotState {
    let s = state;
    for (let i = 0; i < 600 && s.crashes === state.crashes; i++) {
      s = stepChariot(s, steer, DT, track, steering);
    }
    return s;
  }

  it('stops the chariot and knocks it clear of the wall', () => {
    const after = crashInto(startChariot(0, 20, SPEED), 1);
    expect(after.crashes).toBe(1);
    expect(after.speed).toBe(0);
    expect(after.lane).toBe(track.width - 0.5);
    expect(after.heading).toBeCloseTo(-steering.bounceAngle);
    expect(after.turnRate).toBe(0);
  });

  it('stops the chariot and knocks it clear of the spina', () => {
    const after = crashInto(startChariot(0, 3, SPEED), -1);
    expect(after.speed).toBe(0);
    expect(after.lane).toBe(0.5);
    expect(after.heading).toBeCloseTo(steering.bounceAngle);
  });

  it('pulls away from the wall afterwards, back up to speed', () => {
    const after = crashInto(startChariot(0, 20, SPEED), 1);
    const later = run(after, 0, 2);
    expect(later.crashes).toBe(1);
    expect(later.lane).toBeLessThan(after.lane);
    expect(later.speed).toBeCloseTo(12);
  });

  it('cannot hug the wall: steering into it keeps crashing and stalls', () => {
    const end = run(startChariot(0, 20, SPEED), 1, 8);
    expect(end.crashes).toBeGreaterThan(2);
    // Far less ground covered than the 176 m an unhindered chariot would.
    expect(end.progress).toBeLessThan(0.5);
  });
});

describe('lateralVelocity', () => {
  it('is the sideways part of the forward speed', () => {
    expect(lateralVelocity({ ...startChariot(0, 6, 20), heading: Math.PI / 6 })).toBeCloseTo(10);
  });
});

describe('interpolateChariot', () => {
  it('blends between two states', () => {
    const a = { progress: 1, lane: 4, heading: 0, turnRate: 0, speed: 20, crashes: 1 };
    const b = { progress: 2, lane: 6, heading: 0.2, turnRate: 1, speed: 22, crashes: 2 };
    expect(interpolateChariot(a, b, 0.25)).toEqual({
      progress: 1.25,
      lane: 4.5,
      heading: 0.05,
      turnRate: 0.25,
      speed: 20.5,
      crashes: 2,
    });
  });
});
