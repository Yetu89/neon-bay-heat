// Neon Bay Heat — the city itself: ground, sky, sun, buildings, palms, street
// lights, the beach and the sea, plus the collision boxes and the spawn points the
// other systems use. Everything is placed from the seeded random, so one seed is one
// city.
import * as THREE from 'three';
import { BEACH_X, BLOCK, CITY_HALF, GRID, PALETTE, PITCH, ROAD, SEA_X } from './config.js';
import { createFacadeTexture, createGroundTexture, createSkyTexture } from './textures.js';

const PALM_POSITIONS = [];
const PARKED_SPOTS = [];

function hexToCss(hex) {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

export function buildCity(scene, random) {
  const colliders = []; // {x, z, hw, hd} axis-aligned boxes cars and feet cannot enter
  const group = new THREE.Group();
  scene.add(group);

  // Sky dome, sun and lights: a low golden sun, warm fill, soft shadows.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ map: createSkyTexture(), side: THREE.BackSide, fog: false }),
  );
  group.add(sky);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.4);
  sun.position.set(-180, 150, -120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0004;
  group.add(sun);
  group.add(new THREE.HemisphereLight(0xffd9b0, 0x3a2f4a, 1.1));

  // Ground: one textured plane for the whole city, beach and sea.
  const ground = createGroundTexture();
  const groundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(ground.span, ground.span),
    new THREE.MeshStandardMaterial({ map: ground.texture, roughness: 0.95 }),
  );
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  group.add(groundMesh);
  // The sea shimmers: a translucent plane above the sand's east edge.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(400, ground.span),
    new THREE.MeshStandardMaterial({ color: PALETTE.sea, transparent: true, opacity: 0.82, roughness: 0.25, metalness: 0.1 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(SEA_X + 200, 0.15, 0);
  group.add(sea);

  // Facade textures, one per building colour family.
  const facades = PALETTE.building.map((c) => createFacadeTexture(hexToCss(c), 0.45));
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.9 });

  // Buildings: one or two per block, heights 8–48, taller near the centre.
  for (let i = -GRID; i < GRID; i += 1) {
    for (let j = -GRID; j < GRID; j += 1) {
      const cx = (i + 0.5) * PITCH;
      const cz = (j + 0.5) * PITCH;
      const dist = Math.hypot(cx, cz) / CITY_HALF;
      if (random.chance(0.12)) {
        // A pocket park: palms and a bench instead of a tower.
        plantPalms(group, random, cx, cz, 5);
        continue;
      }
      const count = random.chance(0.35) ? 2 : 1;
      for (let k = 0; k < count; k += 1) {
        const w = random.range(16, 30);
        const d = random.range(16, 30);
        const h = random.range(9, 46) * (1.15 - dist * 0.55);
        const ox = count === 1 ? 0 : (k === 0 ? -9 : 9);
        const oz = count === 1 ? 0 : (k === 0 ? 9 : -9);
        const x = cx + ox;
        const z = cz + oz;
        const mat = new THREE.MeshStandardMaterial({ map: facades[random.int(0, facades.length - 1)], roughness: 0.85 });
        const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        tower.position.set(x, h / 2, z);
        tower.castShadow = true;
        tower.receiveShadow = true;
        group.add(tower);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 1.2, d * 0.7), roofMat);
        roof.position.set(x, h + 0.6, z);
        group.add(roof);
        // A neon rooftop sign on the tallest towers.
        if (h > 30) {
          const sign = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.5, 2.2, 0.4),
            new THREE.MeshBasicMaterial({ color: PALETTE.neon[random.int(0, PALETTE.neon.length - 1)] }),
          );
          sign.position.set(x, h + 2.4, z - d / 2 - 0.2);
          group.add(sign);
        }
        colliders.push({ x, z, hw: w / 2, hd: d / 2 });
      }
      if (random.chance(0.5)) plantPalms(group, random, cx, cz, 2);
    }
  }

  // Street lights along every road, and palm rows on the beach boulevard.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x22222a, roughness: 0.6, metalness: 0.6 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const poleGeo = new THREE.CylinderGeometry(0.14, 0.18, 7, 6);
  const lampGeo = new THREE.SphereGeometry(0.55, 8, 6);
  for (let i = -GRID; i <= GRID; i += 1) {
    for (let j = -GRID; j <= GRID; j += 1) {
      const x = i * PITCH + ROAD / 2 + 0.8;
      const z = j * PITCH + ROAD / 2 + 0.8;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, 3.5, z);
      group.add(pole);
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(x, 7.1, z);
      group.add(lamp);
    }
  }
  for (let z = -180; z <= 180; z += 24) {
    plantPalms(group, random, BEACH_X + 8, z, 1);
    PARKED_SPOTS.push([BEACH_X - 12, z]);
  }

  // Parked cars along the beach boulevard and a few side streets.
  for (let i = 0; i < 10; i += 1) {
    PARKED_SPOTS.push([random.pick([-186, -124, -62, 0, 62, 124]) + random.range(-4, 4), random.pick([-186, -124, -62, 0, 62, 124]) + random.range(-4, 4)]);
  }

  return { colliders, group, parkedSpots: PARKED_SPOTS };
}

function plantPalms(group, random, cx, cz, count) {
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6b4f, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2fa36b, roughness: 0.9 });
  for (let k = 0; k < count; k += 1) {
    const x = cx + random.range(-BLOCK / 2 + 4, BLOCK / 2 - 4);
    const z = cz + random.range(-BLOCK / 2 + 4, BLOCK / 2 - 4);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 6, 6), trunkMat);
    trunk.position.set(x, 3, z);
    trunk.castShadow = true;
    group.add(trunk);
    for (let f = 0; f < 6; f += 1) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.8, 4), leafMat);
      const a = (f / 6) * Math.PI * 2 + random.next();
      leaf.position.set(x + Math.cos(a) * 1.3, 6.5, z + Math.sin(a) * 1.3);
      leaf.rotation.set(Math.sin(a) * 1.15, 0, Math.cos(a) * 1.15);
      leaf.castShadow = true;
      group.add(leaf);
    }
    PALM_POSITIONS.push([x, z]);
  }
}

// Push a circle (x, z, radius) out of every building box it overlaps. Returns true on hit.
export function collideBuildings(colliders, pos, radius) {
  let hit = false;
  for (const b of colliders) {
    const nx = Math.max(b.x - b.hw, Math.min(pos.x, b.x + b.hw));
    const nz = Math.max(b.z - b.hd, Math.min(pos.z, b.z + b.hd));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    hit = true;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      pos.x = nx + (dx / d) * radius;
      pos.z = nz + (dz / d) * radius;
    } else {
      // Dead centre inside the box: shove out along the smallest penetration.
      const px = b.hw + radius - Math.abs(pos.x - b.x);
      const pz = b.hd + radius - Math.abs(pos.z - b.z);
      if (px < pz) pos.x = b.x + (pos.x > b.x ? b.hw + radius : -b.hw - radius);
      else pos.z = b.z + (pos.z > b.z ? b.hd + radius : -b.hd - radius);
    }
  }
  return hit;
}
