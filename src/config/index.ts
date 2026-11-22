import defaults from '../../config/game.toml';
import { applyOverrides, queryValues, type ConfigTree } from './overrides';

export interface GameConfig extends ConfigTree {
  race: { laps: number };
  render: { max_pixel_ratio: number; antialias: boolean };
  debug: { show_fps: boolean };
}

/** The settings from config/game.toml, with build-time environment overrides. */
export const DEFAULT_CONFIG = defaults as GameConfig;

/** Applies URL query parameter overrides (for example "?race.laps=3"). */
export function loadConfig(search: string) {
  return applyOverrides(DEFAULT_CONFIG, queryValues(search), 'URL');
}
