import { describe, expect, it } from 'vitest';
import { formatOverlay, type OverlaySnapshot } from './overlay';

const snapshot: OverlaySnapshot = {
  build: {
    commit: 'abc1234',
    commitFull: 'abc1234'.padEnd(40, '0'),
    ref: 'main',
    builtAt: '2026-11-22T12:34:56.789Z',
    builtBy: 'github-actions',
  },
  fps: 59.6,
  worstFrameMs: 18.25,
  drawCalls: 7,
  triangles: 1234,
  progress: 5.12345,
  lap: 1,
  laps: 7,
  lane: 6,
  speed: 22,
  viewport: { width: 844, height: 390 },
  devicePixelRatio: 3,
  renderPixelRatio: 2,
  gpu: 'Apple GPU (WebGL 2)',
  extra: [['input', 'keyboard']],
  overrides: [{ key: 'race.laps', value: '7', source: 'URL' }],
};

describe('formatOverlay', () => {
  const text = formatOverlay(snapshot);
  const lines = text.split('\n');

  it('starts with the commit', () => {
    expect(lines[0]).toBe('commit    abc1234');
  });

  it('aligns values in a column', () => {
    const columns = new Set(lines.map((line) => line.search(/ {2}\S/)));
    expect(columns.size).toBe(1);
  });

  it('shows build time without milliseconds', () => {
    expect(text).toContain('built     2026-11-22 12:34:56Z (github-actions)');
  });

  it('counts laps from one and converts speed', () => {
    expect(text).toContain('lap       2 of 7');
    expect(text).toContain('speed     22.0 m/s (79 km/h)');
  });

  it('includes extra rows and overrides', () => {
    expect(text).toContain('input     keyboard');
    expect(text).toContain('set       race.laps=7 (URL)');
  });

  it('does not run past the last lap after finishing', () => {
    expect(formatOverlay({ ...snapshot, lap: 7 })).toContain('lap       7 of 7');
  });
});
