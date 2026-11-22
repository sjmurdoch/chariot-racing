import { loadConfig, type GameConfig } from './config';
import { createStage } from './scene';
import { createFixedClock } from './sim/clock';
import { advance } from './sim/track';

declare global {
  interface Window {
    /** Read-only hooks for end-to-end tests and debugging. */
    chariot?: {
      config: GameConfig;
      frames: number;
      /** Track progress of the camera; see sim/track.ts. */
      progress: number;
      /** Draw calls in the last rendered frame. */
      drawCalls: number;
    };
  }
}

const { config, warnings, applied } = loadConfig(location.search);
for (const warning of warnings) console.warn(warning);
for (const { key, source } of applied) console.debug('config %s overridden from %s', key, source);

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const fps = document.querySelector<HTMLDivElement>('#fps')!;
fps.hidden = !config.debug.show_fps;

const stage = createStage(canvas, config);
const hooks = { config, frames: 0, progress: 0, drawCalls: 0 };
window.chariot = hooks;

stage.resize();
window.addEventListener('resize', stage.resize);

// Until steering arrives in milestone 3, the camera drives a fixed lane.
const lane = config.chariot.start_lane;
const clock = createFixedClock();
let previous = config.debug.start_progress;
let current = previous;
let lastTime: number | undefined;

let fpsWindowStart = performance.now();
let fpsFrames = 0;

stage.renderer.setAnimationLoop((now) => {
  const elapsed = lastTime === undefined ? 0 : (now - lastTime) / 1000;
  lastTime = now;
  const steps = clock.tick(elapsed);
  for (let i = 0; i < steps; i++) {
    previous = current;
    current = advance(stage.track, current, lane, config.chariot.cruise_speed * clock.step);
  }

  hooks.progress = previous + (current - previous) * clock.alpha;
  stage.placeCamera(hooks.progress, lane);
  stage.render();
  hooks.drawCalls = stage.renderer.info.render.calls;
  hooks.frames += 1;
  if (hooks.frames === 1) document.documentElement.dataset.ready = 'true';

  if (config.debug.show_fps) {
    fpsFrames += 1;
    if (now - fpsWindowStart >= 500) {
      fps.textContent = `${Math.round((fpsFrames * 1000) / (now - fpsWindowStart))} fps · ${hooks.drawCalls} calls`;
      fpsWindowStart = now;
      fpsFrames = 0;
    }
  }
});
