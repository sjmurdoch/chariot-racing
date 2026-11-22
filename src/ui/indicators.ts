// Edge indicators: in the driver's view, rivals beside or behind the player
// are out of sight, so a marker in the rival's colour shows at the edge of
// the screen on that side, stronger the closer the rival is.

import type { Separation } from '../sim/pack';

/** Rivals further behind than this, in metres, aren't shown. */
const REACH = 30;
/**
 * Rivals within this angle of straight ahead are on screen and need no
 * marker: tan(50°), a little inside the edge of the default view.
 */
const IN_VIEW = Math.tan((50 * Math.PI) / 180);

export interface Indicator {
  side: 'left' | 'right';
  /** 1 when right alongside, fading to 0 at the edge of reach. */
  strength: number;
  /** 0 when alongside, rising to 1 when far behind; for placing the marker. */
  behind: number;
}

/** The marker for a rival at `gap` from the player, or null if none is needed. */
export function indicatorFor(gap: Separation): Indicator | null {
  if (!Number.isFinite(gap.along) || gap.along < -REACH) return null;
  // Ahead and within the view: the player can see it.
  if (gap.along > 0 && Math.abs(gap.across) < gap.along * IN_VIEW) return null;
  const distance = Math.hypot(gap.along, gap.across);
  return {
    side: gap.across < 0 ? 'left' : 'right',
    strength: Math.max(0, Math.min(1, 1 - distance / REACH)),
    behind: Math.max(0, Math.min(1, -gap.along / REACH)),
  };
}
