import build from 'virtual:build-info';
import type { BuildInfo } from '../build/build-info';
import { loadConfig, steeringParams, tiltParams, type GameConfig } from './config';
import { valueAt } from './config/overrides';
import {
  chooseSteer,
  createKeyboardSteer,
  createPointerSteer,
  rampSteer,
  type SteerReading,
} from './input/steering';
import { createTiltSteer, type TiltSteer } from './input/tilt';
import { createStage } from './scene';
import { interpolateChariot, startChariot, stepChariot, type ChariotState } from './sim/chariot';
import { createFixedClock } from './sim/clock';
import { lapsCompleted } from './sim/track';
import {
  enterFullscreenLandscape,
  isInstalled,
  isIPhone,
  watchOrientation,
} from './ui/display';
import { createFrameStats } from './ui/frame-stats';
import { createOverlay, describeGpu, type OverlaySnapshot } from './ui/overlay';

declare global {
  interface Window {
    /** Read-only hooks for end-to-end tests and debugging. */
    chariot?: {
      config: GameConfig;
      build: BuildInfo;
      frames: number;
      started: boolean;
      /** True while a touch device is held upright and the rotate prompt shows. */
      paused: boolean;
      /** The chariot as last rendered; see sim/chariot.ts. */
      state: ChariotState;
      input: SteerReading;
      tilt: Pick<TiltSteer, 'status' | 'angle' | 'neutral'>;
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
const startButton = document.querySelector<HTMLButtonElement>('#start')!;
fps.hidden = !config.debug.show_fps;

const stage = createStage(canvas, config);
const steering = steeringParams(config);
const keyboard = createKeyboardSteer(window);
const pointer = createPointerSteer(canvas);
const tilt = createTiltSteer(tiltParams(config));

let previous = startChariot(
  config.debug.start_progress,
  config.chariot.start_lane,
  config.chariot.cruise_speed,
);
let current = previous;

const hooks = {
  config,
  build,
  frames: 0,
  started: false,
  paused: false,
  state: current,
  input: { steer: 0, source: 'none' } as SteerReading,
  tilt,
  drawCalls: 0,
};
window.chariot = hooks;

stage.resize();
window.addEventListener('resize', stage.resize);

document.querySelector<HTMLElement>('#install-hint')!.hidden = !isIPhone() || isInstalled();
watchOrientation(document.querySelector<HTMLElement>('#rotate')!, (paused) => {
  hooks.paused = paused;
});

function start(): void {
  if (hooks.started) return;
  hooks.started = true;
  startButton.hidden = true;
  if (config.display.fullscreen) enterFullscreenLandscape();
  // Must run inside the tap: iOS only prompts for motion access then.
  void tilt.enable().then((status) => {
    console.debug('tilt steering %s', status);
    if (status === 'granted') tilt.calibrate();
  });
}
startButton.addEventListener('click', start);
window.addEventListener('keydown', (event) => {
  if (!hooks.started && event.code !== 'Backquote') start();
});

const overlay = createOverlay(document.querySelector<HTMLElement>('#overlay')!, config.debug.overlay);
const overrides = applied.map(({ key, source }) => ({
  key,
  value: String(valueAt(config, key)),
  source,
}));
let gpu: string | undefined;
let lastOverlayUpdate = -Infinity;

const clock = createFixedClock();
const stats = createFrameStats();
let lastTime: number | undefined;
let rampedSteer = 0;

function describeTilt(): string {
  const angle = tilt.angle === null ? '-' : `${tilt.angle.toFixed(1)}°`;
  const neutral = tilt.neutral === null ? '-' : `${tilt.neutral.toFixed(1)}°`;
  return `${tilt.status}, angle ${angle}, neutral ${neutral}`;
}

function snapshot(): OverlaySnapshot {
  gpu ??= describeGpu(stage.renderer.getContext());
  const info = stage.renderer.info.render;
  return {
    build,
    fps: stats.fps,
    worstFrameMs: stats.worstFrameMs,
    drawCalls: info.calls,
    triangles: info.triangles,
    progress: hooks.state.progress,
    lap: lapsCompleted(hooks.state.progress),
    laps: config.race.laps,
    lane: hooks.state.lane,
    speed: hooks.started ? hooks.state.speed : 0,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    devicePixelRatio: window.devicePixelRatio,
    renderPixelRatio: stage.renderer.getPixelRatio(),
    gpu,
    extra: [
      ['input', `${hooks.input.source} ${hooks.input.steer.toFixed(2)}`],
      ['tilt', describeTilt()],
    ],
    overrides,
  };
}

stage.renderer.setAnimationLoop((now) => {
  const elapsed = lastTime === undefined ? 0 : (now - lastTime) / 1000;
  lastTime = now;
  const steps = clock.tick(elapsed);

  const raw = chooseSteer({
    keyboard: keyboard.read(),
    touch: pointer.read(),
    tilt: tilt.read(),
  });
  // Keys and screen halves are on/off, so ease them in; tilt is proportional.
  const digital = raw.source === 'keyboard' || raw.source === 'touch';
  rampedSteer = rampSteer(
    rampedSteer,
    digital ? raw.steer : 0,
    Math.min(elapsed, 0.1),
    config.steering.ramp_up,
    config.steering.ramp_down,
  );
  hooks.input = digital ? { steer: rampedSteer, source: raw.source } : raw;
  if (hooks.started && !hooks.paused) {
    for (let i = 0; i < steps; i++) {
      previous = current;
      current = stepChariot(current, hooks.input.steer, clock.step, stage.track, steering);
    }
  } else {
    // Hold still: with nothing advancing, don't blend between old steps.
    previous = current;
  }

  hooks.state = interpolateChariot(previous, current, clock.alpha);
  stage.placeCamera(hooks.state);
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
