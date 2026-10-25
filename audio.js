// audio.js
// All sound is synthesized with the Web Audio API, so there are no audio files.
//   Sound.play(name, x)  - play a sound effect (x = screen position, used for left/right panning)
//   Sound.setMode(mode)  - switch the music: "menu", "game" or "over"
// Loaded as a plain <script>; files share globals and load in the order listed in index.html.

const Sound = (() => {
  const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  let ac = null, master, musicBus, sfxBus, delay, noiseBuf;
  let mode = "menu";

  // ----- Settings (saved between visits) -----
  const settings = { music: 50, sfx: 70, musicMuted: false, sfxMuted: false };
  try { Object.assign(settings, JSON.parse(localStorage.getItem("riftAudio") || "{}")); } catch (e) {}
  function save() { try { localStorage.setItem("riftAudio", JSON.stringify(settings)); } catch (e) {} }

  function applyVolumes() {
    if (!ac) return;
    const t = ac.currentTime;
    // squared curve feels more natural for volume sliders
    const m = settings.musicMuted ? 0 : Math.pow(settings.music / 100, 2) * 0.5;
    const s = settings.sfxMuted ? 0 : Math.pow(settings.sfx / 100, 2);
    musicBus.gain.setTargetAtTime(m, t, 0.05);
    sfxBus.gain.setTargetAtTime(s, t, 0.05);
  }

  // Browsers only allow audio after the player clicks or presses a key.
  function unlock() {
    if (!AC) return;
    if (!ac) {
      ac = new AC();
      master = ac.createDynamicsCompressor();
      master.threshold.value = -14; master.ratio.value = 4;
      master.connect(ac.destination);
      musicBus = ac.createGain(); musicBus.connect(master);
      sfxBus = ac.createGain(); sfxBus.connect(master);
      // spacey echo used by the music's arpeggio
      delay = ac.createDelay(1);
      delay.delayTime.value = 60 / BPM * 0.75;
      const fb = ac.createGain(); fb.gain.value = 0.32;
      const wet = ac.createGain(); wet.gain.value = 0.35;
      delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(musicBus);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      applyVolumes();
      startMusic();
    }
    if (ac.state === "suspended") ac.resume();
  }

  // =====================================================================
  // SOUND-EFFECT BUILDING BLOCKS
  // =====================================================================
  let voices = 0;
  const MAX_VOICES = 28;

  function out(x, bus) {
    if (x === undefined || !ac.createStereoPanner) return bus;
    const p = ac.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, (x / W) * 2 - 1)) * 0.6;
    p.connect(bus);
    return p;
  }

  // A pitched tone that sweeps from f0 to f1
  function tone({ type = "sine", f0, f1 = f0, dur, vol = 0.2, at = 0, x, lp, bus = sfxBus, attack = 0.004 }) {
    if (voices >= MAX_VOICES) return;
    const t = ac.currentTime + at;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (lp) { const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp; o.connect(f); node = f; }
    node.connect(g); g.connect(out(x, bus));
    voices++; o.onended = () => voices--;
    o.start(t); o.stop(t + dur + 0.02);
  }

  // A burst of filtered noise (explosions, hiss, hats)
  function noise({ dur, vol = 0.2, at = 0, x, type = "lowpass", f0 = 2000, f1 = f0, q = 0.7, bus = sfxBus }) {
    if (voices >= MAX_VOICES) return;
    const t = ac.currentTime + at;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf;
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out(x, bus));
    voices++; s.onended = () => voices--;
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  // =====================================================================
  // SOUND EFFECTS
  // =====================================================================
  const SFX = {
    laser:   x => tone({ type: "square", f0: 1500, f1: 450, dur: 0.07, vol: 0.05, x, lp: 3200 }),
    frost:   x => { tone({ type: "triangle", f0: 2400, f1: 1500, dur: 0.07, vol: 0.06, x }); noise({ dur: 0.05, vol: 0.02, x, type: "highpass", f0: 6000 }); },
    plasma:  x => { tone({ f0: 220, f1: 70, dur: 0.18, vol: 0.22, x }); noise({ dur: 0.08, vol: 0.06, x, f0: 1200 }); },
    nova:    x => { tone({ f0: 170, f1: 55, dur: 0.24, vol: 0.24, x }); tone({ type: "triangle", f0: 900, f1: 1900, dur: 0.16, vol: 0.05, x }); },
    boom:    x => { noise({ dur: 0.25, vol: 0.18, x, f0: 1800, f1: 200 }); tone({ f0: 130, f1: 40, dur: 0.2, vol: 0.16, x }); },
    cryo:    x => { tone({ f0: 2100, f1: 1000, dur: 0.3, vol: 0.06, x }); noise({ dur: 0.3, vol: 0.04, x, type: "highpass", f0: 5000 }); },
    ion:     x => { tone({ type: "sawtooth", f0: 220, f1: 1300, dur: 0.16, vol: 0.09, x, lp: 2600 }); noise({ dur: 0.12, vol: 0.05, x, type: "bandpass", f0: 3000, q: 2 }); },
    kill:    x => tone({ type: "triangle", f0: 760, f1: 180, dur: 0.07, vol: 0.09, x }),
    bigkill: x => { noise({ dur: 0.7, vol: 0.32, x, f0: 1400, f1: 80 }); tone({ f0: 90, f1: 28, dur: 0.6, vol: 0.32, x }); },
    build:   x => { tone({ type: "square", f0: 440, dur: 0.06, vol: 0.06, x, lp: 2500 }); tone({ type: "square", f0: 660, dur: 0.08, vol: 0.06, at: 0.07, x, lp: 2500 }); },
    upgrade: x => [523, 659, 784].forEach((f, i) => tone({ type: "triangle", f0: f, dur: 0.1, vol: 0.1, at: i * 0.06, x })),
    merge:   x => {
      [523, 659, 784, 1047].forEach((f, i) => tone({ type: "triangle", f0: f, dur: 0.25, vol: 0.09, at: i * 0.05, x }));
      tone({ f0: 300, f1: 1400, dur: 0.5, vol: 0.08, x });
      noise({ dur: 0.6, vol: 0.05, x, type: "highpass", f0: 4000 });
    },
    sell:    x => tone({ type: "square", f0: 620, f1: 280, dur: 0.12, vol: 0.06, x, lp: 2000 }),
    give:    x => { tone({ f0: 1319, dur: 0.1, vol: 0.12, x }); tone({ f0: 1760, dur: 0.18, vol: 0.12, at: 0.08, x }); },
    deny:    x => { tone({ type: "square", f0: 140, dur: 0.08, vol: 0.07, x, lp: 900 }); tone({ type: "square", f0: 120, dur: 0.1, vol: 0.07, at: 0.1, x, lp: 900 }); },
    corehit: x => {
      tone({ f0: 95, f1: 38, dur: 0.35, vol: 0.32, x });
      tone({ type: "square", f0: 880, dur: 0.09, vol: 0.05, at: 0.02, x, lp: 3000 });
      tone({ type: "square", f0: 660, dur: 0.12, vol: 0.05, at: 0.12, x, lp: 3000 });
    },
    wave:    () => { tone({ type: "sawtooth", f0: 220, f1: 440, dur: 0.5, vol: 0.07, lp: 1600, attack: 0.08 }); tone({ type: "sawtooth", f0: 330, f1: 660, dur: 0.5, vol: 0.05, lp: 1600, attack: 0.08 }); },
    surge:   () => [0, 0.3].forEach(at => tone({ type: "square", f0: 600, f1: 950, dur: 0.25, vol: 0.06, at, lp: 2400 })),
    boss:    () => { tone({ type: "sawtooth", f0: 55, f1: 45, dur: 1.4, vol: 0.18, lp: 320, attack: 0.2 }); noise({ dur: 1.4, vol: 0.12, f0: 220 }); },
    gameover:() => [440, 349, 262, 196].forEach((f, i) => tone({ type: "triangle", f0: f, dur: 0.4, vol: 0.14, at: i * 0.26 })),
    ui:      () => tone({ f0: 1250, dur: 0.035, vol: 0.06 })
  };
  // Minimum seconds between repeats, so 20 lasers firing at once don't turn into noise
  const LIMIT = { laser: 0.045, frost: 0.05, kill: 0.03, boom: 0.05, cryo: 0.1, plasma: 0.05, ion: 0.06, nova: 0.08 };
  const lastPlayed = {};

  function play(name, x) {
    if (!ac || ac.state !== "running" || !SFX[name]) return;
    if (typeof screen !== "undefined" && screen === "title" && name !== "ui") return; // demo battle stays quiet
    if (settings.sfxMuted || settings.sfx === 0) return;
    const now = ac.currentTime;
    if (LIMIT[name] && now - (lastPlayed[name] || 0) < LIMIT[name]) return;
    lastPlayed[name] = now;
    SFX[name](x);
  }

  // =====================================================================
  // MUSIC: a synthwave loop in A minor (Am - F - C - G), built from code
  // =====================================================================
  const BPM = 104;
  const STEP = 60 / BPM / 4; // one 16th note
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
  const ROOTS = [33, 29, 36, 31];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  let step = 0, nextTime = 0, timer = null;

  function startMusic() {
    nextTime = ac.currentTime + 0.1;
    timer = setInterval(schedule, 25);
  }

  function schedule() {
    while (nextTime < ac.currentTime + 0.12) {
      playStep(step, nextTime);
      nextTime += STEP; step++;
    }
  }

  function synth(type, freq, t, dur, vol, cutoff, dest, attack = 0.01, release = 0.1, detune = 0) {
    const o = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = type; o.frequency.value = freq; o.detune.value = detune;
    f.type = "lowpass"; f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function drum(kind, t) {
    if (kind === "kick") {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.3);
    } else {
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noiseBuf;
      f.type = kind === "hat" ? "highpass" : "bandpass";
      f.frequency.value = kind === "hat" ? 7000 : 1800;
      const len = kind === "hat" ? 0.05 : 0.18, vol = kind === "hat" ? 0.18 : 0.45;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
      s.connect(f); f.connect(g); g.connect(musicBus);
      s.start(t, Math.random() * 0.5); s.stop(t + len + 0.02);
    }
  }

  function playStep(s, t) {
    const bar = Math.floor(s / 16) % 4, pos = s % 16;
    const chord = CHORDS[bar], root = ROOTS[bar];
    const full = mode === "game";

    // Pad: soft detuned chord held for the whole bar
    if (pos === 0) {
      const padVol = mode === "over" ? 0.05 : 0.045;
      for (const n of chord) {
        synth("sawtooth", mtof(n), t, STEP * 16, padVol, 1100, musicBus, 0.4, 0.5, -7);
        synth("sawtooth", mtof(n), t, STEP * 16, padVol, 1100, musicBus, 0.4, 0.5, 7);
      }
    }
    if (mode === "over") return;

    // Bass
    if (full ? pos % 2 === 0 : pos % 8 === 0) {
      const n = root + (full && (pos === 6 || pos === 14) ? 12 : 0);
      synth("sawtooth", mtof(n), t, STEP * (full ? 1.7 : 7), full ? 0.22 : 0.16, full ? 420 : 300, musicBus, 0.005, 0.08);
    }

    // Arpeggio (echoed for a spacey feel)
    if (full || pos % 2 === 0) {
      const pattern = [0, 1, 2, 1];
      const n = chord[pattern[(full ? pos : pos / 2) % 4]] + 12 + (bar % 2 && pos >= 8 ? 12 : 0);
      synth("square", mtof(n), t, STEP * 0.9, full ? 0.035 : 0.03, 2200, delay, 0.003, 0.05);
      synth("square", mtof(n), t, STEP * 0.9, full ? 0.035 : 0.03, 2200, musicBus, 0.003, 0.05);
    }

    // Drums
    if (full) {
      if (pos % 4 === 0) drum("kick", t);
      if (pos === 4 || pos === 12) drum("snare", t);
      if (pos % 4 === 2) drum("hat", t);
    }
  }

  function setMode(m) { mode = m; }

  return {
    unlock, play, setMode, settings, save, applyVolumes,
    get unlocked() { return !!ac && ac.state === "running"; },
    supported: !!AC
  };
})();

// Start audio on the first click or key press anywhere on the page
["pointerdown", "keydown"].forEach(ev => document.addEventListener(ev, () => Sound.unlock(), { once: false }));
