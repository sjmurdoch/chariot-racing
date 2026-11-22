// Wreckage on the track: an overturned car in the faction's colour, a loose
// wheel lying flat and scattered planks, spread out from the spina or wall.
// Instanced, so all the wreckage costs a few draw calls.

import * as THREE from 'three';
import { poseAt, type TrackSpec } from '../sim/track';
import { MAX_WRECKS, openSide, type Wreck } from '../sim/wreckage';

const WOOD = 0x6b4a2e;
const DARK_WOOD = 0x4a3020;

interface Part {
  mesh: THREE.InstancedMesh;
  /**
   * Placement within a wreck. Local frame: +X along the track, +Z out from
   * the wall or spina, within the wreckage's spread (WRECK_SPREAD).
   */
  offsets: THREE.Matrix4[];
}

export interface WreckageModels {
  group: THREE.Group;
  /** Shows `wrecks`, the car of each in the colour `colourOf` gives its owner. */
  update(wrecks: Wreck[], colourOf: (owner: number) => number): void;
}

export function buildWreckage(track: TrackSpec): WreckageModels {
  const group = new THREE.Group();
  group.name = 'wreckage';
  const parts: Part[] = [];
  const m = () => new THREE.Matrix4();
  const rot = (x: number, y: number, z: number) =>
    new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(x, y, z));

  function part(geometry: THREE.BufferGeometry, offsets: THREE.Matrix4[], colour: number | null) {
    const mesh = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshLambertMaterial({ color: colour ?? 0xffffff }),
      MAX_WRECKS * offsets.length,
    );
    mesh.count = 0;
    mesh.frustumCulled = false;
    group.add(mesh);
    parts.push({ mesh, offsets });
    return mesh;
  }

  // The car, on its side, in the owner's colour (set per instance).
  const car = part(
    new THREE.BoxGeometry(1.3, 0.5, 1.5),
    [m().makeTranslation(0.3, 0.75, 0.9).multiply(rot(1.3, 0.5, 0))],
    null,
  );
  // Create the per-wreck colours now: Three.js only uses instance colours
  // that exist when the mesh is first drawn.
  for (let w = 0; w < MAX_WRECKS; w++) car.setColorAt(w, new THREE.Color(0xffffff));
  // A wheel lying flat, and one still on its rim.
  const wheel = new THREE.CylinderGeometry(0.6, 0.6, 0.12, 12);
  part(wheel, [m().makeTranslation(-1.6, 0.06, 1.3), m().makeTranslation(1.9, 0.6, 0.4).multiply(rot(Math.PI / 2, 0.4, 0))], DARK_WOOD);
  // Broken planks.
  part(
    new THREE.BoxGeometry(1.6, 0.08, 0.22),
    [
      m().makeTranslation(-0.8, 0.05, 0.4).multiply(rot(0, 0.6, 0)),
      m().makeTranslation(1.1, 0.05, 1.6).multiply(rot(0, -0.9, 0.1)),
      m().makeTranslation(-0.2, 0.05, 1.7).multiply(rot(0, 1.8, 0)),
    ],
    WOOD,
  );

  const place = new THREE.Matrix4();
  const basis = new THREE.Matrix4();
  const out = new THREE.Matrix4();
  const colour = new THREE.Color();

  return {
    group,
    update(wrecks, colourOf) {
      const shown = wrecks.slice(-MAX_WRECKS);
      shown.forEach((wreck, w) => {
        const pose = poseAt(track, wreck.progress, wreck.lane);
        const side = openSide(track, wreck);
        // +Z of the wreck's frame points onto the open track. Against the
        // wall that is inwards, so the frame turns half round (keeping it
        // right-handed, so faces aren't culled).
        basis.makeBasis(
          new THREE.Vector3(pose.forwardX * side, 0, pose.forwardZ * side),
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(-pose.forwardZ * side, 0, pose.forwardX * side),
        );
        place.makeTranslation(pose.x, 0, pose.z).multiply(basis);
        for (const { mesh, offsets } of parts) {
          offsets.forEach((offset, k) => {
            mesh.setMatrixAt(w * offsets.length + k, out.multiplyMatrices(place, offset));
          });
        }
        car.setColorAt(w, colour.setHex(colourOf(wreck.owner)));
      });
      for (const { mesh, offsets } of parts) {
        mesh.count = shown.length * offsets.length;
        mesh.instanceMatrix.needsUpdate = true;
      }
      if (car.instanceColor) car.instanceColor.needsUpdate = true;
    },
  };
}
