// Neon Bay Heat — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there. The game
// moves between title, play, paused, busted, wasted and story-complete screens.
//
// ?seed=N fixes the city and the traffic. ?shot=start|play|foot|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const world = createWorld(canvas, seed);
const input = createInput(canvas);

// Overlays: the title, pause, busted, wasted and complete panels.
const overlays = {
  title: document.getElementById('screen-title'),
  paused: document.getElementById('screen-paused'),
  busted: document.getElementById('screen-busted'),
  wasted: document.getElementById('screen-wasted'),
  complete: document.getElementById('screen-complete'),
};
const hud = document.getElementById('hud');
const titleStats = document.getElementById('title-stats');
const continueButton = document.getElementById('btn-continue');
const startButton = document.getElementById('btn-start');

function showOnly(name) {
  for (const [key, el] of Object.entries(overlays)) {
    if (el) el.classList.toggle('hidden', key !== name);
  }
  if (hud) hud.classList.toggle('hidden', name === 'title');
}

function refreshTitle() {
  const save = world.loadSave();
  if (save && (save.cash > 0 || save.missionsDone > 0 || save.finished)) {
    titleStats.textContent = `Saved: $${(save.cash || 0).toLocaleString('en-US')} • Missions done: ${save.missionsDone || 0}/3 • Tokens: ${(save.tokensTaken || []).filter(Boolean).length}/10`;
    continueButton.classList.remove('hidden');
  } else {
    titleStats.textContent = 'A sun-soaked city. Three jobs. One wheelman.';
    continueButton.classList.add('hidden');
  }
}

function runShot(name) {
  const screen = stageShot(name, world);
  // In shot mode the overlays stay off except the title: the HUD and the banner
  // are the story of the play, foot and end frames.
  showOnly(screen === SCREEN_TITLE ? 'title' : null);
  if (screen === SCREEN_TITLE) refreshTitle();
  let painted = 0;
  function paint() {
    world.render();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();
  let lastScreen = null;

  function syncOverlays() {
    const screen = world.screen();
    if (screen === lastScreen) return;
    lastScreen = screen;
    if (screen === SCREEN_TITLE) {
      refreshTitle();
      showOnly('title');
    } else if (screen === SCREEN_PAUSED) showOnly('paused');
    else if (screen === SCREEN_BUSTED) showOnly('busted');
    else if (screen === SCREEN_WASTED) showOnly('wasted');
    else if (screen === SCREEN_COMPLETE) showOnly('complete');
    else showOnly(null);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = !world.audio.isMuted();
      world.audio.setMuted(muted);
    }
    const screen = world.screen();
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) world.startGame(false);
      world.stepAmbient(STEP);
    } else if (screen === SCREEN_PLAY) {
      // One-shot presses go to the first step only: the same E must not enter
      // and then leave the car in one frame.
      let first = true;
      while (accumulator >= STEP) {
        world.stepPlay(STEP, input, first ? actions : 0);
        first = false;
        accumulator -= STEP;
        if (world.screen() !== SCREEN_PLAY) break;
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) world.setScreen(SCREEN_PLAY);
    } else if (screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      if (actions & ACTION_CONFIRM) world.respawn();
    } else if (screen === SCREEN_COMPLETE) {
      if (actions & ACTION_CONFIRM) world.setScreen(SCREEN_PLAY);
    }
    syncOverlays();
    world.render();
  }

  // Buttons on the overlays do what the keys do.
  startButton?.addEventListener('click', () => {
    world.audio.unlock();
    world.startGame(true);
  });
  continueButton?.addEventListener('click', () => {
    world.audio.unlock();
    world.startGame(false);
  });
  document.getElementById('btn-resume')?.addEventListener('click', () => world.setScreen(SCREEN_PLAY));
  document.getElementById('btn-restart-mission')?.addEventListener('click', () => {
    world.respawn();
  });
  document.getElementById('btn-quit-title')?.addEventListener('click', () => {
    world.setScreen(SCREEN_TITLE);
    world.resetRun();
  });
  document.getElementById('btn-continue-roam')?.addEventListener('click', () => world.setScreen(SCREEN_PLAY));
  document.getElementById('btn-busted-ok')?.addEventListener('click', () => world.respawn());
  document.getElementById('btn-wasted-ok')?.addEventListener('click', () => world.respawn());

  // Leaving the tab pauses a running game rather than letting the heat pile up unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && world.screen() === SCREEN_PLAY) world.setScreen(SCREEN_PAUSED);
  });

  refreshTitle();
  syncOverlays();
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
