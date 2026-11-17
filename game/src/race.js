// Neon Bay Heat — the Midnight Apex street race: a repeatable side activity. Four
// checkered gates form a circuit around the city. Drive through gate 1 in a car to
// start the clock, then hit gates 2–4 in order before it runs out. Win pays $600
// and the race re-arms after a short cooldown, so it is always there to replay.
import * as THREE from 'three';
import { RACE_GATES, RACE_REWARD, RACE_TIME_LIMIT, distance2D } from './config.js';

export const RACE_NONE = 0;
export const RACE_STARTED = 1;
export const RACE_GATE = 2;
export const RACE_WON = 4;
export const RACE_FAILED = 8;

function buildGateMesh(axis) {
  // A checkered arch across the road: two posts and a top beam of alternating
  // black and white blocks, plus a glowing ring on the asphalt.
  const group = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0x22222a, roughness: 0.6, metalness: 0.4 });
  for (const side of [-5.2, 5.2]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 5.2, 6), postMat);
    post.position.set(axis === 'x' ? side : 0, 2.6, axis === 'x' ? 0 : side);
    post.castShadow = true;
    group.add(post);
  }
  for (let k = 0; k < 10; k += 1) {
    const block = new THREE.Mesh(
      new THREE.BoxGeometry(1.08, 0.9, 0.35),
      new THREE.MeshBasicMaterial({ color: k % 2 ? 0x111111 : 0xffffff }),
    );
    const along = -4.9 + k * 1.08 + 0.54;
    block.position.set(axis === 'x' ? along : 0, 5.4, axis === 'x' ? 0 : along);
    group.add(block);
  }
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4.6, 0.22, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xff8e00, transparent: true, opacity: 0.85 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.3;
  group.add(ring);
  group.userData.ring = ring;
  return group;
}

export function createRace(scene) {
  const gates = RACE_GATES.map((gate) => {
    const mesh = buildGateMesh(gate.axis);
    mesh.position.set(gate.at[0], 0, gate.at[1]);
    scene.add(mesh);
    return { ...gate, mesh };
  });
  return {
    gates,
    active: false,
    nextGate: 0,
    timer: 0,
    cooldown: 0,
    wins: 0,
  };
}

// The current gate marker for the HUD and minimap, or null when idle.
export function raceMarker(race) {
  if (!race.active) return null;
  const gate = RACE_GATES[race.nextGate];
  return gate ? { x: gate.at[0], z: gate.at[1], radius: 8 } : null;
}

export function raceObjective(race) {
  if (!race.active) return 'Midnight Apex race: drive through gate 1 on Palm Row to start.';
  return `STREET RACE — hit gate ${race.nextGate + 1} of ${RACE_GATES.length}!`;
}

// One tick. `ctx` carries the player position and whether they are driving.
// Returns an event flag; the world turns it into cash, banners and sound.
export function stepRace(race, dt, ctx) {
  let event = RACE_NONE;
  if (race.cooldown > 0) race.cooldown -= dt;
  if (!race.active) {
    if (race.cooldown <= 0 && ctx.inCar) {
      const gate = RACE_GATES[0];
      if (distance2D(ctx.x, ctx.z, gate.at[0], gate.at[1]) < 8) {
        race.active = true;
        race.nextGate = 1;
        race.timer = RACE_TIME_LIMIT;
        event |= RACE_STARTED;
      }
    }
  } else {
    race.timer -= dt;
    if (race.timer <= 0) {
      race.active = false;
      race.cooldown = 8;
      event |= RACE_FAILED;
    } else if (!ctx.inCar) {
      race.active = false;
      race.cooldown = 8;
      event |= RACE_FAILED;
    } else {
      const gate = RACE_GATES[race.nextGate];
      if (gate && distance2D(ctx.x, ctx.z, gate.at[0], gate.at[1]) < 8) {
        race.nextGate += 1;
        if (race.nextGate >= RACE_GATES.length) {
          race.active = false;
          race.cooldown = 10;
          race.wins += 1;
          event |= RACE_WON;
        } else {
          event |= RACE_GATE;
        }
      }
    }
  }
  // The next gate glows orange; the rest sit dim grey.
  for (let i = 0; i < race.gates.length; i += 1) {
    const ring = race.gates[i].mesh.userData.ring;
    const isNext = race.active ? i === race.nextGate : i === 0;
    ring.material.color.setHex(isNext ? 0xff8e00 : 0x555560);
    ring.material.opacity = isNext ? 0.85 + Math.sin(performance.now() / 180) * 0.15 : 0.4;
  }
  return event;
}

export function raceReward() {
  return RACE_REWARD;
}
