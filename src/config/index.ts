import defaults from '../../config/game.toml';
import type { TiltParams } from '../input/tilt';
import type { SteeringParams } from '../sim/chariot';
import type { TrackSpec } from '../sim/track';
import { applyOverrides, queryValues, type ConfigTree } from './overrides';

export interface GameConfig extends ConfigTree {
  race: { laps: number };
  track: {
    straight_length: number;
    inner_radius: number;
    width: number;
    spina_clearance: number;
  };
  chariot: { cruise_speed: number; start_lane: number };
  steering: {
    max_turn_rate: number;
    response: number;
    straighten_time: number;
    max_heading: number;
    ramp_up: number;
    ramp_down: number;
  };
  tilt: { full_lock: number; deadzone: number; invert: boolean };
  camera: { height: number; fov: number; lookahead: number };
  render: { max_pixel_ratio: number; antialias: boolean };
  debug: { show_fps: boolean; overlay: boolean; start_progress: number };
}

/** The settings from config/game.toml, with build-time environment overrides. */
export const DEFAULT_CONFIG = defaults as GameConfig;

/** Applies URL query parameter overrides (for example "?race.laps=3"). */
export function loadConfig(search: string) {
  return applyOverrides(DEFAULT_CONFIG, queryValues(search), 'URL');
}

/** The track geometry described by the config. */
export function trackSpec(config: GameConfig): TrackSpec {
  return {
    straightLength: config.track.straight_length,
    innerRadius: config.track.inner_radius,
    width: config.track.width,
    spinaClearance: config.track.spina_clearance,
  };
}

/** The steering response described by the config. */
export function steeringParams(config: GameConfig): SteeringParams {
  const degrees = Math.PI / 180;
  return {
    maxTurnRate: config.steering.max_turn_rate * degrees,
    response: config.steering.response,
    straightenTime: config.steering.straighten_time,
    maxHeading: config.steering.max_heading * degrees,
  };
}

/** The tilt steering described by the config. */
export function tiltParams(config: GameConfig): TiltParams {
  return {
    fullLock: config.tilt.full_lock,
    deadzone: config.tilt.deadzone,
    invert: config.tilt.invert,
  };
}
