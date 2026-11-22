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
import * as THREE from 'three';
import { buildChariots, type ChariotModels } from './render/chariots';
import { buildGates } from './render/gates';
import { buildLapCounters } from './render/lap-counters';
import { buildWreckage } from './render/wreckage';
import { interpolateChariot, startChariot, type ChariotState } from './sim/chariot';
import { createFixedClock } from './sim/clock';
import { FACTIONS, isFactionId, rivalsFor, type FactionId } from './sim/factions';
import {
  browserStorage,
  DIFFICULTIES,
  initialChoices,
  isDifficulty,
  saveChoices,
  type Choices,
  type Difficulty,
} from './ui/choices';
import { createRacer, placeOf, standings, stepField, type Racer } from './sim/field';
import {
  currentLap,
  formatTime,
  ordinal,
  roman,
  startRace,
  startStagger,
  type RaceState,
} from './sim/race';
import { advance } from './sim/track';
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
import { recordTime } from './ui/records';
import { indicatorFor } from './ui/indicators';
import { createOverlay, describeGpu, type OverlaySnapshot } from './ui/overlay';

declare global {
  interface Window {
    /** Read-only hooks for end-to-end tests and debugging. */
    chariot?: {
      config: GameConfig;
      build: BuildInfo;
      frames: number;
      phase: 'menu' | 'gates' | 'racing';
      started: boolean;
      /** True while a touch device is held upright and the rotate prompt shows. */
      paused: boolean;
      /** The chariot as last rendered; see sim/chariot.ts. */
      state: ChariotState;
      /** The player's faction and difficulty, from the start screen. */
      choices: Choices;
      /** Laps, timing and finish; see sim/race.ts. */
      race: RaceState;
      lapsCounted: number;
      lastResult: { place: number; time: number; isBest: boolean } | null;
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
fps.hidden = !config.debug.show_fps;

const stage = createStage(canvas, config);
const chariot = chariotParams(config);
const keyboard = createKeyboardSteer(window);
const pointer = createPointerSteer(canvas);
const tilt = createTiltSteer(tiltParams(config));

// The player's choices: faction and difficulty, from the start screen. A
// setting given in the URL wins over what the player chose last time.
const storage = browserStorage();
const explicitly = (key: string) => applied.some((a) => a.key === key && a.source === 'URL');
let defaultFaction: FactionId = 'prasina';
if (isFactionId(config.race.faction)) {
  defaultFaction = config.race.faction;
} else {
  console.warn('Unknown faction "%s" in race.faction; racing for prasina', config.race.faction);
}
let defaultDifficulty: Difficulty = 'normal';
if (isDifficulty(config.rivals.difficulty)) {
  defaultDifficulty = config.rivals.difficulty;
} else {
  console.warn('Unknown difficulty "%s" in rivals.difficulty; using normal', config.rivals.difficulty);
}
let choices: Choices = initialChoices(
  { faction: defaultFaction, difficulty: defaultDifficulty },
  {
    ...(explicitly('race.faction') ? { faction: defaultFaction } : {}),
    ...(explicitly('rivals.difficulty') ? { difficulty: defaultDifficulty } : {}),
  },
  storage,
);

/**
 * A fresh field in the starting gates, from a standstill: the player first,
 * then the rivals. Outer chariots start a little further forward.
 */
function newField(): Racer[] {
  const start = config.debug.start_progress;
  const skill = config.rivals.skill * DIFFICULTIES[choices.difficulty].skill;
  const rivals = rivalsFor(choices.faction, config.rivals.count, skill);
  const insideLane = Math.min(config.chariot.start_lane, ...rivals.map((r) => r.startLane));
  const startAt = (lane: number) =>
    startChariot(advance(stage.track, start, lane, startStagger(lane, insideLane)), lane);
  return [
    createRacer(choices.faction, startAt(config.chariot.start_lane), chariot),
    ...rivals.map((r) =>
      createRacer(
        r.faction,
        startAt(r.startLane),
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

const factionHex = (faction: string) => FACTIONS[faction as FactionId].hex;
const gates = buildGates(stage.track, 4);
stage.scene.add(gates.group);
const lapCounters = buildLapCounters(stage.track);
stage.scene.add(lapCounters.group);
const wreckage = buildWreckage(stage.track);
stage.scene.add(wreckage.group);
const colourOfRacer = (i: number) => factionHex(current[i]?.faction ?? 'albata');

let previous: Racer[] = [];
let current: Racer[] = [];
let wrecks: Wreck[] = [];
let models: ChariotModels | undefined;
let markers: HTMLElement[] = [];

/** Builds the rivals' models and edge markers for the current field. */
function buildFieldView(): void {
  if (models) {
    stage.scene.remove(models.group);
    models.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        (object.material as THREE.Material).dispose();
      }
    });
  }
  models = buildChariots(stage.track, current.map((r) => factionHex(r.faction)));
  models.hide(0); // The player's own chariot is behind the camera.
  for (let i = 1; i < current.length; i++) models.place(i, current[i]!.chariot);
  stage.scene.add(models.group);

  // A marker at the screen edge for each rival beside or behind the player.
  for (const marker of markers) marker.remove();
  markers = current.slice(1).map((r) => {
    const marker = document.createElement('div');
    marker.className = 'edge-marker';
    marker.dataset.faction = r.faction;
    marker.style.color = `#${factionHex(r.faction).toString(16).padStart(6, '0')}`;
    marker.hidden = true;
    document.querySelector('#edge-markers')!.append(marker);
    return marker;
  });
}

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

type Phase = 'menu' | 'gates' | 'racing';
let phase: Phase = 'menu';
/** Seconds since the gates phase began, or since the mappa dropped. */
let sincePhase = 0;
const mappa = document.querySelector<HTMLElement>('#mappa')!;

const hooks = {
  config,
  build,
  frames: 0,
  /** menu: on the start screen; gates: waiting for the mappa; racing: under way. */
  phase: phase as Phase,
  started: false,
  paused: false,
  choices,
  state: startChariot(0, 0),
  race: startRace(),
  wrecks,
  /** Laps counted off by the eggs and dolphins on the spina (the leader's). */
  lapsCounted: -1,
  /** The player's last finish: place, time and whether it was a best. */
  lastResult: null as { place: number; time: number; isBest: boolean } | null,
  field: [] as { faction: string; progress: number; lane: number; place: number; crashes: number }[],
  input: { steer: 0, source: 'none' } as SteerReading,
  tilt,
  drawCalls: 0,
};
window.chariot = hooks;

/** Puts every chariot back on the start line, as the player has chosen. */
function resetField(): void {
  previous = current = newField();
  wrecks = startingWrecks();
  hooks.wrecks = wrecks;
  hooks.state = current[0]!.chariot;
  hooks.race = current[0]!.race;
  shownCrashes = 0;
  buildFieldView();
  gates.setStalls(current.map((r) => r.chariot));
  phase = 'menu';
  hooks.phase = phase;
  hooks.started = false;
  mappa.hidden = true;
}

/**
 * The start: the chariots wait in the starting gates while the magistrate
 * holds up the mappa; when he drops it, the gates fly open and the race is on.
 */
function enterGates(): void {
  phase = 'gates';
  hooks.phase = phase;
  sincePhase = 0;
  mappa.hidden = false;
  mappa.classList.remove('dropped');
  hud.hidden = false;
}

function dropMappa(): void {
  phase = 'racing';
  hooks.phase = phase;
  hooks.started = true;
  sincePhase = 0;
  mappa.classList.add('dropped');
}

stage.resize();
window.addEventListener('resize', stage.resize);

fitInstalledViewport();
document.querySelector<HTMLElement>('#install-hint')!.hidden = !isIPhone() || isInstalled();
watchOrientation(document.querySelector<HTMLElement>('#rotate')!, (paused) => {
  hooks.paused = paused;
});

const startScreen = document.querySelector<HTMLElement>('#start')!;
const factionButtons = [...startScreen.querySelectorAll<HTMLButtonElement>('[data-faction]')];
const difficultyButtons = [...startScreen.querySelectorAll<HTMLButtonElement>('[data-difficulty]')];

function showChoices(): void {
  for (const b of factionButtons) b.ariaChecked = String(b.dataset.faction === choices.faction);
  for (const b of difficultyButtons) {
    b.ariaChecked = String(b.dataset.difficulty === choices.difficulty);
  }
}

function choose(next: Partial<Choices>): void {
  choices = { ...choices, ...next };
  hooks.choices = choices;
  saveChoices(choices, storage);
  showChoices();
  resetField();
}
for (const b of factionButtons) {
  b.addEventListener('click', () => {
    if (b.dataset.faction && isFactionId(b.dataset.faction)) choose({ faction: b.dataset.faction });
  });
}
for (const b of difficultyButtons) {
  b.addEventListener('click', () => {
    if (b.dataset.difficulty && isDifficulty(b.dataset.difficulty)) {
      choose({ difficulty: b.dataset.difficulty });
    }
  });
}
showChoices();

let starting = false;

/**
 * Handles the Race button or Enter. The race itself begins only once the
 * player has answered the motion permission prompt (on iOS), so the chariot
 * doesn't set off while the prompt is still on screen.
 */
function start(): void {
  if (starting) return;
  starting = true;
  startScreen.classList.add('waiting');
  // Ask for motion access first and synchronously, inside the tap: iOS only
  // prompts in response to a user gesture.
  const tiltReady = tilt.enable();
  if (config.display.fullscreen) enterFullscreenLandscape();
  void tiltReady.then((status) => {
    console.debug('tilt steering %s', status);
    if (status === 'granted') tilt.calibrate();
    startScreen.hidden = true;
    startScreen.classList.remove('waiting');
    enterGates();
  });
}
document.querySelector('#race-button')!.addEventListener('click', start);
window.addEventListener('keydown', (event) => {
  const onChoice = (event.target as Element | null)?.closest?.('.choice');
  if (!startScreen.hidden && !starting && event.code === 'Enter' && !onChoice) {
    event.preventDefault();
    start();
  }
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
const palm = document.querySelector<SVGElement>('#palm')!;
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
  const time = hooks.race.finishTime ?? 0;
  // A palm branch for the victor, as given to winning charioteers.
  palm.toggleAttribute('hidden', !won);
  document.querySelector('#finish .title')!.textContent = won ? 'Victor!' : 'Finis';
  document.querySelector('#finish-time')!.textContent = formatTime(time);
  const placing = current.length > 1 ? `${ordinal(place)} of ${current.length} · ` : '';
  document.querySelector('#finish-detail')!.textContent =
    placing + (crashes === 0 ? 'No crashes' : crashes === 1 ? '1 crash' : `${crashes} crashes`);
  const record = recordTime(storage, laps, choices.difficulty, time);
  document.querySelector('#finish-best')!.textContent = record.isBest
    ? record.previous === null
      ? 'First time on the board'
      : 'New best time!'
    : `Best ${formatTime(record.previous!)}`;
  hooks.lastResult = { place, time, isBest: record.isBest };
  standingsShown = '';
  updateStandings();
  hud.hidden = true;
  finish.hidden = false;
}

let standingsShown = '';

/** Lists every chariot in race order; rivals still racing show their lap. */
function updateStandings(): void {
  const rows = standings(current).map((i, k) => {
    const r = current[i]!;
    const when =
      r.race.finishTime === null
        ? `lap ${roman(currentLap(r.race, laps))}`
        : formatTime(r.race.finishTime);
    return { i, place: k + 1, faction: r.faction, when };
  });
  const key = JSON.stringify(rows);
  if (key === standingsShown) return;
  standingsShown = key;
  const list = document.querySelector('#standings')!;
  list.replaceChildren(
    ...rows.map(({ i, place, faction, when }) => {
      const li = document.createElement('li');
      li.className = i === 0 ? 'player' : '';
      li.dataset.faction = faction;
      const cells = [
        ordinal(place),
        '',
        FACTIONS[faction as FactionId].name + (i === 0 ? ' (you)' : ''),
        when,
      ];
      const classes = ['place', 'swatch', 'name', 'when'];
      for (const [k, text] of cells.entries()) {
        const span = document.createElement('span');
        span.className = classes[k]!;
        if (classes[k] === 'swatch') span.dataset.faction = faction;
        span.textContent = text;
        li.append(span);
      }
      return li;
    }),
  );
}

/** Puts every chariot back on the start line for another race. */
function raceAgain(): void {
  resetField();
  finish.hidden = true;
  if (tilt.status === 'granted') tilt.calibrate();
  enterGates();
}
document.querySelector('#again')!.addEventListener('click', raceAgain);

/** Back to the start screen, to choose a faction or difficulty. */
function backToMenu(): void {
  resetField();
  finish.hidden = true;
  starting = false;
  startScreen.hidden = false;
}
document.querySelector('#menu')!.addEventListener('click', backToMenu);
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

// Everything is declared: put the field on the start line and begin drawing.
resetField();

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
  if (phase !== 'menu' && !hooks.paused) {
    sincePhase += clock.step * steps;
    if (phase === 'gates' && sincePhase >= config.race.gate_seconds) dropMappa();
  }
  if (phase === 'racing') {
    gates.open(sincePhase);
    // Once the field is well clear, the gates are no longer needed.
    if (sincePhase > 8) gates.group.visible = false;
  }
  if (phase === 'racing' && !hooks.paused) {
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
    models!.place(i, interpolateChariot(previous[i]!.chariot, current[i]!.chariot, clock.alpha));
  }
  updateMarkers();
  if (!finish.hidden) updateStandings();
  wreckage.update(wrecks, colourOfRacer);
  // The eggs and dolphins count the leader's laps.
  const leaderLaps = Math.max(...current.map((r) => r.race.lapsDone));
  if (leaderLaps !== hooks.lapsCounted) {
    hooks.lapsCounted = leaderLaps;
    lapCounters.show(leaderLaps, config.race.laps);
  }
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
