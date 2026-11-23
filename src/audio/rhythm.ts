// Timing for the sound: when hooves strike in a gallop, and how loud the
// crowd is. Pure functions, so they can be tested without an AudioContext.

import { STRIDE } from '../render/gait';

/**
 * Where in a stride each hoof strikes, as fractions of the stride. A gallop
 * is a four-beat gait: three quick beats, then a moment with all four hooves
 * off the ground.
 */
const GALLOP_BEATS = [0, 0.11, 0.22, 0.36];

/** Below this speed, in m/s, the horses are barely moving and make no hoofbeats. */
export const MIN_HOOF_SPEED = 1;

/** Seconds per stride at `speed` m/s, or Infinity when standing. */
export function strideSeconds(speed: number): number {
  return speed < MIN_HOOF_SPEED ? Infinity : STRIDE / speed;
}

/** Times of the hoofbeats in the stride starting at `start`, `stride` seconds long. */
export function gallopBeats(start: number, stride: number): number[] {
  if (!Number.isFinite(stride)) return [];
  return GALLOP_BEATS.map((f) => start + f * stride);
}

/**
 * How loud the crowd is, from 0 to 1: a steady murmur, louder as the player
 * goes round a turn (where the crowd watched for crashes), plus any
 * excitement from a cheer or a gasp.
 */
export function crowdLevel(inTurn: boolean, excitement: number): number {
  const base = inTurn ? 0.5 : 0.3;
  return Math.min(1, base + 0.5 * Math.max(0, excitement));
}

/** Excitement fades by this fraction each second. */
const EXCITEMENT_FADE = 0.6;

/** Lets excitement die away over `dt` seconds. */
export function fadeExcitement(excitement: number, dt: number): number {
  return excitement * Math.pow(1 - EXCITEMENT_FADE, dt);
}
