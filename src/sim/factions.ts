// The four circus factions (factiones) of Rome, each with its colour, and
// the rivals' driving styles.

import type { Personality } from './rival';

export interface Faction {
  id: FactionId;
  /** The faction's Latin name. */
  name: string;
  /** Plain English name of the colour. */
  colour: string;
  /** Display colour, as 0xRRGGBB. */
  hex: number;
}

export type FactionId = 'russata' | 'albata' | 'veneta' | 'prasina';

export const FACTIONS: Record<FactionId, Faction> = {
  russata: { id: 'russata', name: 'Russata', colour: 'Red', hex: 0xb3261e },
  albata: { id: 'albata', name: 'Albata', colour: 'White', hex: 0xece6d8 },
  veneta: { id: 'veneta', name: 'Veneta', colour: 'Blue', hex: 0x2f5d9e },
  prasina: { id: 'prasina', name: 'Prasina', colour: 'Green', hex: 0x2f8a3e },
};

export const FACTION_ORDER: FactionId[] = ['russata', 'albata', 'veneta', 'prasina'];

export function isFactionId(id: string): id is FactionId {
  return id in FACTIONS;
}

export interface RivalSetup {
  faction: FactionId;
  personality: Personality;
  /** Starting distance out from the inside line, in metres. */
  startLane: number;
}

/**
 * Driving styles for the three rivals, in order: one hugs the inside but is a
 * little slower, one runs the middle at the player's pace, and one goes wide
 * but is quicker. On the default track the inside rival beats a player who
 * holds the middle lane, so the player has to take the inside line to win.
 */
const STYLES: { personality: Personality; startLane: number }[] = [
  { personality: { line: 2, skill: 0.97 }, startLane: 1.5 },
  { personality: { line: 7, skill: 1.0 }, startLane: 11 },
  { personality: { line: 13, skill: 1.06 }, startLane: 16 },
];

/**
 * The rivals for a player of faction `player`: every other faction, each with
 * a driving style. `skill` scales every rival's speed (1 is normal).
 */
export function rivalsFor(player: FactionId, count: number, skill: number): RivalSetup[] {
  return FACTION_ORDER.filter((f) => f !== player)
    .slice(0, Math.max(0, Math.min(count, STYLES.length)))
    .map((faction, i) => {
      const style = STYLES[i]!;
      return {
        faction,
        personality: { ...style.personality, skill: style.personality.skill * skill },
        startLane: style.startLane,
      };
    });
}
