import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadTomlConfig } from './toml-config';

const GAME_TOML = fileURLToPath(new URL('../config/game.toml', import.meta.url));

describe('loadTomlConfig', () => {
  it('reads defaults from the TOML file', () => {
    const { config, warnings } = loadTomlConfig(GAME_TOML, {});
    expect(config).toMatchObject({ race: { laps: 7 } });
    expect(warnings).toEqual([]);
  });

  it('applies CHARIOT_* environment overrides', () => {
    const { config, applied } = loadTomlConfig(GAME_TOML, {
      CHARIOT_RACE_LAPS: '3',
      CHARIOT_DEBUG_SHOW_FPS: 'yes',
    });
    expect(config).toMatchObject({ race: { laps: 3 }, debug: { show_fps: true } });
    expect(applied.map((a) => a.source)).toEqual(['environment', 'environment']);
  });

  it('warns about environment values of the wrong type', () => {
    const { warnings } = loadTomlConfig(GAME_TOML, { CHARIOT_RACE_LAPS: 'many' });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('race.laps');
  });
});
