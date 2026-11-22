import { describe, expect, it } from 'vitest';
import { startChariot, type ChariotParams } from './chariot';
import { createRacer, placeOf, standings, stepField, type FieldParams, type Racer } from './field';
import { aiSteer, createBrain, planLane } from './rival';
import { advance, type TrackSpec } from './track';

const track: TrackSpec = { straightLength: 150, innerRadius: 8, width: 24, spinaClearance: 2 };
const params: ChariotParams = {
  maxTurnRate: Math.PI,
  response: 0.12,
  maxHeading: (80 * Math.PI) / 180,
  cruiseSpeed: 22,
  acceleration: 6,
  braking: 5,
  crashSpeed: 0,
  bounceAngle: (15 * Math.PI) / 180,
  crashClearance: 0.5,
};
const setup: FieldParams = { track, laps: 7, slipstreamBoost: 0.08 };
const DT = 1 / 60;

function rival(faction: string, line: number, skill = 1, start = line, progress = 0): Racer {
  return createRacer(
    faction,
    startChariot(progress, start),
    { ...params, cruiseSpeed: params.cruiseSpeed * skill },
    createBrain({ line, skill }),
  );
}

function race(field: Racer[], seconds: number): Racer[] {
  let f = field;
  for (let i = 0; i < seconds / DT; i++) f = stepField(f, 0, DT, setup);
  return f;
}

describe('aiSteer', () => {
  it('drives straight on its line along a straight', () => {
    const c = startChariot(0.5, 6, 22);
    expect(aiSteer(c, 6, track, params)).toBe(0);
  });

  it('steers left into a bend', () => {
    const c = startChariot(1.2, 6, 22);
    expect(aiSteer(c, 6, track, params)).toBeLessThan(-0.3);
  });
});

describe('a rival on its own', () => {
  for (const line of [1.5, 7, 13]) {
    it(`laps cleanly on a ${line} m line`, () => {
      const [r] = race([rival('russata', line)], 25);
      expect(r!.chariot.crashes).toBe(0);
      expect(r!.chariot.progress).toBeGreaterThan(4);
    });
  }

  it('finishes all seven laps without crashing', () => {
    const [r] = race([rival('veneta', 7)], 150);
    expect(r!.race.phase).toBe('finished');
    expect(r!.chariot.crashes).toBe(0);
    expect(r!.race.finishTime).toBeGreaterThan(100);
    expect(r!.race.finishTime).toBeLessThan(140);
  });
});

describe('planLane', () => {
  const blocked = (lane: number) => [startChariot(0.3, lane, 22), startChariot(advance(track, 0.3, lane, 10), lane, 18)];

  it('pulls inside to pass a chariot ahead when there is room', () => {
    const brain = planLane(createBrain({ line: 10, skill: 1 }), 0, blocked(10), track);
    expect(brain.targetLane).toBeCloseTo(6.4);
  });

  it('passes on the outside when the inside is too tight', () => {
    const brain = planLane(createBrain({ line: 2, skill: 1 }), 0, blocked(2), track);
    expect(brain.targetLane).toBeCloseTo(5.6);
  });

  it('returns to its line once clear', () => {
    const brain = { ...createBrain({ line: 2, skill: 1 }), targetLane: 6 };
    expect(planLane(brain, 0, [startChariot(0.3, 6, 22)], track).targetLane).toBe(2);
  });

  it('does not steer through a chariot alongside to reach its line', () => {
    const me = startChariot(0.3, 5, 22);
    const alongside = startChariot(0.3, 8, 22);
    const brain = planLane(createBrain({ line: 12, skill: 1 }), 0, [me, alongside], track);
    expect(brain.targetLane).toBeLessThanOrEqual(8 - 3.2 + 1e-9);
  });

  it('keeps its plan through the bends', () => {
    const brain = { ...createBrain({ line: 2, skill: 1 }), targetLane: 6 };
    expect(planLane(brain, 0, [startChariot(1.3, 6, 22)], track)).toBe(brain);
  });
});

describe('a full field', () => {
  it('races seven laps with every chariot finishing in order', () => {
    const field = race(
      [rival('russata', 2, 0.97, 2), rival('prasina', 6, 1, 6), rival('veneta', 7, 1, 11), rival('albata', 13, 1.02, 16)],
      170,
    );
    for (const r of field) {
      expect(r.race.phase).toBe('finished');
      expect(Number.isFinite(r.chariot.progress)).toBe(true);
    }
    const order = standings(field);
    const times = order.map((i) => field[i]!.race.finishTime!);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(placeOf(field, order[0]!)).toBe(1);
  });

  it('lets a faster rival get past a slower one on the same line', () => {
    const slow = rival('albata', 8, 0.9, 8, 0.05);
    const fast = rival('russata', 8, 1.0, 8, 0);
    const field = race([fast, slow], 60);
    expect(field[0]!.chariot.progress).toBeGreaterThan(field[1]!.chariot.progress);
  });

  it('gains from slipstreaming close behind', () => {
    // Chariots without a driver hold their lane, so only the slipstream differs.
    const holding = (progress: number) => createRacer('veneta', startChariot(progress, 8, 22), params);
    const alone = race([holding(0)], 3)[0]!;
    const following = race([holding(0), holding(0.05)], 3)[0]!;
    expect(following.chariot.progress).toBeGreaterThan(alone.chariot.progress);
    expect(following.chariot.speed).toBeGreaterThan(22);
  });
});
