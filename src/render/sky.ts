// The sky and the hills of Rome around the circus. A dome shades from deep
// blue overhead to a pale haze at the horizon (matching the fog), and a band
// painted with the skyline stands beyond the stands: the Palatine to the
// north-east, crowned by the imperial palace, and the Aventine to the
// south-west, as they flank the real Circus Maximus. The hills are drawn
// taller and closer than life so they show above the stands from the
// driver's eye.
//
// In the game's layout the circus runs west (the starting gates) to east, so
// the Palatine lies on the -Z side and the Aventine on the +Z side.

import * as THREE from 'three';
import { seededRandom } from './arena';

/** The haze at the horizon; the fog uses the same colour so distance fades into it. */
export const HORIZON = 0xc8d6df;
const ZENITH = 0x4f86c0;

const DOME_RADIUS = 800;
const SKYLINE_RADIUS = 260;
const SKYLINE_HEIGHT = 150;

export interface Sky {
  group: THREE.Group;
}

export function buildSky(): Sky {
  const group = new THREE.Group();
  group.name = 'sky';
  group.add(dome(), skyline());
  return { group };
}

/** A dome shaded by height, from haze at the horizon to blue overhead. */
function dome(): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(DOME_RADIUS, 32, 16);
  const horizon = new THREE.Color(HORIZON);
  const zenith = new THREE.Color(ZENITH);
  const colours: number[] = [];
  const position = geometry.getAttribute('position');
  const c = new THREE.Color();
  for (let i = 0; i < position.count; i++) {
    const height = Math.max(0, position.getY(i) / DOME_RADIUS);
    // Most of the change happens low in the sky, as in a real hazy day.
    c.copy(horizon).lerp(zenith, Math.pow(height, 0.55));
    colours.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  mesh.name = 'sky-dome';
  mesh.renderOrder = -1;
  return mesh;
}

/** The hills and buildings around the circus, on the inside of a cylinder. */
function skyline(): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(SKYLINE_RADIUS, SKYLINE_RADIUS, SKYLINE_HEIGHT, 64, 1, true);
  geometry.translate(0, SKYLINE_HEIGHT / 2 - 6, 0);
  const texture = new THREE.CanvasTexture(paintSkyline());
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide, fog: false, alphaTest: 0.5 }),
  );
  mesh.name = 'skyline';
  return mesh;
}

/**
 * Height of the land, as a fraction of the band, at `u` round the circle.
 * u runs from 0 at +Z (south-west, the Aventine) through 0.5 at -Z
 * (north-east, the Palatine), as CylinderGeometry lays out its texture.
 */
export function landHeight(u: number): number {
  const bump = (centre: number, width: number, height: number) => {
    // Distance round the circle, so the land joins up where the band wraps.
    const d = Math.min(Math.abs(u - centre), 1 - Math.abs(u - centre));
    return height * Math.exp(-((d / width) ** 2));
  };
  return Math.min(
    0.95,
    0.22 + bump(0.5, 0.11, 0.52) + bump(0, 0.09, 0.42) + 0.02 * Math.sin(u * 2 * Math.PI * 9),
  );
}

/** Paints the skyline: hills, the palace and temples, and Rome's pines and cypresses. */
function paintSkyline(): HTMLCanvasElement {
  const width = 2048;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const random = seededRandom(23);
  // Canvas y runs downwards; the band's bottom (v = 0) is at the canvas bottom.
  const ground = (x: number) => height * (1 - landHeight(x / width));

  // The hills, hazed blue-green with distance.
  ctx.fillStyle = '#8fa3a3';
  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let x = 0; x <= width; x += 4) ctx.lineTo(x, ground(x));
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  // Buildings: the palace on the Palatine, temples on the Aventine, and a
  // scatter of the city's roofs between.
  const building = (x: number, w: number, h: number, colour: string, temple = false) => {
    const base = Math.max(ground(x), ground(x + w)) + 2;
    ctx.fillStyle = colour;
    ctx.fillRect(x, base - h, w, h);
    // Rows of arched windows or a colonnade, as darker slits.
    ctx.fillStyle = 'rgba(70, 80, 85, 0.45)';
    const rows = Math.max(1, Math.floor(h / 14));
    for (let r = 0; r < rows; r++) {
      for (let wx = x + 3; wx < x + w - 4; wx += 6) {
        ctx.fillRect(wx, base - h + 5 + r * 14, 2, 7);
      }
    }
    if (temple) {
      // A pediment on top.
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(x - 2, base - h);
      ctx.lineTo(x + w / 2, base - h - w * 0.22);
      ctx.lineTo(x + w + 2, base - h);
      ctx.closePath();
      ctx.fill();
    }
  };
  // The imperial palace spreads along the top of the Palatine.
  for (let x = width * 0.4; x < width * 0.6; x += 30 + random() * 25) {
    building(x, 26 + random() * 30, 24 + random() * 36, random() < 0.5 ? '#d8cdb6' : '#cbbfa6');
  }
  // Temples on the Aventine, either side of the wrap.
  for (const x of [width * 0.03, width * 0.08, width * 0.93]) {
    building(x, 30 + random() * 12, 18 + random() * 10, '#d2c7b0', true);
  }
  // The city between the hills: low roofs.
  for (let x = 0; x < width; x += 18 + random() * 40) {
    const u = x / width;
    const onHill = Math.abs(u - 0.5) < 0.12 || u < 0.1 || u > 0.9;
    if (!onHill && random() < 0.7) {
      building(x, 14 + random() * 20, 8 + random() * 14, random() < 0.5 ? '#c4b49a' : '#b9a78c');
    }
  }

  // Umbrella pines and cypresses along the ridges.
  for (let x = 0; x < width; x += 10 + random() * 26) {
    const top = ground(x);
    if (random() < 0.55) {
      // Stone pine: a thin trunk and a flat, spreading crown.
      ctx.fillStyle = '#6b6a5c';
      ctx.fillRect(x, top - 14, 2, 14);
      ctx.fillStyle = '#5f7466';
      ctx.beginPath();
      ctx.ellipse(x + 1, top - 16, 9 + random() * 5, 4 + random() * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Cypress: tall and narrow.
      ctx.fillStyle = '#56695c';
      ctx.beginPath();
      ctx.ellipse(x, top - 12, 2.5, 13 + random() * 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return canvas;
}
