// The horses' gallop: how far through its stride a team is, and how that
// moves each horse's legs, body and head. Pure functions, so they can be
// tested without drawing anything.

/** Ground covered in one galloping stride, in metres (a horse's is about 6–7 m). */
export const STRIDE = 6.5;
/** Speed, in m/s, at which the gallop reaches its full swing. */
const FULL_SWING_SPEED = 8;
/** Leg swing either side of upright at a full gallop, in radians. */
const LEG_SWING = 0.55;
/** Body rise and fall at a full gallop, in metres. */
const BOB = 0.08;
/** Head nod either side at a full gallop, in radians. */
const NOD = 0.12;

export interface Gait {
  /** Position in the stride, in radians (one stride is 2π). */
  phase: number;
  /** How hard the horses are galloping, from 0 (standing) to 1. */
  strength: number;
}

/** Moves the gait on by `dt` seconds at `speed` metres per second. */
export function advanceGait(gait: Gait, speed: number, dt: number): Gait {
  return {
    phase: (gait.phase + (2 * Math.PI * speed * dt) / STRIDE) % (2 * Math.PI),
    strength: Math.min(1, Math.max(0, speed / FULL_SWING_SPEED)),
  };
}

/** Each horse in a team gallops slightly out of step with the next. */
function horsePhase(gait: Gait, horse: number): number {
  return gait.phase + horse * 0.45;
}

/**
 * Swing of a leg forwards (positive) or back, in radians. In a gallop the
 * front and hind legs move in opposite directions.
 */
export function legSwing(gait: Gait, horse: number, front: boolean): number {
  const s = Math.sin(horsePhase(gait, horse) + (front ? 0 : Math.PI));
  return LEG_SWING * gait.strength * s;
}

/** Rise of a horse's body above its standing height, in metres. */
export function bodyBob(gait: Gait, horse: number): number {
  // Twice per stride, never below standing height.
  return BOB * gait.strength * Math.abs(Math.sin(horsePhase(gait, horse)));
}

/** Nod of a horse's head down (positive) or up, in radians. */
export function headNod(gait: Gait, horse: number): number {
  return NOD * gait.strength * Math.sin(horsePhase(gait, horse) + Math.PI / 2);
}
