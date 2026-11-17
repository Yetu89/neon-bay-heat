// Neon Bay Heat — cars: the factory that builds a low-poly car from boxes, the
// arcade driving model for the player's car, and the traffic that cruises the grid.
import * as THREE from 'three';
import { CAR_ACCEL, CAR_BRAKE, CAR_MAX_REVERSE, CAR_MAX_SPEED, CAR_RADIUS, CAR_TURN, CITY_HALF, GRID, PALETTE, PITCH, ROAD, angleDelta, clamp, nearestRoadCoord } from './config.js';
import { collideBuildings } from './city.js';

const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.34, 10);
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.9 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x1c2f45, roughness: 0.2, metalness: 0.6 });
const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });

// A car is a body box, a cabin, four wheels and lights. `police` adds a light bar.
// `type` changes the whole silhouette: 'sedan' (the classic), 'taxi' (sedan plus a
// roof sign), 'van' (one tall box, sliding-door look) and 'truck' (cab plus cargo).
export function buildCarMesh(color, police = false, type = 'sedan') {
  if (type === 'van') return buildVanMesh(color);
  if (type === 'truck') return buildTruckMesh(color);
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.4), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.55, 2.1), glassMat);
  cabin.position.set(0, 1.18, -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.3, 0.7), bodyMat);
  nose.position.set(0, 0.55, 2.15);
  group.add(nose);
  for (const [x, z] of [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.5], [0.95, -1.5]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.42, z);
    wheel.castShadow = true;
    group.add(wheel);
  }
  for (const x of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), headMat);
    head.position.set(x, 0.68, 2.52);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.08), tailMat);
    tail.position.set(x, 0.68, -2.24);
    group.add(tail);
  }
  if (type === 'taxi') {
    // A lit roof sign and a checkered door band mark the cab.
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.3, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 }),
    );
    sign.position.set(0, 1.62, -0.25);
    group.add(sign);
    const bandMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    for (const side of [-1, 1]) {
      for (let k = 0; k < 4; k += 1) {
        const sq = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 0.4), k % 2 ? bandMat : new THREE.MeshBasicMaterial({ color: 0xffffff }));
        sq.position.set(side * 1.06, 0.72, -0.9 + k * 0.45);
        group.add(sq);
      }
    }
  }
  let lightBar = null;
  if (police) {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.x = -0.45;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.x = 0.45;
    lightBar.add(red, blue);
    lightBar.position.set(0, 1.55, -0.25);
    lightBar.userData = { red, blue };
    group.add(lightBar);
  }
  group.userData.lightBar = lightBar;
  group.userData.bodyMat = bodyMat;
  return group;
}

// A tall delivery van: one long box with a windshield band and bigger wheels.
function buildVanMesh(color) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.9, 5.4), bodyMat);
  body.position.y = 1.25;
  body.castShadow = true;
  group.add(body);
  const shield = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 0.1), glassMat);
  shield.position.set(0, 1.55, 2.72);
  shield.rotation.x = -0.18;
  group.add(shield);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x22222a, roughness: 0.6 });
  for (const side of [-1, 1]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.1, 1.4), doorMat);
    door.position.set(side * 1.16, 1.1, 0.4);
    group.add(door);
  }
  const bigWheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.36, 10);
  for (const [x, z] of [[-1.0, 1.8], [1.0, 1.8], [-1.0, -1.8], [1.0, -1.8]]) {
    const wheel = new THREE.Mesh(bigWheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.5, z);
    wheel.castShadow = true;
    group.add(wheel);
  }
  for (const x of [-0.75, 0.75]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.08), headMat);
    head.position.set(x, 0.8, 2.74);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.08), tailMat);
    tail.position.set(x, 0.8, -2.74);
    group.add(tail);
  }
  group.userData.lightBar = null;
  group.userData.bodyMat = bodyMat;
  return group;
}

