import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { baseShade, shadeBase } from './stone';

describe('baseShade', () => {
  it('is darkest at the foot of a wall and full brightness higher up', () => {
    expect(baseShade(0)).toBeCloseTo(0.62);
    expect(baseShade(1.8)).toBe(1);
    expect(baseShade(5)).toBe(1);
  });

  it('brightens steadily with height', () => {
    expect(baseShade(0.5)).toBeGreaterThan(baseShade(0.2));
    expect(baseShade(1.2)).toBeGreaterThan(baseShade(0.5));
  });
});

describe('shadeBase', () => {
  it('shades each vertex by its height', () => {
    const geometry = new THREE.BoxGeometry(1, 4, 1);
    geometry.translate(0, 2, 0);
    shadeBase(geometry);
    const colour = geometry.getAttribute('color');
    const position = geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      expect(colour.getX(i)).toBeCloseTo(baseShade(position.getY(i)));
    }
  });
});
