// Steering input from the keyboard and from holding either half of the screen.
// Each source yields a steer value from -1 (left) to +1 (right), or null when
// the player isn't using it.

export type SteerSource = 'keyboard' | 'touch' | 'tilt';

export interface SteerReading {
  steer: number;
  source: SteerSource | 'none';
}

const LEFT_KEYS = new Set(['ArrowLeft', 'KeyA']);
const RIGHT_KEYS = new Set(['ArrowRight', 'KeyD']);

/** Steering from the set of held key codes, or null if no steering key is held. */
export function keysSteer(held: ReadonlySet<string>): number | null {
  let left = false;
  let right = false;
  for (const code of held) {
    if (LEFT_KEYS.has(code)) left = true;
    if (RIGHT_KEYS.has(code)) right = true;
  }
  if (!left && !right) return null;
  return (right ? 1 : 0) - (left ? 1 : 0);
}

/**
 * Steering from the x positions of held pointers: the left half steers left
 * and the right half steers right. Null if nothing is held.
 */
export function halvesSteer(xs: readonly number[], width: number): number | null {
  if (xs.length === 0) return null;
  let total = 0;
  for (const x of xs) total += x < width / 2 ? -1 : 1;
  return Math.max(-1, Math.min(1, total));
}

/** Picks the first active source, in priority order keyboard, touch, tilt. */
export function chooseSteer(readings: Partial<Record<SteerSource, number | null>>): SteerReading {
  for (const source of ['keyboard', 'touch', 'tilt'] as const) {
    const steer = readings[source];
    if (steer !== null && steer !== undefined) return { steer, source };
  }
  return { steer: 0, source: 'none' };
}

/**
 * Eases an on/off input (a key, a held screen half) towards its target, so
 * holding it builds steering up over `riseTime` seconds instead of jumping
 * straight to full lock. Letting go or reversing takes only `fallTime`.
 */
export function rampSteer(
  current: number,
  target: number,
  dt: number,
  riseTime: number,
  fallTime: number,
): number {
  const easing = Math.abs(target) < Math.abs(current) || target * current < 0;
  const rate = dt / (easing ? fallTime : riseTime);
  if (Math.abs(target - current) <= rate) return target;
  const next = current + Math.sign(target - current) * rate;
  // When easing off, stop exactly at the centre rather than overshooting it,
  // so building up the other way starts cleanly at the rise rate.
  if (easing && (next * current <= 0 || Math.abs(next) < 1e-9)) return 0;
  return next;
}

export function isSteeringKey(code: string): boolean {
  return LEFT_KEYS.has(code) || RIGHT_KEYS.has(code);
}

/** Tracks held steering keys. */
export function createKeyboardSteer(target: Window) {
  const held = new Set<string>();
  target.addEventListener('keydown', (event) => {
    if (isSteeringKey(event.code)) {
      held.add(event.code);
      event.preventDefault();
    }
  });
  target.addEventListener('keyup', (event) => held.delete(event.code));
  // Keys released while the page is in the background never send keyup.
  target.addEventListener('blur', () => held.clear());
  return { read: () => keysSteer(held) };
}

/** Tracks pointers (fingers, mouse, pen) held down on an element. */
export function createPointerSteer(element: HTMLElement) {
  const pointers = new Map<number, number>();
  const track = (event: PointerEvent) => {
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, event.clientX);
  };
  const release = (event: PointerEvent) => pointers.delete(event.pointerId);

  element.addEventListener('pointerdown', (event) => {
    pointers.set(event.pointerId, event.clientX);
    element.setPointerCapture?.(event.pointerId);
  });
  element.addEventListener('pointermove', track);
  element.addEventListener('pointerup', release);
  element.addEventListener('pointercancel', release);
  element.addEventListener('lostpointercapture', release);
  return {
    read: () => halvesSteer([...pointers.values()], element.clientWidth),
  };
}
