import * as THREE from 'three';
import type { GameConfig } from './config';

const SKY = 0x87b5d9;
const SAND = 0xc8a165;

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  resize(): void;
  render(): void;
}

/** Creates the renderer and a placeholder arena: sky, sand and light. */
export function createStage(canvas: HTMLCanvasElement, config: GameConfig): Stage {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: config.render.antialias,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, config.render.max_pixel_ratio));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 150, 600);

  scene.add(new THREE.HemisphereLight(0xdfefff, SAND, 1.2));
  const sun = new THREE.DirectionalLight(0xfff1d6, 2);
  sun.position.set(80, 120, 40);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 1200),
    new THREE.MeshLambertMaterial({ color: SAND }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1000);
  camera.position.set(0, 2.2, 0);
  camera.lookAt(0, 1.5, -20);

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
    resize,
    render: () => renderer.render(scene, camera),
  };
}
