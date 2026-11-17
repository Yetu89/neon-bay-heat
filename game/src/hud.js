// Neon Bay Heat — the HUD: DOM panels over the 3D view (cash, health, wanted stars,
// mission banner, speed, hints) and the minimap canvas drawn from the live world.
import { BEACH_X, CITY_HALF, PLACES, SEA_X, TOKEN_SPOTS, clamp } from './config.js';

export function createHud(document) {
  const el = (id) => document.getElementById(id);
  const cash = el('hud-cash');
  const healthFill = el('hud-health-fill');
  const stars = el('hud-stars');
  const missionTitle = el('hud-mission-title');
  const missionText = el('hud-mission-text');
  const missionDist = el('hud-mission-dist');
  const missionTimer = el('hud-mission-timer');
  const speed = el('hud-speed');
  const speedUnit = el('hud-speed-unit');
  const hint = el('hud-hint');
  const banner = el('hud-banner');
  const bannerTitle = el('hud-banner-title');
  const bannerSub = el('hud-banner-sub');
  const minimap = el('minimap');
  const clock = el('hud-clock');
  const ammo = el('hud-ammo');
  const mapCtx = minimap.getContext('2d');
  let bannerTimer = 0;
  let lastCash = -1;
  let lastStars = -1;

  function showBanner(title, sub, seconds = 3) {
    bannerTitle.textContent = title;
    bannerSub.textContent = sub;
    banner.classList.remove('hidden');
    bannerTimer = seconds;
  }

  function drawMinimap(world) {
    const size = minimap.width;
    const span = (CITY_HALF + 130) * 2;
    const toPx = (v) => ((v + span / 2) / span) * size;
    mapCtx.fillStyle = '#14101f';
    mapCtx.fillRect(0, 0, size, size);
    // Sea and beach on the east.
    mapCtx.fillStyle = '#1d5f7a';
    mapCtx.fillRect(toPx(SEA_X), 0, size - toPx(SEA_X), size);
    mapCtx.fillStyle = '#e8cf9e';
    mapCtx.fillRect(toPx(BEACH_X), 0, toPx(SEA_X) - toPx(BEACH_X), size);
    // Roads.
    mapCtx.strokeStyle = '#4a4658';
    mapCtx.lineWidth = 5;
    for (let i = -3; i <= 3; i += 1) {
      const c = toPx(i * 62);
      mapCtx.beginPath(); mapCtx.moveTo(c, 0); mapCtx.lineTo(c, size); mapCtx.stroke();
      mapCtx.beginPath(); mapCtx.moveTo(0, c); mapCtx.lineTo(size, c); mapCtx.stroke();
    }
    // Blocks.
    mapCtx.fillStyle = '#2e2a3d';
    for (let i = -3; i < 3; i += 1) {
      for (let j = -3; j < 3; j += 1) {
        mapCtx.fillRect(toPx((i + 0.5) * 62 - 24), toPx((j + 0.5) * 62 - 24), 48 / span * size, 48 / span * size);
      }
    }
    // Tokens left to collect.
    mapCtx.fillStyle = '#00f5d4';
    for (let i = 0; i < TOKEN_SPOTS.length; i += 1) {
      if (world.tokensTaken[i]) continue;
      mapCtx.beginPath();
      mapCtx.arc(toPx(TOKEN_SPOTS[i][0]), toPx(TOKEN_SPOTS[i][1]), 2.5, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // Mission marker: pulsing gold diamond.
    const marker = world.missionMarker;
    if (marker) {
      const pulse = 5 + Math.sin(performance.now() / 200) * 2;
      mapCtx.fillStyle = '#fee440';
      const mx = toPx(marker.x);
      const my = toPx(marker.z);
      mapCtx.beginPath();
      mapCtx.moveTo(mx, my - pulse);
      mapCtx.lineTo(mx + pulse, my);
      mapCtx.lineTo(mx, my + pulse);
      mapCtx.lineTo(mx - pulse, my);
      mapCtx.closePath();
      mapCtx.fill();
    }
    // Safehouse and spray shop.
    mapCtx.fillStyle = '#2ec4b6';
    mapCtx.fillRect(toPx(PLACES.safehouse.at[0]) - 3, toPx(PLACES.safehouse.at[1]) - 3, 6, 6);
    mapCtx.fillStyle = '#9b5de5';
    mapCtx.fillRect(toPx(PLACES.spray.at[0]) - 3, toPx(PLACES.spray.at[1]) - 3, 6, 6);
    // Neon Spire landmark: a gold star on the beachfront.
    mapCtx.fillStyle = '#fee440';
    const sx = toPx(PLACES.spire.at[0]);
    const sy = toPx(PLACES.spire.at[1]);
    mapCtx.beginPath();
    mapCtx.moveTo(sx, sy - 5);
    mapCtx.lineTo(sx + 5, sy + 4);
    mapCtx.lineTo(sx - 5, sy + 4);
    mapCtx.closePath();
    mapCtx.fill();
    // Police helicopter overhead: a big flashing red/blue ring.
    if (world.policeHeli?.active) {
      mapCtx.strokeStyle = Math.floor(performance.now() / 200) % 2 ? '#ff2222' : '#2266ff';
      mapCtx.lineWidth = 2.5;
      mapCtx.beginPath();
      mapCtx.arc(toPx(world.policeHeli.x), toPx(world.policeHeli.z), 6, 0, Math.PI * 2);
      mapCtx.stroke();
    }
    // Traffic (white) and police (red/blue).
    mapCtx.fillStyle = '#ffffff';
    for (const car of world.traffic) {
      if (car.parked) continue;
      mapCtx.fillRect(toPx(car.x) - 1.5, toPx(car.z) - 1.5, 3, 3);
    }
    for (const car of world.policeCars) {
      mapCtx.fillStyle = Math.floor(performance.now() / 200) % 2 ? '#ff2222' : '#2266ff';
      mapCtx.beginPath();
      mapCtx.arc(toPx(car.x), toPx(car.z), 3.5, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // The player: a yellow arrow that turns with them.
    const px = toPx(world.playerX);
    const py = toPx(world.playerZ);
    mapCtx.save();
    mapCtx.translate(px, py);
    mapCtx.rotate(world.playerHeading);
    mapCtx.fillStyle = '#fee440';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -7);
    mapCtx.lineTo(5, 5);
    mapCtx.lineTo(-5, 5);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
  }

  return {
    showBanner,
    hideBanner() {
      banner.classList.add('hidden');
    },
    update(world, dt) {
      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) banner.classList.add('hidden');
      }
      if (world.cash !== lastCash) {
        cash.textContent = `$${world.cash.toLocaleString('en-US')}`;
        lastCash = world.cash;
      }
      healthFill.style.width = `${clamp(world.health, 0, 100)}%`;
      healthFill.style.background = world.health > 50 ? '#2ec4b6' : world.health > 25 ? '#fee440' : '#ef476f';
      if (world.wanted !== lastStars) {
        stars.textContent = '★'.repeat(world.wanted) + '☆'.repeat(5 - world.wanted);
        stars.classList.toggle('hot', world.wanted > 0);
        lastStars = world.wanted;
      }
      missionTitle.textContent = world.missionTitle;
      missionText.textContent = world.missionText;
      missionDist.textContent = world.missionDist;
      missionTimer.textContent = world.missionTimerText;
      clock.textContent = world.clockText;
      if (world.inCar) {
        speed.textContent = String(Math.round(Math.abs(world.speed) * 2.2));
        speedUnit.textContent = 'MPH';
        ammo.textContent = '';
      } else {
        speed.textContent = '—';
        speedUnit.textContent = 'ON FOOT';
        ammo.textContent = `PISTOL ${world.ammo}/${world.ammoMax}`;
      }
      hint.textContent = world.hint;
      drawMinimap(world);
    },
  };
}
