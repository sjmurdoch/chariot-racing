// The starting gates (carceres): a stall in front of each chariot, with two
// pillars, a lintel and a pair of doors that swing open when the magistrate
// drops the mappa. Instanced, so the gates cost a few draw calls.

import * as THREE from 'three';
import { advance, poseAt, type TrackSpec } from '../sim/track';

const STONE = 0xd8ccb6;
const DOOR = 0x7a4a2a;
/** Distance from a chariot's centre to its gate, in metres: just past the horses' noses. */
export const GATE_AHEAD = 5.6;
const HALF_WIDTH = 1.55;
const HEIGHT = 3.4;
const DOOR_HEIGHT = 2.6;
/** Seconds the doors take to swing fully open. */
const OPEN_SECONDS = 0.5;

export interface Stall {
  progress: number;
  lane: number;
}

export interface GateModels {
  group: THREE.Group;
  /** Places a stall in front of each chariot, doors shut. */
  setStalls(stalls: Stall[]): void;
  /** Swings the doors open: `seconds` since the drop of the mappa. */
  open(seconds: number): void;
}

export function buildGates(track: TrackSpec, maxStalls: number): GateModels {
  const group = new THREE.Group();
  group.name = 'gates';
  const stone = new THREE.MeshLambertMaterial({ color: STONE });

  const pillars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, HEIGHT, 0.5), stone, maxStalls * 2);
  const lintels = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.6, 0.45, HALF_WIDTH * 2 + 0.5),
    stone,
    maxStalls,
  );
  // A door hinges on its outer edge: its geometry runs from the hinge inwards.
  const doorGeometry = new THREE.BoxGeometry(0.1, DOOR_HEIGHT, HALF_WIDTH - 0.25);
  doorGeometry.translate(0, DOOR_HEIGHT / 2 + 0.05, -(HALF_WIDTH - 0.25) / 2);
  const doors = new THREE.InstancedMesh(
    doorGeometry,
    new THREE.MeshLambertMaterial({ color: DOOR }),
    maxStalls * 2,
  );
  for (const mesh of [pillars, lintels, doors]) {
    mesh.count = 0;
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  let frames: THREE.Matrix4[] = [];
  const out = new THREE.Matrix4();
  const local = new THREE.Matrix4();

  function placeDoors(angle: number): void {
    frames.forEach((frame, s) => {
      for (const side of [1, -1]) {
        // Hinge at the pillar; the door reaches back across the opening and
        // swings forwards (away from the horses) as it opens.
        local
          .makeTranslation(0, 0, side * (HALF_WIDTH - 0.25))
          .multiply(new THREE.Matrix4().makeRotationY(side === 1 ? -angle : Math.PI + angle));
        doors.setMatrixAt(s * 2 + (side === 1 ? 0 : 1), out.multiplyMatrices(frame, local));
      }
    });
    doors.instanceMatrix.needsUpdate = true;
  }

  return {
    group,
    setStalls(stalls) {
      frames = stalls.slice(0, maxStalls).map(({ progress, lane }) => {
        const at = poseAt(track, advance(track, progress, lane, GATE_AHEAD), lane);
        // Columns: forward, up, right.
        return new THREE.Matrix4()
          .makeTranslation(at.x, 0, at.z)
          .multiply(
            new THREE.Matrix4().makeBasis(
              new THREE.Vector3(at.forwardX, 0, at.forwardZ),
              new THREE.Vector3(0, 1, 0),
              new THREE.Vector3(-at.forwardZ, 0, at.forwardX),
            ),
          );
      });
      frames.forEach((frame, s) => {
        for (const [k, side] of [1, -1].entries()) {
          local.makeTranslation(0, HEIGHT / 2, side * HALF_WIDTH);
          pillars.setMatrixAt(s * 2 + k, out.multiplyMatrices(frame, local));
        }
        local.makeTranslation(0, HEIGHT - 0.2, 0);
        lintels.setMatrixAt(s, out.multiplyMatrices(frame, local));
      });
      pillars.count = doors.count = frames.length * 2;
      lintels.count = frames.length;
      pillars.instanceMatrix.needsUpdate = true;
      lintels.instanceMatrix.needsUpdate = true;
      placeDoors(0);
      group.visible = true;
    },
    open(seconds) {
      const t = Math.min(1, Math.max(0, seconds / OPEN_SECONDS));
      // Ease out: the doors fly open, then settle against the pillars.
      placeDoors((Math.PI / 2) * (1 - (1 - t) ** 3));
    },
  };
}
