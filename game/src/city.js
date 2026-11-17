// Neon Bay Heat — the city itself: ground, sky, sun, buildings, palms, street
// lights, the beach and the sea, plus the collision boxes and the spawn points the
// other systems use. Everything is placed from the seeded random, so one seed is one
// city. West of the grid sits Rustport Docks, the night-shift industrial port:
// container stacks, gantry cranes, warehouses and a cargo ship at the far quay.
import * as THREE from 'three';
import { BEACH_X, BLOCK, CITY_HALF, GRID, PALETTE, PITCH, PORT_EDGE, PORT_X, ROAD, SEA_X } from './config.js';
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
  // A cool fill from the sea side so shadowed facades are not dead black.
  const fill = new THREE.DirectionalLight(0x8fb4ff, 0.5);
  fill.position.set(260, 90, 160);
  group.add(fill);

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
        // A pocket park: lawn, bushes, palms and a bench instead of a tower.
        const lawn = new THREE.Mesh(
          new THREE.PlaneGeometry(BLOCK - 4, BLOCK - 4),
          new THREE.MeshStandardMaterial({ color: 0x4d9e57, roughness: 1 }),
        );
        lawn.rotation.x = -Math.PI / 2;
        lawn.position.set(cx, 0.06, cz);
        lawn.receiveShadow = true;
        group.add(lawn);
        plantPalms(group, random, cx, cz, 5);
        for (let b = 0; b < 4; b += 1) addBush(group, cx + random.range(-BLOCK / 2 + 5, BLOCK / 2 - 5), cz + random.range(-BLOCK / 2 + 5, BLOCK / 2 - 5));
        addBench(group, cx + random.range(-8, 8), cz + random.range(-8, 8), random.range(0, Math.PI));
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
        // Tall towers step back: a smaller crown box on top.
        if (h > 26) {
          const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.45, random.range(3, 7), d * 0.45), mat);
          crown.position.set(x, h + 1.2 + crown.geometry.parameters.height / 2, z);
          crown.castShadow = true;
          group.add(crown);
        }
        // Roof clutter: an AC unit and, on the tallest, a blinking antenna.
        if (random.chance(0.6)) {
          const ac = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 1.6), new THREE.MeshStandardMaterial({ color: 0x9a9aa2, roughness: 0.8, metalness: 0.4 }));
          ac.position.set(x + w * 0.2, h + 1.7, z + d * 0.15);
          group.add(ac);
        }
        if (h > 38) {
          const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 7, 5), new THREE.MeshStandardMaterial({ color: 0x55555e, roughness: 0.5, metalness: 0.7 }));
          antenna.position.set(x - w * 0.2, h + 4.5, z - d * 0.2);
          group.add(antenna);
          const tip = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff4444 }));
          tip.position.set(x - w * 0.2, h + 8.2, z - d * 0.2);
          group.add(tip);
        }
        // A neon rooftop sign on the taller towers, and a vertical neon strip
        // down one face so the skyline glows from the street too.
        if (h > 22 && random.chance(0.55)) {
          const sign = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.5, 2.2, 0.4),
            new THREE.MeshBasicMaterial({ color: PALETTE.neon[random.int(0, PALETTE.neon.length - 1)] }),
          );
          sign.position.set(x, h + 2.4, z - d / 2 - 0.2);
          group.add(sign);
        }
        if (h > 18 && random.chance(0.4)) {
          const strip = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, h * 0.7, 0.5),
            new THREE.MeshBasicMaterial({ color: PALETTE.neon[random.int(0, PALETTE.neon.length - 1)] }),
          );
          strip.position.set(x + w / 2 + 0.3, h * 0.35, z + d * 0.2);
          group.add(strip);
        }
        // A big glowing billboard on the roof edge of one building in five.
        if (random.chance(0.2)) {
          const boardColor = PALETTE.neon[random.int(0, PALETTE.neon.length - 1)];
          const board = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.62, 4.5, 0.3),
            new THREE.MeshBasicMaterial({ color: boardColor }),
          );
          board.position.set(x, h + 3.6, z - d / 2 - 0.4);
          group.add(board);
          const boardBack = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.62, 4.5, 0.2),
            new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.9 }),
          );
          boardBack.position.set(x, h + 3.6, z - d / 2 - 0.6);
          group.add(boardBack);
          const frame = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.62 + 0.6, 0.4, 0.5),
            new THREE.MeshStandardMaterial({ color: 0x22222a, roughness: 0.7 }),
          );
          frame.position.set(x, h + 6, z - d / 2 - 0.5);
          group.add(frame);
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

  // Street props: traffic lights at the central intersections, hydrants, stop
  // signs, beach umbrellas and benches, and palms along the main avenues.
  const lightColors = [0xff2a2a, 0xffc93c, 0x2ec44b];
  for (let i = -2; i <= 2; i += 1) {
    for (let j = -2; j <= 2; j += 1) {
      const lx = i * PITCH + ROAD / 2 + 1.6;
      const lz = j * PITCH + ROAD / 2 + 1.6;
      const tPole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.4, 6), poleMat);
      tPole.position.set(lx, 2.7, lz);
      group.add(tPole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.5, 0.55), new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.6 }));
      head.position.set(lx, 5.6, lz);
      group.add(head);
      for (let k = 0; k < 3; k += 1) {
        const lamp = new THREE.Mesh(
          new THREE.SphereGeometry(0.17, 8, 6),
          new THREE.MeshBasicMaterial({ color: lightColors[k] }),
        );
        lamp.position.set(lx, 6.05 - k * 0.45, lz + 0.29);
        group.add(lamp);
      }
    }
  }
  const hydrantMat = new THREE.MeshStandardMaterial({ color: 0xd62828, roughness: 0.5, metalness: 0.3 });
  const hydrantCapMat = new THREE.MeshStandardMaterial({ color: 0x8f1d1d, roughness: 0.5 });
  for (let h = 0; h < 14; h += 1) {
    const hx = random.pick([-124, -62, 0, 62, 124]) + random.range(-3, 3) + (random.chance(0.5) ? 9 : -9);
    const hz = random.pick([-124, -62, 0, 62, 124]) + random.range(-3, 3);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.9, 8), hydrantMat);
    body.position.set(hx, 0.45, hz);
    body.castShadow = true;
    group.add(body);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), hydrantCapMat);
    cap.position.set(hx, 0.95, hz);
    group.add(cap);
  }
  // Stop signs on a few side streets.
  for (let s = 0; s < 12; s += 1) {
    const sx = random.pick([-186, -124, -62, 0, 62, 124, 186]);
    const sz = random.pick([-186, -124, -62, 0, 62, 124, 186]) + (random.chance(0.5) ? 9.5 : -9.5);
    const sPole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 5), poleMat);
    sPole.position.set(sx, 1.3, sz);
    group.add(sPole);
    const oct = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.08, 8),
      new THREE.MeshStandardMaterial({ color: 0xd62828, roughness: 0.6 }),
    );
    oct.rotation.x = Math.PI / 2;
    oct.position.set(sx, 2.9, sz);
    group.add(oct);
  }
  // Beach umbrellas and benches along the sand.
  const umbrellaColors = [0xff2e88, 0x00f5d4, 0xfee440, 0x9b5de5, 0xff8e63];
  for (let u = 0; u < 8; u += 1) {
    const ux = BEACH_X + 6 + random.range(0, 22);
    const uz = -170 + u * 48 + random.range(-8, 8);
    const uPole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.4, 5), poleMat);
    uPole.position.set(ux, 1.2, uz);
    group.add(uPole);
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(2.4, 1.1, 8),
      new THREE.MeshStandardMaterial({ color: umbrellaColors[u % umbrellaColors.length], roughness: 0.9 }),
    );
    canopy.position.set(ux, 2.8, uz);
    canopy.castShadow = true;
    group.add(canopy);
  }
  for (let b = 0; b < 6; b += 1) {
    addBench(group, BEACH_X - 4, -150 + b * 60, Math.PI / 2);
  }
  // Boardwalk, beachfront hotels and the Neon Spire: the dense beachfront
  // district east of the grid, so the coast reads as a place, not an edge.
  // Hotels sit at x 226, clear of the Flamingo Beach pickup (z 124) and the
  // beach token (z 62); the Spire stands alone at the north end of the sand.
  const boardwalk = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 380),
    new THREE.MeshStandardMaterial({ color: 0x9a7b4f, roughness: 1 }),
  );
  boardwalk.rotation.x = -Math.PI / 2;
  boardwalk.position.set(222, 0.07, 0);
  boardwalk.receiveShadow = true;
  group.add(boardwalk);
  const hotelColors = [0xff8fa3, 0x7bdff2, 0xffd166, 0xf7ede2];
  const hotelSpots = [[-175, 52], [-85, 34], [-30, 46], [25, 30]];
  for (let h = 0; h < hotelSpots.length; h += 1) {
    const [hz, hh] = hotelSpots[h];
    const hx = 226;
    const mat = new THREE.MeshStandardMaterial({ map: facades[h % facades.length], roughness: 0.85 });
    const tower = new THREE.Mesh(new THREE.BoxGeometry(18, hh, 18), mat);
    tower.position.set(hx, hh / 2, hz);
    tower.castShadow = true;
    tower.receiveShadow = true;
    group.add(tower);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(12, 1.2, 12), roofMat);
    roof.position.set(hx, hh + 0.6, hz);
    group.add(roof);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(10, 2.4, 0.4),
      new THREE.MeshBasicMaterial({ color: PALETTE.neon[h % PALETTE.neon.length] }),
    );
    sign.position.set(hx, hh + 2.6, hz - 9.2);
    group.add(sign);
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, hh * 0.7, 0.5),
      new THREE.MeshBasicMaterial({ color: hotelColors[h % hotelColors.length] }),
    );
    strip.position.set(hx + 9.3, hh * 0.35, hz + 4);
    group.add(strip);
    colliders.push({ x: hx, z: hz, hw: 9, hd: 9 });
  }
  for (let z = -180; z <= 180; z += 36) plantPalms(group, random, 218, z, 1);
  // The Neon Spire: a striped lighthouse tower with a rotating beacon beam,
  // the one landmark you can see from anywhere in Neon Bay.
  const spireX = 240;
  const spireZ = -120;
  const spireBase = new THREE.Mesh(
    new THREE.CylinderGeometry(6.5, 7.5, 4, 12),
    new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.8 }),
  );
  spireBase.position.set(spireX, 2, spireZ);
  spireBase.castShadow = true;
  group.add(spireBase);
  const spireColors = [0xf7ede2, 0xff2e88, 0xf7ede2, 0x00f5d4, 0xf7ede2, 0xfee440];
  for (let s = 0; s < spireColors.length; s += 1) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4 - s * 0.12, 3.6 - s * 0.12, 7.5, 12),
      new THREE.MeshStandardMaterial({ color: spireColors[s], roughness: 0.7 }),
    );
    seg.position.set(spireX, 4 + s * 7.5 + 3.75, spireZ);
    seg.castShadow = true;
    group.add(seg);
  }
  const spireTop = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.2, 3, 10),
    new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.5, metalness: 0.6 }),
  );
  spireTop.position.set(spireX, 52, spireZ);
  group.add(spireTop);
  const spireLamp = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0 }),
  );
  spireLamp.position.set(spireX, 52, spireZ);
  group.add(spireLamp);
  const spireLight = new THREE.PointLight(0xfff2b0, 900, 160, 1.8);
  spireLight.position.set(spireX, 52, spireZ);
  group.add(spireLight);
  // Two long beams sweeping the sky from the lamp room, rotating over time.
  const spireBeam = new THREE.Group();
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  for (const dir of [-1, 1]) {
    const beam = new THREE.Mesh(new THREE.ConeGeometry(3.5, 60, 8, 1, true), beamMat);
    beam.rotation.z = dir * Math.PI / 2;
    beam.position.x = dir * 30;
    spireBeam.add(beam);
  }
  spireBeam.position.set(spireX, 52, spireZ);
  group.add(spireBeam);
  colliders.push({ x: spireX, z: spireZ, hw: 7.5, hd: 7.5 });
  // Palm rows along the two main avenues so the roads feel planted, not bare.
  for (let a = -2; a <= 2; a += 1) {
    plantPalms(group, random, 62 + 11, a * PITCH, 1);
    plantPalms(group, random, -62 - 11, a * PITCH, 1);
  }

  // Rustport Docks: the night-shift industrial port west of the grid.
  const portHook = buildRustport(group, random, colliders);

  // Parked cars along the beach boulevard and a few side streets.
  for (let i = 0; i < 10; i += 1) {
    PARKED_SPOTS.push([random.pick([-186, -124, -62, 0, 62, 124]) + random.range(-4, 4), random.pick([-186, -124, -62, 0, 62, 124]) + random.range(-4, 4)]);
  }

  return { colliders, group, parkedSpots: PARKED_SPOTS, spireBeam, portHook };
}

