// Neon Bay Heat — the world: it owns the renderer, the city, the traffic, the
// pedestrians, the player, the police, the missions and the save, and steps them
// together in fixed steps. main.js only drives the loop and the screens.
import * as THREE from 'three';
import { BEACH_X, BEST_KEY, CAR_RADIUS, CITY_HALF, GRID, MISSIONS, PALETTE, PITCH, PLACES, SAVE_KEY, STEP, TOKEN_REWARD, TOKEN_SPOTS, WANTED, clamp, distance2D, lerp } from './config.js';
import { createRandom } from './random.js';
import { buildCity, collideBuildings } from './city.js';
import { collideCars, createTraffic, driveCar, makeCar, stepTraffic } from './vehicles.js';
import { createPedestrians, knockPedDown, stepPedestrians } from './pedestrians.js';
import { createPlayer, punchTarget, shootTarget, stepPlayerOnFoot } from './player.js';
import { addWanted, clearWanted, createPolice, stepPolice } from './police.js';
import { MISSION_DONE, MISSION_FAILED, MISSION_STARTED, MISSION_STEP_DONE, createMissions, missionMarker, missionObjective, missionReward, missionTitle, startMission, startStory, stepMissions } from './missions.js';
import { createEffects } from './effects.js';
import { createRace, raceMarker, raceObjective, raceReward, stepRace, RACE_FAILED, RACE_GATE, RACE_STARTED, RACE_WON } from './race.js';
import { createAudio } from './audio.js';
import { createCamera } from './camera.js';
import { createHud } from './hud.js';
import { ACTION_ENTER, ACTION_PAUSE, ACTION_PUNCH, ACTION_SHOOT } from './input.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_COMPLETE = 'complete';

const START_POS = { x: 0, z: 62 };

