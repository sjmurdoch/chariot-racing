// The player's chariot: forward motion along the track plus sideways motion
// across it, driven by a single steering input.

import { advance, type TrackSpec } from './track';

export interface ChariotState {
  /** Track progress; see track.ts. */
  progress: number;
  /** Metres out from the inside line, between 0 and the track width. */
  lane: number;
  /** Sideways speed in m/s; positive moves outwards (to the driver's right). */
  lateralVelocity: number;
  /** Forward speed in m/s. */
  speed: number;
}

export interface SteeringParams {
  /** Sideways speed at full steering lock, in m/s. */
  maxLateralSpeed: number;
  /** Time constant for reaching the steered sideways speed, in seconds. */
  response: number;
}

export function startChariot(progress: number, lane: number, speed: number): ChariotState {
  return { progress, lane, lateralVelocity: 0, speed };
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
  const target = clamped * steering.maxLateralSpeed;
  // Exponential approach: frame-rate independent and never overshoots.
  const blend = 1 - Math.exp(-dt / steering.response);
  let lateralVelocity = state.lateralVelocity + (target - state.lateralVelocity) * blend;

  let lane = state.lane + lateralVelocity * dt;
  if (lane <= 0 || lane >= track.width) {
    // Up against the spina or the wall: stop sliding. Crashes come later.
    lane = Math.max(0, Math.min(track.width, lane));
    lateralVelocity = 0;
  }

  return {
    progress: advance(track, state.progress, lane, state.speed * dt),
    lane,
    lateralVelocity,
    speed: state.speed,
  };
}

/** Linear interpolation between two states, for smooth rendering. */
export function interpolateChariot(a: ChariotState, b: ChariotState, t: number): ChariotState {
  const mix = (x: number, y: number) => x + (y - x) * t;
  return {
    progress: mix(a.progress, b.progress),
    lane: mix(a.lane, b.lane),
    lateralVelocity: mix(a.lateralVelocity, b.lateralVelocity),
    speed: mix(a.speed, b.speed),
  };
}