// Rustport Docks — container yard, gantry cranes, warehouses and a cargo ship.
// The apron is a dark asphalt plane west of the grid, lit by floodlights, so the
// port reads as a different place at a glance: industrial, night-shift, neon signs
// instead of pastel towers. Mission 6's pickup sits in a clear lane at (-248, 60).
function buildRustport(group, random, colliders) {
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x4a4a55, roughness: 0.7, metalness: 0.4 });
  const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.7, metalness: 0.5 });
  const apronMat = new THREE.MeshStandardMaterial({ color: 0x3a3a44, roughness: 1 });

  // The apron: dark asphalt from the grid edge out past the quay, so the port
  // has ground under it beyond the city ground plane.
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(152, 400), apronMat);
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(PORT_X, 0.04, 0);
  apron.receiveShadow = true;
  group.add(apron);
  // Yellow lane paint on the apron, marking the truck lanes through the yard.
  const laneMat = new THREE.MeshStandardMaterial({ color: 0xf5d76e, roughness: 0.9 });
  for (const lz of [-120, -40, 40, 120]) {
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 56), laneMat);
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(-232, 0.06, lz);
    group.add(lane);
  }

  // Container stacks: bright steel boxes, 1–3 high, some turned sideways.
  // The pickup lane around (-248, 60) stays clear.
  const containerColors = [0xd62828, 0x2266aa, 0x2a9d8f, 0xe9c46a, 0x9b5de5, 0xf4a261];
  const stackSpots = [
    [-292, -150], [-268, -150], [-292, -110], [-262, -110], [-292, -70], [-268, -70],
    [-292, -30], [-262, -30], [-292, 10], [-268, 10], [-292, 110], [-268, 110],
    [-292, 150], [-268, 150], [-232, -150], [-232, -110], [-232, -70], [-232, 150],
    [-292, -170], [-262, 170], [-232, 30],
  ];
  for (const [sx, sz] of stackSpots) {
    if (Math.hypot(sx + 248, sz - 60) < 16) continue; // keep the pickup lane clear
    const sideways = random.chance(0.35);
    const levels = random.int(1, 3);
    const color = containerColors[random.int(0, containerColors.length - 1)];
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.35 });
    const ribMat = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.7 });
    for (let lv = 0; lv < levels; lv += 1) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(sideways ? 2.7 : 6.2, 2.6, sideways ? 6.2 : 2.7), mat);
      box.position.set(sx, 1.3 + lv * 2.6, sz);
      box.castShadow = true;
      box.receiveShadow = true;
      group.add(box);
      // A dark rib across the top so a stack reads as containers, not a wall.
      const rib = new THREE.Mesh(new THREE.BoxGeometry(sideways ? 2.75 : 6.25, 0.18, sideways ? 6.25 : 2.75), ribMat);
      rib.position.set(sx, 2.55 + lv * 2.6, sz);
      group.add(rib);
    }
    colliders.push({ x: sx, z: sz, hw: sideways ? 1.5 : 3.2, hd: sideways ? 3.2 : 1.5 });
  }

  // Warehouses along the far quay, with glowing signs on their east faces.
  const warehouseSpots = [[-312, -120, 'RUSTPORT'], [-312, 0, 'CARGO 7'], [-312, 120, 'DOCK 9']];
  const signColors = [0xff2e88, 0x00f5d4, 0xfee440];
  for (let w = 0; w < warehouseSpots.length; w += 1) {
    const [wx, wz] = warehouseSpots[w];
    const shed = new THREE.Mesh(new THREE.BoxGeometry(22, 10, 30), steelMat);
    shed.position.set(wx, 5, wz);
    shed.castShadow = true;
    shed.receiveShadow = true;
    group.add(shed);
    const shedRoof = new THREE.Mesh(new THREE.BoxGeometry(23, 1, 31), darkSteelMat);
    shedRoof.position.set(wx, 10.5, wz);
    group.add(shedRoof);
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(15, 2.4, 0.4),
      new THREE.MeshBasicMaterial({ color: signColors[w % signColors.length] }),
    );
    sign.position.set(wx + 11.2, 8, wz);
    group.add(sign);
    // Roller doors on the east face, facing the yard.
    for (const dz of [-8, 0, 8]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5, 5), darkSteelMat);
      door.position.set(wx + 11.1, 2.5, wz + dz);
      group.add(door);
    }
    colliders.push({ x: wx, z: wz, hw: 11, hd: 15 });
  }

  // Two gantry cranes over the truck lanes: four legs, a top beam, a trolley
  // and a hook hanging on a cable. Crane 7's hook sways gently over time.
  let portHook = null;
  const craneSpots = [[-215, -60, 'CRANE 7'], [-215, 90, 'CRANE 9']];
  for (let c = 0; c < craneSpots.length; c += 1) {
    const [cx, cz, label] = craneSpots[c];
    const crane = new THREE.Group();
    for (const [lx, lz] of [[-7, -5], [7, -5], [-7, 5], [7, 5]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 26, 1.2), darkSteelMat);
      leg.position.set(lx, 13, lz);
      leg.castShadow = true;
      crane.add(leg);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(2, 2.2, 34), steelMat);
    beam.position.set(0, 27, 0);
    beam.castShadow = true;
    crane.add(beam);
    const beamSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 1.8, 12),
      new THREE.MeshBasicMaterial({ color: c === 0 ? 0xfee440 : 0x00f5d4 }),
    );
    beamSign.position.set(1.3, 27, 0);
    crane.add(beamSign);
    // Trolley and hook: a cable drops from the beam, a container hangs on it.
    const trolley = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 2.4), darkSteelMat);
    trolley.position.set(0, 25.4, 2);
    crane.add(trolley);
    const hookGroup = new THREE.Group();
    hookGroup.position.set(0, 25, 2);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 15, 5), darkSteelMat);
    cable.position.y = -7.5;
    hookGroup.add(cable);
    const hookBox = new THREE.Mesh(
      new THREE.BoxGeometry(3, 2.4, 2.4),
      new THREE.MeshStandardMaterial({ color: containerColors[c * 2 + 1], roughness: 0.6, metalness: 0.35 }),
    );
    hookBox.position.y = -16;
    hookBox.castShadow = true;
    hookGroup.add(hookBox);
    crane.add(hookGroup);
    if (c === 0) portHook = hookGroup;
    crane.position.set(cx, 0, cz);
    group.add(crane);
    colliders.push({ x: cx - 7, z: cz, hw: 1.2, hd: 6 });
    colliders.push({ x: cx + 7, z: cz, hw: 1.2, hd: 6 });
  }

  // A cargo ship at the far quay, beyond the driveable apron: hull, deck
  // containers and a funnel, so the port ends on water, not on a void.
  const ship = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(24, 7, 74), new THREE.MeshStandardMaterial({ color: 0x1d3557, roughness: 0.6, metalness: 0.4 }));
  hull.position.y = 3.5;
  hull.castShadow = true;
  ship.add(hull);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(22, 1, 70), darkSteelMat);
  deck.position.y = 7.5;
  ship.add(deck);
  for (let s = 0; s < 8; s += 1) {
    const deckBox = new THREE.Mesh(
      new THREE.BoxGeometry(5, 2.4, 5),
      new THREE.MeshStandardMaterial({ color: containerColors[s % containerColors.length], roughness: 0.6, metalness: 0.35 }),
    );
    deckBox.position.set(s % 2 ? 5.5 : -5.5, 9.2, -28 + s * 8);
    ship.add(deckBox);
  }
  const funnel = new THREE.Mesh(new THREE.BoxGeometry(6, 8, 4), new THREE.MeshStandardMaterial({ color: 0xe9c46a, roughness: 0.6 }));
  funnel.position.set(0, 12, -32);
  ship.add(funnel);
  ship.position.set(-362, 0, 0);
  group.add(ship);

  // Floodlight poles over the yard, with two real point lights so the port
  // glows amber against the sunset city.
  const floodPoleMat = new THREE.MeshStandardMaterial({ color: 0x22222a, roughness: 0.6, metalness: 0.6 });
  for (const [fx, fz] of [[-200, -120], [-200, 120], [-326, -120], [-326, 120], [-200, 0], [-326, 0]]) {
    const fPole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 12, 6), floodPoleMat);
    fPole.position.set(fx, 6, fz);
    group.add(fPole);
    const fLamp = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    fLamp.position.set(fx, 12.2, fz);
    group.add(fLamp);
  }
  for (const [lx, lz] of [[-215, -60], [-215, 90]]) {
    const light = new THREE.PointLight(0xffd9a0, 500, 130, 1.8);
    light.position.set(lx, 20, lz);
    group.add(light);
  }

  // Barrels, crates and a forklift: small props so the yard floor is not bare.
  const barrelColors = [0x8a5a3b, 0x2266aa, 0x2a9d8f];
  for (let b = 0; b < 12; b += 1) {
    const bx = -240 + random.range(-30, 30);
    const bz = -160 + b * 28 + random.range(-6, 6);
    if (Math.hypot(bx + 248, bz - 60) < 14) continue;
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.6, 1.1, 8),
      new THREE.MeshStandardMaterial({ color: barrelColors[b % barrelColors.length], roughness: 0.8, metalness: 0.3 }),
    );
    barrel.position.set(bx, 0.55, bz);
    barrel.castShadow = true;
    group.add(barrel);
  }
  const forklift = new THREE.Group();
  const forkBody = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 2.6), new THREE.MeshStandardMaterial({ color: 0xf5c518, roughness: 0.5, metalness: 0.3 }));
  forkBody.position.y = 0.8;
  forkBody.castShadow = true;
  forklift.add(forkBody);
  const mast = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, 0.15), darkSteelMat);
  mast.position.set(0, 1.6, 1.4);
  forklift.add(mast);
  for (const side of [-1, 1]) {
    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 1.2), darkSteelMat);
    fork.position.set(side * 0.5, 0.15, 1.9);
    forklift.add(fork);
  }
  forklift.position.set(-238, 0, 28);
  forklift.rotation.y = Math.PI / 4;
  group.add(forklift);

  return portHook;
}

function addBush(group, x, z) {
  const bush = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x2f7d3d, roughness: 1 }),
  );
  bush.scale.y = 0.75;
  bush.position.set(x, 0.7, z);
  bush.castShadow = true;
  group.add(bush);
}

function addBench(group, x, z, rotY) {
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a5a3b, roughness: 0.9 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.6, metalness: 0.5 });
  const bench = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.7), woodMat);
  seat.position.y = 0.55;
  seat.castShadow = true;
  bench.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 0.1), woodMat);
  back.position.set(0, 1.0, -0.32);
  back.rotation.x = -0.15;
  bench.add(back);
  for (const lx of [-0.9, 0.9]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.6), ironMat);
    leg.position.set(lx, 0.28, 0);
    bench.add(leg);
  }
  bench.position.set(x, 0, z);
  bench.rotation.y = rotY;
  group.add(bench);
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
