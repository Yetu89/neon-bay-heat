// Neon Bay Heat — the screenshot scenes behind ?shot=start|play|foot|end. Each one
// plays the real rules forward from a fresh world for a few seconds with a scripted
// driver, so the frame is what a short game really looks like and the same seed
// always gives the same frame. No pixels are faked: the scene is the live game.
import { STEP, clamp } from './config.js';
import { addWanted, placePoliceCar } from './police.js';
import { placeHelicopter } from './helicopter.js';
import { knockPedDown } from './pedestrians.js';
import { punchTarget } from './player.js';
import { startMission } from './missions.js';
import { SCREEN_COMPLETE, SCREEN_PLAY, SCREEN_TITLE } from './world.js';

const SAMPLE_SECONDS = 4;

// A fake input that drives toward a target point on the grid, used by the play scene.
function chaseInput(world, tx, tz) {
  return {
    drive() {
      const car = world.player.inCar;
      const desired = Math.atan2(tx - car.x, tz - car.z);
      let d = desired - car.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return { steer: clamp(d * 2.2, -1, 1), throttle: 1, run: false, brake: false };
    },
    move() {
      return { forward: 0, strafe: 0, run: false };
    },
    takeMouseDelta() {
      return { x: 0, y: 0 };
    },
    takeWheel() {
      return 0;
    },
  };
}

function idleInput() {
  return {
    drive() {
      return { steer: 0, throttle: 0, run: false, brake: false };
    },
    move() {
      return { forward: 0, strafe: 0, run: false };
    },
    takeMouseDelta() {
      return { x: 0, y: 0 };
    },
    takeWheel() {
      return 0;
    },
  };
}

function runSteps(world, input, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.stepPlay(STEP, input, 0);
    if (world.screen() !== SCREEN_PLAY) break;
  }
}

