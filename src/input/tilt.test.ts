import { describe, expect, it } from 'vitest';
import { deviceUp, tiltSteer, wheelAngle, type TiltParams } from './tilt';

const params: TiltParams = { fullLock: 25, deadzone: 2, invert: false };

/**
 * Finds beta and gamma for a device whose "up" vector in device x/y is
 * (x, y), with the remainder along the screen normal. Inverts deviceUp.
 */
function orientationFor(x: number, y: number): { beta: number; gamma: number } {
  const beta = (Math.asin(y) * 180) / Math.PI;
  const cosBeta = Math.cos(Math.asin(y));
  const gamma = (Math.asin(-x / cosBeta) * 180) / Math.PI;
  return { beta, gamma };
}

/** A phone in landscape, leaned back by `lean` degrees, turned clockwise by `turn`. */
function landscape(screenAngle: 90 | -90, turn: number, lean = 30) {
  const inPlane = Math.cos((lean * Math.PI) / 180);
  const t = (turn * Math.PI) / 180;
  // Up as the player sees it on screen, then rotated back into device axes.
  const sx = -Math.sin(t) * inPlane;
  const sy = Math.cos(t) * inPlane;
  const a = (-screenAngle * Math.PI) / 180;
  const dx = sx * Math.cos(a) - sy * Math.sin(a);
  const dy = sx * Math.sin(a) + sy * Math.cos(a);
  return orientationFor(dx, dy);
}

describe('deviceUp', () => {
  it('points up the screen for an upright portrait phone', () => {
    const up = deviceUp(90, 0);
    expect(up.x).toBeCloseTo(0);
    expect(up.y).toBeCloseTo(1);
  });

  it('has no in-plane part when the phone lies flat', () => {
    const up = deviceUp(0, 0);
    expect(Math.hypot(up.x, up.y)).toBeCloseTo(0);
  });

  it('round-trips through the test helper', () => {
    const { beta, gamma } = orientationFor(0.5, 0.3);
    const up = deviceUp(beta, gamma);
    expect(up.x).toBeCloseTo(0.5);
    expect(up.y).toBeCloseTo(0.3);
  });
});

describe('wheelAngle', () => {
  for (const screenAngle of [90, -90] as const) {
    describe(`in landscape at ${screenAngle}°`, () => {
      it('reads zero when level', () => {
        const { beta, gamma } = landscape(screenAngle, 0);
        expect(wheelAngle(beta, gamma, screenAngle)).toBeCloseTo(0);
      });

      it('reads positive when turned clockwise and negative anticlockwise', () => {
        const right = landscape(screenAngle, 15);
        expect(wheelAngle(right.beta, right.gamma, screenAngle)).toBeCloseTo(15);
        const left = landscape(screenAngle, -15);
        expect(wheelAngle(left.beta, left.gamma, screenAngle)).toBeCloseTo(-15);
      });

      it('reads the same however far the phone is leaned back', () => {
        for (const lean of [0, 30, 60]) {
          const { beta, gamma } = landscape(screenAngle, 10, lean);
          expect(wheelAngle(beta, gamma, screenAngle)).toBeCloseTo(10);
        }
      });
    });
  }

  it('gives up when the phone is nearly flat', () => {
    const { beta, gamma } = landscape(90, 10, 85);
    expect(wheelAngle(beta, gamma, 90)).toBeNull();
  });
});

describe('tiltSteer', () => {
  it('ignores small angles inside the deadzone', () => {
    expect(tiltSteer(1.5, 0, params)).toBe(0);
    expect(tiltSteer(-1.5, 0, params)).toBe(-0);
  });

  it('reaches full lock at the configured angle', () => {
    expect(tiltSteer(25, 0, params)).toBe(1);
    expect(tiltSteer(-40, 0, params)).toBe(-1);
  });

  it('scales linearly between deadzone and full lock', () => {
    expect(tiltSteer(13.5, 0, params)).toBeCloseTo(0.5);
  });

  it('measures from the calibrated neutral', () => {
    expect(tiltSteer(15, 10, params)).toBeCloseTo(3 / 23);
  });

  it('wraps across ±180 degrees', () => {
    expect(tiltSteer(-175, 175, params)).toBeCloseTo(8 / 23);
  });

  it('can be inverted', () => {
    expect(tiltSteer(25, 0, { ...params, invert: true })).toBe(-1);
  });
});
