import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, loadConfig } from './index';

describe('game.toml defaults', () => {
  it('has every setting with the expected type', () => {
    expect(DEFAULT_CONFIG).toEqual({
      race: { laps: expect.any(Number) },
      render: { max_pixel_ratio: expect.any(Number), antialias: expect.any(Boolean) },
      debug: { show_fps: expect.any(Boolean) },
    });
  });

  it('races the historical seven laps', () => {
    expect(DEFAULT_CONFIG.race.laps).toBe(7);
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
