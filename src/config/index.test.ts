import { describe, expect, it } from 'vitest';
import { lapLength, spinaHalfWidth } from '../sim/track';
import { DEFAULT_CONFIG, loadConfig, steeringParams, trackSpec } from './index';

const num = expect.any(Number);
const bool = expect.any(Boolean);

describe('game.toml defaults', () => {
  it('has every setting with the expected type', () => {
    expect(DEFAULT_CONFIG).toEqual({
      race: { laps: num },
      track: { straight_length: num, inner_radius: num, width: num, spina_clearance: num },
      chariot: { cruise_speed: num, start_lane: num },
      steering: {
        max_turn_rate: num,
        response: num,
        straighten_time: num,
        max_heading: num,
        ramp_up: num,
        ramp_down: num,
      },
      tilt: { full_lock: num, deadzone: num, invert: bool },
      camera: { height: num, fov: num, lookahead: num },
      render: { max_pixel_ratio: num, antialias: bool },
      debug: { show_fps: bool, overlay: bool, start_progress: num },
    });
  });

  it('races the historical seven laps', () => {
    expect(DEFAULT_CONFIG.race.laps).toBe(7);
  });

  it('starts on the track, with a spina between the metae', () => {
    const track = trackSpec(DEFAULT_CONFIG);
    expect(DEFAULT_CONFIG.chariot.start_lane).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_CONFIG.chariot.start_lane).toBeLessThanOrEqual(track.width);
    expect(spinaHalfWidth(track)).toBeGreaterThan(0);
  });

  it('gives a race of about two minutes at cruising speed', () => {
    const { race, chariot } = DEFAULT_CONFIG;
    const seconds =
      (race.laps * lapLength(trackSpec(DEFAULT_CONFIG), chariot.start_lane)) / chariot.cruise_speed;
    expect(seconds).toBeGreaterThan(90);
    expect(seconds).toBeLessThan(150);
  });
});

describe('steering defaults', () => {
  it('can hold the innermost lane round a turn at cruising speed', () => {
    const { maxTurnRate } = steeringParams(DEFAULT_CONFIG);
    const needed = DEFAULT_CONFIG.chariot.cruise_speed / DEFAULT_CONFIG.track.inner_radius;
    expect(maxTurnRate).toBeGreaterThan(needed);
    // ...but only just, so the inside line is a real commitment.
    expect(maxTurnRate).toBeLessThan(needed * 1.5);
  });
});

describe('tilt defaults', () => {
  it('reaches full lock beyond the deadzone', () => {
    expect(DEFAULT_CONFIG.tilt.full_lock).toBeGreaterThan(DEFAULT_CONFIG.tilt.deadzone);
  });
});

describe('loadConfig', () => {
  it('applies URL overrides', () => {
    const { config, warnings } = loadConfig('?race.laps=2&debug.show_fps=true');
    expect(config.race.laps).toBe(2);
    expect(config.debug.show_fps).toBe(true);
    expect(warnings).toEqual([]);
  });
});
