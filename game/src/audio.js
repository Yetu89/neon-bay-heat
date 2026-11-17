// Neon Bay Heat — every sound is synthesised with WebAudio: no audio files, no
// network. Engine hum, sirens, gunshots, punches, pickups, mission jingles and a
// lazy sunset bassline that loops under the whole game.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let rotorOsc = null;
  let rotorGain = null;
  let rotorFilter = null;
  let musicTimer = null;
  let muted = false;
  let musicStep = 0;

  // Am–F–C–G, one bass note a beat, a soft pad above it.
  const BASS = [55, 43.65, 65.41, 49];
  const PAD = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 261.63, 329.63], [164.81, 220, 261.63]];

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: two detuned saws through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 82;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();
      // Siren: a square wave that wails between two notes.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      // Rotor: a low chopped saw that throbs when the police helicopter flies.
      rotorOsc = ctx.createOscillator();
      rotorOsc.type = 'sawtooth';
      rotorOsc.frequency.value = 38;
      rotorFilter = ctx.createBiquadFilter();
      rotorFilter.type = 'lowpass';
      rotorFilter.frequency.value = 220;
      rotorGain = ctx.createGain();
      rotorGain.gain.value = 0;
      rotorOsc.connect(rotorFilter);
      rotorFilter.connect(rotorGain);
      rotorGain.connect(master);
      rotorOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq) {
    if (!ctx || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  function startMusic() {
    if (!ctx || musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (muted) return;
      const bar = Math.floor(musicStep / 4) % 4;
      const beat = musicStep % 4;
      if (beat === 0) {
        tone(BASS[bar], 0.9, 'sine', 0.16);
        for (const f of PAD[bar]) tone(f, 1.6, 'triangle', 0.035);
      } else if (beat === 2) {
        tone(BASS[bar] * 1.5, 0.4, 'sine', 0.08);
      }
      musicStep += 1;
    }, 460);
  }

  return {
    // Call from the first user gesture; browsers block audio before one.
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
      startMusic();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    // speed01: 0..1 of top speed. driving: false silences the engine.
    engine(speed01, driving) {
      if (!ctx || !engineGain) return;
      const target = driving ? 0.05 + speed01 * 0.075 : 0;
      engineGain.gain.setTargetAtTime(muted ? 0 : target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + speed01 * 165, ctx.currentTime, 0.06);
      engineOsc2.frequency.setTargetAtTime(78 + speed01 * 240, ctx.currentTime, 0.06);
      engineFilter.frequency.setTargetAtTime(320 + speed01 * 1400, ctx.currentTime, 0.1);
    },
    siren(on) {
      if (!ctx || !sirenGain) return;
      if (!on) {
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        return;
      }
      sirenGain.gain.setTargetAtTime(muted ? 0 : 0.045, ctx.currentTime, 0.1);
      const now = ctx.currentTime;
      sirenOsc.frequency.setValueAtTime(715, now);
      sirenOsc.frequency.linearRampToValueAtTime(950, now + 0.42);
      sirenOsc.frequency.linearRampToValueAtTime(715, now + 0.84);
    },
    // Helicopter rotor chop: on while the Bay PD helicopter is overhead.
    rotor(on) {
      if (!ctx || !rotorGain) return;
      rotorGain.gain.setTargetAtTime(on && !muted ? 0.05 : 0, ctx.currentTime, 0.15);
      if (on) rotorOsc.frequency.setTargetAtTime(34 + Math.sin(ctx.currentTime * 9) * 6, ctx.currentTime, 0.05);
    },
    gunshot() {
      noise(0.14, 0.5, 1800);
      tone(180, 0.1, 'square', 0.2, 0, 60);
    },
    punch() {
      noise(0.09, 0.4, 500);
      tone(120, 0.09, 'sine', 0.35, 0, 55);
    },
    crash() {
      noise(0.25, 0.5, 900);
      tone(90, 0.25, 'sawtooth', 0.25, 0, 40);
    },
    pickup() {
      tone(880, 0.12, 'sine', 0.25);
      tone(1318, 0.18, 'sine', 0.25, 0.09);
    },
    token() {
      tone(1046, 0.1, 'triangle', 0.22);
      tone(1568, 0.16, 'triangle', 0.22, 0.08);
    },
    wantedUp() {
      tone(220, 0.16, 'square', 0.18);
      tone(174, 0.24, 'square', 0.18, 0.14);
    },
    missionStart() {
      tone(523, 0.14, 'triangle', 0.25);
      tone(659, 0.14, 'triangle', 0.25, 0.12);
      tone(784, 0.22, 'triangle', 0.25, 0.24);
    },
    missionComplete() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.28, i * 0.11));
    },
    missionFail() {
      [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.16, i * 0.14));
    },
    busted() {
      [440, 415, 392, 370].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.18, i * 0.2));
    },
    click() {
      tone(660, 0.05, 'square', 0.12);
    },
  };
}
