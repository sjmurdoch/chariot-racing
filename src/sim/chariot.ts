// The player's chariot. It has a heading of its own: steering turns it, and
// the track bends underneath it. Without steering, it runs straight on at a
// bend and drifts wide towards the outer wall, so the player has to steer
// round every turn.
//
// The heading is measured relative to the direction of the track at the
// chariot's position: 0 is straight along the track, positive points
// outwards (to the driver's right).

import { advance, curvature, type TrackSpec } from './track';

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
}

export interface SteeringParams {
  /** Rate of turning at full steering lock, in radians per second. */
  maxTurnRate: number;
  /** Time constant for reaching the steered turning rate, in seconds. */
  response: number;
  /**
   * Time constant, in seconds, with which the horses line up with the track
   * on their own. This makes straights forgiving, but at a bend it only
   * slows the drift: the player still has to steer round.
   */
  straightenTime: number;
  /** Largest heading away from the track direction, in radians. */
  maxHeading: number;
}

export function startChariot(progress: number, lane: number, speed: number): ChariotState {
  return { progress, lane, heading: 0, turnRate: 0, speed };
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
  steering: SteeringParams,
): ChariotState {
  const clamped = Math.max(-1, Math.min(1, steer));
  // Exponential approach: frame-rate independent and never overshoots.
  const blend = 1 - Math.exp(-dt / steering.response);
  const turnRate = state.turnRate + (clamped * steering.maxTurnRate - state.turnRate) * blend;

  // The track turning left under a chariot that holds its course swings the
  // relative heading outwards, at the bend's curvature times forward speed.
  const along = state.speed * Math.cos(state.heading);
  const bend = curvature(track, state.progress, state.lane) * along;
  let heading = state.heading + (turnRate + bend) * dt;
  heading *= Math.exp(-dt / steering.straightenTime);
  heading = Math.max(-steering.maxHeading, Math.min(steering.maxHeading, heading));

  let lane = state.lane + state.speed * Math.sin(heading) * dt;
  if (lane <= 0 || lane >= track.width) {
    // Against the spina or the wall: scrape along it. Crashes come later.
    lane = Math.max(0, Math.min(track.width, lane));
    heading = 0;
  }

  return {
    progress: advance(track, state.progress, lane, along * dt),
    lane,
    heading,
    turnRate,
    speed: state.speed,
  };
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
  };
}