export function stageShot(name, world) {
  world.resetRun();
  if (name === 'play') {
    // Mission 2's delivery run, mid-chase: three stars, Bay PD closing in on the
    // ground and the police helicopter overhead, the Neon Hotel marker ahead.
    startMission(world.missions, 1);
    world.missions.step = 1;
    world.missions.timer = 62;
    addWanted(world.police, 3);
    const car = world.playerCar;
    car.x = 62;
    car.z = 120;
    car.heading = Math.PI;
    car.speed = 30;
    car.mesh.position.set(car.x, 0, car.z);
    world.player.inCar = car;
    world.player.mesh.visible = false;
    world.player.x = car.x;
    world.player.z = car.z;
    world.player.heading = car.heading;
    world.cam.snapBehind(Math.PI);
    world.setScreen(SCREEN_PLAY);
    // Two interceptors flanking the player from behind, closing in to box it in.
    placePoliceCar(world.police, 52, 140, Math.PI, 38);
    placePoliceCar(world.police, 72, 144, Math.PI, 38);
    runSteps(world, chaseInput(world, 62, -62), 3.0);
    // Frame the chase: one interceptor pulls alongside behind the player, big
    // in frame near the camera, the other boxes it in ahead on the avenue.
    const p = world.player;
    const c1 = world.police.cars[0];
    const c2 = world.police.cars[1];
    if (c1) {
      c1.x = p.x - 6; c1.z = p.z + 4; c1.heading = p.heading;
      c1.mesh.position.set(c1.x, 0, c1.z);
      c1.mesh.rotation.y = c1.heading;
    }
    if (c2) {
      c2.x = p.x + 5.5; c2.z = p.z - 11; c2.heading = p.heading;
      c2.mesh.position.set(c2.x, 0, c2.z);
      c2.mesh.rotation.y = c2.heading;
    }
    // Closer, lower three-quarter rear angle: the player's car fills the frame,
    // the avenue and both interceptors read at a glance.
    world.cam.zoom(-150);
    world.cam.drag(-40, 60);
    world.cam.update(1, { x: world.player.x, y: 0, z: world.player.z }, world.player.heading, true, 0.6);
    // The helicopter sweeps in ahead of the player, big in the sky, and Marco's
    // warning sits on screen as the subtitle. It flies low for the frame and
    // the camera tilts up so the sky — and the rotor — stay in shot.
    placeHelicopter(world.heli, p.x - 15, p.z - 30, p.heading, 15);
    world.cam.drag(0, -140);
    world.cam.update(1, { x: world.player.x, y: 0, z: world.player.z }, world.player.heading, true, 0.6);
    world.dialogue.showNow('MARCO', 'Three stars, Kai. They\u2019re calling the chopper.');
    world.updateHud();
    world.setScreen(SCREEN_PLAY);
    return SCREEN_PLAY;
  }
  if (name === 'foot') {
    // On foot on Palm Row: Kai mid-punch, a pedestrian down, one star, the pink
    // Vortex GT parked beside him, mission 1 asking for a car.
    startMission(world.missions, 0);
    addWanted(world.police, 1);
    const player = world.player;
    player.x = 0;
    player.z = 31;
    player.heading = Math.PI * 0.75;
    const ped = world.peds[3];
    ped.x = player.x + Math.sin(player.heading) * 2.1;
    ped.z = player.z + Math.cos(player.heading) * 2.1;
    ped.heading = player.heading + Math.PI;
    ped.mesh.position.set(ped.x, 0, ped.z);
    punchTarget(player, world.peds);
    knockPedDown(ped);
    const car = world.playerCar;
    car.x = 6;
    car.z = 31;
    car.heading = Math.PI / 2;
    car.mesh.position.set(car.x, 0, car.z);
    world.cam.snapBehind(player.heading);
    world.cam.drag(60, -30);
    world.setScreen(SCREEN_PLAY);
    runSteps(world, idleInput(), 1.2);
    world.dialogue.showNow('MARCO', 'Kai. You need wheels, I need a driver.');
    world.updateHud();
    world.setScreen(SCREEN_PLAY);
    return SCREEN_PLAY;
  }
  if (name === 'end') {
    // Story complete at the Bayfront Safehouse: the banner, the payout, the car,
    // the sun going down over the bay.
    world.missions.finished = true;
    world.state.cash = 4200;
    world.state.missionsDone = 5;
    const player = world.player;
    player.x = 186;
    player.z = 196;
    player.heading = Math.PI * 0.9;
    player.mesh.position.set(player.x, 0, player.z);
    const car = world.playerCar;
    car.x = 178;
    car.z = 196;
    car.heading = Math.PI / 2;
    car.mesh.position.set(car.x, 0, car.z);
    world.cam.snapBehind(player.heading);
    world.cam.zoom(300);
    world.cam.drag(-90, -40);
    world.cam.update(1, { x: player.x, y: 0, z: player.z }, player.heading, false, 0);
    world.hud.showBanner('STORY COMPLETE', 'Neon Bay is yours. +$2,500 — Kai Mercer, wheelman.', 30);
    world.dialogue.showNow('KAI', 'Five jobs. One city. Mine.');
    world.setScreen(SCREEN_COMPLETE);
    world.updateHud();
    return SCREEN_COMPLETE;
  }
  // Default: the title screen over a living city at golden hour.
  const player = world.player;
  player.x = 202;
  player.z = 0;
  player.heading = Math.PI / 2;
  player.mesh.position.set(player.x, 0, player.z);
  const car = world.playerCar;
  car.x = 202;
  car.z = 8;
  car.heading = Math.PI / 2;
  car.mesh.position.set(car.x, 0, car.z);
  world.cam.snapBehind(Math.PI / 2);
  world.cam.drag(-50, -20);
  for (let i = 0; i < 6 / STEP; i += 1) world.stepAmbient(STEP, { x: 202, y: 0, z: 0 });
  world.setScreen(SCREEN_TITLE);
  return SCREEN_TITLE;
}
