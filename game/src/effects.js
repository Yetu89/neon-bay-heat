// Neon Bay Heat — cheap particle bursts: muzzle flashes, crash sparks, exhaust
// smoke, token sparkles and mission confetti. One pooled set of small meshes.
import * as THREE from 'three';

const MAX = 160;

export function createEffects(scene) {
  const geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = MAX;
  mesh.frustumCulled = false;
  scene.add(mesh);
  const parts = [];
  for (let i = 0; i < MAX; i += 1) {
    parts.push({ life: 0, x: 0, y: -10, z: 0, vx: 0, vy: 0, vz: 0, r: 0, g: 0, b: 0, size: 1 });
    mesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(0, -10, 0));
  }
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let cursor = 0;

  function burst(x, y, z, count, speed, up, r, g, b, life = 0.7, sizeScale = 1) {
    for (let k = 0; k < count; k += 1) {
      const p = parts[cursor];
      cursor = (cursor + 1) % MAX;
      p.life = life * (0.6 + Math.random() * 0.7);
      p.x = x;
      p.y = y;
      p.z = z;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      p.vx = Math.cos(a) * s;
      p.vz = Math.sin(a) * s;
      p.vy = up * (0.5 + Math.random());
      p.r = r;
      p.g = g;
      p.b = b;
      p.size = (0.7 + Math.random() * 1.1) * sizeScale;
    }
  }

  return {
    sparks(x, z, speed) {
      burst(x, 0.8, z, 14, 7, 4, 1, 0.75, 0.2);
    },
    smoke(x, z) {
      burst(x, 1.2, z, 6, 1.5, 2.5, 0.45, 0.45, 0.5, 1.1);
    },
    // Exhaust puffs: small grey clouds spat from a tailpipe.
    exhaust(x, z) {
      burst(x, 0.6, z, 2, 0.8, 1.6, 0.55, 0.55, 0.58, 0.7, 0.55);
    },
    // Skid dust: tan clouds kicked up by sliding tyres.
    dust(x, z) {
      burst(x, 0.3, z, 5, 2.2, 1.2, 0.72, 0.62, 0.48, 0.6, 0.8);
    },
    muzzle(x, y, z) {
      burst(x, y, z, 8, 5, 1, 1, 0.9, 0.3, 0.25);
    },
    sparkle(x, y, z) {
      burst(x, y, z, 16, 3, 3, 0, 0.96, 0.83, 0.9);
    },
    confetti(x, y, z) {
      burst(x, y, z, 40, 6, 7, 1, 0.18, 0.53, 1.4);
      burst(x, y, z, 40, 6, 7, 0, 0.96, 0.83, 1.4);
    },
    step(dt) {
      for (let i = 0; i < MAX; i += 1) {
        const p = parts[i];
        if (p.life > 0) {
          p.life -= dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          p.vy -= 6 * dt;
          if (p.y < 0.1) { p.y = 0.1; p.vy = 0; }
        }
        dummy.position.set(p.x, p.life > 0 ? p.y : -10, p.z);
        const s = p.life > 0 ? p.size * Math.min(1, p.life * 2) : 0.001;
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        color.setRGB(p.r, p.g, p.b);
        mesh.setColorAt(i, color);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
}