// A box truck: a short cab up front, a tall cargo box behind, six wheels.
function buildTruckMesh(color) {
  const group = new THREE.Group();
  const cabMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.4 });
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.5, 1.7), cabMat);
  cab.position.set(0, 1.05, 2.4);
  cab.castShadow = true;
  group.add(cab);
  const shield = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 0.1), glassMat);
  shield.position.set(0, 1.35, 3.28);
  group.add(shield);
  const boxMat = new THREE.MeshStandardMaterial({ color: 0xd8d3c8, roughness: 0.7, metalness: 0.2 });
  const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 3.6), boxMat);
  cargo.position.set(0, 1.5, -1.2);
  cargo.castShadow = true;
  group.add(cargo);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.35, 3.62), new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
  stripe.position.set(0, 1.9, -1.2);
  group.add(stripe);
  const bigWheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.36, 10);
  for (const [x, z] of [[-1.0, 2.6], [1.0, 2.6], [-1.0, -0.6], [1.0, -0.6], [-1.0, -2.4], [1.0, -2.4]]) {
    const wheel = new THREE.Mesh(bigWheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.5, z);
    wheel.castShadow = true;
    group.add(wheel);
  }
  for (const x of [-0.75, 0.75]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.08), headMat);
    head.position.set(x, 0.8, 3.28);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.18, 0.08), tailMat);
    tail.position.set(x, 0.8, -3.02);
    group.add(tail);
  }
  group.userData.lightBar = null;
  group.userData.bodyMat = cabMat;
  return group;
}

// Repaint a car in the garage: recolour its body material in place.
export function repaintCar(car, color) {
  const mat = car.mesh.userData.bodyMat;
  if (mat) mat.color.setHex(color);
}

export function makeCar(x, z, heading, color, police = false, type = 'sedan') {
  return {
    mesh: buildCarMesh(color, police, type),
    x, z, heading,
    speed: 0,
    steer: 0,
    health: 100,
    police,
    type,
    bumpCooldown: 0,
    // Traffic state: which road axis it follows and where it turns next.
    axis: 'x',
    dir: 1,
    cruise: 9,
    stopped: 0,
    wander: 0,
  };
}

// Arcade driving: throttle, brake/reverse, speed-scaled steering, drag and drift.
export function driveCar(car, input, dt, colliders, onCrash) {
  if (car.bumpCooldown > 0) car.bumpCooldown -= dt;
  const forward = input.throttle;
  if (forward > 0) car.speed += CAR_ACCEL * forward * dt;
  else if (forward < 0) {
    if (car.speed > 0.5) car.speed -= CAR_BRAKE * dt; // brake first
    else car.speed -= CAR_ACCEL * 0.55 * dt; // then reverse
  }
  if (input.brake) car.speed -= (car.speed > 0 ? CAR_BRAKE : -CAR_BRAKE * 0.4) * dt * 0.6;
  car.speed -= car.speed * 0.35 * dt; // rolling drag
  if (input.brake && Math.abs(car.speed) > 6) car.speed -= car.speed * 0.9 * dt; // handbrake slide
  car.speed = clamp(car.speed, -CAR_MAX_REVERSE, CAR_MAX_SPEED);
  const speed01 = Math.abs(car.speed) / CAR_MAX_SPEED;
  const steerTarget = input.steer * (input.brake ? 1.5 : 1);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  car.heading += car.steer * CAR_TURN * clamp(speed01 * 1.6, 0, 1) * Math.sign(car.speed || 1) * dt * (input.brake ? 1.25 : 1);
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const pos = { x: nx, z: nz };
  const hit = collideBuildings(colliders, pos, CAR_RADIUS);
  if (hit) {
    if (Math.abs(car.speed) > 8 && onCrash) onCrash(Math.abs(car.speed));
    car.speed *= 0.45;
  }
  car.x = clamp(pos.x, -CITY_HALF - 40, 320);
  car.z = clamp(pos.z, -CITY_HALF - 10, CITY_HALF + 10);
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  // Body lean: roll into corners, pitch under braking.
  car.mesh.rotation.z = -car.steer * speed01 * 0.06;
  car.mesh.rotation.x = clamp(-input.throttle * speed01 * 0.02, -0.03, 0.03);
}

// Traffic: each car cruises along a road centreline, turns at intersections, and
// stops when the car ahead is close. Pure grid logic, no pathfinding needed.
// The mix is mostly sedans, with taxis, vans and trucks so the road reads varied.
function pickTrafficType(random) {
  const roll = random.next();
  if (roll < 0.58) return ['sedan', null];
  if (roll < 0.74) return ['taxi', 0xf5c518];
  if (roll < 0.88) return ['van', null];
  return ['truck', null];
}

