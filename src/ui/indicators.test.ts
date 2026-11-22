import { describe, expect, it } from 'vitest';
import { indicatorFor } from './indicators';

describe('indicatorFor', () => {
  it('shows a rival right alongside strongly, on its side', () => {
    expect(indicatorFor({ along: 0, across: -3 })).toEqual({
      side: 'left',
      strength: 0.9,
      behind: 0,
    });
    expect(indicatorFor({ along: 1, across: 4 })?.side).toBe('right');
  });

  it('fades a rival further behind', () => {
    const near = indicatorFor({ along: -5, across: 2 })!;
    const far = indicatorFor({ along: -20, across: 2 })!;
    expect(far.strength).toBeLessThan(near.strength);
    expect(far.behind).toBeGreaterThan(near.behind);
  });

  it('shows nothing for a rival in view ahead', () => {
    expect(indicatorFor({ along: 10, across: 3 })).toBeNull();
    expect(indicatorFor({ along: 40, across: -1 })).toBeNull();
  });

  it('shows nothing for a rival far behind or a lap away', () => {
    expect(indicatorFor({ along: -35, across: 0 })).toBeNull();
    expect(indicatorFor({ along: -Infinity, across: 0 })).toBeNull();
    expect(indicatorFor({ along: Infinity, across: 0 })).toBeNull();
  });

  it('puts a rival directly behind on the side it is on', () => {
    expect(indicatorFor({ along: -8, across: 0.5 })?.side).toBe('right');
  });
});
