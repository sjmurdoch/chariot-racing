// Tilt steering: the phone, held in landscape, is turned like a steering
// wheel. The wheel angle comes from the direction of gravity in the plane of
// the screen, so it works whether the phone is held upright or leaned back.

export interface TiltParams {
  /** Wheel angle, in degrees, that gives full steering lock. */
  fullLock: number;
  /** Wheel angles smaller than this, in degrees, count as straight ahead. */
  deadzone: number;
  /** Reverse the steering direction. */
  invert: boolean;
}

const RAD = Math.PI / 180;
/**
 * Below this, gravity lies mostly across the screen's normal (the phone is
 * nearly flat) and the wheel angle is too noisy to steer with.
 */
const MIN_IN_PLANE_GRAVITY = 0.25;

/**
 * World "up" in device coordinates (x right, y up in the natural portrait
 * orientation), from DeviceOrientationEvent beta and gamma in degrees.
 * Derived from the W3C rotation order Z(alpha)·X(beta)·Y(gamma).
 */
export function deviceUp(beta: number, gamma: number): { x: number; y: number } {
  return { x: -Math.sin(gamma * RAD) * Math.cos(beta * RAD), y: Math.sin(beta * RAD) };
}

/**
 * Wheel angle in degrees, positive when the phone is turned clockwise as the
 * player sees it, or null if the phone is too flat to tell.
 *
 * `screenAngle` is how far the device is turned anticlockwise from its
 * natural orientation, as in window.orientation (90 is landscape with the top
 * of the phone to the left).
 */
export function wheelAngle(beta: number, gamma: number, screenAngle: number): number | null {
  const up = deviceUp(beta, gamma);
  const t = screenAngle * RAD;
  const x = up.x * Math.cos(t) - up.y * Math.sin(t);
  const y = up.x * Math.sin(t) + up.y * Math.cos(t);
  if (Math.hypot(x, y) < MIN_IN_PLANE_GRAVITY) return null;
  return Math.atan2(-x, y) / RAD;
}

/** Converts a wheel angle relative to the calibrated neutral into steering. */
export function tiltSteer(angle: number, neutral: number, params: TiltParams): number {
  // Wrap the difference into -180..180 so crossing ±180 doesn't flip lock.
  const delta = ((((angle - neutral + 180) % 360) + 360) % 360) - 180;
  const magnitude = Math.max(0, Math.abs(delta) - params.deadzone);
  const steer = Math.min(1, magnitude / (params.fullLock - params.deadzone)) * Math.sign(delta);
  return params.invert ? -steer : steer;
}

/** The screen's rotation from natural, anticlockwise, in degrees. */
export function currentScreenAngle(): number {
  // iOS documents window.orientation (90 = turned anticlockwise); it is
  // deprecated elsewhere, so fall back to the Screen Orientation API.
  const legacy = (window as { orientation?: unknown }).orientation;
  if (typeof legacy === 'number') return legacy;
  return screen.orientation?.angle ?? 0;
}

export type TiltStatus = 'off' | 'granted' | 'denied' | 'unavailable';

type PermissionRequester = () => Promise<'granted' | 'denied'>;

export interface TiltSteer {
  readonly status: TiltStatus;
  /** Latest wheel angle in degrees, or null before a usable reading. */
  readonly angle: number | null;
  /** Wheel angle treated as straight ahead. */
  readonly neutral: number | null;
  /**
   * Asks for motion access. Call from inside a tap or click handler: iOS
   * only shows its permission prompt in response to a user gesture.
   */
  enable(): Promise<TiltStatus>;
  /** Treats the current wheel angle as straight ahead. */
  calibrate(): void;
  /** Steering from -1 to 1, or null when tilt isn't usable. */
  read(): number | null;
}

/** Smoothing applied to each new sensor reading (0 = none, near 1 = heavy). */
const SMOOTHING = 0.35;

export function createTiltSteer(params: TiltParams): TiltSteer {
  let status: TiltStatus = 'off';
  let angle: number | null = null;
  let neutral: number | null = null;
  let calibratePending = false;

  const onOrientation = (event: DeviceOrientationEvent) => {
    if (event.beta === null || event.gamma === null) return;
    const raw = wheelAngle(event.beta, event.gamma, currentScreenAngle());
    if (raw === null) {
      angle = null;
      return;
    }
    // Smooth along the shortest way round, so ±180 doesn't jump.
    if (angle === null) {
      angle = raw;
    } else {
      const delta = ((((raw - angle + 180) % 360) + 360) % 360) - 180;
      angle += delta * (1 - SMOOTHING);
    }
    if (calibratePending || neutral === null) {
      neutral = angle;
      calibratePending = false;
    }
  };

  return {
    get status() {
      return status;
    },
    get angle() {
      return angle;
    },
    get neutral() {
      return neutral;
    },
    async enable() {
      if (status === 'granted') return status;
      if (typeof DeviceOrientationEvent === 'undefined') {
        status = 'unavailable';
        return status;
      }
      const request = (DeviceOrientationEvent as unknown as { requestPermission?: PermissionRequester })
        .requestPermission;
      if (typeof request === 'function') {
        try {
          // Called before any await, so it stays inside the user gesture.
          if ((await request.call(DeviceOrientationEvent)) !== 'granted') {
            status = 'denied';
            return status;
          }
        } catch {
          status = 'denied';
          return status;
        }
      }
      window.addEventListener('deviceorientation', onOrientation);
      status = 'granted';
      return status;
    },
    calibrate() {
      if (angle === null) {
        calibratePending = true;
      } else {
        neutral = angle;
      }
    },
    read() {
      if (status !== 'granted' || angle === null || neutral === null) return null;
      return tiltSteer(angle, neutral, params);
    },
  };
}
