// Neon Bay Heat — Marco's Garage tuning. The upgrade ladders live in config.js;
// this module decides what a purchase costs and whether it can happen, and owns
// the tuning panel: a side menu over the game that lists every part, its current
// level, the next level and its price, and the nitro charges left in the tank.
// The world supplies the live state and applies the purchase; the panel only
// renders and forwards clicks and number keys.
import { NITRO_MAX_CHARGES, NITRO_REFILL_CHARGES, NITRO_REFILL_COST, TUNING_LABELS, TUNING_PARTS } from './config.js';

const PART_IDS = ['engine', 'tires', 'armor', 'nitro'];

// Decide one purchase. Returns {ok, cost, message} and, on success, the new
// level (or a nitro refill count) for the world to apply. Nitro is special: once
// the kit is installed, buying again refills the tank instead of levelling up.
export function buyTuningPart(tune, partId, cash, nitroCharges) {
  const ladder = TUNING_PARTS[partId];
  const level = tune[partId] || 0;
  if (partId === 'nitro' && level >= 1) {
    if (nitroCharges >= NITRO_MAX_CHARGES) return { ok: false, cost: 0, message: 'Nitro tanks already full.' };
    if (cash < NITRO_REFILL_COST) return { ok: false, cost: 0, message: `Need $${NITRO_REFILL_COST} for a nitro refill.` };
    return { ok: true, cost: NITRO_REFILL_COST, refill: NITRO_REFILL_CHARGES, message: `Nitro refilled +${NITRO_REFILL_CHARGES} charges — $${NITRO_REFILL_COST}.` };
  }
  if (level >= ladder.length - 1) return { ok: false, cost: 0, message: `${TUNING_LABELS[partId]} is already maxed out.` };
  const next = ladder[level + 1];
  if (cash < next.cost) return { ok: false, cost: 0, message: `Need $${next.cost.toLocaleString('en-US')} for ${next.name}.` };
  return { ok: true, cost: next.cost, level: level + 1, message: `${next.name} installed — $${next.cost.toLocaleString('en-US')}.` };
}

// One line for the HUD: what the Vortex GT carries right now.
export function tuningSummary(tune, nitroCharges) {
  return `ENG ${tune.engine || 0} • GRIP ${tune.tires || 0} • ARMOR ${tune.armor || 0} • NITRO ${nitroCharges}`;
}

export function createTuningPanel(document, hooks) {
  const panel = document.getElementById('screen-tuning');
  const cashEl = document.getElementById('tune-cash');
  const rowsEl = document.getElementById('tune-rows');
  const msgEl = document.getElementById('tune-msg');
  const closeBtn = document.getElementById('btn-tune-close');
  let open = false;

  function render() {
    const { tune, cash, nitroCharges } = hooks.getState();
    if (cashEl) cashEl.textContent = `Cash: $${cash.toLocaleString('en-US')}  •  Nitro charges: ${nitroCharges}`;
    if (!rowsEl) return;
    rowsEl.innerHTML = '';
    PART_IDS.forEach((partId, index) => {
      const ladder = TUNING_PARTS[partId];
      const level = tune[partId] || 0;
      const current = ladder[level];
      const next = ladder[level + 1];
      const row = document.createElement('div');
      row.className = 'tune-row';
      const label = document.createElement('div');
      label.className = 'tune-label';
      label.textContent = TUNING_LABELS[partId];
      row.appendChild(label);
      const info = document.createElement('div');
      info.className = 'tune-info';
      if (partId === 'nitro' && level >= 1) {
        info.textContent = `${current.name} — ${nitroCharges}/${NITRO_MAX_CHARGES} charges`;
      } else {
        info.textContent = next ? `${current.name} → ${next.name}` : `${current.name} — MAX`;
      }
      row.appendChild(info);
      const btn = document.createElement('button');
      btn.className = 'btn tune-buy';
      if (partId === 'nitro' && level >= 1) {
        btn.textContent = `REFILL $${NITRO_REFILL_COST} [${index + 1}]`;
      } else if (next) {
        btn.textContent = `BUY $${next.cost.toLocaleString('en-US')} [${index + 1}]`;
      } else {
        btn.textContent = 'MAXED';
        btn.disabled = true;
      }
      btn.addEventListener('click', () => buy(partId));
      row.appendChild(btn);
      rowsEl.appendChild(row);
    });
  }

  function buy(partId) {
    const result = hooks.onBuy(partId);
    if (msgEl) msgEl.textContent = result.message;
    render();
  }

  function show() {
    open = true;
    render();
    if (msgEl) msgEl.textContent = 'Spend mission cash on the ride — upgrades stay with the Vortex GT.';
    panel?.classList.remove('hidden');
  }

  function hide() {
    open = false;
    panel?.classList.add('hidden');
  }

  closeBtn?.addEventListener('click', () => hooks.onClose());
  window.addEventListener('keydown', (event) => {
    if (!open) return;
    const index = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(event.code);
    if (index >= 0) buy(PART_IDS[index]);
  });

  return {
    get visible() {
      return open;
    },
    show,
    hide,
    render,
  };
}