export function createWorld(canvas, seed) {
  const random = createRandom(seed);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PALETTE.fog, 140, 720);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1400);
  const cam = createCamera(camera);
  const audio = createAudio();
  const hud = createHud(document);
  const effects = createEffects(scene);

  const city = buildCity(scene, random);
  const traffic = createTraffic(scene, random, 22, city.parkedSpots);
  const peds = createPedestrians(scene, random, 26);
  const player = createPlayer(scene);
  const police = createPolice(scene);
  const missions = createMissions(scene);
  const race = createRace(scene);

  // The hero's own car: a hot pink Vortex GT parked on Palm Row.
  const playerCar = makeCar(0, 31, Math.PI, PALETTE.playerCar);
  playerCar.owned = true;
  scene.add(playerCar.mesh);

  // Neon tokens: spinning rings that pay $100 when driven or walked through.
  const tokenMeshes = TOKEN_SPOTS.map(([x, z], i) => {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.2, 8, 24),
      new THREE.MeshBasicMaterial({ color: PALETTE.neon[i % PALETTE.neon.length] }),
    );
    mesh.position.set(x, 1.4, z);
    scene.add(mesh);
    return mesh;
  });
  // Spray & Shade: a purple beacon marks the cool zone that clears wanted for $100.
  const sprayBeacon = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 4, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x9b5de5, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
  );
  sprayBeacon.position.set(PLACES.spray.at[0], 13, PLACES.spray.at[1]);
  scene.add(sprayBeacon);

  const state = {
    screen: SCREEN_TITLE,
    cash: 0,
    tokensTaken: TOKEN_SPOTS.map(() => false),
    missionsDone: 0,
    clockMinutes: 17 * 60 + 42,
    elapsed: 0,
    bustTimer: 0,
    pedHitCooldown: 0,
    crashCooldown: 0,
    saveTimer: 0,
    lastMissionKey: '',
    muted: false,
    exhaustTimer: 0,
    skidTimer: 0,
  };

  function saveGame() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: state.cash,
        tokensTaken: state.tokensTaken,
        missionsDone: state.missionsDone,
        finished: missions.finished,
      }));
    } catch { /* storage off: the run still plays, it just does not persist */ }
  }

  function loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function applySave(save) {
    if (!save) return;
    state.cash = save.cash || 0;
    state.tokensTaken = TOKEN_SPOTS.map((_, i) => !!save.tokensTaken?.[i]);
    state.missionsDone = save.missionsDone || 0;
    for (let i = 0; i < TOKEN_SPOTS.length; i += 1) {
      tokenMeshes[i].visible = !state.tokensTaken[i];
    }
    if (save.finished) missions.finished = true;
  }

  function resetRun() {
    player.x = START_POS.x;
    player.z = START_POS.z;
    player.heading = Math.PI;
    player.health = 100;
    player.ammo = player.ammoMax;
    player.inCar = null;
    player.mesh.visible = true;
    playerCar.x = 0;
    playerCar.z = 31;
    playerCar.heading = Math.PI;
    playerCar.speed = 0;
    playerCar.health = 100;
    playerCar.wrecked = false;
    clearWanted(police);
    cam.snapBehind(Math.PI);
    cam.update(0.1, { x: 0, y: 0, z: 62 }, Math.PI, false, 0);
  }

  function startGame(fresh) {
    const save = fresh ? null : loadSave();
    if (save) applySave(save);
    resetRun();
    if (missions.finished) {
      state.screen = SCREEN_PLAY;
      hud.showBanner('FREE ROAM', 'Story complete — cruise Neon Bay, collect tokens.', 4);
    } else if (save && state.missionsDone > 0 && state.missionsDone < MISSIONS.length) {
      // Continue the story where the save left it.
      startMission(missions, state.missionsDone);
      state.screen = SCREEN_PLAY;
      const mission = MISSIONS[missions.index];
      hud.showBanner(mission.title, mission.intro, 4.5);
      audio.missionStart();
    } else {
      startStory(missions);
      state.screen = SCREEN_PLAY;
      const mission = MISSIONS[missions.index];
      hud.showBanner(mission.title, mission.intro, 4.5);
      audio.missionStart();
    }
    audio.unlock();
    saveGame();
  }

  function respawn() {
    player.x = PLACES.safehouse.at[0];
    player.z = PLACES.safehouse.at[1] + 8;
    player.heading = Math.PI;
    player.health = 100;
    player.inCar = null;
    player.mesh.visible = true;
    playerCar.x = PLACES.safehouse.at[0] - 6;
    playerCar.z = PLACES.safehouse.at[1] + 8;
    playerCar.heading = Math.PI;
    playerCar.speed = 0;
    playerCar.health = 100;
    playerCar.wrecked = false;
    clearWanted(police);
    if (!missions.finished) startMission(missions, missions.index);
    cam.snapBehind(Math.PI);
    state.screen = SCREEN_PLAY;
    saveGame();
  }

  function nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    const pool = [playerCar, ...traffic];
    for (const car of pool) {
      if (car.police || car.wrecked) continue;
      const d = distance2D(player.x, player.z, car.x, car.z);
      if (d < bestD) {
        best = car;
        bestD = d;
      }
    }
    return best;
  }

  function enterCar(car) {
    player.inCar = car;
    player.mesh.visible = false;
    if (!car.owned && !car.stolen) {
      car.stolen = true;
      addWanted(police, 1);
      hud.showBanner('CAR STOLEN', 'Bay PD has your plate now — 1 star.', 2.5);
      audio.wantedUp();
      // A stolen traffic car leaves the traffic flow.
      const index = traffic.indexOf(car);
      if (index >= 0) traffic.splice(index, 1);
    }
    audio.click();
  }

  function exitCar() {
    const car = player.inCar;
    player.inCar = null;
    car.speed = 0;
    player.x = car.x - Math.sin(car.heading + Math.PI / 2) * 2.6;
    player.z = car.z - Math.cos(car.heading + Math.PI / 2) * 2.6;
    player.heading = car.heading;
    player.mesh.visible = true;
    player.mesh.position.set(player.x, 0, player.z);
    cam.snapBehind(player.heading);
    audio.click();
  }

  function missionEvents(events) {
    if (events & MISSION_STEP_DONE) {
      audio.pickup();
      state.saveTimer = 0.5;
    }
    if (events & MISSION_DONE) {
      const reward = missionReward(missions);
      state.cash += reward;
      state.missionsDone = Math.max(state.missionsDone, missions.index);
      if (missions.finished) state.missionsDone = MISSIONS.length;
      audio.missionComplete();
      effects.confetti(player.x, 3, player.z);
      if (missions.finished) {
        state.screen = SCREEN_COMPLETE;
        hud.showBanner('STORY COMPLETE', `Neon Bay is yours. +$${reward.toLocaleString('en-US')}`, 5);
        try {
          const best = Number(window.localStorage.getItem(BEST_KEY) || '0');
          if (state.cash > best) window.localStorage.setItem(BEST_KEY, String(state.cash));
        } catch { /* ignore */ }
      } else {
        const next = MISSIONS[missions.index];
        hud.showBanner(`${next.title}  •  +$${reward.toLocaleString('en-US')}`, next.intro, 4.5);
        audio.missionStart();
      }
      if (events & 0xff00) addWanted(police, (events >> 8) & 0xff);
      saveGame();
    }
    if (events & MISSION_FAILED) {
      audio.missionFail();
      hud.showBanner('MISSION FAILED', 'Out of time — the job is back on. Try again.', 3.5);
      clearWanted(police);
      startMission(missions, missions.index);
    }
  }

  // One fixed step of live play. `actions` is the frame's one-shot presses, read
  // once by main.js and passed in, so no press is lost or counted twice.
  function stepPlay(dt, input, actions) {
    state.elapsed += dt;
    state.clockMinutes += dt / 3;
    if (state.pedHitCooldown > 0) state.pedHitCooldown -= dt;
    if (state.crashCooldown > 0) state.crashCooldown -= dt;
    if (state.saveTimer > 0) {
      state.saveTimer -= dt;
      if (state.saveTimer <= 0) saveGame();
    }
    if (actions & ACTION_PAUSE) {
      state.screen = SCREEN_PAUSED;
      return;
    }
    const drive = input.drive();
    const mouse = input.takeMouseDelta();
    const wheel = input.takeWheel();
    if (mouse.x || mouse.y) cam.drag(mouse.x, mouse.y);
    if (wheel) cam.zoom(wheel);

    let inCar = !!player.inCar;
    const threat = {
      x: inCar ? player.inCar.x : player.x,
      z: inCar ? player.inCar.z : player.z,
      danger: inCar ? Math.abs(player.inCar.speed) > 8 : false,
    };

    if (inCar) {
      const car = player.inCar;
      // The driver rides inside: keep the on-foot mesh hidden and glued to the car.
      player.mesh.visible = false;
      player.mesh.position.set(car.x, 0, car.z);
      driveCar(car, drive, dt, city.colliders, (impact) => {
        if (state.crashCooldown <= 0) {
          audio.crash();
          effects.sparks(car.x, car.z, impact);
          state.crashCooldown = 0.5;
        }
        car.health -= impact * 0.9;
      });
      player.x = car.x;
      player.z = car.z;
      player.heading = car.heading;
      // Ram traffic cars and pedestrians.
      for (const other of [...traffic]) {
        const impact = collideCars(car, other);
        if (impact > 6) {
          if (state.crashCooldown <= 0) {
            audio.crash();
            effects.sparks(car.x, car.z, impact);
            state.crashCooldown = 0.5;
          }
          car.health -= impact * 0.7;
        }
      }
      for (const ped of peds) {
        if (ped.down > 0) continue;
        if (distance2D(car.x, car.z, ped.x, ped.z) < 3.2 && Math.abs(car.speed) > 3) {
          knockPedDown(ped);
          effects.sparks(ped.x, ped.z, 6);
          if (state.pedHitCooldown <= 0) {
            addWanted(police, 1);
            audio.wantedUp();
            hud.showBanner('PEDESTRIAN DOWN', 'A witness called it in — wanted level up.', 2.5);
            state.pedHitCooldown = 3;
          }
        }
      }
      // Smoke when the car is nearly wrecked; wrecked cars stop dead.
      if (car.health <= 0 && !car.wrecked) {
        car.wrecked = true;
        car.speed = 0;
        effects.smoke(car.x, car.z);
        hud.showBanner('CAR WRECKED', 'This ride is done — find another one.', 3);
        exitCar();
      } else if (car.health < 35 && Math.random() < dt * 6) {
        effects.smoke(car.x + Math.sin(car.heading) * 1.5, car.z + Math.cos(car.heading) * 1.5);
      }
      if (actions & ACTION_ENTER) exitCar();
      // Exhaust puffs while accelerating, skid dust while handbraking hard.
      const rearX = car.x - Math.sin(car.heading) * 2.4;
      const rearZ = car.z - Math.cos(car.heading) * 2.4;
      if (drive.throttle > 0.5 && Math.abs(car.speed) > 5) {
        state.exhaustTimer -= dt;
        if (state.exhaustTimer <= 0) {
          effects.exhaust(rearX, rearZ);
          state.exhaustTimer = 0.12;
        }
      }
      if (drive.brake && Math.abs(car.speed) > 10) {
        state.skidTimer -= dt;
        if (state.skidTimer <= 0) {
          effects.dust(rearX, rearZ);
          state.skidTimer = 0.08;
        }
      }
    } else {
      stepPlayerOnFoot(player, input.move(), cam.yaw, dt, city.colliders);
      if (actions & ACTION_ENTER) {
        const car = nearestCar(4.6);
        if (car) enterCar(car);
      }
      if (actions & ACTION_PUNCH) {
        const ped = punchTarget(player, peds);
        audio.punch();
        if (ped) {
          knockPedDown(ped);
          addWanted(police, 1);
          audio.wantedUp();
          hud.showBanner('ASSAULT', 'Someone called Bay PD — wanted level up.', 2.5);
        }
      }
      if (actions & ACTION_SHOOT) {
        const hit = shootTarget(player, peds, police.cars);
        audio.gunshot();
        const mx = player.x + Math.sin(player.heading) * 1.2;
        const mz = player.z + Math.cos(player.heading) * 1.2;
        effects.muzzle(mx, 1.4, mz);
        if (hit?.ped) {
          knockPedDown(hit.ped);
          addWanted(police, 1);
          audio.wantedUp();
        } else if (hit?.car) {
          hit.car.health -= 25;
          effects.sparks(hit.car.x, hit.car.z, 8);
          addWanted(police, 1);
          audio.wantedUp();
        } else {
          addWanted(police, 0); // a shot in the air still draws eyes if police are near
          if (police.cars.some((c) => distance2D(c.x, c.z, player.x, player.z) < 40)) addWanted(police, 1);
        }
      }
    }

    // The player may have got in or out of a car in the branch above: refresh the
    // flag so everything below reads the live state, not the step's start.
    inCar = !!player.inCar;

    // Police chase the player (in a car or on foot) and ram. Read player.inCar
    // live here: the player may have just got out of the car this very step,
    // and the `inCar` flag above is stale by then.
    const target = {
      x: player.x,
      z: player.z,
      vx: player.inCar ? Math.sin(player.inCar.heading) * player.inCar.speed : 0,
      vz: player.inCar ? Math.cos(player.inCar.heading) * player.inCar.speed : 0,
    };
    stepPolice(police, dt, target, city.colliders, random, (car) => {
      if (player.inCar) {
        const impact = collideCars(player.inCar, car);
        if (impact > 5 && state.crashCooldown <= 0) {
          audio.crash();
          effects.sparks(player.x, player.z, impact);
          state.crashCooldown = 0.5;
          player.inCar.health -= impact * 0.6;
        }
      } else {
        player.health -= 26 * dt;
        state.bustTimer += dt;
        if (state.bustTimer > 1.6) {
          state.cash = Math.max(0, Math.floor(state.cash * 0.9));
          state.screen = SCREEN_BUSTED;
          audio.busted();
          hud.showBanner('BUSTED', 'Bay PD took you in — 10% of your cash is gone.', 4);
          return;
        }
      }
    });
    if (police.cars.length === 0 || police.cars.every((c) => distance2D(c.x, c.z, player.x, player.z) > 4)) {
      state.bustTimer = Math.max(0, state.bustTimer - dt * 2);
    }

    // Health regens when the heat is off.
    if (police.wanted === 0 && player.health < 100) player.health = Math.min(100, player.health + 4 * dt);
    if (player.health <= 0) {
      state.cash = Math.max(0, state.cash - 200);
      state.screen = SCREEN_WASTED;
      audio.busted();
      hud.showBanner('WASTED', 'You wake up at the safehouse — $200 lighter.', 4);
      return;
    }

    // Traffic and pedestrians live their own lives.
    stepTraffic(traffic, dt, city.colliders, player.inCar, random);
    stepPedestrians(peds, dt, city.colliders, threat, random);
    effects.step(dt);

    // Missions advance; a step change can raise the heat (the delivery, the getaway).
    const key = `${missions.index}:${missions.step}`;
    const events = stepMissions(missions, dt, { x: player.x, z: player.z, inCar, wanted: police.wanted });
    if (key !== state.lastMissionKey) {
      const step = missions.active ? MISSIONS[missions.index].steps[missions.step] : null;
      if (step?.wantedOnStart) addWanted(police, step.wantedOnStart);
      state.lastMissionKey = key;
    }
    missionEvents(events);

    // The Midnight Apex street race runs alongside the story, in a car only.
    const raceEvents = stepRace(race, dt, { x: player.x, z: player.z, inCar });
    if (raceEvents & RACE_STARTED) {
      audio.missionStart();
      hud.showBanner('STREET RACE', 'Midnight Apex — hit gates 2, 3 and 4 before the clock runs out!', 3.5);
    }
    if (raceEvents & RACE_GATE) {
      audio.pickup();
      hud.showBanner(`GATE ${race.nextGate} OF 4`, `Next gate marked on the minimap — ${Math.ceil(race.timer)}s left.`, 2);
    }
    if (raceEvents & RACE_WON) {
      const reward = raceReward();
      state.cash += reward;
      audio.missionComplete();
      effects.confetti(player.x, 3, player.z);
      hud.showBanner('RACE WON', `Midnight Apex pays +$${reward.toLocaleString('en-US')} — the circuit is yours.`, 4);
      state.saveTimer = 0.5;
    }
    if (raceEvents & RACE_FAILED) {
      audio.missionFail();
      hud.showBanner('RACE OVER', 'Out of time — the gates reset. Drive through gate 1 to go again.', 3);
    }

    // Tokens: walk or drive through a ring to bank $100.
    for (let i = 0; i < TOKEN_SPOTS.length; i += 1) {
      if (state.tokensTaken[i]) continue;
      const [tx, tz] = TOKEN_SPOTS[i];
      if (distance2D(player.x, player.z, tx, tz) < 2.8) {
        state.tokensTaken[i] = true;
        tokenMeshes[i].visible = false;
        state.cash += TOKEN_REWARD;
        audio.token();
        effects.sparkle(tx, 1.6, tz);
        state.saveTimer = 0.5;
      }
      tokenMeshes[i].rotation.y += dt * 1.4;
      tokenMeshes[i].position.y = 1.4 + Math.sin(state.elapsed * 2 + i) * 0.25;
    }

    // Spray & Shade: drive in with heat to clear it for $100.
    if (police.wanted > 0 && inCar && distance2D(player.x, player.z, PLACES.spray.at[0], PLACES.spray.at[1]) < 9) {
      if (state.cash >= 100) {
        state.cash -= 100;
        clearWanted(police);
        audio.pickup();
        hud.showBanner('HEAT CLEARED', 'New paint, new plates — $100. Bay PD lost you.', 3);
        state.saveTimer = 0.5;
      }
    }

    // Camera follows the player or the car.
    const focus = { x: player.x, y: 0, z: player.z };
    cam.update(dt, focus, player.heading, inCar, inCar ? Math.abs(player.inCar.speed) / 40 : 0);
    audio.engine(inCar ? Math.abs(player.inCar.speed) / 40 : 0, inCar);
    audio.siren(police.wanted > 0 && police.cars.length > 0);
    updateHud();
  }

  function updateHud() {
    const marker = missionMarker(missions) || raceMarker(race);
    const hh = Math.floor(state.clockMinutes / 60) % 24;
    const mm = Math.floor(state.clockMinutes % 60);
    const nearCar = !player.inCar && nearestCar(4.6);
    let hint = 'WASD move • SHIFT run • F punch • CLICK shoot • P pause';
    if (player.inCar) hint = 'WASD drive • SPACE handbrake • E get out • M mute';
    else if (nearCar) hint = 'E get in the car • F punch • CLICK shoot • M mute';
    if (!missions.active && !missions.finished) hint = 'ENTER start the story • ' + hint;
    if (police.wanted > 0 && player.inCar) hint += ' • Spray & Shade clears heat ($100)';
    if (race.active) hint = 'STREET RACE — follow the orange gate on the minimap!';
    const raceOn = race.active;
    hud.update({
      cash: state.cash,
      health: Math.round(player.health),
      wanted: police.wanted,
      missionTitle: raceOn ? 'STREET RACE — MIDNIGHT APEX' : missionTitle(missions),
      missionText: raceOn ? raceObjective(race) : missionObjective(missions),
      missionDist: marker ? `${Math.round(distance2D(player.x, player.z, marker.x, marker.z))}m` : '',
      missionTimerText: raceOn ? `⏱ ${Math.ceil(race.timer)}s` : (missions.timer > 0 ? `⏱ ${Math.ceil(missions.timer)}s` : ''),
      clockText: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
      inCar: !!player.inCar,
      speed: player.inCar ? player.inCar.speed : 0,
      ammo: player.ammo,
      ammoMax: player.ammoMax,
      hint,
      playerX: player.x,
      playerZ: player.z,
      playerHeading: player.heading,
      traffic,
      policeCars: police.cars,
      tokensTaken: state.tokensTaken,
      missionMarker: marker,
    }, STEP);
  }

  // Ambient life for the title screen: traffic and pedestrians move, nothing else.
  function stepAmbient(dt, focus = { x: 0, y: 0, z: 62 }) {
    state.elapsed += dt;
    stepTraffic(traffic, dt, city.colliders, null, random);
    stepPedestrians(peds, dt, city.colliders, { x: 9999, z: 9999, danger: false }, random);
    effects.step(dt);
    cam.update(dt, focus, Math.PI, false, 0);
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  resize();
  window.addEventListener('resize', resize);

  return {
    state,
    audio,
    hud,
    missions,
    race,
    police,
    player,
    playerCar,
    traffic,
    peds,
    cam,
    screen: () => state.screen,
    setScreen(s) {
      state.screen = s;
    },
    startGame,
    respawn,
    resetRun,
    loadSave,
    applySave,
    saveGame,
    stepPlay,
    stepAmbient,
    updateHud,
    render() {
      renderer.render(scene, camera);
    },
  };
}
