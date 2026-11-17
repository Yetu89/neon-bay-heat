// Neon Bay Heat — textures painted at run time on offscreen canvases, so the game
// ships no image files at all: the road map, the building windows and the sunset sky.
import * as THREE from 'three';
import { BEACH_X, BLOCK, CITY_HALF, GRID, PALETTE, PITCH, ROAD, SEA_X } from './config.js';

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return [canvas, canvas.getContext('2d')];
}

// The ground: asphalt with the road grid, lane dashes, crosswalks and the beach drawn in,
// mapped 1:1 onto the city so the minimap and the world always agree.
export function createGroundTexture() {
  const size = 1024;
  const [canvas, ctx] = makeCanvas(size, size);
  const span = CITY_HALF * 2 + 140; // world units across the texture
  const toPx = (v) => ((v + span / 2) / span) * size;
  ctx.fillStyle = '#33303a';
  ctx.fillRect(0, 0, size, size);
  // Sidewalk blocks: warm concrete squares between the roads, two tones so the
  // grid does not read as one flat slab.
  const tones = ['#b9b0a2', '#a89e8d'];
  for (let i = -GRID; i < GRID; i += 1) {
    for (let j = -GRID; j < GRID; j += 1) {
      const x0 = (i + 0.5) * PITCH - BLOCK / 2;
      const z0 = (j + 0.5) * PITCH - BLOCK / 2;
      ctx.fillStyle = tones[(i + j + 200) % 2];
      ctx.fillRect(toPx(x0), toPx(z0), (BLOCK / span) * size, (BLOCK / span) * size);
    }
  }
  // Beach sand and sea on the east edge.
  ctx.fillStyle = '#e8cf9e';
  ctx.fillRect(toPx(BEACH_X), 0, (SEA_X - BEACH_X) / span * size, size);
  ctx.fillStyle = '#2e86ab';
  ctx.fillRect(toPx(SEA_X), 0, size - toPx(SEA_X), size);
  ctx.fillStyle = '#1d5f7a';
  for (let y = 0; y < size; y += 46) ctx.fillRect(toPx(SEA_X), y, size - toPx(SEA_X), 3);
  // Lane dashes along every road, both directions: thin paint, not slabs.
  ctx.fillStyle = '#f5d76e';
  const dashW = (0.55 / span) * size;
  const dashL = (3.2 / span) * size;
  for (let i = -GRID; i <= GRID; i += 1) {
    const c = i * PITCH;
    for (let d = -CITY_HALF; d < CITY_HALF; d += 12) {
      ctx.fillRect(toPx(c) - dashW / 2, toPx(d), dashW, dashL);
      ctx.fillRect(toPx(d), toPx(c) - dashW / 2, dashL, dashW);
    }
  }
  // Solid white edge lines where the asphalt meets the sidewalk.
  ctx.fillStyle = 'rgba(235,235,228,0.7)';
  const edgeW = (0.35 / span) * size;
  for (let i = -GRID; i <= GRID; i += 1) {
    const c = i * PITCH;
    for (const off of [-ROAD / 2 + 0.7, ROAD / 2 - 0.7]) {
      ctx.fillRect(toPx(c + off) - edgeW / 2, toPx(-CITY_HALF), edgeW, (CITY_HALF * 2 / span) * size);
      ctx.fillRect(toPx(-CITY_HALF), toPx(c + off) - edgeW / 2, (CITY_HALF * 2 / span) * size, edgeW);
    }
  }
  // Crosswalk stripes at every intersection.
  ctx.fillStyle = 'rgba(240,240,235,0.85)';
  for (let i = -GRID; i <= GRID; i += 1) {
    for (let j = -GRID; j <= GRID; j += 1) {
      const cx = i * PITCH;
      const cz = j * PITCH;
      for (let k = -2; k <= 2; k += 1) {
        ctx.fillRect(toPx(cx + k * 2.4) - 2, toPx(cz - ROAD / 2 + 1), 4, (ROAD / 2 - 2) / span * size);
        ctx.fillRect(toPx(cx + k * 2.4) - 2, toPx(cz + 1), 4, (ROAD / 2 - 2) / span * size);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { texture: tex, span };
}

// One facade texture per tint: a wall colour with lit windows, neon sign band and a door.
// Buildings share a handful of these, so the city stays cheap to draw.
export function createFacadeTexture(baseHex, litRatio) {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);
  const cols = 6;
  const rows = 10;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lit = Math.random() < litRatio;
      ctx.fillStyle = lit ? '#ffe9a8' : 'rgba(20,24,40,0.55)';
      ctx.fillRect(14 + c * 40, 14 + r * 24, 26, 15);
    }
  }
  // Neon sign band near the top.
  const neon = ['#ff2e88', '#00f5d4', '#fee440', '#9b5de5'][Math.floor(Math.random() * 4)];
  ctx.fillStyle = neon;
  ctx.fillRect(0, 6, 256, 5);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(108, 232, 40, 24);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A vertical sunset gradient for the sky dome.
export function createSkyTexture() {
  const [canvas, ctx] = makeCanvas(16, 512);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#2e4a7a');
  g.addColorStop(0.45, '#7a5a9e');
  g.addColorStop(0.7, '#ff8e63');
  g.addColorStop(1, '#ffc98a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
