// The whole field: the player and the rivals, stepped together.

import { stepChariot, type ChariotParams, type ChariotState } from './chariot';
import { resolveContacts, slipstreamFor } from './pack';
import { startRace, stepRace, type RaceState } from './race';
import { aiSteer, planLane, type Brain } from './rival';
import type { TrackSpec } from './track';

export interface Racer {
  /** Faction name, such as "prasina". */
  faction: string;
  chariot: ChariotState;
  race: RaceState;
  /** This racer's handling; rivals' cruising speed reflects their skill. */
  params: ChariotParams;
  /** The AI driving a rival; absent for the player. */
  brain?: Brain;
}

export interface FieldParams {
  track: TrackSpec;
  laps: number;
  /** Extra cruising speed at full slipstream, as a fraction (0.08 = 8%). */
  slipstreamBoost: number;
}

export function createRacer(
  faction: string,
  chariot: ChariotState,
  params: ChariotParams,
  brain?: Brain,
): Racer {
  return { faction, chariot, race: startRace(), params, ...(brain ? { brain } : {}) };
}

/**
 * Advances every racer by `dt` seconds. The player steers with
 * `playerSteer`; rivals steer themselves. Racers who have finished pull up.
 */
export function stepField(
  field: Racer[],
  playerSteer: number,
  dt: number,
  setup: FieldParams,
): Racer[] {
  const { track, laps } = setup;
  const before = field.map((r) => r.chariot);

  const moved = field.map((racer, i) => {
    const racing = racer.race.phase === 'racing';
    const boost = racing ? 1 + setup.slipstreamBoost * slipstreamFor(track, before, i) : 0;
    const params = { ...racer.params, cruiseSpeed: racer.params.cruiseSpeed * boost };
    let steer = 0;
    if (racing) {
      steer = racer.brain
        ? aiSteer(racer.chariot, racer.brain.targetLane, track, racer.params)
        : playerSteer;
    }
    return stepChariot(racer.chariot, steer, dt, track, params);
  });

  const settled = resolveContacts(track, moved);
  return field.map((racer, i) => {
    const chariot = settled[i]!;
    const race = stepRace(racer.race, racer.chariot.progress, chariot.progress, dt, laps);
    const brain = racer.brain ? planLane(racer.brain, i, settled, track) : undefined;
    return { ...racer, chariot, race, ...(brain ? { brain } : {}) };
  });
}

/**
 * Racers in race order: finishers by finishing time, then the rest by how
 * far round they are. Returns indices into `field`.
 */
export function standings(field: Racer[]): number[] {
  return field
    .map((_, i) => i)
    .sort((a, b) => {
      const ra = field[a]!;
      const rb = field[b]!;
      const fa = ra.race.finishTime;
      const fb = rb.race.finishTime;
      if (fa !== null && fb !== null) return fa - fb;
      if (fa !== null) return -1;
      if (fb !== null) return 1;
      return rb.chariot.progress - ra.chariot.progress;
    });
}

/** A racer's place, counting from 1. */
export function placeOf(field: Racer[], index: number): number {
  return standings(field).indexOf(index) + 1;
}
