// Low-poly quadrigae: a car in the faction's colour, two wheels, a driver in
// a matching tunic and four horses abreast, galloping. Each part is one
// instanced mesh shared by every chariot, so the whole field costs a handful
// of draw calls however many chariots there are. The player's own chariot is
// drawn as its horses only: the driver's view looks out over them.
//
// Local frame of a chariot: +X forward, +Y up, +Z to the driver's right.
// The origin is the middle of the car, on the ground.

import * as THREE from 'three';
import { poseAt, travelDirection, type TrackSpec } from '../sim/track';
import { bodyBob, headNod, legSwing, type Gait } from './gait';

const HORSE_COLOURS = [0x5b3a24, 0x7a5232, 0x3d2a1e, 0x8c7a66];
const WOOD = 0x4a3020;
const SKIN = 0xc89878;

/** Horses' distances out from the chariot's centre line, in metres. */
const HORSE_SIDES = [-1.05, -0.35, 0.35, 1.05];
/** Height of a horse's hips and shoulders, where its legs pivot, in metres. */
const HIP = 1.0;

interface Part {
  mesh: THREE.InstancedMesh;
  /** How many instances each chariot has of this part. */
  each: number;
  /** Placement of instance `k` within a chariot, for a gait. */
  offset: (k: number, gait: Gait, out: THREE.Matrix4) => THREE.Matrix4;
  /** Whether it belongs to the horses (drawn for the player too). */
  horse: boolean;
}

function box(length: number, height: number, width: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(length, height, width);
}

export interface ChariotPose {
  progress: number;
  lane: number;
  heading: number;
}

export interface ChariotModels {
  group: THREE.Group;
  /**
   * Places chariot `i` on the track, its horses at `gait`. With `horsesOnly`
   * (the player's own chariot) the car, driver and shadow are left out.
   */
  place(i: number, pose: ChariotPose, gait: Gait, horsesOnly?: boolean): void;
  /** Hides chariot `i` entirely. */
  hide(i: number): void;
}

const STILL: Gait = { phase: 0, strength: 0 };

/**
 * Builds models for `colours.length` chariots, chariot `i` in faction colour
 * `colours[i]`.
 */
export function buildChariots(track: TrackSpec, colours: number[]): ChariotModels {
  const count = colours.length;
  const group = new THREE.Group();
  group.name = 'chariots';
  const parts: Part[] = [];
  const rotZ = new THREE.Matrix4();

  function part(
    geometry: THREE.BufferGeometry,
    each: number,
    offset: Part['offset'],
    colour: (chariot: number, k: number) => number,
    horse = false,
  ): void {
    const mesh = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      count * each,
    );
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < each; k++) mesh.setColorAt(i * each + k, c.setHex(colour(i, k)));
    }
    mesh.frustumCulled = false;
    group.add(mesh);
    parts.push({ mesh, each, offset, horse });
  }
  const fixed = (x: number, y: number, z: number) => (_k: number, _g: Gait, out: THREE.Matrix4) =>
    out.makeTranslation(x, y, z);

  // The car: a shallow box with a raised front (the breastwork).
  part(box(1.3, 0.5, 1.5), 1, fixed(0, 0.85, 0), (i) => colours[i]!);
  part(box(0.25, 0.6, 1.5), 1, fixed(0.6, 1.35, 0), (i) => colours[i]!);

  // Wheels, axle across the car.
  const wheel = new THREE.CylinderGeometry(0.6, 0.6, 0.12, 12);
  wheel.rotateX(Math.PI / 2);
  part(wheel, 2, (k, _g, out) => out.makeTranslation(-0.1, 0.6, k === 0 ? -0.85 : 0.85), () => WOOD);

  // The driver, in the faction's colour, and his head.
  part(box(0.45, 0.9, 0.5), 1, fixed(-0.1, 1.55, 0), (i) => colours[i]!);
  part(box(0.28, 0.3, 0.26), 1, fixed(-0.1, 2.15, 0), () => SKIN);

  // Four horses abreast: body, neck and head, and legs, all galloping.
  const horseColour = (_: number, k: number) => HORSE_COLOURS[k % HORSE_COLOURS.length]!;
  part(
    box(1.8, 0.7, 0.42),
    4,
    (k, g, out) => out.makeTranslation(3.0, 1.3 + bodyBob(g, k), HORSE_SIDES[k]!),
    horseColour,
    true,
  );
  part(
    box(0.9, 0.32, 0.26),
    4,
    (k, g, out) =>
      out
        .makeTranslation(4.05, 1.85 + bodyBob(g, k), HORSE_SIDES[k]!)
        .multiply(rotZ.makeRotationZ(0.75 - headNod(g, k))),
    horseColour,
    true,
  );
  // Legs pivot at the top, so their geometry hangs down from the origin.
  const leg = box(0.22, HIP, 0.36);
  leg.translate(0, -HIP / 2, 0);
  part(
    leg,
    8,
    (k, g, out) => {
      const horse = Math.floor(k / 2);
      const front = k % 2 === 0;
      return out
        .makeTranslation(front ? 3.65 : 2.35, HIP + bodyBob(g, horse), HORSE_SIDES[horse]!)
        .multiply(rotZ.makeRotationZ(legSwing(g, horse, front)));
    },
    (_, k) => HORSE_COLOURS[Math.floor(k / 2) % HORSE_COLOURS.length]!,
    true,
  );

  // A soft shadow on the sand under each chariot.
  const shadowGeometry = new THREE.CircleGeometry(1, 20);
  shadowGeometry.rotateX(-Math.PI / 2);
  const shadow = new THREE.InstancedMesh(
    shadowGeometry,
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }),
    count,
  );
  shadow.frustumCulled = false;
  group.add(shadow);
  const shadowOffset = new THREE.Matrix4()
    .makeTranslation(1.6, 0.03, 0)
    .multiply(new THREE.Matrix4().makeScale(3.4, 1, 1.6));

  const place = new THREE.Matrix4();
  const basis = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const out = new THREE.Matrix4();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const forward = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3();

  return {
    group,
    place(i, pose, gait = STILL, horsesOnly = false) {
      const here = poseAt(track, pose.progress, pose.lane);
      const f = travelDirection(here, pose.heading);
      // Columns: forward, up, right.
      basis.makeBasis(forward.set(f.x, 0, f.z), up, right.set(-f.z, 0, f.x));
      place.makeTranslation(here.x, 0, here.z).multiply(basis);
      for (const { mesh, each, offset, horse } of parts) {
        for (let k = 0; k < each; k++) {
          const show = horse || !horsesOnly;
          mesh.setMatrixAt(
            i * each + k,
            show ? out.multiplyMatrices(place, offset(k, gait, local)) : hidden,
          );
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
      shadow.setMatrixAt(i, horsesOnly ? hidden : out.multiplyMatrices(place, shadowOffset));
      shadow.instanceMatrix.needsUpdate = true;
    },
    hide(i) {
      for (const { mesh, each } of parts) {
        for (let k = 0; k < each; k++) mesh.setMatrixAt(i * each + k, hidden);
        mesh.instanceMatrix.needsUpdate = true;
      }
      shadow.setMatrixAt(i, hidden);
      shadow.instanceMatrix.needsUpdate = true;
    },
  };
}
