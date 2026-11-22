import { describe, expect, it } from 'vitest';
import { createFrameStats } from './frame-stats';

describe('createFrameStats', () => {
  it('reports zero until a window completes', () => {
    const stats = createFrameStats(500);
    stats.frame(0);
    stats.frame(16);
    expect(stats.fps).toBe(0);
  });

  it('measures a steady 60 fps', () => {
    const stats = createFrameStats(500);
    for (let i = 0; i <= 40; i++) stats.frame((i * 1000) / 60);
    expect(stats.fps).toBeCloseTo(60, 0);
    expect(stats.worstFrameMs).toBeCloseTo(1000 / 60);
  });

  it('records the worst frame in the window', () => {
    const stats = createFrameStats(500);
    const times = [0, 16, 32, 132, 148, 300, 520];
    for (const t of times) stats.frame(t);
    // Gaps are 16, 16, 100, 16, 152 and 220 ms.
    expect(stats.worstFrameMs).toBe(220);
  });
});