export function createTraffic(scene, random, count, parkedSpots) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const axis = random.chance(0.5) ? 'x' : 'z';
    const road = random.int(-GRID, GRID) * PITCH;
    const along = random.range(-CITY_HALF, CITY_HALF);
    const [type, fixedColor] = pickTrafficType(random);
    const car = makeCar(axis === 'x' ? along : road, axis === 'x' ? road : along, 0, fixedColor ?? random.pick(PALETTE.trafficCar), false, type);
    car.axis = axis;
    car.dir = random.chance(0.5) ? 1 : -1;
    car.heading = axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    car.cruise = random.range(7, 12);
    car.speed = car.cruise;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    scene.add(car.mesh);
    cars.push(car);
  }
  // Parked cars: same factory, no motion, dotted along the beach and side streets.
  for (const [x, z] of parkedSpots.slice(0, 12)) {
    const [type, fixedColor] = pickTrafficType(random);
    const car = makeCar(x, z, random.chance(0.5) ? 0 : Math.PI / 2, fixedColor ?? random.pick(PALETTE.trafficCar), false, type);
    car.parked = true;
    car.speed = 0;
    car.mesh.position.set(x, 0, z);
    car.mesh.rotation.y = car.heading;
    scene.add(car.mesh);
    cars.push(car);
  }
  return cars;
}

export function stepTraffic(cars, dt, colliders, playerCar, random) {
  for (const car of cars) {
    if (car.parked || car.police) continue;
    if (car.bumpCooldown > 0) car.bumpCooldown -= dt;
    // Stop for the car ahead on the same road.
    let blocked = false;
    for (const other of cars) {
      if (other === car || other.parked) continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const ahead = car.axis === 'x' ? dx * car.dir : dz * car.dir;
      const side = car.axis === 'x' ? Math.abs(dz) : Math.abs(dx);
      if (ahead > 0 && ahead < 9 && side < 3) { blocked = true; break; }
    }
    if (playerCar) {
      const dx = playerCar.x - car.x;
      const dz = playerCar.z - car.z;
      const ahead = car.axis === 'x' ? dx * car.dir : dz * car.dir;
      const side = car.axis === 'x' ? Math.abs(dz) : Math.abs(dx);
      if (ahead > 0 && ahead < 8 && side < 3.5) blocked = true;
    }
    car.speed += ((blocked ? 0 : car.cruise) - car.speed) * Math.min(1, dt * 2);
    if (car.speed < 0.05) continue;
    let nx = car.x;
    let nz = car.z;
    if (car.axis === 'x') nx += car.dir * car.speed * dt;
    else nz += car.dir * car.speed * dt;
    // At an intersection, sometimes turn onto the crossing road.
    const along = car.axis === 'x' ? nx : nz;
    const roadCoord = nearestRoadCoord(along);
    if (Math.abs(along - roadCoord) < 0.6 && Math.abs(car.axis === 'x' ? car.z : car.x) < CITY_HALF && random.chance(0.012)) {
      car.axis = car.axis === 'x' ? 'z' : 'x';
      car.dir = random.chance(0.5) ? 1 : -1;
      if (car.axis === 'x') { car.z = roadCoord; car.heading = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      else { car.x = roadCoord; car.heading = car.dir > 0 ? 0 : Math.PI; }
    }
    // Wrap around the city edge so traffic never runs out.
    if (nx > CITY_HALF + 20) nx = -CITY_HALF - 20;
    if (nx < -CITY_HALF - 20) nx = CITY_HALF + 20;
    if (nz > CITY_HALF + 20) nz = -CITY_HALF - 20;
    if (nz < -CITY_HALF - 20) nz = CITY_HALF + 20;
    car.x = nx;
    car.z = nz;
    // Ease the heading toward the travel direction.
    const target = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    car.heading += angleDelta(car.heading, target) * Math.min(1, dt * 6);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
  }
}

// Circle-vs-circle push between two cars; returns the impact speed. A bump only
// costs speed once per half second, so a shove does not grind both cars to a halt.
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const d = Math.hypot(dx, dz);
  const min = CAR_RADIUS * 2 - 0.4;
  if (d >= min || d < 0.001) return 0;
  const push = (min - d) / 2;
  const ux = dx / d;
  const uz = dz / d;
  a.x -= ux * push;
  a.z -= uz * push;
  b.x += ux * push;
  b.z += uz * push;
  const impact = Math.abs(a.speed - b.speed);
  if ((a.bumpCooldown || 0) > 0 || (b.bumpCooldown || 0) > 0) return 0;
  a.bumpCooldown = 0.5;
  b.bumpCooldown = 0.5;
  // The car behind shoves the one ahead forward instead of both stopping dead.
  if (Math.abs(a.speed) > Math.abs(b.speed)) b.speed = Math.max(b.speed, a.speed * 0.85);
  else a.speed = Math.max(a.speed, b.speed * 0.85);
  a.speed *= 0.85;
  b.speed *= 0.85;
  return impact;
}
