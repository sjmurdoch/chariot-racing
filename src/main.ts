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
import { buildChariots } from './render/chariots';
import { buildWreckage } from './render/wreckage';
import { interpolateChariot, startChariot, type ChariotState } from './sim/chariot';
import { createFixedClock } from './sim/clock';
import { FACTIONS, isFactionId, rivalsFor, type FactionId } from './sim/factions';
import { createRacer, placeOf, stepField, type Racer } from './sim/field';
import { currentLap, formatTime, ordinal, roman, type RaceState } from './sim/race';
import { separation } from './sim/pack';
import { createBrain } from './sim/rival';
import type { Wreck } from './sim/wreckage';
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
import { indicatorFor } from './ui/indicators';
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
      /** Wreckage on the track; see sim/wreckage.ts. */
      wrecks: Wreck[];
      /** Every chariot, the player first, with its place in the race. */
      field: { faction: string; progress: number; lane: number; place: number; crashes: number }[];
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

let playerFaction: FactionId = 'prasina';
if (isFactionId(config.race.faction)) {
  playerFaction = config.race.faction;
} else {
  console.warn('Unknown faction "%s" in race.faction; racing for prasina', config.race.faction);
}

/** A fresh field on the start line, from a standstill: the player first, then the rivals. */
function newField(): Racer[] {
  const start = config.debug.start_progress;
  const rivals = rivalsFor(playerFaction, config.rivals.count, config.rivals.skill);
  return [
    createRacer(playerFaction, startChariot(start, config.chariot.start_lane), chariot),
    ...rivals.map((r) =>
      createRacer(
        r.faction,
        startChariot(start, r.startLane),
        { ...chariot, cruiseSpeed: chariot.cruiseSpeed * r.personality.skill },
        createBrain(r.personality),
      ),
    ),
  ];
}

const fieldSetup = {
  track: stage.track,
  laps: config.race.laps,
  slipstreamBoost: config.rivals.slipstream_boost,
  wreckage: { lifetime: config.wreckage.lifetime, minSpeed: config.wreckage.min_speed },
};
/** Wreckage on the track at the start: none, unless placed for testing. */
function startingWrecks(): Wreck[] {
  const at = config.debug.wreck_at;
  return at >= 0 ? [{ progress: at, lane: 0, owner: -1, age: 0 }] : [];
}

let previous = newField();
let current = previous;
let wrecks: Wreck[] = startingWrecks();
const models = buildChariots(
  stage.track,
  current.map((r) => FACTIONS[r.faction as FactionId].hex),
);
models.hide(0); // The player's own chariot is behind the camera.
stage.scene.add(models.group);
const wreckage = buildWreckage(stage.track);
stage.scene.add(wreckage.group);
const colourOfRacer = (i: number) => FACTIONS[(current[i]?.faction ?? 'albata') as FactionId].hex;

// A marker at the screen edge for each rival beside or behind the player.
const markers = current.slice(1).map((r) => {
  const marker = document.createElement('div');
  marker.className = 'edge-marker';
  marker.dataset.faction = r.faction;
  marker.style.color = `#${FACTIONS[r.faction as FactionId].hex.toString(16).padStart(6, '0')}`;
  marker.hidden = true;
  document.querySelector('#edge-markers')!.append(marker);
  return marker;
});

function updateMarkers(): void {
  const player = current[0]!.chariot;
  markers.forEach((marker, k) => {
    const show = hooks.started && current[0]!.race.phase === 'racing';
    const mark = show ? indicatorFor(separation(stage.track, player, current[k + 1]!.chariot)) : null;
    marker.hidden = mark === null;
    if (!mark) return;
    marker.dataset.side = mark.side;
    marker.style.opacity = (0.25 + 0.75 * mark.strength).toFixed(2);
    marker.style.top = `${(40 + 35 * mark.behind).toFixed(1)}%`;
  });
}

const hooks = {
  config,
  build,
  frames: 0,
  started: false,
  paused: false,
  state: current[0]!.chariot,
  race: current[0]!.race,
  wrecks,
  field: [] as { faction: string; progress: number; lane: number; place: number; crashes: number }[],
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
const hudPlace = document.querySelector<HTMLElement>('#hud-place')!;
const finish = document.querySelector<HTMLElement>('#finish')!;
const laps = config.race.laps;

function updateHud(): void {
  const lap = `Lap ${roman(currentLap(hooks.race, laps))} of ${roman(laps)}`;
  const place = current.length > 1 ? ordinal(placeOf(current, 0)) : '';
  const time = formatTime(hooks.race.elapsed);
  if (hudLap.textContent !== lap) hudLap.textContent = lap;
  if (hudPlace.textContent !== place) hudPlace.textContent = place;
  if (hudTime.textContent !== time) hudTime.textContent = time;
}

function showFinish(): void {
  const crashes = current[0]!.chariot.crashes;
  const place = placeOf(current, 0);
  const won = place === 1 && current.length > 1;
  document.querySelector('#finish .title')!.textContent = won ? 'Victor!' : 'Finis';
  document.querySelector('#finish-time')!.textContent = formatTime(hooks.race.finishTime ?? 0);
  const placing = current.length > 1 ? `${ordinal(place)} of ${current.length} · ` : '';
  document.querySelector('#finish-detail')!.textContent =
    placing + (crashes === 0 ? 'No crashes' : crashes === 1 ? '1 crash' : `${crashes} crashes`);
  hud.hidden = true;
  finish.hidden = false;
}

/** Puts every chariot back on the start line for another race. */
function raceAgain(): void {
  previous = current = newField();
  wrecks = startingWrecks();
  hooks.wrecks = wrecks;
  hooks.race = current[0]!.race;
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
      const racing = current[0]!.race.phase === 'racing';
      previous = current;
      const next = stepField({ racers: current, wrecks }, hooks.input.steer, clock.step, fieldSetup);
      current = next.racers;
      wrecks = next.wrecks;
      hooks.wrecks = wrecks;
      hooks.race = current[0]!.race;
      if (racing && hooks.race.phase === 'finished') showFinish();
    }
  } else {
    // Hold still: with nothing advancing, don't blend between old steps.
    previous = current;
  }

  const player = current[0]!.chariot;
  if (player.crashes !== shownCrashes) {
    shownCrashes = player.crashes;
    showCrash();
  }

  hooks.state = interpolateChariot(previous[0]!.chariot, player, clock.alpha);
  for (let i = 1; i < current.length; i++) {
    models.place(i, interpolateChariot(previous[i]!.chariot, current[i]!.chariot, clock.alpha));
  }
  updateMarkers();
  wreckage.update(wrecks, colourOfRacer);
  hooks.field = current.map((r, i) => ({
    faction: r.faction,
    progress: r.chariot.progress,
    lane: r.chariot.lane,
    place: placeOf(current, i),
    crashes: r.chariot.crashes,
  }));
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
