// Neon Bay Heat — shared constants: the city grid, the palette, the story and the
// tuning numbers every system reads. One place to change the feel of the game.
import * as THREE from 'three';

// The city is a grid of square blocks separated by roads. Roads run along both axes at
// multiples of PITCH; blocks sit between them. The beach and the sea are east of the grid.
export const PITCH = 62; // distance between neighbouring road centrelines
export const ROAD = 14; // road width
export const BLOCK = PITCH - ROAD; // block side
export const GRID = 3; // roads at -GRID..GRID * PITCH on each axis
export const CITY_HALF = GRID * PITCH + ROAD / 2; // ~193, edge of the outermost road
export const BEACH_X = 214; // where the sand starts
export const SEA_X = 252; // where the water starts

// Sun-soaked Neon Bay: warm sunset sky, pastel towers, neon signs.
export const PALETTE = {
  skyTop: 0x2e4a7a,
  skyMid: 0xff8e63,
  skyLow: 0xffc98a,
  fog: 0xf2a56b,
  sun: 0xffd9a0,
  road: 0x33303a,
  roadLine: 0xf5d76e,
  sidewalk: 0xb9b0a2,
  sand: 0xe8cf9e,
  sea: 0x2e86ab,
  seaDeep: 0x1d5f7a,
  building: [0xff8fa3, 0xffd166, 0x7bdff2, 0xf7ede2, 0xe07a5f, 0x81b29a, 0xf2cc8f, 0xcdb4db, 0xffafcc, 0xa2d2ff, 0xf4a261, 0x90be6d],
  trafficCar: [0xe63946, 0xf4a261, 0x2a9d8f, 0x457b9d, 0xe9c46a, 0x8d99ae, 0xef476f, 0x06d6a0, 0x9b5de5, 0xf15bb5],
  playerCar: 0xff2e88, // hot pink Vortex GT
  policeCar: 0xf1faee,
  pedShirt: [0xef476f, 0xffd166, 0x06d6a0, 0x118ab2, 0x9b5de5, 0xf15bb5, 0x073b4c, 0xffffff],
  neon: [0xff2e88, 0x00f5d4, 0xfee440, 0x9b5de5, 0x00bbf9],
};

export const STEP = 1 / 60; // fixed simulation step
export const SAVE_KEY = 'neon-bay-heat-save-v1';
export const BEST_KEY = 'neon-bay-heat-best-v1';

// On-foot and driving feel.
export const WALK_SPEED = 6.5;
export const RUN_SPEED = 10.5;
export const CAR_ACCEL = 26;
export const CAR_BRAKE = 42;
export const CAR_MAX_SPEED = 40;
export const CAR_MAX_REVERSE = 13;
export const CAR_TURN = 1.9; // radians per second at full lock, scaled by speed
export const CAR_RADIUS = 2.3;
export const PLAYER_RADIUS = 0.9;

// Wanted levels: stars, how many police cars hunt, how fast they are.
export const WANTED = [
  { stars: 0, police: 0, policeSpeed: 0 },
  { stars: 1, police: 1, policeSpeed: 34 },
  { stars: 2, police: 2, policeSpeed: 37 },
  { stars: 3, police: 3, policeSpeed: 40 },
  { stars: 4, police: 4, policeSpeed: 43 },
  { stars: 5, police: 4, policeSpeed: 46 },
];
export const WANTED_DECAY_SECONDS = 12; // quiet time before one star drops

