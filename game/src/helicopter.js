// Neon Bay Heat — the Bay PD police helicopter. It only flies when the heat is
// serious (3 stars or more): it shadows the player from the air, sweeps a
// spotlight over them and chops the air with its rotor, so a three-star chase
// reads in the sky as well as on the street. One cheap low-poly model, no
// physics: it eases toward a slow orbit above the player and never collides
// with anything, so it cannot crash the game or stall the frame.
import * as THREE from 'three';
import { angleDelta, clamp } from './config.js';

const HELI_HEIGHT = 30;
const ORBIT_RADIUS = 20;

export function createHelicopter(scene) {
  const group = new THREE.Group();

  // Fuselage: a white Bay PD body with a dark belly and a blue stripe.
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf1faee, roughness: 0.4, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.5, 5.2), bodyMat);
  body.position.y = 0;
  body.castShadow = true;
  group.add(body);
  const belly = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.5, 4.6), new THREE.MeshStandardMaterial({ color: 0x1d3557, roughness: 0.5 }));
  belly.position.y = -0.85;
  group.add(belly);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.24, 0.35, 5.24), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
  stripe.position.y = 0.1;
  group.add(stripe);
  // Glass cockpit up front.
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(2.7, 0.9, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x1c2f45, roughness: 0.15, metalness: 0.7 }),
  );
  glass.position.set(0, 0.25, 2.4);
  group.add(glass);
  // Tail boom, fin and skids.
  const boom = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 4.6), bodyMat);
  boom.position.set(0, 0.25, -4.6);
  boom.castShadow = true;
  group.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.8, 1.4), new THREE.MeshStandardMaterial({ color: 0x1d3557, roughness: 0.5 }));
  fin.position.set(0, 1.0, -6.6);
  group.add(fin);
  const skidMat = new THREE.MeshStandardMaterial({ color: 0x22222a, roughness: 0.6, metalness: 0.5 });
  for (const side of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 4.4), skidMat);
    skid.position.set(side * 1.5, -1.35, 0.2);
    group.add(skid);
  }
  // Main rotor: two long blades on a mast, spinning fast.
  const rotor = new THREE.Group();
  rotor.position.y = 1.15;
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.5, metalness: 0.4 });
  for (const side of [-1, 1]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.09, 0.55), bladeMat);
    blade.position.x = side * 4.75;
    rotor.add(blade);
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.6, 6), skidMat);
  mast.position.y = -0.2;
  rotor.add(mast);
  group.add(rotor);
  // Tail rotor: a small spinning cross at the end of the boom.
  const tailRotor = new THREE.Group();
  tailRotor.position.set(0.45, 0.5, -6.6);
  for (let k = 0; k < 2; k += 1) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.9, 0.3), bladeMat);
    blade.rotation.z = (k * Math.PI) / 2;
    tailRotor.add(blade);
  }
  group.add(tailRotor);
  // Flashing red/blue beacons under the belly.
  const redLight = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  redLight.position.set(-0.9, -1.15, 0.8);
  const blueLight = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
  blueLight.position.set(0.9, -1.15, 0.8);
  group.add(redLight, blueLight);
  // Searchlight: a translucent cone hanging below the nose, aimed at the player.
  const spotMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
  const spot = new THREE.Mesh(new THREE.ConeGeometry(7, HELI_HEIGHT, 12, 1, true), spotMat);
  spot.rotation.x = Math.PI; // apex up, wide end down
  spot.position.y = -HELI_HEIGHT / 2;
  const spotGroup = new THREE.Group();
  spotGroup.add(spot);
  group.add(spotGroup);

  group.visible = false;
  group.position.set(0, HELI_HEIGHT, 0);
  scene.add(group);
  return {
    group,
    rotor,
    tailRotor,
    redLight,
    blueLight,
    spotGroup,
    spotMat,
    x: 0,
    z: 0,
    y: HELI_HEIGHT,
    heading: 0,
    orbitAngle: 0,
    active: false,
  };
}

// Ease the helicopter toward a slow orbit above the player while wanted >= 3;
// park it out of sight the moment the heat drops below that.
export function stepHelicopter(heli, dt, target, wanted) {
  const shouldFly = wanted >= 3;
  if (!shouldFly) {
    if (heli.active) {
      heli.active = false;
      heli.group.visible = false;
    }
    return;
  }
  if (!heli.active) {
    heli.active = true;
    // Arrive from the sea side so it sweeps into frame instead of popping in.
    heli.x = target.x + 90;
    heli.z = target.z - 40;
    heli.orbitAngle = Math.atan2(heli.x - target.x, heli.z - target.z);
    heli.group.visible = true;
  }
  heli.orbitAngle += dt * 0.22;
  const tx = target.x + Math.sin(heli.orbitAngle) * ORBIT_RADIUS;
  const tz = target.z + Math.cos(heli.orbitAngle) * ORBIT_RADIUS;
  const ease = Math.min(1, dt * 1.4);
  heli.x += (tx - heli.x) * ease;
  heli.z += (tz - heli.z) * ease;
  heli.y += (HELI_HEIGHT - heli.y) * ease;
  const desired = Math.atan2(target.x - heli.x, target.z - heli.z);
  heli.heading += angleDelta(heli.heading, desired) * Math.min(1, dt * 3);
  heli.group.position.set(heli.x, heli.y, heli.z);
  heli.group.rotation.y = heli.heading;
  // Gentle bob and bank so it reads as flying, not hovering on a stick.
  heli.group.position.y = heli.y + Math.sin(performance.now() / 500) * 0.8;
  heli.group.rotation.z = clamp(Math.sin(heli.orbitAngle) * 0.08, -0.1, 0.1);
  heli.rotor.rotation.y += dt * 22;
  heli.tailRotor.rotation.x += dt * 30;
  // Alternate the beacons and pulse the spotlight with the rotor beat.
  const on = Math.floor(performance.now() / 220) % 2 === 0;
  heli.redLight.material.color.setHex(on ? 0xff2222 : 0x551111);
  heli.blueLight.material.color.setHex(on ? 0x1133aa : 0x2266ff);
  heli.spotMat.opacity = 0.12 + Math.sin(performance.now() / 130) * 0.05;
  // Tilt the searchlight cone toward the player on the ground below.
  const dx = target.x - heli.x;
  const dz = target.z - heli.z;
  const tilt = clamp(Math.hypot(dx, dz) / HELI_HEIGHT, 0, 0.6);
  heli.spotGroup.rotation.x = Math.cos(Math.atan2(dz, dx)) * tilt * 0.6;
  heli.spotGroup.rotation.z = -Math.sin(Math.atan2(dz, dx)) * tilt * 0.6;
}

// Put the helicopter exactly where a screenshot needs it (staging only).
// `y` drops it lower than its patrol height so it fits the frame.
export function placeHelicopter(heli, x, z, heading, y = HELI_HEIGHT) {
  heli.active = true;
  heli.x = x;
  heli.z = z;
  heli.y = y;
  heli.heading = heading;
  heli.group.position.set(x, y, z);
  heli.group.rotation.y = heading;
  heli.group.visible = true;
}
