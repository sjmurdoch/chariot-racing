// Low-poly quadrigae for the rivals: a car in the faction's colour, two
// wheels, a driver in a matching tunic and four horses abreast. Each part is
// one instanced mesh shared by every chariot, so the whole field costs a
// handful of draw calls however many chariots there are.
//
// Local frame of a chariot: +X forward, +Y up, +Z to the driver's right.
// The origin is the middle of the car, on the ground.

import * as THREE from 'three';
import { poseAt, travelDirection, type TrackSpec } from '../sim/track';

const HORSE_COLOURS = [0x5b3a24, 0x7a5232, 0x3d2a1e, 0x8c7a66];
const WOOD = 0x4a3020;
const SKIN = 0xc89878;

/** Horses' distances out from the chariot's centre line, in metres. */
const HORSE_SIDES = [-1.05, -0.35, 0.35, 1.05];

interface Part {
  mesh: THREE.InstancedMesh;
  /** Each instance's placement within a chariot. */
  offsets: THREE.Matrix4[];
}

function box(w: number, h: number, d: number): THREE.BufferGeometry {
  // BoxGeometry takes width (X), height (Y), depth (Z): here length, height, width.
  return new THREE.BoxGeometry(w, h, d);
}

export interface ChariotPose {
  progress: number;
  lane: number;
  heading: number;
}

export interface ChariotModels {
  group: THREE.Group;
  /** Places chariot `i` on the track. */
  place(i: number, pose: ChariotPose): void;
  /** Hides chariot `i`, for example the player's own. */
  hide(i: number): void;
}

/**
 * Builds models for `colours.length` chariots, chariot `i` in faction colour
 * `colours[i]`.
 */
export function buildChariots(track: TrackSpec, colours: number[]): ChariotModels {
  const count = colours.length;
  const group = new THREE.Group();
  group.name = 'chariots';
  const parts: Part[] = [];
  const m = () => new THREE.Matrix4();

  function part(
    geometry: THREE.BufferGeometry,
    offsets: THREE.Matrix4[],
    colour: (chariot: number, k: number) => number,
  ): void {
    const mesh = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshLambertMaterial({ color: 0xffffff }),
      count * offsets.length,
    );
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      offsets.forEach((_, k) => mesh.setColorAt(i * offsets.length + k, c.setHex(colour(i, k))));
    }
    mesh.frustumCulled = false;
    group.add(mesh);
    parts.push({ mesh, offsets });
  }

  // The car: a shallow box with a raised front (the breastwork).
  part(box(1.3, 0.5, 1.5), [m().makeTranslation(0, 0.85, 0)], (i) => colours[i]!);
  part(box(0.25, 0.6, 1.5), [m().makeTranslation(0.6, 1.35, 0)], (i) => colours[i]!);

  // Wheels, axle across the car.
  const wheel = new THREE.CylinderGeometry(0.6, 0.6, 0.12, 12);
  wheel.rotateX(Math.PI / 2);
  part(wheel, [m().makeTranslation(-0.1, 0.6, -0.85), m().makeTranslation(-0.1, 0.6, 0.85)], () => WOOD);

  // The driver, in the faction's colour, and his head.
  part(box(0.45, 0.9, 0.5), [m().makeTranslation(-0.1, 1.55, 0)], (i) => colours[i]!);
  part(box(0.28, 0.3, 0.26), [m().makeTranslation(-0.1, 2.15, 0)], () => SKIN);

  // Four horses abreast: body, neck and head, and legs.
  const horseColour = (_: number, k: number) => HORSE_COLOURS[k % HORSE_COLOURS.length]!;
  part(
    box(1.8, 0.7, 0.42),
    HORSE_SIDES.map((z) => m().makeTranslation(3.0, 1.3, z)),
    horseColour,
  );
  part(
    box(0.9, 0.32, 0.26),
    HORSE_SIDES.map((z) =>
      m().makeTranslation(4.05, 1.85, z).multiply(new THREE.Matrix4().makeRotationZ(0.75)),
    ),
    horseColour,
  );
  part(
    box(0.22, 1.0, 0.36),
    HORSE_SIDES.flatMap((z) => [m().makeTranslation(3.65, 0.5, z), m().makeTranslation(2.35, 0.5, z)]),
    (_, k) => HORSE_COLOURS[Math.floor(k / 2) % HORSE_COLOURS.length]!,
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
  const shadowOffset = m().makeTranslation(1.6, 0.03, 0).multiply(new THREE.Matrix4().makeScale(3.4, 1, 1.6));

  const place = new THREE.Matrix4();
  const basis = new THREE.Matrix4();
  const out = new THREE.Matrix4();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);

  return {
    group,
    place(i, pose) {
      const here = poseAt(track, pose.progress, pose.lane);
      const f = travelDirection(here, pose.heading);
      // Columns: forward, up, right.
      basis.makeBasis(
        new THREE.Vector3(f.x, 0, f.z),
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(-f.z, 0, f.x),
      );
      place.makeTranslation(here.x, 0, here.z).multiply(basis);
      for (const { mesh, offsets } of parts) {
        offsets.forEach((offset, k) => mesh.setMatrixAt(i * offsets.length + k, out.multiplyMatrices(place, offset)));
        mesh.instanceMatrix.needsUpdate = true;
      }
      shadow.setMatrixAt(i, out.multiplyMatrices(place, shadowOffset));
      shadow.instanceMatrix.needsUpdate = true;
    },
    hide(i) {
      for (const { mesh, offsets } of parts) {
        offsets.forEach((_, k) => mesh.setMatrixAt(i * offsets.length + k, hidden));
        mesh.instanceMatrix.needsUpdate = true;
      }
      shadow.setMatrixAt(i, hidden);
      shadow.instanceMatrix.needsUpdate = true;
    },
  };
}
