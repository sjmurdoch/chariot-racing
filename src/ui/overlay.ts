// Debug overlay: a panel of facts about the running game (build, performance,
// race state, device) for playtesting and bug reports.
//
// Toggle it with the backtick key, a three-finger tap, or ?debug.overlay=1.

import type { BuildInfo } from '../../build/build-info';

export interface OverlaySnapshot {
  build: BuildInfo;
  fps: number;
  worstFrameMs: number;
  drawCalls: number;
  triangles: number;
  progress: number;
  lap: number;
  laps: number;
  lane: number;
  speed: number;
  viewport: { width: number; height: number };
  devicePixelRatio: number;
  renderPixelRatio: number;
  gpu: string;
  /** Extra name/value rows, such as the state of the input. */
  extra: [string, string][];
  /** Settings changed from the defaults, with their source. */
  overrides: { key: string; value: string; source: string }[];
}

const fixed = (n: number, digits: number) => n.toFixed(digits);

/** Lays out the snapshot as aligned "name  value" lines. */
export function formatOverlay(s: OverlaySnapshot): string {
  const rows: [string, string][] = [
    ['commit', s.build.commit],
    ['ref', s.build.ref || '-'],
    ['built', `${s.build.builtAt.replace('T', ' ').replace(/\.\d+Z$/, 'Z')} (${s.build.builtBy})`],
    ['fps', `${fixed(s.fps, 0)} (worst ${fixed(s.worstFrameMs, 1)} ms)`],
    ['draw', `${s.drawCalls} calls, ${s.triangles} tris`],
    ['lap', `${Math.min(s.lap + 1, s.laps)} of ${s.laps}`],
    ['progress', fixed(s.progress, 3)],
    ['lane', `${fixed(s.lane, 2)} m`],
    ['speed', `${fixed(s.speed, 1)} m/s (${fixed(s.speed * 3.6, 0)} km/h)`],
    ...s.extra,
    ['viewport', `${s.viewport.width}×${s.viewport.height}`],
    ['pixels', `dpr ${s.devicePixelRatio}, rendering at ${s.renderPixelRatio}`],
    ['gpu', s.gpu],
    ...s.overrides.map(({ key, value, source }): [string, string] => [
      'set',
      `${key}=${value} (${source})`,
    ]),
  ];
  const width = Math.max(...rows.map(([name]) => name.length));
  return rows.map(([name, value]) => `${name.padEnd(width)}  ${value}`).join('\n');
}

export interface Overlay {
  readonly visible: boolean;
  toggle(): void;
  update(snapshot: OverlaySnapshot): void;
}

/** Wires the overlay element to its toggles. */
export function createOverlay(element: HTMLElement, initiallyVisible: boolean): Overlay {
  let visible = initiallyVisible;
  const show = () => {
    element.hidden = !visible;
  };
  show();

  const overlay: Overlay = {
    get visible() {
      return visible;
    },
    toggle() {
      visible = !visible;
      show();
    },
    update(snapshot) {
      if (visible) element.textContent = formatOverlay(snapshot);
    },
  };

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Backquote' && !event.repeat) overlay.toggle();
  });
  window.addEventListener(
    'touchstart',
    (event) => {
      if (event.touches.length === 3) overlay.toggle();
    },
    { passive: true },
  );
  return overlay;
}

/** Names the GPU, as far as the browser will say. */
export function describeGpu(gl: WebGLRenderingContext | WebGL2RenderingContext): string {
  const version = gl instanceof WebGL2RenderingContext ? 'WebGL 2' : 'WebGL 1';
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = info
    ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
    : String(gl.getParameter(gl.RENDERER));
  return `${renderer} (${version})`;
}
