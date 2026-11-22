import { loadConfig, type GameConfig } from './config';
import { createStage } from './scene';

declare global {
  interface Window {
    /** Read-only hooks for end-to-end tests and debugging. */
    chariot?: { config: GameConfig; frames: number };
  }
}

const { config, warnings, applied } = loadConfig(location.search);
for (const warning of warnings) console.warn(warning);
for (const { key, source } of applied) console.debug('config %s overridden from %s', key, source);

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const fps = document.querySelector<HTMLDivElement>('#fps')!;
fps.hidden = !config.debug.show_fps;

const stage = createStage(canvas, config);
const hooks = { config, frames: 0 };
window.chariot = hooks;

stage.resize();
window.addEventListener('resize', stage.resize);

let fpsWindowStart = performance.now();
let fpsFrames = 0;

stage.renderer.setAnimationLoop((now) => {
  stage.render();
  hooks.frames += 1;
  if (hooks.frames === 1) document.documentElement.dataset.ready = 'true';

  if (config.debug.show_fps) {
    fpsFrames += 1;
    if (now - fpsWindowStart >= 500) {
      fps.textContent = `${Math.round((fpsFrames * 1000) / (now - fpsWindowStart))} fps`;
      fpsWindowStart = now;
      fpsFrames = 0;
    }
  }
});
