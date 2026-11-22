import defaults from '../../config/game.toml';
import type { TiltParams } from '../input/tilt';
import type { ChariotParams } from '../sim/chariot';
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
  chariot: { cruise_speed: number; start_lane: number; acceleration: number };
  crash: { speed: number; bounce_angle: number; clearance: number };
  steering: {
    max_turn_rate: number;
    response: number;
    max_heading: number;
    ramp_up: number;
    ramp_down: number;
  };
  tilt: { full_lock: number; deadzone: number; invert: boolean };
  camera: { height: number; fov: number; lookahead: number };
  display: { fullscreen: boolean };
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

/** The chariot's handling, speed and crash response described by the config. */
export function chariotParams(config: GameConfig): ChariotParams {
  const degrees = Math.PI / 180;
  return {
    maxTurnRate: config.steering.max_turn_rate * degrees,
    response: config.steering.response,
    maxHeading: config.steering.max_heading * degrees,
    cruiseSpeed: config.chariot.cruise_speed,
    acceleration: config.chariot.acceleration,
    crashSpeed: config.crash.speed,
    bounceAngle: config.crash.bounce_angle * degrees,
    crashClearance: config.crash.clearance,
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
