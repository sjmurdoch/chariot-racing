// Wreckage (naufragia). A chariot that crashes into the spina or the wall at
// speed leaves wreckage where it hit, for a while. Running into wreckage is a
// crash too, though it leaves no more wreckage of its own, so pile-ups can't
// snowball. Wreckage lies against the spina or the wall, so wreckage at the
// spina blocks the inside line.

import { crashAgainst, type ChariotParams, type ChariotState } from './chariot';
import { CHARIOT_LENGTH, CHARIOT_WIDTH, separation } from './pack';
import type { TrackSpec } from './track';

export interface Wreck {
  progress: number;
  /** 0 against the spina, or the track width against the wall. */
  lane: number;
  /** Index of the racer whose wreck it is; it can't hit its own. */
  owner: number;
  /** Seconds since the crash. */
  age: number;
}

export interface WreckageParams {
  /** Seconds before wreckage is cleared away. */
  lifetime: number;
  /** Slowest crash, in m/s, that leaves wreckage. */
  minSpeed: number;
}

/** How far wreckage spreads out from the spina or wall, in metres. */
export const WRECK_SPREAD = 1.8;
/** At most this many wrecks stay on the track; older ones go first. */
export const MAX_WRECKS = 8;

/** Wreckage left by a crash, if any: only crashes at speed leave it. */
export function wreckFrom(
  track: TrackSpec,
  before: ChariotState,
  after: ChariotState,
  owner: number,
  params: WreckageParams,
): Wreck | null {
  if (after.crashes <= before.crashes || before.speed < params.minSpeed) return null;
  return {
    progress: after.progress,
    lane: after.lane < track.width / 2 ? 0 : track.width,
    owner,
    age: 0,
  };
}

/** Ages the wreckage and clears away any that has lain long enough. */
export function ageWrecks(wrecks: Wreck[], dt: number, params: WreckageParams): Wreck[] {
  return wrecks
    .map((w) => ({ ...w, age: w.age + dt }))
    .filter((w) => w.age < params.lifetime)
    .slice(-MAX_WRECKS);
}

/** The side of a wreck with open track: outwards from the spina, inwards from the wall. */
export function openSide(track: TrackSpec, wreck: Wreck): 1 | -1 {
  return wreck.lane < track.width / 2 ? 1 : -1;
}

/** The lane just clear of a wreck, on its open side, for a chariot's centre. */
export function clearOf(track: TrackSpec, wreck: Wreck, margin = 0): number {
  return wreck.lane + openSide(track, wreck) * (WRECK_SPREAD + CHARIOT_WIDTH / 2 + margin);
}

/** Whether a chariot is running into a wreck. */
export function hitsWreck(track: TrackSpec, chariot: ChariotState, wreck: Wreck): boolean {
  const gap = separation(track, chariot, { ...chariot, progress: wreck.progress, lane: wreck.lane });
  return (
    gap.along > -1 &&
    gap.along < CHARIOT_LENGTH - 0.5 &&
    Math.abs(gap.across) < WRECK_SPREAD + CHARIOT_WIDTH / 2
  );
}

/**
 * Crashes a chariot that has run into someone else's wreckage, knocking it
 * clear on the open side. Returns the chariot unchanged if it hit nothing.
 */
export function crashIntoWreckage(
  track: TrackSpec,
  chariot: ChariotState,
  index: number,
  wrecks: Wreck[],
  params: ChariotParams,
): ChariotState {
  const wreck = wrecks.find((w) => w.owner !== index && hitsWreck(track, chariot, w));
  if (!wreck) return chariot;
  const side = openSide(track, wreck);
  return crashAgainst(chariot, wreck.lane + side * (WRECK_SPREAD + CHARIOT_WIDTH / 2), side, params);
}
