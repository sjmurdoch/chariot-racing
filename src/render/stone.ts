// Stone for the spina, the podium wall and the stands: squared blocks
// (ashlar) with mortar joints and slight colour variation, and darker
// shading towards the foot of each wall so it sits on the sand. Painted in
// code, so there's nothing to download, and shared by every stone surface.

import * as THREE from 'three';
import { seededRandom } from './arena';

/** Metres of wall one tile of the texture covers, across and up. */
export const TILE_METRES = 4;
const BLOCK_ROWS = 8;

let shared: THREE.CanvasTexture | undefined;

/**
 * The masonry texture. Extruded walls get texture coordinates in metres, so
 * the texture repeats every TILE_METRES.
 */
export function stoneTexture(renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  if (shared) return shared;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const random = seededRandom(5);

  // Mortar shows between the blocks.
  ctx.fillStyle = '#9d907b';
  ctx.fillRect(0, 0, size, size);
  const rowHeight = size / BLOCK_ROWS;
  for (let r = 0; r < BLOCK_ROWS; r++) {
    // Each course starts at a different offset, as in laid masonry; blocks
    // that run off the right edge wrap round to the left, so tiles join up.
    let x = -random() * 120;
    while (x < size) {
      const w = 80 + random() * 90;
      const shade = 0.9 + random() * 0.14;
      const tone = (n: number) => Math.round(Math.min(255, n * shade));
      ctx.fillStyle = `rgb(${tone(236)}, ${tone(227)}, ${tone(208)})`;
      for (const dx of [0, size]) {
        ctx.fillRect(x + dx + 2, r * rowHeight + 2, w - 4, rowHeight - 4);
      }
      x += w;
    }
  }
  // Weathering: fine speckles, darker and lighter.
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = random() < 0.5 ? 'rgba(90, 80, 65, 0.18)' : 'rgba(255, 250, 240, 0.16)';
    const s = 1 + random() * 2;
    ctx.fillRect(random() * size, random() * size, s, s);
  }

  shared = new THREE.CanvasTexture(canvas);
  shared.colorSpace = THREE.SRGBColorSpace;
  shared.wrapS = shared.wrapT = THREE.RepeatWrapping;
  shared.repeat.set(1 / TILE_METRES, 1 / TILE_METRES);
  shared.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return shared;
}

/**
 * How bright stone is at `height` metres above the sand: darker at the foot
 * of a wall, where little light reaches, full brightness from `fade` up.
 */
export function baseShade(height: number, darkest = 0.62, fade = 1.8): number {
  const t = Math.min(1, Math.max(0, height / fade));
  // Ease out, so the darkening hugs the ground.
  return darkest + (1 - darkest) * (1 - (1 - t) ** 2);
}

/** Bakes the darkening at the foot of the walls into a geometry's vertex colours. */
export function shadeBase(geometry: THREE.BufferGeometry, groundHeight = 0): THREE.BufferGeometry {
  const position = geometry.getAttribute('position');
  const colours = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const shade = baseShade(position.getY(i) - groundHeight);
    colours.set([shade, shade, shade], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geometry;
}

/** A material for stone surfaces in `colour`, textured and shaded at the base. */
export function stoneMaterial(renderer: THREE.WebGLRenderer, colour: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    color: colour,
    map: stoneTexture(renderer),
    vertexColors: true,
  });
}
