// settings.js
// The Settings panel: difficulty, music and sound-effect volume. Everything is saved in the browser.
// Loaded as a plain <script>; files share globals and load in the order listed in index.html.

let settingsOpen = false, pausedBySettings = false;

function openSettings() {
  const el = document.getElementById("settings");
  if (!el || settingsOpen) return;
  settingsOpen = true;
  el.hidden = false;
  // pause a running game while the panel is open
  if (!isMenuScreen() && !state.over && !state.paused) {
    state.paused = true; pausedBySettings = true;
  }
  syncSettingsUI();
}

function closeSettings() {
  const el = document.getElementById("settings");
  if (!el || !settingsOpen) return;
  settingsOpen = false;
  el.hidden = true;
  if (pausedBySettings) { state.paused = false; pausedBySettings = false; }
}

function syncSettingsUI() {
  // Difficulty
  const seg = document.getElementById("diffSeg");
  if (seg) {
    seg.querySelectorAll("button").forEach(b => {
      const on = b.dataset.diff === difficulty;
      b.classList.toggle("on", on);
      b.style.setProperty("--c", DIFFICULTIES[b.dataset.diff].color);
    });
    const D = DIFFICULTIES[difficulty];
    let note = D.desc + ".";
    if (screen === "playing" && state.diff !== difficulty) note += " Takes effect when you start a new game.";
    document.getElementById("diffDesc").textContent = note;
  }

  // Audio
  const s = Sound.settings;
  [["music", "musicMuted"], ["sfx", "sfxMuted"]].forEach(([key, muteKey]) => {
    const slider = document.getElementById(key + "Vol");
    if (!slider) return;
    const val = document.getElementById(key + "Val");
    const btn = document.getElementById(key + "Mute");
    slider.value = s[key];
    val.textContent = s[muteKey] ? "OFF" : s[key] + "%";
    btn.textContent = s[muteKey] ? "UNMUTE" : "MUTE";
    btn.classList.toggle("on", s[muteKey]);
    slider.closest(".row").classList.toggle("muted", s[muteKey]);
  });
}

(function wireSettings() {
  if (!document.getElementById("settings")) return;

  // Difficulty buttons
  const seg = document.getElementById("diffSeg");
  DIFF_ORDER.forEach(d => {
    const b = document.createElement("button");
    b.dataset.diff = d;
    b.textContent = DIFFICULTIES[d].label;
    b.addEventListener("click", () => { setDifficulty(d); Sound.play("ui"); });
    seg.appendChild(b);
  });

  // Volume sliders and mute buttons
  [["music", "musicMuted"], ["sfx", "sfxMuted"]].forEach(([key, muteKey]) => {
    const slider = document.getElementById(key + "Vol");
    slider.addEventListener("input", () => {
      Sound.settings[key] = +slider.value;
      Sound.settings[muteKey] = false;
      Sound.applyVolumes(); Sound.save(); syncSettingsUI();
    });
    if (key === "sfx") slider.addEventListener("change", () => Sound.play("upgrade"));
    document.getElementById(key + "Mute").addEventListener("click", () => {
      Sound.settings[muteKey] = !Sound.settings[muteKey];
      Sound.applyVolumes(); Sound.save(); syncSettingsUI();
    });
  });

  document.getElementById("settingsClose").addEventListener("click", closeSettings);
  document.getElementById("settings").addEventListener("click", e => {
    if (e.target.id === "settings") closeSettings(); // click outside the card
  });
  syncSettingsUI();
})();
