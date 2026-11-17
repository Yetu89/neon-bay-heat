// Neon Bay Heat — pedestrians: simple low-poly walkers who stroll the sidewalks,
// cross at corners, and run away screaming when a car or a gunshot comes too close.
import * as THREE from 'three';
import { BLOCK, CITY_HALF, GRID, PALETTE, PITCH, clamp } from './config.js';
import { collideBuildings } from './city.js';

function buildPedMesh(shirtColor, skinColor) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.9 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2b2d42, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), shirt);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.8, 0.26), pants);
  legL.position.set(-0.16, 0.4, 0);
  const legR = legL.clone();
  legR.position.x = 0.16;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirt);
  armL.position.set(-0.42, 1.15, 0);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(legL, legR, armL, armR);
  group.userData = { legL, legR, armL, armR, torso };
  return group;
}

export function createPedestrians(scene, random, count) {
  const peds = [];
  const skins = [0xf1c27d, 0xe0ac69, 0x8d5524, 0xffdbac, 0xc68642];
  for (let i = 0; i < count; i += 1) {
    const mesh = buildPedMesh(random.pick(PALETTE.pedShirt), random.pick(skins));
    const ped = {
      mesh,
      x: random.range(-CITY_HALF, CITY_HALF),
      z: random.range(-CITY_HALF, CITY_HALF),
      heading: random.range(0, Math.PI * 2),
      speed: random.range(1.2, 2.2),
      targetX: 0,
      targetZ: 0,
      flee: 0, // seconds left of running away
      down: 0, // seconds left lying on the ground after being hit
      walkPhase: random.range(0, Math.PI * 2),
      dead: false,
    };
    pickSidewalkTarget(ped, random);
    ped.x = ped.targetX;
    ped.z = ped.targetZ;
    mesh.position.set(ped.x, 0, ped.z);
    scene.add(mesh);
    peds.push(ped);
  }
  return peds;
}

// A point on a sidewalk: just off a road centreline, inside the city.
function pickSidewalkTarget(ped, random) {
  const road = random.int(-GRID, GRID) * PITCH;
  const along = random.range(-CITY_HALF, CITY_HALF);
  const side = random.chance(0.5) ? 1 : -1;
  if (random.chance(0.5)) {
    ped.targetX = along;
    ped.targetZ = road + side * (7 + random.range(0, BLOCK - 14));
  } else {
    ped.targetX = road + side * (7 + random.range(0, BLOCK - 14));
    ped.targetZ = along;
  }
}

export function stepPedestrians(peds, dt, colliders, threat, random) {
  for (const ped of peds) {
    if (ped.dead) continue;
    if (ped.down > 0) {
      ped.down -= dt;
      ped.mesh.rotation.x = ped.down > 0 ? -Math.PI / 2 + 0.15 : 0;
      ped.mesh.position.y = ped.down > 0 ? 0.25 : 0;
      if (ped.down <= 0) ped.mesh.rotation.x = 0;
      continue;
    }
    // Flee: run away from the threat, faster than a stroll, veering sideways off
    // the road so a fleeing walker never ends up glued to a car's bumper.
    let speed = ped.speed;
    let tx = ped.targetX;
    let tz = ped.targetZ;
    if (ped.flee > 0) {
      ped.flee -= dt;
      const dx = ped.x - threat.x;
      const dz = ped.z - threat.z;
      const d = Math.hypot(dx, dz) || 1;
      const ax = dx / d;
      const az = dz / d;
      if (!ped.fleeSide) ped.fleeSide = random.chance(0.5) ? 1 : -1;
      tx = ped.x + (ax * 0.5 - az * ped.fleeSide * 0.9) * 30;
      tz = ped.z + (az * 0.5 + ax * ped.fleeSide * 0.9) * 30;
      speed = 5.2;
    } else if (threat && Math.hypot(ped.x - threat.x, ped.z - threat.z) < 9 && threat.danger) {
      ped.flee = 2.5;
      ped.fleeSide = 0;
    }
    const dx = tx - ped.x;
    const dz = tz - ped.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.5) {
      if (ped.flee <= 0) pickSidewalkTarget(ped, random);
      continue;
    }
    const targetHeading = Math.atan2(dx, dz);
    let dh = targetHeading - ped.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    ped.heading += clamp(dh, -3.2 * dt, 3.2 * dt);
    const nx = ped.x + Math.sin(ped.heading) * speed * dt;
    const nz = ped.z + Math.cos(ped.heading) * speed * dt;
    const pos = { x: nx, z: nz };
    if (!collideBuildings(colliders, pos, 0.5)) {
      ped.x = clamp(pos.x, -CITY_HALF - 30, 320);
      ped.z = clamp(pos.z, -CITY_HALF - 10, CITY_HALF + 10);
    }
    ped.walkPhase += dt * speed * 2.4;
    const swing = Math.sin(ped.walkPhase) * 0.55;
    const u = ped.mesh.userData;
    u.legL.rotation.x = swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.8;
    u.armR.rotation.x = swing * 0.8;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
  }
}

// Knock a pedestrian down (car hit or punch). Returns true if it was standing.
export function knockPedDown(ped) {
  if (ped.down > 0 || ped.dead) return false;
  ped.down = 6;
  ped.flee = 0;
  ped.mesh.rotation.x = -Math.PI / 2 + 0.15;
  ped.mesh.position.y = 0.25;
  return true;
}
