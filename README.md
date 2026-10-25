# Rift Defense

A two-player co-op tower defense game where you don't defend your own base — **you defend your ally's**.

A glowing rift splits the map in two. The drones marching through *your* side are headed for *your ally's* core, and the drones on their side are coming for yours. Your turrets can only fire on the lane you guard, so you're each other's only line of defense. If either core falls, you both lose.

**▶ Play it here:** https://JPUTK.github.io/Duodefense/

---

## How to play

Both players share one screen and one mouse.

- **Player 1** (cyan) builds on the **left** side.
- **Player 2** (magenta) builds on the **right** side.

1. On the title screen, pick a difficulty with the ◀ ▶ arrows, then press **START GAME**. New players can press **HOW TO PLAY** for a guided tutorial.
1. Pick a turret type from your panel at the bottom of the screen.
2. Click open ground on your side to build it.
3. Click one of your turrets to upgrade it (up to level 3).
4. Earn credits by destroying drones on the lane you guard.
5. Survive as many waves as you can.

### Difficulty

| Level | What changes |
|---|---|
| **Easy** | Weaker drones that toughen slowly, 40-health cores, 200 starting credits, 30 seconds between waves |
| **Normal** | The intended challenge: 30-health cores, 150 starting credits, 25 seconds between waves |
| **Hard** | Tougher drones, 20-health cores, 130 starting credits, smaller kill rewards, 22 seconds between waves |
| **Nightmare** | Drones toughen fastest, 12-health cores, 120 starting credits, 18 seconds between waves |

Your best wave is tracked separately for each difficulty. You can also change difficulty in **Settings**; mid-game changes apply to your next game.

### Two different fronts

The two sides are deliberately different, but balanced so neither has it easier.

| Lane | Guarded by | What comes down it |
|---|---|---|
| **Swarm Lane** | Player 1 | A long, winding route full of fast, fragile drones. Every 5th wave brings a **Brood Carrier** that bursts into scouts when destroyed. |
| **Heavy Lane** | Player 2 | A short, direct route with fewer, slower, armored drones. Every 5th wave brings an armored **Juggernaut**. |

Every 4th wave, a **surge** sends 50% more drones down one lane. A ⚠ SURGE warning appears on that lane a wave ahead, so your ally has time to prepare and **GIVE** you credits.

### Controls

| Action | Player 1 | Player 2 |
|---|---|---|
| Select Laser / Plasma / Cryo | `1` `2` `3` | `8` `9` `0` |
| Build | Click open ground on your side | Click open ground on your side |
| Upgrade a turret | Click it | Click it |
| Sell a turret (60% refund) | Right-click it | Right-click it |
| Send your ally 25 credits | GIVE button | GIVE button |

| Shared controls | Key |
|---|---|
| Pause / resume | `Space` |
| Call the next wave early (bonus credits for both) | `N` |
| Cancel a merge | `Esc` |
| Change difficulty (title screen) | `◀` `▶` arrow keys |

**Settings** (on the title screen or under the game) let you change difficulty and adjust or mute the music and sound effects separately. Settings are saved in your browser.

---

## Turrets

| Turret | Cost | Strengths |
|---|---|---|
| **Laser** | 50 | Rapid single-target beam. Great against swarms, weak against armor. |
| **Plasma** | 80 | Slow splash-damage bolts. Shreds groups and armored drones. |
| **Cryo** | 70 | Freeze pulse that slows every drone nearby and ignores armor. |

### XP, Elite turrets and merging

Turrets earn **XP** for the damage they deal (Cryo turrets also earn XP for every drone they slow). A level 3 turret with full XP becomes **Elite** and gets a spinning gold ring.

Click an Elite turret, then click one of your other Elite turrets of a **different type** nearby to merge them into a hybrid for **200 credits**. The second turret's spot frees up so you can keep building.

| Hybrid | Made from | What it does |
|---|---|---|
| **Ion Lance** | Laser + Plasma | Piercing beam that hits every drone in a line and ignores armor. |
| **Frost Lance** | Laser + Cryo | Rapid freezing beam. Drones it hits take 40% more damage from all turrets. |
| **Nova Mortar** | Plasma + Cryo | Frost bombs with huge splash that leave a freezing damage field behind. |

## Drones

| Drone | Notes |
|---|---|
| **Grunt** | The standard drone. |
| **Scout** | Fast and fragile. Common on the Swarm Lane. |
| **Tank** | Slow and armored. Common on the Heavy Lane. |
| **Brood Carrier** | Swarm Lane boss. Splits into six scouts when destroyed. |
| **Juggernaut** | Heavy Lane boss. Heavily armored. |

---

## Running it yourself

No install or build step needed. It's plain HTML, CSS and JavaScript.

- **Play online:** use the GitHub Pages link above.
- **Play locally:** download the repository and open `index.html` in a web browser.

## Project structure

```
index.html        Page layout; loads the scripts below in order
css/style.css     Page styling
js/config.js      Tuning numbers: map, lanes, turrets, drones, waves, difficulty levels
js/audio.js       Sound effects and music, synthesized in code (no audio files)
js/game.js        Game rules: waves, damage, merging, credits
js/render.js      Everything drawn on the battlefield
js/screens.js     Title screen (with a live demo battle) and game-over screen
js/tutorial.js    Interactive how-to-play
js/settings.js    Settings panel: difficulty and volume
js/input.js       Mouse, keyboard and button handling
js/main.js        Starts the game loop
```

Want to rebalance the game? Almost everything lives in `js/config.js`.

## Roadmap

Planned work is tracked on this repository's project board. Coming up next:

- Online multiplayer (each player on their own computer)
- Public release on itch.io
