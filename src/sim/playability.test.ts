// Checks that the default settings are drivable with on/off controls, the
// hardest input to steer with: a simulated player taps keys (ramped, as in
// the game) to get round a whole lap without touching the wall or spina.

import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, steeringParams, trackSpec } from '../config';
import { rampSteer } from '../input/steering';
import { startChariot, stepChariot } from './chariot';
import { curvature, lapLength } from './track';

const DT = 1 / 60;

function keyboardLap(targetLane: number) {
  const track = trackSpec(DEFAULT_CONFIG);
  const steering = steeringParams(DEFAULT_CONFIG);
  const { ramp_up, ramp_down } = DEFAULT_CONFIG.steering;
  const speed = DEFAULT_CONFIG.chariot.cruise_speed;

  let state = startChariot(0, targetLane, speed);
  let steer = 0;
  let closestToSpina = Infinity;
  let closestToWall = Infinity;
  const seconds = (lapLength(track, targetLane) / speed) * 1.05;

  for (let i = 0; i < seconds / DT; i++) {
    // The steering a perfect analogue player would use...
    const bend = (curvature(track, state.progress, state.lane) * speed) / steering.maxTurnRate;
    const wanted = -bend + 0.2 * (targetLane - state.lane) - 2.5 * state.heading;
    // ...approximated by pressing a key whenever it's far enough off centre.
    const key = wanted < -0.25 ? -1 : wanted > 0.25 ? 1 : 0;
    steer = rampSteer(steer, key, DT, ramp_up, ramp_down);
    state = stepChariot(state, steer, DT, track, steering);
    closestToSpina = Math.min(closestToSpina, state.lane);
    closestToWall = Math.min(closestToWall, track.width - state.lane);
  }
  return { state, closestToSpina, closestToWall };
}

// Such a player strays about 2 m either side of their line, so the innermost
// lanes are reachable with keys but leave little margin: the inside line is
// meant to be a risk.
describe('keyboard playability with default settings', () => {
  for (const lane of [3, 8, 14]) {
    it(`gets round a lap in lane ${lane} m without touching the spina or wall`, () => {
      const { state, closestToSpina, closestToWall } = keyboardLap(lane);
      expect(state.progress).toBeGreaterThan(4);
      expect(closestToSpina).toBeGreaterThan(0);
      expect(closestToWall).toBeGreaterThan(0);
    });
  }
});
