// Builds the arena scenery: sand, spina, metae, obelisk, outer wall and the
// start line. Geometry is generated in code; repeated objects are instanced
// so the whole arena costs only a handful of draw calls.

import * as THREE from 'three';
import { spinaHalfWidth, type TrackSpec } from '../sim/track';
import { shadeBase, stoneMaterial } from './stone';

const COLOURS = {
  sand: 0xc8a165,
  stone: 0xe6dccb,
  stoneShade: 0xb8a990,
  bronze: 0xc9a227,
  granite: 0xb5776a,
  chalk: 0xf4efe4,
};

const SPINA_HEIGHT = 1.6;
export const WALL_HEIGHT = 3.2;
export const WALL_THICKNESS = 2;
const META_CONE_HEIGHT = 6;
const META_CONE_RADIUS = 0.9;
const OBELISK_HEIGHT = 24;
const POST_SPACING = 8;

/** A closed stadium outline: two straights joined by semicircles. */
export function stadiumShape(halfLength: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-halfLength, -radius);
  shape.lineTo(halfLength, -radius);
  shape.absarc(halfLength, 0, radius, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(-halfLength, radius);
  shape.absarc(-halfLength, 0, radius, Math.PI / 2, (3 * Math.PI) / 2, false);
  return shape;
}

/** Extrudes a shape upwards from the ground plane. */
export function extrudeUp(shape: THREE.Shape, height: number, curveSegments = 24): THREE.BufferGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/** A small deterministic pseudo-random generator (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Raked sand: speckles and faint grooves give the eye something to track at speed. */
function sandTexture(renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#c8a165';
  ctx.fillRect(0, 0, size, size);

  const random = seededRandom(7);
  for (let i = 0; i < 2600; i++) {
    const light = random() < 0.5;
    ctx.fillStyle = light ? 'rgba(240, 214, 160, 0.55)' : 'rgba(120, 88, 48, 0.35)';
    const r = 0.6 + random() * 1.6;
    ctx.fillRect(random() * size, random() * size, r, r);
  }
  ctx.strokeStyle = 'rgba(140, 104, 60, 0.18)';
  ctx.lineWidth = 2;
  for (let y = 8; y < size; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y + random() * 2);
    ctx.lineTo(size, y + random() * 2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function ground(renderer: THREE.WebGLRenderer, extent: number): THREE.Mesh {
  const texture = sandTexture(renderer);
  const tileMetres = 8;
  texture.repeat.set(extent / tileMetres, extent / tileMetres);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(extent, extent),
    new THREE.MeshLambertMaterial({ map: texture }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.name = 'sand';
  return mesh;
}

function spina(renderer: THREE.WebGLRenderer, track: TrackSpec): THREE.Mesh {
  const mesh = new THREE.Mesh(
    shadeBase(extrudeUp(stadiumShape(track.straightLength / 2, spinaHalfWidth(track)), SPINA_HEIGHT)),
    stoneMaterial(renderer, 0xffffff),
  );
  mesh.name = 'spina';
  return mesh;
}

/** Three gilded conical columns on the semicircular base at each end. */
function metae(track: TrackSpec): THREE.InstancedMesh {
  const geometry = new THREE.ConeGeometry(META_CONE_RADIUS, META_CONE_HEIGHT, 12);
  geometry.translate(0, META_CONE_HEIGHT / 2 + SPINA_HEIGHT, 0);
  const mesh = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshLambertMaterial({ color: COLOURS.bronze }),
    6,
  );
  const half = track.straightLength / 2;
  const ring = spinaHalfWidth(track) - META_CONE_RADIUS - 0.4;
  const matrix = new THREE.Matrix4();
  let i = 0;
  for (const end of [1, -1]) {
    for (const angle of [-Math.PI / 3, 0, Math.PI / 3]) {
      matrix.makeTranslation(end * (half + ring * Math.cos(angle)), 0, ring * Math.sin(angle));
      mesh.setMatrixAt(i++, matrix);
    }
  }
  mesh.name = 'metae';
  return mesh;
}

/** The obelisk of Augustus at the middle of the spina, with its pyramidion. */
function obelisk(): THREE.Group {
  const material = new THREE.MeshLambertMaterial({ color: COLOURS.granite });
  const shaft = new THREE.CylinderGeometry(0.9, 1.4, OBELISK_HEIGHT, 4, 1);
  shaft.rotateY(Math.PI / 4);
  shaft.translate(0, SPINA_HEIGHT + OBELISK_HEIGHT / 2, 0);
  const tip = new THREE.ConeGeometry(0.9, 1.6, 4);
  tip.rotateY(Math.PI / 4);
  tip.translate(0, SPINA_HEIGHT + OBELISK_HEIGHT + 0.8, 0);

  const group = new THREE.Group();
  group.add(new THREE.Mesh(shaft, material), new THREE.Mesh(tip, material));
  group.name = 'obelisk';
  return group;
}

export function outerWallRadius(track: TrackSpec): number {
  return track.innerRadius + track.width + 1;
}

/** The podium wall around the track, with a hole for the arena. */
function outerWall(renderer: THREE.WebGLRenderer, track: TrackSpec): THREE.Mesh {
  const half = track.straightLength / 2;
  const inner = outerWallRadius(track);
  const shape = stadiumShape(half, inner + WALL_THICKNESS);
  shape.holes.push(stadiumShape(half, inner));
  const mesh = new THREE.Mesh(shadeBase(extrudeUp(shape, WALL_HEIGHT, 32)), stoneMaterial(renderer, 0xf6f0e6));
  mesh.name = 'outer-wall';
  return mesh;
}

/** Pilasters along the inside face of the wall, as markers of speed. */
function wallPosts(track: TrackSpec): THREE.InstancedMesh {
  const half = track.straightLength / 2;
  const r = outerWallRadius(track);
  const curve = stadiumShape(half, r);
  const perimeter = curve.getLength();
  const count = Math.floor(perimeter / POST_SPACING);
  const points = curve.getSpacedPoints(count);

  const geometry = new THREE.BoxGeometry(0.8, WALL_HEIGHT + 0.6, 0.8);
  geometry.translate(0, (WALL_HEIGHT + 0.6) / 2, 0);
  const mesh = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshLambertMaterial({ color: COLOURS.stoneShade }),
    count,
  );
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const p = points[i]!;
    // Shape y maps to world -z after extrusion; posts use the same mapping.
    matrix.makeTranslation(p.x, 0, -p.y);
    mesh.setMatrixAt(i, matrix);
  }
  mesh.name = 'wall-posts';
  return mesh;
}

/** A chalk line across the home straight where each lap begins. */
function startLine(track: TrackSpec): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, track.width + 2),
    new THREE.MeshBasicMaterial({ color: COLOURS.chalk }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(-track.straightLength / 2, 0.02, track.innerRadius + track.width / 2);
  mesh.name = 'start-line';
  return mesh;
}

export function buildArena(renderer: THREE.WebGLRenderer, track: TrackSpec): THREE.Group {
  const arena = new THREE.Group();
  arena.name = 'arena';
  const extent = 2 * (track.straightLength + 2 * outerWallRadius(track));
  arena.add(
    ground(renderer, extent),
    spina(renderer, track),
    metae(track),
    obelisk(),
    outerWall(renderer, track),
    wallPosts(track),
    startLine(track),
  );
  return arena;
}
