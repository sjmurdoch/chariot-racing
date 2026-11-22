import { describe, expect, it } from 'vitest';
import { FACTION_ORDER, FACTIONS, isFactionId, rivalsFor } from './factions';

describe('factions', () => {
  it('has the four circus factions', () => {
    expect(FACTION_ORDER.map((id) => FACTIONS[id].name)).toEqual([
      'Russata',
      'Albata',
      'Veneta',
      'Prasina',
    ]);
  });

  it('recognises faction ids', () => {
    expect(isFactionId('veneta')).toBe(true);
    expect(isFactionId('purpurea')).toBe(false);
  });
});

describe('rivalsFor', () => {
  it('gives the player the three other factions as rivals', () => {
    const rivals = rivalsFor('prasina', 3, 1);
    expect(rivals.map((r) => r.faction)).toEqual(['russata', 'albata', 'veneta']);
  });

  it('never makes the player race their own faction', () => {
    for (const player of FACTION_ORDER) {
      expect(rivalsFor(player, 3, 1).map((r) => r.faction)).not.toContain(player);
    }
  });

  it('scales every rival by the skill setting', () => {
    const normal = rivalsFor('prasina', 3, 1);
    const hard = rivalsFor('prasina', 3, 1.05);
    hard.forEach((r, i) => {
      expect(r.personality.skill).toBeCloseTo(normal[i]!.personality.skill * 1.05);
    });
  });

  it('can race fewer rivals, but no more than three', () => {
    expect(rivalsFor('prasina', 1, 1)).toHaveLength(1);
    expect(rivalsFor('prasina', 0, 1)).toHaveLength(0);
    expect(rivalsFor('prasina', 9, 1)).toHaveLength(3);
  });

  it('starts rivals in separate lanes', () => {
    const lanes = rivalsFor('prasina', 3, 1).map((r) => r.startLane);
    expect(new Set(lanes).size).toBe(3);
  });
});
