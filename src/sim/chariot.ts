// The player's chariot. It has a heading of its own: steering turns it, and
// the track bends underneath it. With no steering it travels in a straight
// line, so at a bend it runs on towards the outer wall unless the player
// steers round, and after a swerve it keeps its new angle until steered back.
// Hitting the spina or the wall is a crash that stops the chariot.
//
// The heading is measured relative to the direction of the track at the
// chariot's position: 0 is straight along the track, positive points
// outwards (to the driver's right).

import { advance, poseAt, type TrackSpec } from './track';

export interface ChariotState {
  /** Track progress; see track.ts. */
  progress: number;
  /** Metres out from the inside line, between 0 and the track width. */
  lane: number;
  /** Heading relative to the track, in radians; positive points outwards. */
  heading: number;
  /** Rate of turning in radians per second; positive turns right. */
  turnRate: number;
  /** Forward speed in m/s. */
  speed: number;
  /** Number of times the chariot has hit the spina or the outer wall. */
  crashes: number;
}

export interface ChariotParams {
  /** Rate of turning at full steering lock, in radians per second. */
  maxTurnRate: number;
  /** Time constant for reaching the steered turning rate, in seconds. */
  response: number;
  /** Largest heading away from the track direction, in radians. */
  maxHeading: number;
  /** Top speed on the flat, in m/s. */
  cruiseSpeed: number;
  /** Acceleration up to cruising speed, in m/s². */
  acceleration: number;
  /** Deceleration when above the target speed (after the finish), in m/s². */
  braking: number;
  /** Speed straight after a crash, in m/s. */
  crashSpeed: number;
  /** Angle a crash knocks the chariot away from what it hit, in radians. */
  bounceAngle: number;
  /** Distance a crash knocks the chariot clear of what it hit, in metres. */
  crashClearance: number;
}

export function startChariot(progress: number, lane: number, speed = 0): ChariotState {
  return { progress, lane, heading: 0, turnRate: 0, speed, crashes: 0 };
}

/** Sideways speed across the track, in m/s; positive moves outwards. */
export function lateralVelocity(state: ChariotState): number {
  return state.speed * Math.sin(state.heading);
}

/**
 * Advances the chariot by `dt` seconds. `steer` runs from -1 (full left,
 * towards the spina) to +1 (full right, towards the outer wall).
 */
export function stepChariot(
  state: ChariotState,
  steer: number,
  dt: number,
  track: TrackSpec,
  params: ChariotParams,
): ChariotState {
  const clamped = Math.max(-1, Math.min(1, steer));
  // Exponential approach: frame-rate independent and never overshoots.
  const blend = 1 - Math.exp(-dt / params.response);
  const turnRate = state.turnRate + (clamped * params.maxTurnRate - state.turnRate) * blend;
  const speed =
    state.speed < params.cruiseSpeed
      ? Math.min(params.cruiseSpeed, state.speed + params.acceleration * dt)
      : Math.max(params.cruiseSpeed, state.speed - params.braking * dt);

  // As the track bends left under the chariot, its heading relative to the
  // track swings outwards by exactly the angle the track turns. With no
  // steering, that makes the path a straight line across the ground.
  //
  // The step is taken twice (predict, then correct), so the move uses the
  // heading midway through the step, including half of the track's turn.
  const steered = turnRate * dt;
  let bend = 0;
  let lane = state.lane;
  let midLane = state.lane;
  let progress = state.progress;
  for (let pass = 0; pass < 2; pass++) {
    const midHeading = state.heading + (steered + bend) / 2;
    lane = state.lane + state.speed * Math.sin(midHeading) * dt;
    midLane = (state.lane + Math.max(0, Math.min(track.width, lane))) / 2;
    progress = advance(track, state.progress, midLane, state.speed * Math.cos(midHeading) * dt);
    bend = trackTurn(track, state.progress, progress, midLane);
  }

  // Hitting the spina or the wall is a crash: the chariot stops dead and is
  // knocked clear, pointing away from what it hit, so it can't scrape along.
  if (lane <= 0 || lane >= track.width) {
    const intoWall = lane >= track.width;
    return {
      progress,
      lane: intoWall ? track.width - params.crashClearance : params.crashClearance,
      heading: intoWall ? -params.bounceAngle : params.bounceAngle,
      turnRate: 0,
      speed: params.crashSpeed,
      crashes: state.crashes + 1,
    };
  }

  let heading = state.heading + steered + bend;
  heading = Math.max(-params.maxHeading, Math.min(params.maxHeading, heading));
  return { progress, lane, heading, turnRate, speed, crashes: state.crashes };
}

/** How far the track direction turns left between two progress values, in radians. */
function trackTurn(track: TrackSpec, from: number, to: number, lane: number): number {
  const a = poseAt(track, from, lane);
  const b = poseAt(track, to, lane);
  // Angle of each direction, increasing as the track turns left (towards -Z
  // when heading +X), wrapped to the shortest way round.
  const angle = Math.atan2(-b.forwardZ, b.forwardX) - Math.atan2(-a.forwardZ, a.forwardX);
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** Linear interpolation between two states, for smooth rendering. */
export function interpolateChariot(a: ChariotState, b: ChariotState, t: number): ChariotState {
  const mix = (x: number, y: number) => x + (y - x) * t;
  return {
    progress: mix(a.progress, b.progress),
    lane: mix(a.lane, b.lane),
    heading: mix(a.heading, b.heading),
    turnRate: mix(a.turnRate, b.turnRate),
    speed: mix(a.speed, b.speed),
    crashes: b.crashes,
  };
}
