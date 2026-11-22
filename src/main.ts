import build from 'virtual:build-info';
import type { BuildInfo } from '../build/build-info';
import { loadConfig, type GameConfig } from './config';
import { valueAt } from './config/overrides';
import { createStage } from './scene';
import { createFixedClock } from './sim/clock';
import { advance, lapsCompleted } from './sim/track';
import { createFrameStats } from './ui/frame-stats';
import { createOverlay, describeGpu, type OverlaySnapshot } from './ui/overlay';

declare global {
  interface Window {
    /** Read-only hooks for end-to-end tests and debugging. */
    chariot?: {
      config: GameConfig;
      build: BuildInfo;
      frames: number;
      /** Track progress of the camera; see sim/track.ts. */
      progress: number;
      /** Draw calls in the last rendered frame. */
      drawCalls: number;
    };
  }
}

/** How often the overlay text refreshes, in milliseconds. */
const OVERLAY_REFRESH_MS = 250;

const { config, warnings, applied } = loadConfig(location.search);
for (const warning of warnings) console.warn(warning);
for (const { key, source } of applied) console.debug('config %s overridden from %s', key, source);

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const fps = document.querySelector<HTMLDivElement>('#fps')!;
fps.hidden = !config.debug.show_fps;

const stage = createStage(canvas, config);
const hooks = { config, build, frames: 0, progress: 0, drawCalls: 0 };
window.chariot = hooks;

stage.resize();
window.addEventListener('resize', stage.resize);

const overlay = createOverlay(document.querySelector<HTMLElement>('#overlay')!, config.debug.overlay);
const overrides = applied.map(({ key, source }) => ({
  key,
  value: String(valueAt(config, key)),
  source,
}));
let gpu: string | undefined;
let lastOverlayUpdate = -Infinity;

// Until steering arrives in milestone 3, the camera drives a fixed lane.
const lane = config.chariot.start_lane;
const speed = config.chariot.cruise_speed;
const clock = createFixedClock();
const stats = createFrameStats();
let previous = config.debug.start_progress;
let current = previous;
let lastTime: number | undefined;

function snapshot(): OverlaySnapshot {
  gpu ??= describeGpu(stage.renderer.getContext());
  const info = stage.renderer.info.render;
  return {
    build,
    fps: stats.fps,
    worstFrameMs: stats.worstFrameMs,
    drawCalls: info.calls,
    triangles: info.triangles,
    progress: hooks.progress,
    lap: lapsCompleted(hooks.progress),
    laps: config.race.laps,
    lane,
    speed,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    devicePixelRatio: window.devicePixelRatio,
    renderPixelRatio: stage.renderer.getPixelRatio(),
    gpu,
    extra: [],
    overrides,
  };
}

stage.renderer.setAnimationLoop((now) => {
  const elapsed = lastTime === undefined ? 0 : (now - lastTime) / 1000;
  lastTime = now;
  const steps = clock.tick(elapsed);
  for (let i = 0; i < steps; i++) {
    previous = current;
    current = advance(stage.track, current, lane, speed * clock.step);
  }

  hooks.progress = previous + (current - previous) * clock.alpha;
  stage.placeCamera(hooks.progress, lane);
  stage.render();
  hooks.drawCalls = stage.renderer.info.render.calls;
  hooks.frames += 1;
  if (hooks.frames === 1) document.documentElement.dataset.ready = 'true';

  stats.frame(now);
  if (config.debug.show_fps) {
    fps.textContent = `${Math.round(stats.fps)} fps · ${hooks.drawCalls} calls`;
  }
  if (overlay.visible && now - lastOverlayUpdate >= OVERLAY_REFRESH_MS) {
    overlay.update(snapshot());
    lastOverlayUpdate = now;
  }
});
