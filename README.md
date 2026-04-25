# NIN DEFENDER

A Nine Inch Nails-themed space shooter built with HTML5 Canvas and vanilla JavaScript. No frameworks, no dependencies — just pure browser tech.

**Play now:** [nin-defender.fly.dev](https://nin-defender.fly.dev/)

## Controls

| Key | Action |
|-----|--------|
| WASD / Arrows | Move ship |
| Space (hold) | Fire weapons |
| E | Activate shield (charges, recharges after depletion) |
| Q | Screen-clearing bomb |
| T | Cycle trail color (11 colors) |
| Y | Cycle ship skin (Classic, Stealth, Viper, Tank) |
| Left/Right | Select difficulty on menu |
| P / Esc | Pause (with Resume/Restart/Main Menu) |

Mobile: virtual joystick + fire/shield/bomb touch buttons (landscape only). PWA installable — add to home screen for fullscreen.

### Easter Eggs

Type during gameplay: `HURT` for god mode, `CLOSER` to spawn the final boss.

## Features

### Enemies
9 creature-themed enemy types with unique behaviors and canvas-drawn visuals:
- **Asteroids** — textured with craters and ridges, split into fragments on destruction
- **Alien Critters** — bug-like creatures with antennae, segmented body, scuttling legs
- **Space Fireflies** — bioluminescent swarm insects with fluttering wings
- **Space Jellyfish** — translucent bell domes with flowing tentacles, sting on proximity
- **Spider Drones** — animated legs, mandibles, multiple eyes, shoot web projectiles
- **Alien Ghosts** — translucent, teleport to new positions
- **Space Octopus** — tentacled aliens that drop ink bombs
- **Space Chameleons** — color-shifting lizards that cloak in/out of visibility
- **Alien Devils** — fiery with horns, charge at player, shoot fireballs

### Bosses
Each phase ends with a unique boss — all canvas-animated with distinct creature designs:

| Phase | Boss | Visual |
|-------|------|--------|
| 1 | Critter Queen | Armored beetle with compound eyes, mandibles, segmented shell |
| 2 | Firefly Monarch | Glowing queen with fluttering wings, bioluminescent abdomen |
| 3 | Jellyfish Titan | Translucent dome bell with 10 flowing tentacles |
| 4 | Spider Queen | 12 animated legs, 8 red eyes, toxic markings |
| 5 | Ghost Wraith | Translucent body, void-black eyes with purple glow |
| 6 | Kraken | 8 tentacles, dome head, W-shaped octopus pupils |
| 7 | Chameleon Lord | Color-shifting body, curled tail, independent rotating slit eyes |
| 8-10 | Demon Lords | Horns, fire aura, asymmetric glowing eyes, jagged mouth |

Bosses have evasive AI — they dodge away from player fire and perform strafing maneuvers.

### Phase System
10 progressive difficulty phases with smooth exponential spawn curve:
1. Asteroid Field
2. Critter Colony
3. Firefly Swarm
4. Jellyfish Drift
5. Arachnid Sector
6. Ghost Nebula
7. Octopus Den
8. Chameleon Void
9. Devil's Domain
10. Total Chaos (double spawns, 40% flanking)

Phase transitions clear the screen, pause spawning, and announce the next phase. Enemies flank from behind starting at phase 5. Enemy formations (V, Wall, Pincer, Spiral) appear from phase 3+.

### Difficulty
Three difficulty modes selectable on the menu screen:
- **Easy** — 8 lives, slow spawns, 50% boss bullet speed
- **Normal** — 6 lives, standard spawns
- **Brutal** — 4 lives, fast spawns, 130% boss bullet speed

Selection persists across sessions.

### Upgrade Shop
After each boss kill, an inter-wave shop opens where you spend scrap on permanent upgrades:
- **Damage** — +0.5 bullet damage per level
- **Fire Rate** — faster shooting
- **Speed** — +30 ship speed per level
- **Bombs** — +1 max bomb per level
- **Shields** — +1 shield charge per level
- **Max Lives** — +1 max life per level

All purchases persist across games via localStorage.

### Power-ups
7 collectible power-ups that drop during gameplay:
- **Rapid Fire** — 2.5x fire rate for 8 seconds
- **Triple Shot** — 3 bullets per shot for 10 seconds
- **Shield** — absorbs one hit for 12 seconds
- **Extra Life** — +1 life
- **Ricochet** — orange bouncing bullets for 12 seconds (3 bounces)
- **Wingman** — NIN-themed AI attack drone companion for 15 seconds
- **Power Combo** — stacking 2+ power-ups gives 2x-3x score multiplier

### Environment
- Midjourney-generated planet sprites (frozen lava planet, red Mars, alien moon)
- Canvas fallback planets (Gas Giant, Ringed Planet)
- NIN logos on procedural planets
- 3-layer parallax starfield
- Environmental hazards: solar flares, black holes (bend all bullets), asteroid belts

### Progression
- **Combo system** — kill streaks multiply score (x2 through x5)
- **Chain explosions** — kills damage nearby enemies within 60px
- **Scrap collection** — earn scrap from kills, spend in upgrade shop
- **Speed run timer** — phase timer shown in HUD
- **Leaderboard** — top 10 scores with phase, time, and max combo data
- **Trail customization** — 11 trail colors (T key)
- **Ship skins** — 4 distinct hull designs: Classic, Stealth, Viper, Tank (Y key)
- **Rage mode** — 3s invincibility on respawn

### Audio
- 11 NIN MP3 tracks cycling randomly during gameplay
- Menu/game-over music: "Me, I'm Not"
- Song-specific lyrics displayed as animated comic-style words
- Procedural SFX via Web Audio API (explosions, power-ups, hits)
- Dedicated SFX bus (quieter than music)

### Visuals
- Industrial NIN aesthetic — dark blacks, blood reds, pre-rendered scan lines
- Ship tilts when moving vertically, bullets follow tilt angle
- Power-up hull glow cycles through active power-up colors
- Life bar under player ship (green/orange/red)
- Animated lyrics: Impact font, per-word random colors, pop-in scale, slow fade
- GAME_SCALE factor for mobile responsiveness
- Auto cache-busting via build timestamp

## Tech Stack

- HTML5 Canvas (no frameworks)
- Vanilla JavaScript (no build step)
- Web Audio API (synthesized SFX)
- Google Fonts (Bebas Neue, Share Tech Mono)
- Nginx Alpine (Docker)
- Fly.io (deployment, 2 machines, auto-sleep)
- ImageMagick (sprite processing)
- Midjourney (planet and ship sprite generation)

## Run Locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Or with Docker:

```bash
docker build -t nin-defender .
docker run -p 8080:8080 nin-defender
```

## Deploy

```bash
fly deploy
```

## Songs

| Track | File |
|-------|------|
| The Collector | the-collector.mp3 |
| Discipline | discipline.mp3 |
| Beginning of the End | beginning-of-the-end.mp3 |
| Capital G | capital-g.mp3 |
| The Good Soldier | the-good-soldier.mp3 |
| Great Destroyer | great-destroyer.mp3 |
| Deep | deep.mp3 |
| Not So Pretty Now | not-so-pretty-now.mp3 |
| Non-Entity | non-entity.mp3 |
| The Day the World Went Away | the-day-the-world-went-away.mp3 |
| Me, I'm Not (menu) | me-im-not.mp3 |

Lyrics sourced from each song and displayed in-game when that song is playing.

## Credits

- Music: Nine Inch Nails remixes sourced from the now-defunct **remix.nin.com** (official NIN remix site)
- Planet sprites: Generated with Midjourney
- Player ship sprite: Generated with Midjourney
- Everything else: HTML5 Canvas + vanilla JS
