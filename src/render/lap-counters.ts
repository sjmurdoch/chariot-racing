// The lap counters on the spina: seven eggs on one frame and seven dolphins
// on another. As in the Circus Maximus, one egg is taken down and one dolphin
// turned nose-down for each lap completed, so the crowd (and the player) can
// see how many laps are left.

import * as THREE from 'three';
import type { TrackSpec } from '../sim/track';

const STONE = 0xd8ccb6;
const BRONZE = 0xb08d3c;
const EGG = 0xf2ead8;

const SPINA_TOP = 1.6;
const POST_HEIGHT = 3.6;
/** Length of each frame along the spina, in metres. */
const SPAN = 11;
const PER_FRAME = 7;

export interface LapCounters {
  group: THREE.Group;
  /** Shows `lapsDone` laps counted off, of `laps`. */
  show(lapsDone: number, laps: number): void;
}

/** How many eggs stay up and dolphins stay level after `lapsDone` of `laps`. */
export function countersLeft(lapsDone: number, laps: number): number {
  const total = Math.min(laps, PER_FRAME);
  return Math.max(0, total - Math.max(0, lapsDone));
}

/** A frame running along the spina, centred at `x`: two posts and a beam. */
function frame(x: number, material: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const post = new THREE.BoxGeometry(0.4, POST_HEIGHT, 0.4);
  for (const dx of [-SPAN / 2, SPAN / 2]) {
    const m = new THREE.Mesh(post, material);
    m.position.set(x + dx, SPINA_TOP + POST_HEIGHT / 2, 0);
    g.add(m);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(SPAN + 0.8, 0.35, 0.5), material);
  beam.position.set(x, SPINA_TOP + POST_HEIGHT, 0);
  g.add(beam);
  return g;
}

export function buildLapCounters(track: TrackSpec): LapCounters {
  const group = new THREE.Group();
  group.name = 'lap-counters';
  const stone = new THREE.MeshLambertMaterial({ color: STONE });
  const half = track.straightLength / 2;
  // Eggs towards the far end of the spina, dolphins towards the near end.
  const eggX = half * 0.55;
  const dolphinX = -half * 0.55;
  group.add(frame(eggX, stone), frame(dolphinX, stone));

  const slot = (i: number) => -SPAN / 2 + (SPAN * (i + 0.5)) / PER_FRAME;
  const beamTop = SPINA_TOP + POST_HEIGHT + 0.15;

  const eggGeometry = new THREE.SphereGeometry(0.45, 12, 10);
  eggGeometry.scale(1, 1.4, 1);
  const eggs = new THREE.InstancedMesh(eggGeometry, new THREE.MeshLambertMaterial({ color: EGG }), PER_FRAME);

  // A dolphin: a tapering body, arched along its length.
  const dolphinGeometry = new THREE.CapsuleGeometry(0.26, 1.1, 4, 8);
  dolphinGeometry.scale(1, 1, 0.8);
  const dolphins = new THREE.InstancedMesh(
    dolphinGeometry,
    new THREE.MeshLambertMaterial({ color: BRONZE }),
    PER_FRAME,
  );
  for (const mesh of [eggs, dolphins]) {
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  const m = new THREE.Matrix4();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  // Level: lying along the beam, nose forwards (along +X), diving slightly.
  const level = new THREE.Matrix4().makeRotationZ(Math.PI / 2 - 0.35);
  // Turned: nose pointing down.
  const turned = new THREE.Matrix4().makeRotationZ(Math.PI);

  return {
    group,
    show(lapsDone, laps) {
      const total = Math.min(laps, PER_FRAME);
      const left = countersLeft(lapsDone, laps);
      for (let i = 0; i < PER_FRAME; i++) {
        const inUse = i < total;
        // Counters come down from the end of the row.
        const up = i < left;
        eggs.setMatrixAt(
          i,
          inUse && up ? m.makeTranslation(eggX + slot(i), beamTop + 0.6, 0) : hidden,
        );
        const pose = up ? level : turned;
        dolphins.setMatrixAt(
          i,
          inUse
            ? new THREE.Matrix4()
                .makeTranslation(dolphinX + slot(i), beamTop + (up ? 0.45 : 0.85), 0)
                .multiply(pose)
            : hidden,
        );
      }
      eggs.instanceMatrix.needsUpdate = true;
      dolphins.instanceMatrix.needsUpdate = true;
    },
  };
}
