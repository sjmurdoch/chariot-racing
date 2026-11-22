// Chariots racing together: how far apart they are, slipstreaming behind
// one another, and bumping when they touch.

import type { ChariotState } from './chariot';
import { poseAt, type TrackSpec } from './track';

/** Length of a quadriga from the horses' noses to the back of the car, in metres. */
export const CHARIOT_LENGTH = 5;
/** Width of a quadriga (four horses abreast), in metres. */
export const CHARIOT_WIDTH = 2.6;

/** Slipstream reaches this far behind a chariot, in metres. */
const SLIPSTREAM_REACH = 15;
/** Slipstream only helps when this closely lined up, in metres across. */
const SLIPSTREAM_WIDTH = 1.8;
/** Closer than this across the track, a touch counts as hitting from behind. */
const NOSE_TO_TAIL = 1.0;
/** A side bump knocks each chariot's heading away by this much, in radians. */
const BUMP_HEADING = 0.08;
/** A side bump costs both chariots this fraction of their speed. */
const BUMP_SPEED_LOSS = 0.04;
/** Hitting a chariot from behind drops to this fraction of its speed. */
const REAR_END_SPEED = 0.8;

export interface Separation {
  /** How far `b` is ahead of `a` along the track, in metres (negative: behind). */
  along: number;
  /** How far `b` is outside `a` across the track, in metres (negative: inside). */
  across: number;
}

/**
 * Where chariot `b` is relative to chariot `a`. Accurate for chariots close
 * together, which is all the pack rules need.
 */
export function separation(track: TrackSpec, a: ChariotState, b: ChariotState): Separation {
  const pa = poseAt(track, a.progress, a.lane);
  const pb = poseAt(track, b.progress, b.lane);
  const across = b.lane - a.lane;
  // Measure along the track at a's position, ignoring the sideways part.
  const dx = pb.x - pa.x;
  const dz = pb.z - pa.z;
  const along = dx * pa.forwardX + dz * pa.forwardZ;
  // Far apart (or a lap apart), fall back to the progress difference.
  if (Math.abs(b.progress - a.progress) > 0.5) {
    return { along: Math.sign(b.progress - a.progress) * Infinity, across };
  }
  return { along, across };
}

/**
 * Speed boost from running in another chariot's slipstream, from 0 to 1:
 * strongest right behind it, fading to nothing at the edge of its reach.
 */
export function slipstream(gap: Separation): number {
  if (gap.along <= CHARIOT_LENGTH || gap.along >= SLIPSTREAM_REACH) return 0;
  if (Math.abs(gap.across) >= SLIPSTREAM_WIDTH) return 0;
  return 1 - (gap.along - CHARIOT_LENGTH) / (SLIPSTREAM_REACH - CHARIOT_LENGTH);
}

/** The best slipstream chariot `i` gets from any of the others. */
export function slipstreamFor(track: TrackSpec, chariots: ChariotState[], i: number): number {
  let best = 0;
  chariots.forEach((other, j) => {
    if (j !== i) best = Math.max(best, slipstream(separation(track, chariots[i]!, other)));
  });
  return best;
}

/** Sideways speeds must close faster than this, in m/s, to count as a bump. */
const CLOSING_SPEED = 0.5;
/** After a bump, seconds before another can cost either chariot speed. */
const BUMP_COOLDOWN = 0.5;

/**
 * Resolves chariots touching. Side by side, they are kept a chariot's width
 * apart; if they were moving towards each other it's a bump, which knocks
 * their headings apart and costs both a little speed (once, since afterwards
 * they are moving apart, and not again for half a second). Nose to tail, the one behind is checked to well
 * below the speed of the one in front.
 */
export function resolveContacts(track: TrackSpec, chariots: ChariotState[]): ChariotState[] {
  const out = chariots.map((c) => ({ ...c }));
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const a = out[i]!;
      const b = out[j]!;
      const gap = separation(track, a, b);
      if (Math.abs(gap.along) >= CHARIOT_LENGTH || Math.abs(gap.across) >= CHARIOT_WIDTH) continue;

      if (Math.abs(gap.across) >= NOSE_TO_TAIL) {
        const push = (CHARIOT_WIDTH - Math.abs(gap.across)) / 2;
        const side = Math.sign(gap.across); // +1: b is outside a.
        const closing =
          side * (a.speed * Math.sin(a.heading) - b.speed * Math.sin(b.heading));
        a.lane = clampLane(track, a.lane - side * push);
        b.lane = clampLane(track, b.lane + side * push);
        if (closing > CLOSING_SPEED && a.bumpCooldown === 0 && b.bumpCooldown === 0) {
          a.heading -= side * BUMP_HEADING;
          b.heading += side * BUMP_HEADING;
          a.speed *= 1 - BUMP_SPEED_LOSS;
          b.speed *= 1 - BUMP_SPEED_LOSS;
          a.bumpCooldown = b.bumpCooldown = BUMP_COOLDOWN;
        }
      } else {
        // Only when catching up: once checked, it drops back without
        // being checked again on every step.
        const [behind, ahead] = gap.along >= 0 ? [a, b] : [b, a];
        if (behind.speed > ahead.speed) behind.speed = ahead.speed * REAR_END_SPEED;
      }
    }
  }
  return out;
}

function clampLane(track: TrackSpec, lane: number): number {
  return Math.max(0, Math.min(track.width, lane));
}
