// Neon Bay Heat — Kai Mercer on foot: walk, run, punch, shoot, and get in and out
// of cars. The same body mesh the pedestrians use, dressed as the hero.
import * as THREE from 'three';
import { PLAYER_RADIUS, RUN_SPEED, WALK_SPEED, clamp } from './config.js';
import { collideBuildings } from './city.js';

export function createPlayer(scene) {
  const group = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0xff2e88, roughness: 0.7 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x1b1b2e, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe0ac69, roughness: 0.8 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.78, 0.4), jacket);
  torso.position.y = 1.18;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), skin);
  head.position.y = 1.78;
  head.castShadow = true;
  group.add(head);
  // Sunglasses and a backwards cap: the Neon Bay look.
  const shades = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.12), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 }));
  shades.position.set(0, 1.8, 0.24);
  group.add(shades);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 10), new THREE.MeshStandardMaterial({ color: 0x00f5d4, roughness: 0.7 }));
  cap.position.y = 2.0;
  group.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.82, 0.28), pants);
  legL.position.set(-0.18, 0.41, 0);
  const legR = legL.clone();
  legR.position.x = 0.18;
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.66, 0.22), jacket);
  armL.position.set(-0.46, 1.18, 0);
  const armR = armL.clone();
  armR.position.x = 0.46;
  group.add(legL, legR, armL, armR);
  group.userData = { legL, legR, armL, armR };
  scene.add(group);
  return {
    mesh: group,
    x: 0, z: 0, heading: 0,
    health: 100,
    ammo: 24,
    ammoMax: 24,
    punchCooldown: 0,
    shootCooldown: 0,
    reloadTimer: 0,
    walkPhase: 0,
    inCar: null, // the car object when driving, else null
    invulnerable: 0,
  };
}

// Move on foot. `move` is camera-relative (forward/strafe -1..1), `camYaw` the camera's.
export function stepPlayerOnFoot(player, move, camYaw, dt, colliders) {
  const speed = move.run ? RUN_SPEED : WALK_SPEED;
  const sin = Math.sin(camYaw);
  const cos = Math.cos(camYaw);
  // Camera looks along -Z in its own space; forward is away from the camera.
  const mx = (-sin * move.forward + cos * move.strafe) * -1;
  const mz = (-cos * move.forward - sin * move.strafe) * -1;
  const len = Math.hypot(mx, mz);
  let moving = false;
  if (len > 0.01) {
    moving = true;
    const nx = player.x + (mx / len) * speed * dt;
    const nz = player.z + (mz / len) * speed * dt;
    const pos = { x: nx, z: nz };
    if (!collideBuildings(colliders, pos, PLAYER_RADIUS)) {
      player.x = pos.x;
      player.z = pos.z;
    }
    const targetHeading = Math.atan2(mx, mz);
    let dh = targetHeading - player.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    player.heading += clamp(dh, -10 * dt, 10 * dt);
  }
  player.walkPhase += dt * (moving ? speed * 1.9 : 0);
  const swing = moving ? Math.sin(player.walkPhase) * 0.6 : 0;
  const u = player.mesh.userData;
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.8;
  u.armR.rotation.x = swing * 0.8;
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;
  if (player.punchCooldown > 0) player.punchCooldown -= dt;
  if (player.shootCooldown > 0) player.shootCooldown -= dt;
  if (player.invulnerable > 0) player.invulnerable -= dt;
  if (player.reloadTimer > 0) {
    player.reloadTimer -= dt;
    if (player.reloadTimer <= 0) player.ammo = player.ammoMax;
  }
  // Blink while invulnerable after a hard hit.
  player.mesh.visible = player.invulnerable <= 0 || Math.floor(player.invulnerable * 12) % 2 === 0;
}

// Punch: a short arc in front of the player. Returns the nearest ped in range, if any.
export function punchTarget(player, peds) {
  if (player.punchCooldown > 0) return null;
  player.punchCooldown = 0.45;
  const u = player.mesh.userData;
  u.armR.rotation.x = -1.6; // a visible swing
  let best = null;
  let bestD = 2.6;
  for (const ped of peds) {
    if (ped.down > 0 || ped.dead) continue;
    const dx = ped.x - player.x;
    const dz = ped.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d > bestD) continue;
    const facing = Math.sin(player.heading) * dx + Math.cos(player.heading) * dz;
    if (facing < 0) continue;
    best = ped;
    bestD = d;
  }
  return best;
}

// Shoot: hitscan against the nearest ped or police car in a cone ahead of the player.
// Returns {ped} or {car} or null, and spends one bullet.
export function shootTarget(player, peds, policeCars) {
  if (player.shootCooldown > 0 || player.ammo <= 0) return null;
  player.shootCooldown = 0.22;
  player.ammo -= 1;
  if (player.ammo === 0) player.reloadTimer = 1.4;
  const fx = Math.sin(player.heading);
  const fz = Math.cos(player.heading);
  let best = null;
  let bestD = 42;
  for (const ped of peds) {
    if (ped.down > 0 || ped.dead) continue;
    const dx = ped.x - player.x;
    const dz = ped.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d > bestD) continue;
    const along = fx * dx + fz * dz;
    if (along < 0) continue;
    const side = Math.abs(-fz * dx + fx * dz);
    if (side > 1.2 + d * 0.06) continue;
    best = { ped };
    bestD = d;
  }
  for (const car of policeCars) {
    const dx = car.x - player.x;
    const dz = car.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d > bestD) continue;
    const along = fx * dx + fz * dz;
    if (along < 0) continue;
    const side = Math.abs(-fz * dx + fx * dz);
    if (side > 2.4 + d * 0.05) continue;
    best = { car };
    bestD = d;
  }
  return best;
}
