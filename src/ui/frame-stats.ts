/** Measures frame rate over a sliding window of wall-clock time. */
export interface FrameStats {
  /** Records a frame rendered at `now` milliseconds. */
  frame(now: number): void;
  /** Frames per second over the last complete window, or 0 before the first one. */
  readonly fps: number;
  /** Longest gap between frames in the last complete window, in milliseconds. */
  readonly worstFrameMs: number;
}

export function createFrameStats(windowMs = 500): FrameStats {
  let windowStart: number | undefined;
  let last: number | undefined;
  let frames = 0;
  let worst = 0;
  let fps = 0;
  let worstFrameMs = 0;

  return {
    frame(now: number): void {
      if (windowStart === undefined || last === undefined) {
        windowStart = last = now;
        return;
      }
      frames += 1;
      worst = Math.max(worst, now - last);
      last = now;
      const span = now - windowStart;
      if (span >= windowMs) {
        fps = (frames * 1000) / span;
        worstFrameMs = worst;
        windowStart = now;
        frames = 0;
        worst = 0;
      }
    },
    get fps() {
      return fps;
    },
    get worstFrameMs() {
      return worstFrameMs;
    },
  };
}
