// main.js
// Starts the game and runs the frame loop.
// Loaded as a plain <script>; files share globals and load in the order listed in index.html.

// =====================================================================
// MAIN LOOP
// =====================================================================
let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  animT += dt;
  if (screen === "title") updateDemo(dt);
  else if (screen === "tutorial") updateTutorial(dt);
  else for (let i = 0; i < speedMul; i++) update(dt);
  draw();
  requestAnimationFrame(loop);
}

goToMenu();
requestAnimationFrame(loop);
