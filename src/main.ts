import build from 'virtual:build-info';
import type { BuildInfo } from '../build/build-info';
import { loadConfig, chariotParams, tiltParams, type GameConfig } from './config';
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
import {
  currentLap,
  formatTime,
  roman,
  startRace,
  stepRace,
  type RaceState,
} from './sim/race';
import {
  displayMode,
  enterFullscreenLandscape,
  fitInstalledViewport,
  isInstalled,
  isIPhone,
  safeAreaInsets,
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
      /** Laps, timing and finish; see sim/race.ts. */
      race: RaceState;
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
const chariot = chariotParams(config);
const keyboard = createKeyboardSteer(window);
const pointer = createPointerSteer(canvas);
const tilt = createTiltSteer(tiltParams(config));

// The race starts from a standstill.
let previous = startChariot(config.debug.start_progress, config.chariot.start_lane);
let current = previous;

const hooks = {
  config,
  build,
  frames: 0,
  started: false,
  paused: false,
  state: current,
  race: startRace(),
  input: { steer: 0, source: 'none' } as SteerReading,
  tilt,
  drawCalls: 0,
};
window.chariot = hooks;

stage.resize();
window.addEventListener('resize', stage.resize);

fitInstalledViewport();
document.querySelector<HTMLElement>('#install-hint')!.hidden = !isIPhone() || isInstalled();
watchOrientation(document.querySelector<HTMLElement>('#rotate')!, (paused) => {
  hooks.paused = paused;
});

let starting = false;

/**
 * Handles the start tap or key press. The race itself begins only once the
 * player has answered the motion permission prompt (on iOS), so the chariot
 * doesn't set off while the prompt is still on screen.
 */
function start(): void {
  if (starting) return;
  starting = true;
  startButton.classList.add('waiting');
  // Ask for motion access first and synchronously, inside the tap: iOS only
  // prompts in response to a user gesture.
  const tiltReady = tilt.enable();
  if (config.display.fullscreen) enterFullscreenLandscape();
  void tiltReady.then((status) => {
    console.debug('tilt steering %s', status);
    if (status === 'granted') tilt.calibrate();
    hooks.started = true;
    startButton.hidden = true;
    hud.hidden = false;
  });
}
startButton.addEventListener('click', start);
window.addEventListener('keydown', (event) => {
  if (!starting && event.code !== 'Backquote') start();
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
let shownCrashes = 0;

const crashFlash = document.querySelector<HTMLElement>('#crash-flash')!;
const hud = document.querySelector<HTMLElement>('#hud')!;
const hudLap = document.querySelector<HTMLElement>('#hud-lap')!;
const hudTime = document.querySelector<HTMLElement>('#hud-time')!;
const finish = document.querySelector<HTMLElement>('#finish')!;
const laps = config.race.laps;
/** Once finished, the chariot pulls up rather than racing on. */
const pullingUp = { ...chariot, cruiseSpeed: 0 };

function updateHud(): void {
  const lap = `Lap ${roman(currentLap(hooks.race, laps))} of ${roman(laps)}`;
  const time = formatTime(hooks.race.elapsed);
  if (hudLap.textContent !== lap) hudLap.textContent = lap;
  if (hudTime.textContent !== time) hudTime.textContent = time;
}

function showFinish(): void {
  const crashes = current.crashes;
  document.querySelector('#finish-time')!.textContent = formatTime(hooks.race.finishTime ?? 0);
  document.querySelector('#finish-detail')!.textContent =
    crashes === 0 ? 'No crashes' : crashes === 1 ? '1 crash' : `${crashes} crashes`;
  hud.hidden = true;
  finish.hidden = false;
}

/** Puts the chariot back on the start line for another race. */
function raceAgain(): void {
  previous = current = startChariot(config.debug.start_progress, config.chariot.start_lane);
  hooks.race = startRace();
  shownCrashes = 0;
  finish.hidden = true;
  hud.hidden = false;
  if (tilt.status === 'granted') tilt.calibrate();
}
document.querySelector('#again')!.addEventListener('click', raceAgain);
window.addEventListener('keydown', (event) => {
  if (!finish.hidden && (event.code === 'Enter' || event.code === 'Space')) {
    event.preventDefault();
    raceAgain();
  }
});

/** Flashes the screen red, and buzzes phones that support it (not iPhones). */
function showCrash(): void {
  crashFlash.classList.remove('flash');
  void crashFlash.offsetWidth; // Restart the animation.
  crashFlash.classList.add('flash');
  navigator.vibrate?.(150);
}

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
    lap: hooks.race.lapsDone,
    laps: config.race.laps,
    lane: hooks.state.lane,
    speed: hooks.state.speed,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    devicePixelRatio: window.devicePixelRatio,
    renderPixelRatio: stage.renderer.getPixelRatio(),
    gpu,
    extra: [
      ['crashes', String(hooks.state.crashes)],
      ['input', `${hooks.input.source} ${hooks.input.steer.toFixed(2)}`],
      ['tilt', describeTilt()],
      ['canvas', `${canvas.clientWidth}×${canvas.clientHeight}`],
      ['screen', `${screen.width}×${screen.height}`],
      ['insets', safeAreaInsets().join(' ')],
      ['mode', displayMode()],
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
      const racing = hooks.race.phase === 'racing';
      previous = current;
      current = stepChariot(
        current,
        racing ? hooks.input.steer : 0,
        clock.step,
        stage.track,
        racing ? chariot : pullingUp,
      );
      hooks.race = stepRace(hooks.race, previous.progress, current.progress, clock.step, laps);
      if (racing && hooks.race.phase === 'finished') showFinish();
    }
  } else {
    // Hold still: with nothing advancing, don't blend between old steps.
    previous = current;
  }

  if (current.crashes !== shownCrashes) {
    shownCrashes = current.crashes;
    showCrash();
  }

  hooks.state = interpolateChariot(previous, current, clock.alpha);
  if (!hud.hidden) updateHud();
  stage.placeCamera(hooks.state);
  stage.resize();
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
