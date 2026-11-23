// The stands (cavea): tiers of seating rising behind the outer wall all the
// way round, packed with spectators. The crowd is painted onto a band along
// each tier, so the stands cost a few draw calls and few triangles.

import * as THREE from 'three';
import type { TrackSpec } from '../sim/track';
import {
  WALL_HEIGHT,
  WALL_THICKNESS,
  extrudeUp,
  outerWallRadius,
  seededRandom,
  stadiumShape,
} from './arena';
import { shadeBase, stoneMaterial } from './stone';

const TIERS = 3;
/** Depth of each tier, front to back, in metres. */
const TIER_DEPTH = 4;
/** Rise of each tier above the one in front, in metres. */
const TIER_RISE = 2.4;
/** Height of the band of spectators along each tier, in metres. */
const CROWD_HEIGHT = 1.5;
/** Length of track-side crowd one tile of the crowd texture covers, in metres. */
const TILE_LENGTH = 12;
/** Spectators per metre of band (two rows deep). */
const PEOPLE_PER_METRE = 2.4;

/** Tints for the tiers' stone, a little darker further back. */
const STONE_TIERS = [0xf4eee4, 0xe9e2d6, 0xded6c8];
/** Tunics: mostly undyed wool and linen, with some of each faction's colours. */
const TUNICS = [
  0xeae3d2, 0xe0d6c0, 0xd8cbb0, 0xb59a74, 0x8c6f4e, 0xeae3d2, 0xe0d6c0, 0xb3261e, 0xece6d8,
  0x2f5d9e, 0x2f8a3e, 0x9c4a2c,
];
const SKIN = [0xc89878, 0xb07f5c, 0x8f6446, 0xd9ad8c];

export interface Stands {
  group: THREE.Group;
  /** Number of spectators drawn. */
  crowd: number;
}

export function buildStands(renderer: THREE.WebGLRenderer, track: TrackSpec): Stands {
  const group = new THREE.Group();
  group.name = 'stands';
  const half = track.straightLength / 2;
  const front = outerWallRadius(track) + WALL_THICKNESS;

  // The tiers: stadium-shaped rings, each higher than the one in front.
  for (let t = 0; t < TIERS; t++) {
    const inner = front + t * TIER_DEPTH;
    const shape = stadiumShape(half, inner + TIER_DEPTH);
    shape.holes.push(stadiumShape(half, inner));
    // Shaded darker where each tier rises from the one in front.
    const tier = new THREE.Mesh(
      shadeBase(extrudeUp(shape, WALL_HEIGHT + (t + 1) * TIER_RISE, 32), WALL_HEIGHT + t * TIER_RISE),
      stoneMaterial(renderer, STONE_TIERS[t]!),
    );
    tier.name = `tier-${t}`;
    group.add(tier);
  }

  // The crowd: a band in front of each tier, painted with rows of people.
  // A texture rather than thousands of little models keeps the stands cheap
  // to draw on a phone.
  const crowdTexture = paintCrowd(renderer);
  let crowd = 0;
  for (let t = 0; t < TIERS; t++) {
    const radius = front + t * TIER_DEPTH + 0.4;
    const base = WALL_HEIGHT + (t + 1) * TIER_RISE;
    const band = crowdBand(stadiumShape(half, radius), base, base + CROWD_HEIGHT);
    const mesh = new THREE.Mesh(
      band.geometry,
      new THREE.MeshLambertMaterial({ map: crowdTexture }),
    );
    mesh.name = `crowd-${t}`;
    group.add(mesh);
    crowd += Math.round(band.length * PEOPLE_PER_METRE);
  }

  return { group, crowd };
}

/**
 * A vertical strip following `path` (a stadium outline) from `bottom` to
 * `top`, facing the track, with texture coordinates running along it.
 */
function crowdBand(path: THREE.Shape, bottom: number, top: number) {
  const length = path.getLength();
  const segments = Math.ceil(length / 2);
  const points = path.getSpacedPoints(segments);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  points.forEach((p, i) => {
    const u = ((i / segments) * length) / TILE_LENGTH;
    // Shape y maps to world -z, as for the extruded arena pieces.
    positions.push(p.x, bottom, -p.y, p.x, top, -p.y);
    uvs.push(u, 0, u, 1);
    if (i > 0) {
      const a = (i - 1) * 2;
      // Wound so the face points inwards, towards the track (the outline
      // runs anticlockwise in shape space, which is mirrored in world space).
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return { geometry, length };
}

/** Paints a repeating tile of spectators, two rows deep, in tunics of many colours. */
function paintCrowd(renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const width = 1024;
  const height = 128;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#b8a888';
  ctx.fillRect(0, 0, width, height);

  const random = seededRandom(11);
  const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
  const perRow = Math.round((TILE_LENGTH * PEOPLE_PER_METRE) / 2);
  const step = width / perRow;
  // The back row first, higher up and partly hidden by the front row.
  for (const row of [0, 1]) {
    const baseline = row === 0 ? height * 0.55 : height;
    for (let k = 0; k < perRow; k++) {
      const x = (k + 0.5 + (row === 0 ? 0.5 : 0) + (random() - 0.5) * 0.4) * step;
      const bodyHeight = height * (0.32 + random() * 0.08);
      const bodyWidth = step * 0.7;
      const top = baseline - bodyHeight;
      ctx.fillStyle = hex(TUNICS[Math.floor(random() * TUNICS.length)]!);
      ctx.fillRect(x - bodyWidth / 2, top, bodyWidth, bodyHeight);
      ctx.fillStyle = hex(SKIN[Math.floor(random() * SKIN.length)]!);
      ctx.beginPath();
      ctx.arc(x, top - step * 0.22, step * 0.24, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}