// The story: five missions in order. Each step is one objective with a marker.
export const MISSIONS = [
  {
    id: 'first-gear',
    title: 'MISSION 1 — FIRST GEAR',
    intro: 'Kai Mercer is new in Neon Bay. Marco Hale needs a driver who asks no questions.',
    reward: 500,
    steps: [
      { id: 'steal', text: 'Steal a car — walk up to one and press E', kind: 'steal' },
      { id: 'garage', text: "Drive to Marco's Garage", kind: 'goto', at: [124, -124], radius: 10 },
    ],
  },
  {
    id: 'hot-delivery',
    title: 'MISSION 2 — HOT DELIVERY',
    intro: 'A package at Sunset Docks. The Neon Hotel wants it fast — and the law is watching.',
    reward: 1200,
    steps: [
      { id: 'pickup', text: 'Pick up the package at Sunset Docks', kind: 'goto', at: [-186, 186], radius: 9 },
      { id: 'deliver', text: 'Deliver to the Neon Hotel — 90 seconds!', kind: 'goto', at: [62, -62], radius: 10, time: 90, wantedOnStart: 1 },
    ],
  },
  {
    id: 'bayfront-getaway',
    title: 'MISSION 3 — BAYFRONT GETAWAY',
    intro: 'Bay PD is on you, three stars deep. Lose them and vanish at the safehouse.',
    reward: 2500,
    steps: [
      { id: 'escape', text: 'Lose the heat — reach the Bayfront Safehouse', kind: 'escape', at: [186, 186], radius: 11, wantedOnStart: 3 },
    ],
  },
  {
    id: 'neon-runner',
    title: 'MISSION 4 — NEON RUNNER',
    intro: 'The Midnight Apex crew runs the avenues at dusk. Beat their circuit — three gates, against the clock.',
    reward: 1800,
    steps: [
      { id: 'gate1', text: 'Hit the first race gate on Palm Row', kind: 'goto', at: [62, 186], radius: 9, time: 50 },
      { id: 'gate2', text: 'Second gate — south avenue, west end', kind: 'goto', at: [-124, 186], radius: 9, time: 50 },
      { id: 'gate3', text: 'Final gate — cross the city to the north-east', kind: 'goto', at: [124, -62], radius: 9, time: 60 },
    ],
  },
  {
    id: 'big-score',
    title: 'MISSION 5 — THE BIG SCORE',
    intro: 'One last job: a duffel of hot diamonds at Flamingo Beach. Marco wants it at the garage — Bay PD wants you.',
    reward: 3500,
    steps: [
      { id: 'pickup', text: 'Pick up the diamonds at Flamingo Beach', kind: 'goto', at: [228, 124], radius: 9 },
      { id: 'deliver', text: "Get the diamonds to Marco's Garage — 120 seconds!", kind: 'goto', at: [124, -124], radius: 10, time: 120, wantedOnStart: 2 },
      { id: 'vanish', text: 'Lose the heat, then reach the Bayfront Safehouse', kind: 'escape', at: [186, 186], radius: 11 },
    ],
  },
];

// The Midnight Apex street race: a repeatable side activity. Drive through gate 1
// in a car to start the clock, then hit gates 2–4 in order before it runs out.
export const RACE_GATES = [
  { at: [62, 186], axis: 'x' },
  { at: [-124, 186], axis: 'x' },
  { at: [-124, -62], axis: 'z' },
  { at: [124, -62], axis: 'z' },
];
export const RACE_REWARD = 600;
export const RACE_TIME_LIMIT = 100;

// Named places the HUD and the minimap point at.
export const PLACES = {
  garage: { name: "Marco's Garage", at: [124, -124] },
  docks: { name: 'Sunset Docks', at: [-186, 186] },
  hotel: { name: 'Neon Hotel', at: [62, -62] },
  safehouse: { name: 'Bayfront Safehouse', at: [186, 186] },
  spray: { name: 'Spray & Shade', at: [-62, -186] }, // cool zone: clears wanted for $100
  beach: { name: 'Flamingo Beach', at: [228, 0] },
  spire: { name: 'Neon Spire', at: [240, -120] }, // beachfront landmark lighthouse
  boardwalk: { name: 'Boardwalk', at: [222, -60] },
};

// Ten glowing neon tokens hidden around the city: +$100 each, saved when collected.
export const TOKEN_SPOTS = [
  [-155, -155], [-31, -155], [93, -155], [155, -93], [-93, -31],
  [31, 31], [-155, 93], [155, 155], [-31, 155], [228, 62],
];

export const TOKEN_REWARD = 100;
export const CAR_STEAL_WANTED = 1;
export const PED_HIT_WANTED = 1;
export const SHOOT_WANTED = 1;

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
// Shortest signed angle from a to b, in (-PI, PI].
export function angleDelta(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
export function distance2D(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}
// Is this point on a road (either axis), given the grid above?
export function isOnRoad(x, z) {
  const rx = Math.abs(((x + PITCH / 2) % PITCH + PITCH) % PITCH - PITCH / 2);
  const rz = Math.abs(((z + PITCH / 2) % PITCH + PITCH) % PITCH - PITCH / 2);
  return rx < ROAD / 2 + 1 || rz < ROAD / 2 + 1;
}
// Nearest road centreline coordinate on one axis.
export function nearestRoadCoord(v) {
  return Math.round(v / PITCH) * PITCH;
}
export const tmpVec = new THREE.Vector3();
