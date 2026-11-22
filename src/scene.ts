import * as THREE from 'three';
import { trackSpec, type GameConfig } from './config';
import { buildArena } from './render/arena';
import type { ChariotState } from './sim/chariot';
import { poseAt, travelDirection, type TrackSpec } from './sim/track';

const SKY = 0x87b5d9;
const SAND = 0xc8a165;

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  track: TrackSpec;
  resize(): void;
  /** Places the driver's-view camera on the chariot. */
  placeCamera(chariot: ChariotState): void;
  render(): void;
}

/** Creates the renderer, the arena and the driver's-view camera. */
export function createStage(canvas: HTMLCanvasElement, config: GameConfig): Stage {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: config.render.antialias,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, config.render.max_pixel_ratio));

  const track = trackSpec(config);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 200, 700);

  scene.add(new THREE.HemisphereLight(0xdfefff, SAND, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.8);
  sun.position.set(60, 120, 80);
  scene.add(sun);
  scene.add(buildArena(renderer, track));

  const camera = new THREE.PerspectiveCamera(config.camera.fov, 1, 0.1, 1000);
  const eye = config.camera.height;
  const lookahead = config.camera.lookahead;

  function placeCamera(chariot: ChariotState): void {
    const { progress, lane, heading } = chariot;
    const here = poseAt(track, progress, lane);
    // Look exactly where the chariot is heading. (Aiming at a point further
    // along the curved track would swing the view into a bend on its own.)
    const direction = travelDirection(here, heading);
    camera.position.set(here.x, eye, here.z);
    camera.lookAt(
      here.x + direction.x * lookahead,
      eye * 0.75,
      here.z + direction.z * lookahead,
    );
  }

  function resize(): void {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
  }

  return {
    renderer,
    scene,
    camera,
    track,
    resize,
    placeCamera,
    render: () => renderer.render(scene, camera),
  };
}
