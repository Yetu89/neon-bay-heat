// Neon Bay Heat — the third-person camera: it trails behind the player or the car,
// the mouse drags it around, the wheel zooms, and it eases back behind the car
// while driving so the road stays in view.
import * as THREE from 'three';
import { clamp, lerp } from './config.js';

export function createCamera(camera) {
  let yaw = 0; // orbit around the target
  let pitch = 0.32; // how high the camera looks down
  let distance = 11;
  let current = new THREE.Vector3(0, 12, -16);
  let lookAt = new THREE.Vector3();
  let autoAlign = 0;

  return {
    get yaw() {
      return yaw;
    },
    snapBehind(heading) {
      yaw = heading;
      autoAlign = 0;
    },
    drag(dx, dy) {
      yaw -= dx * 0.0042;
      pitch = clamp(pitch + dy * 0.003, 0.08, 1.1);
      autoAlign = 0;
    },
    zoom(delta) {
      distance = clamp(distance + delta * 0.01, 6, 20);
    },
    update(dt, target, heading, driving, speed01) {
      // While driving, drift the camera back behind the car unless the player is
      // actively dragging it around.
      if (driving) {
        autoAlign += dt;
        if (autoAlign > 1.2) {
          let d = heading - yaw;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          yaw += d * Math.min(1, dt * 1.6);
        }
      } else {
        autoAlign = 0;
      }
      const dist = distance + (driving ? speed01 * 4 : 0);
      const cx = target.x - Math.sin(yaw) * Math.cos(pitch) * dist;
      const cz = target.z - Math.cos(yaw) * Math.cos(pitch) * dist;
      const cy = target.y + 2.2 + Math.sin(pitch) * dist;
      const wanted = new THREE.Vector3(cx, Math.max(cy, 2.4), cz);
      current.lerp(wanted, Math.min(1, dt * 7));
      camera.position.copy(current);
      lookAt.lerp(new THREE.Vector3(target.x, target.y + 1.6, target.z), Math.min(1, dt * 10));
      camera.lookAt(lookAt);
      const fov = 62 + speed01 * 10;
      if (Math.abs(camera.fov - fov) > 0.1) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    },
  };
}
