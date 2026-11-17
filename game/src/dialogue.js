// Neon Bay Heat — mission dialogue. Every story mission opens and closes with
// a short exchange between Kai Mercer (the wheelman), Marco Hale (the fixer
// who hands out the jobs) and Rina Solano (the lookout who knows the streets).
// Lines show as subtitles over the game and stay in a short HUD log, so the
// five missions read as one continuing story instead of five dry objectives.
// All three names are original to this game.
export const DIALOGUE = [
  {
    intro: [
      ['MARCO', 'Kai. You need wheels, I need a driver.'],
      ['KAI', 'One job. No questions, no cops.'],
      ['MARCO', 'Steal something fast. Meet me at the garage.'],
    ],
    complete: [
      ['RINA', 'Not bad, new guy. The Vortex suits you.'],
      ['MARCO', 'First gear done. Don\u2019t get comfortable.'],
    ],
  },
  {
    intro: [
      ['MARCO', 'Package at Sunset Docks. Neon Hotel, ninety seconds.'],
      ['RINA', 'Bay PD\u2019s been sniffing the docks all week.'],
      ['KAI', 'Then I drive like the dock\u2019s on fire.'],
    ],
    complete: [
      ['RINA', 'Delivered clean. The Hotel pays double for fast.'],
      ['MARCO', 'You\u2019re earning the name, wheelman.'],
    ],
  },
  {
    intro: [
      ['MARCO', 'Three stars, Kai. They\u2019re calling the chopper.'],
      ['KAI', 'Let them. I know every alley in this bay.'],
      ['RINA', 'Lose them, then vanish at the safehouse.'],
    ],
    complete: [
      ['RINA', 'Air support gave up. You\u2019re a ghost now.'],
      ['MARCO', 'That\u2019s how you survive Neon Bay.'],
    ],
  },
  {
    intro: [
      ['RINA', 'Midnight Apex runs tonight. Three gates, one circuit.'],
      ['KAI', 'Street kids with fast cars? Cute.'],
      ['RINA', 'Beat them and the avenues are yours.'],
    ],
    complete: [
      ['MARCO', 'The Apex crew just lost their crown.'],
      ['KAI', 'Tell them the wheelman says thanks for the race.'],
    ],
  },
  {
    intro: [
      ['MARCO', 'Last job. Diamonds at Flamingo Beach.'],
      ['RINA', 'Bay PD wants that duffel more than we do.'],
      ['KAI', 'Then we don\u2019t stop. Garage, then gone.'],
    ],
    complete: [
      ['RINA', 'The Big Score is ours.'],
      ['MARCO', 'Neon Bay is yours now, Kai. Drive it like you own it.'],
    ],
  },
];

export const DIALOGUE_FINALE = [
  ['KAI', 'Five jobs. One city. Mine.'],
];

export const DIALOGUE_FAIL = [
  ['MARCO', 'Out of time. The job is back on \u2014 go again.'],
];

const LINE_SECONDS = 3.4;
const LOG_KEEP = 3;

export function createDialogue(document) {
  const sub = document.getElementById('hud-dialogue');
  const subSpeaker = document.getElementById('hud-dialogue-speaker');
  const subText = document.getElementById('hud-dialogue-text');
  const log = document.getElementById('hud-dialogue-log');
  let queue = [];
  let timer = 0;
  let current = null; // the line on screen right now

  function renderLog() {
    if (!log) return;
    const rows = log.querySelectorAll('.dlg-row');
    while (rows.length > LOG_KEEP) rows[0].remove();
  }

  // The log keeps history only: a line is written there when it leaves the
  // subtitle, never while it is showing, so the screen never says it twice.
  function logLine(speaker, text) {
    if (!log) return;
    const row = document.createElement('div');
    row.className = 'dlg-row';
    const who = document.createElement('b');
    who.textContent = `${speaker}: `;
    row.appendChild(who);
    row.appendChild(document.createTextNode(text));
    log.appendChild(row);
    renderLog();
  }

  function showLine(speaker, text) {
    current = [speaker, text];
    if (subSpeaker) subSpeaker.textContent = `${speaker}:`;
    if (subText) subText.textContent = text;
    if (sub) sub.classList.remove('hidden');
  }

  return {
    // Queue lines to play one after another (intro, then complete, ...).
    show(lines) {
      if (!lines || !lines.length) return;
      queue = queue.concat(lines);
      if (timer <= 0) {
        const [speaker, text] = queue.shift();
        showLine(speaker, text);
        timer = LINE_SECONDS;
      }
    },
    // Show one line right now and hold it (screenshot staging).
    showNow(speaker, text) {
      queue = [];
      timer = 9999;
      showLine(speaker, text);
    },
    update(dt) {
      if (timer <= 0) return;
      timer -= dt;
      if (timer > 0) return;
      if (current) logLine(current[0], current[1]);
      current = null;
      if (queue.length > 0) {
        const [speaker, text] = queue.shift();
        showLine(speaker, text);
        timer = LINE_SECONDS;
      } else if (sub) {
        sub.classList.add('hidden');
      }
    },
  };
}
