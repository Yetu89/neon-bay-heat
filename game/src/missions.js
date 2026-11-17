// Neon Bay Heat — the story: three missions in order, each a chain of objectives
// with a glowing marker in the world. The world calls step() every tick and reads
// the current objective for the HUD; rewards and events come back as flags.
import * as THREE from 'three';
import { MISSIONS, distance2D } from './config.js';

export const MISSION_NONE = 0;
export const MISSION_STEP_DONE = 1;
export const MISSION_DONE = 2;
export const MISSION_FAILED = 4;
export const MISSION_STARTED = 8;

export function createMissions(scene) {
  // The marker: a tall pulsing beacon of light plus a floating ring.
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xfee440, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 12, 1, true), beaconMat);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xfee440, transparent: true, opacity: 0.9 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.28, 8, 32), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.5;
  beacon.position.y = 30;
  beacon.visible = false;
  ring.visible = false;
  scene.add(beacon, ring);
  return {
    index: 0, // which mission of MISSIONS
    step: 0, // which step of the mission
    timer: 0, // countdown for timed steps, 0 = none
    active: false, // a mission is running
    finished: false, // the whole story is done
    startedCount: 0,
    beacon,
    ring,
  };
}

export function missionTitle(missions) {
  if (missions.finished) return 'FREE ROAM — NEON BAY';
  if (!missions.active) return 'NEON BAY HEAT';
  return MISSIONS[missions.index].title;
}

export function missionObjective(missions) {
  if (missions.finished) return 'Story complete — cruise, collect tokens, stay out of trouble.';
  if (!missions.active) return 'Press ENTER to start the story.';
  const step = MISSIONS[missions.index].steps[missions.step];
  return step.text;
}

export function missionMarker(missions) {
  if (!missions.active || missions.finished) return null;
  const step = MISSIONS[missions.index].steps[missions.step];
  return step.at ? { x: step.at[0], z: step.at[1], radius: step.radius || 10 } : null;
}

export function startStory(missions) {
  missions.index = 0;
  missions.step = 0;
  missions.timer = 0;
  missions.active = true;
  missions.finished = false;
  missions.startedCount += 1;
}

export function startMission(missions, index) {
  missions.index = index;
  missions.step = 0;
  missions.timer = 0;
  missions.active = true;
  const step = MISSIONS[index].steps[0];
  if (step.wantedOnStart) return step.wantedOnStart;
  return 0;
}

// Advance the story one tick. `ctx` carries the live facts: where the player is, whether
// they are in a car, how far the marker is. Returns event flags for the world to act on.
export function stepMissions(missions, dt, ctx) {
  let events = 0;
  if (!missions.active || missions.finished) return events;
  const mission = MISSIONS[missions.index];
  const step = mission.steps[missions.step];
  if (missions.timer > 0) {
    missions.timer -= dt;
    if (missions.timer <= 0) {
      missions.active = false;
      return MISSION_FAILED;
    }
  }
  if (step.kind === 'steal') {
    if (ctx.inCar) {
      missions.step += 1;
      events |= MISSION_STEP_DONE;
    }
  } else if (step.kind === 'goto' || step.kind === 'escape') {
    const marker = { x: step.at[0], z: step.at[1] };
    if (distance2D(ctx.x, ctx.z, marker.x, marker.z) < step.radius) {
      if (step.kind === 'escape' && ctx.wanted > 0) {
        // Reaching the safehouse while still hot does not count: lose the heat first.
      } else {
        missions.step += 1;
        events |= MISSION_STEP_DONE;
      }
    }
  }
  if (missions.step >= mission.steps.length) {
    missions.active = false;
    if (missions.index + 1 < MISSIONS.length) {
      missions.index += 1;
      missions.step = 0;
      missions.active = true;
      events |= MISSION_DONE | MISSION_STARTED;
      const next = MISSIONS[missions.index].steps[0];
      if (next.wantedOnStart) events |= next.wantedOnStart << 8;
    } else {
      missions.finished = true;
      events |= MISSION_DONE;
    }
    const nextStep = missions.active ? MISSIONS[missions.index].steps[0] : null;
    if (nextStep && nextStep.time) missions.timer = nextStep.time;
  } else {
    const current = mission.steps[missions.step];
    if (current.time && missions.timer <= 0) missions.timer = current.time;
  }
  // Place the beacon on the current marker.
  const marker = missionMarker(missions);
  if (marker) {
    missions.beacon.visible = true;
    missions.ring.visible = true;
    missions.beacon.position.set(marker.x, 30, marker.z);
    missions.ring.position.set(marker.x, 0.5, marker.z);
    const pulse = 0.65 + Math.sin(performance.now() / 240) * 0.3;
    missions.ring.scale.setScalar(1 + (1 - pulse) * 0.4);
    missions.beacon.material.opacity = 0.16 + pulse * 0.14;
  } else {
    missions.beacon.visible = false;
    missions.ring.visible = false;
  }
  return events;
}

// The reward of the mission that just finished (index is already the next one).
export function missionReward(missions) {
  const finished = missions.index - 1;
  if (missions.finished) return MISSIONS[MISSIONS.length - 1].reward;
  if (finished >= 0) return MISSIONS[finished].reward;
  return 0;
}
