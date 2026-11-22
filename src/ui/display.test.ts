import { describe, expect, it } from 'vitest';
import { isIPhone, screenHeightFor } from './display';

describe('isIPhone', () => {
  it('recognises iPhone Safari', () => {
    expect(
      isIPhone(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toBe(true);
  });

  it('does not match iPad, Android or desktop', () => {
    expect(isIPhone('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15')).toBe(false);
    expect(isIPhone('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140')).toBe(false);
    expect(isIPhone('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15')).toBe(false);
  });
});

describe('screenHeightFor', () => {
  it('uses the short side in landscape and the long side in portrait', () => {
    expect(screenHeightFor(390, 844, true)).toBe(390);
    expect(screenHeightFor(390, 844, false)).toBe(844);
    expect(screenHeightFor(844, 390, false)).toBe(844);
  });
});
