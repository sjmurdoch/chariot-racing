// Rival drivers. Each drives the same chariot physics as the player, steering
// as a careful player would: round each bend, back to its preferred racing
// line, and out round a slower chariot in its way.

import type { ChariotParams, ChariotState } from './chariot';
import { CHARIOT_LENGTH, CHARIOT_WIDTH, separation } from './pack';
import { advance, curvature, type TrackSpec } from './track';

export interface Personality {
  /** Preferred distance out from the inside line, in metres. */
  line: number;
  /** Top speed as a fraction of the standard cruising speed. */
  skill: number;
}

export interface Brain {
  personality: Personality;
  /** The lane the driver is currently steering for. */
  targetLane: number;
}

/** How far ahead a driver watches for a chariot in its way, in metres. */
const LOOK_AHEAD = 20;
/** How far across a driver moves to pass, in metres. */
const PASSING_OFFSET = 3.6;
/** Closest a driver will steer for to the spina or the wall, in metres. */
const MARGIN = 1.2;
/** Room a driver leaves to a chariot alongside, centre to centre, in metres. */
const ROOM = CHARIOT_WIDTH + 0.6;
/** Seconds ahead a driver anticipates the start or end of a bend. */
const ANTICIPATE = 0.15;

export function createBrain(personality: Personality): Brain {
  return { personality, targetLane: personality.line };
}

/**
 * Steering, from -1 to 1, to follow the bend and settle on `targetLane`.
 * Steers for the bend just ahead as well as the one underfoot, so the driver
 * turns in as the bend starts and straightens as it ends.
 */
export function aiSteer(
  chariot: ChariotState,
  targetLane: number,
  track: TrackSpec,
  params: ChariotParams,
): number {
  const ahead = advance(track, chariot.progress, chariot.lane, chariot.speed * ANTICIPATE);
  const bend =
    (curvature(track, chariot.progress, chariot.lane) + curvature(track, ahead, chariot.lane)) / 2;
  const follow = (-bend * chariot.speed * Math.cos(chariot.heading)) / params.maxTurnRate;
  const correct = 0.15 * (targetLane - chariot.lane) - 2 * chariot.heading;
  return Math.max(-1, Math.min(1, follow + correct));
}

/**
 * Chooses the lane to steer for: the preferred line, unless a chariot ahead
 * is in the way, in which case the driver pulls out to pass it, preferring
 * the inside (the shorter way round) when there is room. Drivers only change
 * their plan on the straights.
 */
export function planLane(
  brain: Brain,
  me: number,
  chariots: ChariotState[],
  track: TrackSpec,
): Brain {
  const self = chariots[me]!;
  if (curvature(track, self.progress, self.lane) !== 0) return brain;

  let blocker: ChariotState | undefined;
  let nearest = LOOK_AHEAD;
  let target = brain.personality.line;
  chariots.forEach((other, i) => {
    if (i === me) return;
    const gap = separation(track, self, other);
    if (gap.along > 0 && gap.along < nearest && Math.abs(gap.across) < CHARIOT_WIDTH + 0.4) {
      nearest = gap.along;
      blocker = other;
    }
    // Leave room for a chariot alongside, and don't try to steer through it
    // to a line on its far side.
    if (Math.abs(gap.along) < CHARIOT_LENGTH + 1) {
      const mySide = self.lane < other.lane ? -1 : 1;
      const beyond = (target - other.lane) * mySide < ROOM;
      if (beyond) target = other.lane + mySide * ROOM;
    }
  });

  const clamp = (lane: number) => Math.max(MARGIN, Math.min(track.width - MARGIN, lane));
  if (!blocker) return { ...brain, targetLane: clamp(target) };

  const inside = blocker.lane - PASSING_OFFSET;
  const targetLane = inside >= MARGIN ? inside : blocker.lane + PASSING_OFFSET;
  return { ...brain, targetLane: clamp(targetLane) };
}
