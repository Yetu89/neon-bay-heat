// Neon Bay Heat — the wanted system and Bay PD. Crimes add stars, stars bring
// police interceptors that chase and ram, and the heat only cools when the player
// stays quiet or reaches the Spray & Shade.
import * as THREE from 'three';
import { CAR_RADIUS, CITY_HALF, PITCH, WANTED, WANTED_DECAY_SECONDS, angleDelta, clamp, distance2D } from './config.js';
import { collideCars, makeCar } from './vehicles.js';
import { collideBuildings } from './city.js';

export function createPolice(scene) {
  return {
    wanted: 0,
    quietTime: 0, // seconds since the last crime or police sighting
    cars: [], // active police cars
    spawnTimer: 0,
    scene,
  };
}

export function addWanted(police, stars) {
  police.wanted = clamp(police.wanted + stars, 0, 5);
  police.quietTime = 0;
}

export function clearWanted(police) {
  police.wanted = 0;
  police.quietTime = 0;
  for (const car of police.cars) police.scene.remove(car.mesh);
  police.cars = [];
}

function spawnPoliceCar(police, px, pz, random) {
  const maxSpeed = WANTED[police.wanted].policeSpeed;
  // Appear on a road a little way from the player, never on top of them.
  for (let tries = 0; tries < 12; tries += 1) {
    const a = random.range(0, Math.PI * 2);
    const d = random.range(55, 95);
    const x = clamp(px + Math.sin(a) * d, -CITY_HALF, CITY_HALF);
    const z = clamp(pz + Math.cos(a) * d, -CITY_HALF, CITY_HALF);
    const roadX = Math.round(x / PITCH) * PITCH;
    const roadZ = Math.round(z / PITCH) * PITCH;
    const onRoad = Math.abs(x - roadX) < 5 || Math.abs(z - roadZ) < 5;
    if (!onRoad) continue;
    const car = makeCar(Math.abs(x - roadX) < 5 ? roadX : x, Math.abs(z - roadZ) < 5 ? roadZ : z, random.range(0, Math.PI * 2), 0xf1faee, true);
    car.cruise = maxSpeed;
    car.speed = maxSpeed * 0.6;
    car.mesh.position.set(car.x, 0, car.z);
    police.scene.add(car.mesh);
    police.cars.push(car);
    return;
  }
}

// Place one police interceptor exactly where it is asked for (screenshot staging
// puts two of them right behind the player's car so the chase is in frame).
export function placePoliceCar(police, x, z, heading, speed) {
  const car = makeCar(x, z, heading, 0xf1faee, true);
  car.cruise = WANTED[police.wanted].policeSpeed;
  car.speed = speed;
  car.mesh.position.set(car.x, 0, car.z);
  police.scene.add(car.mesh);
  police.cars.push(car);
  return car;
}

export function stepPolice(police, dt, target, colliders, random, onRam) {
  const want = WANTED[police.wanted].police;
  // Spawn up to the wanted count, one at a time.
  police.spawnTimer -= dt;
  if (police.cars.length < want && police.spawnTimer <= 0) {
    spawnPoliceCar(police, target.x, target.z, random);
    police.spawnTimer = 2.5;
  }
  // Quiet decay: no police near the player for a while drops a star.
  const nearest = police.cars.length
    ? Math.min(...police.cars.map((c) => distance2D(c.x, c.z, target.x, target.z)))
    : Infinity;
  if (nearest > 80) police.quietTime += dt;
  else police.quietTime = 0;
  if (police.wanted > 0 && police.quietTime > WANTED_DECAY_SECONDS) {
    police.wanted -= 1;
    police.quietTime = 0;
  }
  // Chase: steer at a point ahead of the player, ram on contact.
  for (const car of police.cars) {
    if (car.bumpCooldown > 0) car.bumpCooldown -= dt;
    const tx = target.x + (target.vx || 0) * 0.6;
    const tz = target.z + (target.vz || 0) * 0.6;
    const desired = Math.atan2(tx - car.x, tz - car.z);
    const dh = angleDelta(car.heading, desired);
    car.heading += clamp(dh, -2.6 * dt, 2.6 * dt);
    car.speed += (car.cruise - car.speed) * Math.min(1, dt * 0.8);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const pos = { x: nx, z: nz };
    if (collideBuildings(colliders, pos, CAR_RADIUS)) car.speed *= 0.6;
    car.x = pos.x;
    car.z = pos.z;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    // Flashing light bar.
    const bar = car.mesh.userData.lightBar;
    if (bar) {
      const on = Math.floor(performance.now() / 180) % 2 === 0;
      bar.userData.red.material.color.setHex(on ? 0xff2222 : 0x551111);
      bar.userData.blue.material.color.setHex(on ? 0x1133aa : 0x2266ff);
    }
    const d = distance2D(car.x, car.z, target.x, target.z);
    if (d < CAR_RADIUS + 1.6 && onRam) onRam(car, d);
  }
  // Despawn police that fell far behind when the heat is gone.
  if (police.wanted === 0) {
    for (const car of police.cars) police.scene.remove(car.mesh);
    police.cars = [];
  } else {
    police.cars = police.cars.filter((car) => {
      const d = distance2D(car.x, car.z, target.x, target.z);
      if (d > 260) {
        police.scene.remove(car.mesh);
        return false;
      }
      return true;
    });
  }
  // Police cars push each other apart so they do not stack.
  for (let i = 0; i < police.cars.length; i += 1) {
    for (let j = i + 1; j < police.cars.length; j += 1) collideCars(police.cars[i], police.cars[j]);
  }
}
