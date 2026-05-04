// ============================================================
// game.js — Game state machine, update loop, collision, HUD
// ============================================================

import { Utils, AudioManager, MusicManager, ScreenShake, GAME_SCALE } from './utils.js';
import { Background, SolarFlare, BlackHole, AsteroidBelt } from './background.js';
import { ParticlePool } from './particles.js';
import { ProjectilePool } from './projectiles.js';
import { Player } from './player.js';
import { PowerUp } from './powerups.js';
import { Boss, EnemySpawner, BOSS_NAMES, PHASES } from './enemies.js';
import { Shop, SHOP_ITEMS } from './shop.js';
import { Anim } from './animations.js';
import { UIRenderer } from './ui.js';
import { Schemas } from './schemas.js';
import { emitter } from './events.js';
import { SONG_LYRICS } from './lyrics.js';

export const STATE = {
    MENU:       'MENU',
    PLAYING:    'PLAYING',
    PAUSED:     'PAUSED',
    SHOP:       'SHOP',
    WAVE_CLEAR: 'WAVE_CLEAR',
    DYING:      'DYING',
    GAME_OVER:  'GAME_OVER'
};

export class Game {
    constructor(canvas, ctx, assets) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.assets = assets || {};

        // Sub-systems
        this.audio = new AudioManager();
        this.music = null; // created on first play

        // Menu music — plays on title/game-over screens
        this.menuMusic = new Audio('assets/me-im-not.mp3');
        this.menuMusic.loop = true;
        this.menuMusic.volume = 0.4;
        this.menuMusicStarted = false;
        this.shake = new ScreenShake();
        this.background = new Background(canvas, this.assets);
        this.particles = new ParticlePool(1200);
        this.projectiles = new ProjectilePool(200);
        this.anim = new Anim({ shake: this.shake, particles: this.particles, audio: this.audio });
        this.ui = new UIRenderer(this);
        this.spawner = new EnemySpawner(this.assets);
        this.player = new Player(canvas, this.assets);
        this.powerups = [];

        // Environmental hazards
        this.solarFlare = new SolarFlare();
        this.blackHole = new BlackHole();
        this.asteroidBelt = new AsteroidBelt();
        this.hazardTimer = 0;

        // Boss tracking
        this.bossActive = false;
        this.bossSpawnedForPhase = -1;

        // Leaderboard
        this.leaderboard = Schemas.loadLeaderboard();

        // Bomb flash
        this.bombFlashTimer = 0;

        // State
        this.state = STATE.MENU;
        this.score = 0;
        this.highScore = Schemas.loadHighScore();
        this.time = 0;
        this.powerupTimer = 0;

        // Phase announcement (visible-state lives on this.anim.phaseBanner)
        this.lastPhase = -1;
        this.phaseStartTime = 0; // for speed run timer

        // NIN quotes
        this.quoteText = '';
        this.quoteTimer = 0;
        this.quoteDuration = 15; // seconds to display
        this.quoteInterval = 0; // timer until next quote
        this.usedQuotes = [];

        // Input
        this.keys = {};
        this.joystick = { active: false, dx: 0, dy: 0 };
        this.touchFiring = false;

        // Easter egg code buffer
        this._codeBuffer = '';
        this._codeTimer = 0;

        // Upgrade shop
        this.shop = new Shop();
        this.scrapPulse = 0;

        // GSAP-driven cinematic time source (monotonic; pauses with the game)
        this.gameTime = 0;

        // Laser Beam render geometry — null when no beam is firing
        this._laserBeam = null;

        // Death slow-mo sequence — counts down real-time before transitioning to GAME_OVER
        this._dyingTimer = 0;

        // Boss preview panel — shown during the first ~2s of a phase transition
        // when a boss is incoming. Cleared on game restart / gameOver.
        this._bossPreview = null;

        // Hit-stop counter — frames remaining where world simulation is frozen
        // but anim ticks + render still fire. Decremented at the top of update().
        this._hitStopFrames = 0;

        // Pause menu
        this._pauseMenuIndex = 0;

        // Difficulty
        this.difficulties = ['EASY', 'NORMAL', 'BRUTAL'];
        this.difficultyIndex = Schemas.loadDifficulty();
        this.difficultySettings = {
            EASY:   { lives: 8, baseInterval: 2.8, bulletSpeedMul: 0.5 },
            NORMAL: { lives: 6, baseInterval: 2.2, bulletSpeedMul: 1.0 },
            BRUTAL: { lives: 4, baseInterval: 1.6, bulletSpeedMul: 1.3 },
        };

        // Menu animation
        this.menuTime = 0;

        // Start menu idle loops (state begins as MENU)
        this.anim.startMenuLoops();

        // Wire game-side handlers for events emitted from Player / others.
        // Keeps player.js free of direct particles/shake/audio dependencies.
        emitter.on('shot:fired', ({ x, y, color }) => {
            this.particles.createMuzzleFlash(x, y, 0, color || '#00ffff');
        });
        emitter.on('bomb:empty', () => this.audio.playSmallExplosion());
        emitter.on('bomb:requested', ({ x, y }) => {
            let kills = 0;
            for (const e of this.spawner.enemies) {
                if (!e.active) continue;
                if (e.type === 'boss') {
                    e.takeDamage(Math.ceil(e.maxHp * 0.25));
                    this.particles.createColorExplosion(e.x, e.y,
                        ['#ffffff', '#ffdd00'], 20, 200, 0.5, 4);
                } else {
                    e.active = false;
                    kills++;
                    this.particles.createColorExplosion(e.x, e.y,
                        ['#ffffff', '#ffdd00', '#ff8800'], 15, 200, 0.4, 3);
                }
            }
            this.particles.createColorExplosion(x, y,
                ['#ffffff', '#ffddaa', '#ffaa44'], 60, 400, 1.0, 6);
            this.audio.playExplosion();
            if (kills > 0) {
                this.score += kills * 5;
                this.bombFlashTimer = 0.3;
                this.shake.shake(15, 0.5);
            }
        });
        emitter.on('wingman:expired', ({ x, y }) => {
            this.particles.createColorExplosion(x, y,
                ['#cc0000', '#ff4400', '#ff8800', '#ffffff'], 20, 240, 0.6, 4);
            this.shake.shake(4, 0.1);
        });

        // Auto-pause on tab switch — only auto-resume if WE paused (so we don't
        // un-pause a manual P/Esc pause when the user comes back).
        this._autoPaused = false;
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (this.state === STATE.PLAYING) {
                    this._autoPaused = true;
                    this.pause();
                }
            } else if (this._autoPaused && this.state === STATE.PAUSED) {
                this._autoPaused = false;
                this.pause(); // toggles back to PLAYING
                this.anim.screenFlash({ color: '#ffffff', intensity: 0.2, duration: 0.3 });
            }
        });
    }

    // ----- State transitions -----
    startGame() {
        this.audio.init();
        this.audio.resume();
        this.anim.killAll();
        this.anim.stopMenuLoops();
        this.anim.stopVignette();
        this._hitStopFrames = 0;
        this.state = STATE.PLAYING;
        this.score = 0;
        this.time = 0;
        this.powerupTimer = Utils.random(8, 15);

        // Apply difficulty
        const diff = this.difficultySettings[this.difficulties[this.difficultyIndex]];
        this.player.reset(this.canvas);
        this.player.lives = diff.lives;
        this.spawner.reset();
        this.spawner.baseInterval = diff.baseInterval;
        this._bulletSpeedMul = diff.bulletSpeedMul;
        this.projectiles = new ProjectilePool(200);
        this.particles = new ParticlePool(1200);
        this.anim.particles = this.particles; // keep cinematic FX bound to current pool
        this.powerups = [];
        // Randomize celestial body each new game
        this.background = new Background(this.canvas, this.assets);
        // Reset quotes and phases
        this.lastPhase = -1;
        this.quoteText = '';
        this.quoteTimer = 0;
        this.quoteInterval = Utils.random(3, 6);
        this.usedQuotes = [];
        // Boss & hazards
        this.bossActive = false;
        this.bossSpawnedForPhase = -1;
        this._bossPreview = null;
        this.hazardTimer = Utils.random(60, 90);
        this.solarFlare = new SolarFlare();
        this.blackHole = new BlackHole();
        this.asteroidBelt = new AsteroidBelt();
        this.bombFlashTimer = 0;
        // Stop menu music, start gameplay music
        this.menuMusic.pause();
        this.menuMusic.currentTime = 0;
        if (this.audio.ctx && this.audio.masterGain) {
            if (!this.music) this.music = new MusicManager(this.audio.ctx, this.audio.masterGain);
            if (this.audio.ctx.state === 'suspended') {
                this.audio.ctx.resume().then(() => this.music.start());
            } else {
                this.music.start();
            }
        }
    }

    pause() {
        if (this.state === STATE.PLAYING) {
            this.state = STATE.PAUSED;
        } else if (this.state === STATE.PAUSED) {
            this.state = STATE.PLAYING;
        }
    }

    gameOver() {
        this.anim.killAll();
        this.anim.stopVignette();
        this.state = STATE.GAME_OVER;
        // Capture PB delta BEFORE mutating highScore so the reveal animation
        // can show "+N above your best" with the correct old-best comparison.
        const prevBest = this.highScore;
        const isNewBest = this.score > prevBest;
        const pbDelta = isNewBest ? this.score - prevBest : 0;
        if (isNewBest) {
            this.highScore = this.score;
            localStorage.setItem('ninDefenderHigh', this.highScore.toString());
        }
        this.anim.gameOverReveal({ score: this.score, pbDelta, isNewBest });
        // Save scrap earned and update leaderboard
        this.player.addScrap(0); // ensure saved
        this.addToLeaderboard(this.score);
        this.audio.playGameOver();
        if (this.music) this.music.stop();
        // Resume menu music on game over screen
        this.menuMusic.currentTime = 0;
        this.menuMusic.play().catch(() => {});
    }

    addToLeaderboard(score) {
        this.leaderboard.push({
            score,
            phase: this.lastPhase + 1,
            time: Math.floor(this.time),
            maxCombo: this.player.maxCombo,
            date: new Date().toLocaleDateString()
        });
        this.leaderboard.sort((a, b) => b.score - a.score);
        this.leaderboard = this.leaderboard.slice(0, 10);
        localStorage.setItem('ninDefenderLeaderboard', JSON.stringify(this.leaderboard));
    }

    resize(w, h) {
        this.canvas.width = w;
        this.canvas.height = h;
        this.background.resize(this.canvas);
    }

    // ----- Input handlers -----
    onKeyDown(code) {
        this.keys[code] = true;
        this._checkEasterEgg(code);

        // Shop controls
        if (this.state === STATE.SHOP) {
            if (code === 'ArrowUp' || code === 'KeyW') this.shop.moveUp();
            if (code === 'ArrowDown' || code === 'KeyS') this.shop.moveDown();
            if (code === 'Space') this.shop.tryPurchase(this.player);
            if (code === 'Enter') {
                this.state = STATE.PLAYING;
                this.spawner.timer = 2.0; // brief grace after shop
            }
            return;
        }

        if (code === 'KeyP' || code === 'Escape') {
            if (this.state === STATE.PLAYING) {
                this._pauseMenuIndex = 0;
                this.pause();
            } else if (this.state === STATE.PAUSED) {
                this.pause(); // resume
            }
        }

        // Pause menu navigation
        if (this.state === STATE.PAUSED) {
            if (code === 'ArrowUp' || code === 'KeyW') {
                this._pauseMenuIndex = (this._pauseMenuIndex - 1 + 3) % 3;
            }
            if (code === 'ArrowDown' || code === 'KeyS') {
                this._pauseMenuIndex = (this._pauseMenuIndex + 1) % 3;
            }
            if (code === 'Space' || code === 'Enter') {
                if (this._pauseMenuIndex === 0) this.pause(); // resume
                else if (this._pauseMenuIndex === 1) this.startGame(); // restart
                else if (this._pauseMenuIndex === 2) { // main menu
                    this.anim.killAll();
                    this.anim.startMenuLoops();
                    this.state = STATE.MENU;
                    if (this.music) this.music.stop();
                    this.menuMusic.currentTime = 0;
                    this.menuMusic.play().catch(() => {});
                }
            }
            return;
        }

        // Difficulty selection on menu
        if (this.state === STATE.MENU) {
            if (code === 'ArrowLeft' || code === 'KeyA') {
                this.difficultyIndex = (this.difficultyIndex - 1 + 3) % 3;
                localStorage.setItem('ninDefenderDifficulty', this.difficultyIndex.toString());
                this.anim.popDifficulty();
            }
            if (code === 'ArrowRight' || code === 'KeyD') {
                this.difficultyIndex = (this.difficultyIndex + 1) % 3;
                localStorage.setItem('ninDefenderDifficulty', this.difficultyIndex.toString());
                this.anim.popDifficulty();
            }
        }

        // Start menu music on any key if we're on the menu
        if (this.state === STATE.MENU && !this.menuMusicStarted) {
            this.menuMusicStarted = true;
            this.menuMusic.currentTime = 0;
            this.menuMusic.play().catch(() => {});
        }

        if (code === 'Space') {
            this.audio.init();
            this.audio.resume();
            if (this.state === STATE.MENU) {
                this.startGame();
            } else if (this.state === STATE.GAME_OVER) {
                this.startGame();
            } else if (this.state === STATE.DYING) {
                // Skip the slow-mo death sequence — go straight to game over.
                this._dyingTimer = 0;
                this.gameOver();
            }
        }
    }

    onKeyUp(code) {
        this.keys[code] = false;
    }

    _checkEasterEgg(code) {
        if (this.state !== STATE.PLAYING) return;
        // Extract letter from key code (e.g., 'KeyH' → 'H')
        if (code.startsWith('Key')) {
            this._codeBuffer += code.charAt(3);
            this._codeTimer = 2.0; // reset timeout

            // Check for codes
            if (this._codeBuffer.endsWith('HURT')) {
                // God mode — max lives, invincible
                this.player.lives = this.player.maxLives;
                this.player.invincible = true;
                this.player.invincibleTimer = 30;
                this.anim.phaseAnnounce('GOD MODE', { color: '#cc0000', duration: 2.0 });
                this._codeBuffer = '';
            } else if (this._codeBuffer.endsWith('CLOSER')) {
                // Spawn a max-level boss
                const boss = new Boss(this.canvas.width, this.canvas.height, 9, this.assets);
                boss.canvas_w = this.canvas.width;
                this.spawner.enemies.push(boss);
                this.bossActive = true;
                this.anim.phaseAnnounce('CLOSER', { color: '#ff2200', duration: 2.0 });
                this._codeBuffer = '';
            }

            // Trim buffer
            if (this._codeBuffer.length > 10) {
                this._codeBuffer = this._codeBuffer.slice(-10);
            }
        }
    }

    // ----- Main update -----
    update(dt) {
        this.menuTime += dt;

        // Drive GSAP from gameTime so cinematics freeze when the game pauses.
        if (this.state !== STATE.PAUSED) {
            this.gameTime += dt;
            this.anim.tick(this.gameTime);
        }

        // Hit-stop — freeze world simulation for N frames while anim/shake/
        // flashes continue. Just an early-return that still ticks shake.
        if (this._hitStopFrames > 0) {
            this._hitStopFrames--;
            this.shake.update(dt);
            return;
        }

        if (this.state === STATE.MENU) {
            this.background.update(dt);
            return;
        }

        if (this.state === STATE.PAUSED) return;

        if (this.state === STATE.SHOP) {
            this.shop.update(dt);
            this.background.update(dt);
            return;
        }

        if (this.state === STATE.WAVE_CLEAR) {
            this.background.update(dt);
            this.particles.update(dt);
            // Transition to SHOP fires from waveClearBanner's onComplete callback.
            return;
        }

        if (this.state === STATE.GAME_OVER) {
            this.background.update(dt);
            this.particles.update(dt);
            return;
        }

        if (this.state === STATE.DYING) {
            // Sequence ticks on real time; world updates use a heavy slow-mo dt.
            this._dyingTimer -= dt;
            const slowDt = dt * 0.15;
            this.shake.update(dt);
            this.background.update(slowDt);
            this.particles.update(slowDt);
            this.projectiles.update(slowDt, this.canvas.width, this.canvas.height);
            this.spawner.update(slowDt, this.score, this.canvas.width, this.canvas.height,
                this.projectiles, this.player.y, this.audio, this.player.x);
            if (this._dyingTimer <= 0) {
                this.gameOver();
            }
            return;
        }

        // --- PLAYING ---
        this.time += dt;
        // Time Warp slows the world (enemies, bullets, particles, hazards) but not the
        // player or spawn timers — the player should feel responsive while everything
        // around them drifts. Spawn rates stay on real dt so warp doesn't starve you.
        const worldDt = this.player.timeWarp ? dt * 0.3 : dt;
        this.background.update(worldDt);
        this.shake.update(dt);

        // Player — always on real dt
        this.player.update(dt, this.keys, this.joystick);
        // Combo loss flourish — small flash burst when a high streak (>= 10)
        // expires, so the player notices what they just lost.
        if (this.player._comboResetFrom >= 10) {
            this.particles.createColorExplosion(this.player.x, this.player.y,
                ['#ff2200', '#ffaa00', '#ffffff'], 18, 200, 0.5, 4);
            this.shake.shake(2, 0.1);
        }
        // Wingman disintegration burst — handled by the 'wingman:expired'
        // subscriber bound in the constructor (no per-frame polling needed).
        this.player.drawTrail(this.particles);

        // Auto-fire if key held or touch — apply micro shake + recoil per shot.
        if ((this.keys['Space'] || this.touchFiring) && this.state === STATE.PLAYING) {
            const shot = this.player.shoot(this.projectiles);
            if (shot && !this.player.invincible) {
                if (shot.tripleShot) {
                    this.shake.shake(2, 0.07);
                    this.player.vx -= 45; // 3 separate nudges, applied in one frame
                } else if (shot.rapidFire) {
                    this.shake.shake(0.5, 0.03);
                    this.player.vx -= 15;
                } else {
                    this.shake.shake(1, 0.05);
                    this.player.vx -= 15;
                }
            }
        }

        // Wingman auto-fire — synergies tweak cadence + projectile properties
        if (this.player.wingman && this.player.wingmanShootTimer <= 0) {
            const synergy = this.player.getActiveSynergy();
            // FIRE_SUPPORT (rapid+wingman): wingman matches player fire rate
            this.player.wingmanShootTimer = synergy === 'FIRE_SUPPORT'
                ? this.player.fireRate
                : 0.3;
            const p = this.projectiles.get();
            if (p) {
                p.init(this.player.wingmanX + 15, this.player.wingmanY,
                    600, Utils.random(-30, 30), '#4488ff', '#4488ff', false,
                    this.player.baseDamage || 1);
                // BOUNCE_DRONE (wingman+ricochet): wingman bullets also bounce
                if (synergy === 'BOUNCE_DRONE') {
                    p.bounces = 3;
                    p.color = '#ff8800';
                    p.glowColor = '#ff8800';
                }
            }
        }

        // Laser Beam — sustained hitscan ray. Damages all enemies in a horizontal
        // band ahead of the player; renderer reads this._laserBeam to draw the line.
        if (this.player.laserBeam) {
            const beamX = this.player.x + this.player.width / 2;
            const beamY = this.player.y;
            const beamHalfWidth = 14;
            const dmgPerSec = 3;
            const dmgThisFrame = dmgPerSec * dt;
            for (const e of this.spawner.enemies) {
                if (!e.active || e.x < beamX) continue;
                if (Math.abs(e.y - beamY) > (e.radius || 0) + beamHalfWidth) continue;
                const killed = e.takeDamage(dmgThisFrame);
                if (killed) {
                    this.score += 10;
                    this.particles.createColorExplosion(e.x, e.y,
                        ['#ff0066', '#ffffff', '#ff8800'], 20, 250, 0.6, 4);
                }
            }
            this._laserBeam = { x1: beamX, y1: beamY, x2: this.canvas.width, y2: beamY };
            // Continuous low rumble while firing (per #61 AC mention)
            this.shake.shake(0.5, 0.02);
        } else {
            this._laserBeam = null;
        }

        // Activate shield on E key (consume the keypress)
        if (this.keys['KeyE'] && this.state === STATE.PLAYING) {
            this.player.activateShield(this.audio);
            this.keys['KeyE'] = false;
        }

        // Activate bomb on Q key — score + flash + shake all happen in the
        // 'bomb:requested' subscriber bound in the constructor.
        if (this.keys['KeyQ'] && this.state === STATE.PLAYING) {
            this.player.activateBomb();
            this.keys['KeyQ'] = false;
        }
        if (this.bombFlashTimer > 0) this.bombFlashTimer -= dt;

        // Cycle trail color on T key
        if (this.keys['KeyT'] && this.state === STATE.PLAYING) {
            this.player.cycleTrail();
            this.keys['KeyT'] = false;
        }
        if (this.keys['KeyY'] && this.state === STATE.PLAYING) {
            this.player.cycleSkin();
            this.keys['KeyY'] = false;
        }

        // Enemies — visual movement slows under Time Warp
        this.spawner.update(worldDt, this.score, this.canvas.width, this.canvas.height,
            this.projectiles, this.player.y, this.audio, this.player.x);

        // Phase announcement + boss spawning
        const currentPhase = this.spawner.currentPhase;
        if (currentPhase !== this.lastPhase) {
            this.lastPhase = currentPhase;
            const phaseInfo = PHASES[currentPhase];
            this.anim.phaseAnnounce(phaseInfo.name,
                { color: phaseInfo.color, duration: 4.0 });
            this.phaseStartTime = this.time;

            // Clear all non-boss enemies for a clean phase transition
            if (currentPhase > 0) {
                for (let i = this.spawner.enemies.length - 1; i >= 0; i--) {
                    const e = this.spawner.enemies[i];
                    if (e.type !== 'boss') {
                        // Explosion effect on each cleared enemy
                        this.particles.createColorExplosion(e.x, e.y,
                            ['#ffffff', '#aaaaaa'], 8, 150, 0.4, 3);
                        this.spawner.enemies.splice(i, 1);
                    }
                }
                // Clear enemy bullets too
                for (const b of this.projectiles.getEnemyBullets()) {
                    b.active = false;
                }
                // Brief spawn pause
                this.spawner.timer = 3.0;
            }

            // Spawn boss at each phase transition (except phase 0)
            if (currentPhase > 0 && this.bossSpawnedForPhase < currentPhase) {
                this.bossSpawnedForPhase = currentPhase;
                const boss = new Boss(this.canvas.width, this.canvas.height, currentPhase - 1, this.assets);
                boss.canvas_w = this.canvas.width;
                this.spawner.enemies.push(boss);
                this.bossActive = true;
                // Set up the boss preview panel — runs for ~2s, fades over the last 0.4s.
                this._bossPreview = {
                    timer: 2.0,
                    duration: 2.0,
                    name: BOSS_NAMES[boss.bossType] || `BOSS T${boss.bossType + 1}`,
                    tier: boss.bossType + 1,
                    maxHp: boss.maxHp,
                    color: boss.color,
                };
            }
        }
        // Check if boss is still alive
        if (this.bossActive) {
            const bossAlive = this.spawner.enemies.some(e => e.type === 'boss' && e.active);
            if (!bossAlive) this.bossActive = false;
        }

        // Boss preview panel countdown (real time — independent of Time Warp)
        if (this._bossPreview) {
            this._bossPreview.timer -= dt;
            if (this._bossPreview.timer <= 0) this._bossPreview = null;
        }

        // Low-HP vignette — pulses while critical, fades when not. Idempotent.
        if (this.player.lives <= 1) this.anim.startVignette();
        else this.anim.stopVignette();

        // Environmental hazards — less frequent in easy phases, more frequent later
        this.hazardTimer -= dt;
        if (this.hazardTimer <= 0 && !this.bossActive && currentPhase >= 3) {
            const hazardGap = currentPhase <= 5 ? Utils.random(35, 55) : Utils.random(20, 35);
            this.hazardTimer = hazardGap;
            const hazardRoll = Math.random();
            if (hazardRoll < 0.33) {
                this.solarFlare.trigger(this.canvas.width);
            } else if (hazardRoll < 0.66) {
                this.blackHole.trigger(this.canvas.width, this.canvas.height);
            } else {
                this.asteroidBelt.trigger(this.canvas.width, this.canvas.height);
            }
        }
        // Active hazards' visual updates slow under Time Warp; spawn timer above stays real-time.
        this.solarFlare.update(worldDt);
        this.blackHole.update(worldDt);
        this.asteroidBelt.update(worldDt, this.canvas.width);

        // Black hole pull on player
        if (this.blackHole.active) {
            const pull = this.blackHole.getPullForce(this.player.x, this.player.y);
            this.player.vx += pull.fx * dt * 200;
            this.player.vy += pull.fy * dt * 200;

            // Bend all bullets and enemies toward the black hole
            const allBullets = [...this.projectiles.getPlayerBullets(), ...this.projectiles.getEnemyBullets()];
            for (const b of allBullets) {
                if (!b.active) continue;
                const bp = this.blackHole.getPullForce(b.x, b.y);
                b.vx += bp.fx * dt * 400;
                b.vy += bp.fy * dt * 400;
            }
            for (const e of this.spawner.enemies) {
                if (!e.active || e.type === 'boss') continue;
                const ep = this.blackHole.getPullForce(e.x, e.y);
                e.x += ep.fx * dt * 100;
                e.y += ep.fy * dt * 100;
            }
        }

        // Solar flare collision with player
        if (this.solarFlare.active && !this.solarFlare.warning) {
            const hitbox = this.solarFlare.getHitbox();
            if (hitbox && Math.abs(this.player.x - hitbox.x) < hitbox.width / 2 + this.player.radius) {
                this.handlePlayerHit();
            }
        }

        // Easter egg code buffer timeout
        if (this._codeTimer > 0) {
            this._codeTimer -= dt;
            if (this._codeTimer <= 0) this._codeBuffer = '';
        }

        // Music intensity scales with phase (10 phases)
        if (this.music && this.music.playing) {
            this.music.setIntensity(Math.min(1, (this.lastPhase + 1) / 10));
        }

        // Projectiles + particles slow under Time Warp.
        this.projectiles.update(worldDt, this.canvas.width, this.canvas.height);
        this.particles.update(worldDt);

        // Power-ups — spawn timer stays on real dt so warp doesn't starve drops;
        // the dropped icon's drift slows visually with worldDt.
        this.powerupTimer -= dt;
        if (this.powerupTimer <= 0) {
            this.spawnPowerUp();
            this.powerupTimer = Utils.random(8, 15);
        }
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            this.powerups[i].update(worldDt, this.canvas.width);
            if (!this.powerups[i].active) {
                this.powerups.splice(i, 1);
            }
        }

        // NIN quotes
        if (this.quoteTimer > 0) {
            this.quoteTimer -= dt;
        }
        this.quoteInterval -= dt;
        if (this.quoteInterval <= 0) {
            this.quoteInterval = Utils.random(25, 45);
            this.showRandomQuote();
        }

        // Clear spawn-frame immunity from last frame
        for (const e of this.spawner.enemies) { e._spawnFrame = false; }

        // Collisions
        this.checkCollisions();
    }

    showRandomQuote() {
        // Get lyrics for the currently playing song
        const trackName = this.music && this.music.currentTrackName;
        const lyrics = (trackName && SONG_LYRICS[trackName]) || null;
        if (!lyrics || lyrics.length === 0) return;

        // Reset used quotes when song changes
        if (this._lastTrackName !== trackName) {
            this._lastTrackName = trackName;
            this.usedQuotes = [];
        }

        if (this.usedQuotes.length >= lyrics.length) {
            this.usedQuotes = [];
        }
        const available = lyrics.filter((_, i) => !this.usedQuotes.includes(i));
        const idx = lyrics.indexOf(available[Utils.randomInt(0, available.length - 1)]);
        this.usedQuotes.push(idx);
        this.quoteText = lyrics[idx];
        this.quoteTimer = this.quoteDuration;
        this.ui._quoteWordPositions = null;
    }

    spawnPowerUp() {
        const pu = new PowerUp();
        // Weighted selection — extra lives more likely when low on lives
        let type;
        if (this.player.lives <= 3 && Math.random() < 0.35) {
            type = 'EXTRA_LIFE';
        } else {
            type = POWERUP_KEYS[Utils.randomInt(0, POWERUP_KEYS.length - 1)];
        }
        pu.init(
            this.canvas.width + 20,
            Utils.random(40, this.canvas.height - 40),
            type,
            this.assets
        );
        this.powerups.push(pu);
    }

    // ----- Collision detection -----
    checkCollisions() {
        const enemies = this.spawner.enemies;
        const playerBullets = this.projectiles.getPlayerBullets();
        const enemyBullets = this.projectiles.getEnemyBullets();
        const px = this.player.x;
        const py = this.player.y;
        const pr = this.player.radius;

        // Player bullets → enemies
        for (const bullet of playerBullets) {
            for (let i = enemies.length - 1; i >= 0; i--) {
                const e = enemies[i];
                if (!e.active) continue;
                if (Utils.circleCollision(bullet.x, bullet.y, bullet.radius, e.x, e.y, e.radius)) {
                    if (!bullet.pierce) bullet.active = false;
                    // Boss damage feels weighty: 3-frame hit-stop + theme-color flash.
                    if (e.type === 'boss' && this._hitStopFrames === 0) {
                        this._hitStopFrames = 3;
                        this.anim.screenFlash({ color: e.color || '#ffffff', intensity: 0.3, duration: 0.08 });
                    }
                    const killed = e.takeDamage(bullet.damage);
                    if (killed) {
                        e.active = false;
                        // Combo + score
                        this.player.registerKill();
                        const multiplier = this.player.getComboMultiplier() * this.player.getPowerComboMultiplier();
                        this.score += Math.floor(e.points * multiplier);
                        // Scrap drops (1-3 per kill)
                        this.player.addScrap(Utils.randomInt(1, e.type === 'boss' ? 30 : 3));
                        this.scrapPulse = 1.0;

                        // Asteroid spider burst — only after phase 4, 15% chance
                        if (e.type === 'asteroid' && this.lastPhase >= 4 && Math.random() < 0.15) {
                            const spiderCount = Utils.randomInt(2, 3);
                            for (let s = 0; s < spiderCount; s++) {
                                const spider = new SpiderDrone(this.canvas.width, this.canvas.height);
                                spider.x = e.x;
                                spider.y = e.y + Utils.random(-20, 20);
                                spider.radius = 10; // smaller than normal
                                spider.hp = 1;
                                spider.maxHp = 1;
                                spider.points = 15;
                                spider.vx = Utils.random(-160, -80);
                                spider.canvas_w = this.canvas.width;
                                this.spawner.enemies.push(spider);
                            }
                        }

                        // Asteroid splitting — asteroids break into smaller fragments
                        if (e.type === 'asteroid') {
                            // Only split if not already a tiny fragment
                            if (e.radius > 8 * GAME_SCALE) {
                                const fragCount = e.radius > 16 * GAME_SCALE ? Utils.randomInt(3, 5) : Utils.randomInt(2, 3);

                                for (let f = 0; f < fragCount; f++) {
                                    const angle = ((f + 0.5) / fragCount) * Math.PI * 2;
                                    const fragR = e.radius * Utils.random(0.4, 0.6);
                                    const frag = new Asteroid(
                                        this.canvas.width, this.canvas.height,
                                        1, // normal sizeMultiplier
                                        e.x, e.y
                                    );
                                    // Override radius directly for precise control
                                    frag.radius = Math.max(6, fragR);
                                    frag.sizeMultiplier = 0.5;
                                    frag.hp = 1;
                                    frag.maxHp = 1;
                                    frag.points = 5;
                                    frag._spawnFrame = true;
                                    // Push out from center immediately so fragments don't overlap kill point
                                    const scatterDist = e.radius * 0.5;
                                    frag.x = e.x + Math.cos(angle) * scatterDist;
                                    frag.y = e.y + Math.sin(angle) * scatterDist;
                                    frag.vx = Math.cos(angle) * Utils.random(80, 150) - 60;
                                    frag.vy = Math.sin(angle) * Utils.random(60, 120);
                                    frag.wavy = false;
                                    frag.baseY = frag.y;
                                    // Regenerate shape for new radius
                                    frag.vertices = Utils.generateAsteroidShape(frag.radius, Utils.randomInt(5, 8));
                                    this.spawner.enemies.push(frag);
                                }
                            }
                        }

                        // Type-specific explosion effects
                        const explosionMap = {
                            ship:    { colors: ['#ff6644', '#ffaa33', '#ffee00', '#ffffff'], count: 30, shake: 6 }, // critter splat
                            bomber:  { colors: ['#cc44ff', '#aa66ee', '#8833cc', '#ffffff'], count: 40, shake: 8 }, // octopus ink burst
                            mine:    { colors: ['#ff66cc', '#ff88dd', '#ffaaee', '#ffffff'], count: 35, shake: 7 }, // jellyfish pop
                            drone:   { colors: ['#ddff00', '#ffee44', '#aadd00', '#ffffff'], count: 12, shake: 2 }, // firefly flash
                            stealth: { colors: ['#00cccc', '#00ffff', '#ffff00', '#ff00ff'], count: 22, shake: 4 }, // chameleon color burst
                            spider:  { colors: ['#66ff22', '#aaff44', '#44aa11', '#ffffff'], count: 28, shake: 5 },
                            ghost:   { colors: ['#bb66ff', '#dd99ff', '#8833cc', '#ffffff'], count: 25, shake: 4 },
                            devil:   { colors: ['#ff4400', '#ff8800', '#ffcc00', '#ff2200'], count: 35, shake: 7 },
                            boss:    { colors: ['#ffffff', '#ffdd00', '#ff8800', '#ff3366', '#00ffff'], count: 60, shake: 15 },
                            asteroid:{ colors: ['#ff9900', '#ffdd00', '#aa7733', '#ffffff'], count: 30, shake: 5 }
                        };
                        const fx = explosionMap[e.type] || explosionMap.asteroid;
                        this.particles.createColorExplosion(e.x, e.y, fx.colors,
                            fx.count, 300, 0.8, 5);
                        this.shake.shake(fx.shake, 0.15);
                        this.audio.playExplosion();

                        // Boss kill — trigger cinematic, then wave-clear banner, then shop.
                        if (e.type === 'boss') {
                            const phase = this.lastPhase;
                            this.anim.bossKillCinematic(e.x, e.y, () => {
                                this.state = STATE.WAVE_CLEAR;
                                this.anim.waveClearBanner(phase, () => {
                                    this.state = STATE.SHOP;
                                    this.shop.selectedIndex = 0;
                                });
                            });
                        }

                        // Chain explosion — damage nearby enemies
                        const chainRadius = 60 * GAME_SCALE;
                        for (let j = enemies.length - 1; j >= 0; j--) {
                            const other = enemies[j];
                            if (!other.active || other === e || other._spawnFrame) continue;
                            const dist = Utils.distance(e.x, e.y, other.x, other.y);
                            if (dist < chainRadius + other.radius) {
                                const chainKill = other.takeDamage(1);
                                if (chainKill) {
                                    other.active = false;
                                    this.player.registerKill();
                                    this.score += Math.floor(other.points * this.player.getComboMultiplier());
                                    this.particles.createColorExplosion(other.x, other.y,
                                        ['#ff6600', '#ffaa00', '#ffffff'], 20, 250, 0.6, 4);
                                    this.audio.playSmallExplosion();
                                } else {
                                    this.particles.createExplosion(other.x, other.y, '#ffaa00', 8, 100, 0.3, 2);
                                }
                            }
                        }
                    } else {
                        // Hit flash
                        this.particles.createExplosion(e.x, e.y, '#ffffff', 6, 120, 0.2, 2);
                        this.audio.playSmallExplosion();
                    }
                    break;
                }
            }
        }

        // Enemy bullets → player
        if (this.player.alive) {
            for (const bullet of enemyBullets) {
                if (Utils.circleCollision(bullet.x, bullet.y, bullet.radius, px, py, pr)) {
                    bullet.active = false;
                    this.handlePlayerHit();
                }
            }

            // Enemies → player (body collision)
            for (let i = enemies.length - 1; i >= 0; i--) {
                const e = enemies[i];
                if (!e.active) continue;
                if (Utils.circleCollision(e.x, e.y, e.radius, px, py, pr)) {
                    e.active = false;
                    this.particles.createColorExplosion(e.x, e.y,
                        ['#ff3366', '#ff9900', '#ffdd00'], 20, 200, 0.5, 3);
                    this.audio.playExplosion();
                    this.handlePlayerHit();
                }
            }

            // Power-ups → player
            for (let i = this.powerups.length - 1; i >= 0; i--) {
                const pu = this.powerups[i];
                if (Utils.circleCollision(pu.x, pu.y, pu.radius, px, py, pr + 5)) {
                    this.player.applyPowerUp(pu.type);
                    const info = POWERUP_TYPES[pu.type];
                    this.particles.createExplosion(pu.x, pu.y, info.color, 15, 150, 0.4, 3);
                    this.audio.playPowerUp();
                    pu.active = false;
                    this.powerups.splice(i, 1);
                }
            }
        }
    }

    handlePlayerHit() {
        // Nuke Overcharge intercept: the next damaging hit auto-detonates a bomb (or
        // absorbs harmlessly if no bombs left). Consumed on use either way.
        if (this.player.nukeOvercharge) {
            this.player.nukeOvercharge = false;
            this.player.nukeOverchargeTimer = 0;
            if (this.player.bombs > 0) {
                const kills = this.player.activateBomb(this.audio, this.particles, this.spawner.enemies);
                if (kills > 0) this.score += kills * 5;
                this.bombFlashTimer = 0.3;
                this.shake.shake(15, 0.5);
            } else {
                // No bombs — absorb the hit with a small flash
                this.particles.createColorExplosion(this.player.x, this.player.y,
                    ['#ff4400', '#ffaa00', '#ffffff'], 24, 220, 0.5, 4);
                this.shake.shake(6, 0.2);
                this.audio.playPowerUp();
            }
            return;
        }
        const dead = this.player.hit();
        if (dead) {
            // Re-entry guard: if the dying sequence already started, don't restart it.
            if (this.state === STATE.DYING) return;
            // Heavy hit-stop + intense red flash punctuates death.
            this._hitStopFrames = 8;
            this.anim.screenFlash({ color: '#ff0000', intensity: 0.9, duration: 0.3 });
            this.state = STATE.DYING;
            this._dyingTimer = 1.5;

            // Initial fragmenting explosion
            this.particles.createColorExplosion(this.player.x, this.player.y,
                ['#00ffff', '#ffffff', '#0088ff', '#ff3366'], 50, 300, 0.8, 5);
            // 8 spinning debris bursts in a ring around the ship
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                this.particles.createColorExplosion(
                    this.player.x + Math.cos(angle) * 10,
                    this.player.y + Math.sin(angle) * 10,
                    ['#cccccc', '#888888', '#444444'], 4, 200, 1.5, 3);
            }
            this.shake.shake(20, 1.5);
            // Cut music for dramatic silence
            if (this.music) this.music.stop();
        } else {
            // Survive — moderate hit-stop + red flash.
            this._hitStopFrames = 4;
            this.anim.screenFlash({ color: '#ff0000', intensity: 0.5, duration: 0.12 });
            this.shake.shake(8, 0.2);
            this.audio.playHit();
        }
    }

    // ----- Render -----
    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();

        // Apply screen shake
        if (this.state === STATE.PLAYING || this.state === STATE.GAME_OVER || this.state === STATE.DYING) {
            ctx.translate(this.shake.offsetX, this.shake.offsetY);
        }

        // Background
        this.background.draw(ctx);

        if (this.state === STATE.PLAYING || this.state === STATE.PAUSED || this.state === STATE.WAVE_CLEAR || this.state === STATE.DYING) {
            // Environmental hazards (behind gameplay)
            this.asteroidBelt.draw(ctx);
            this.blackHole.draw(ctx);
            // Power-ups
            for (const pu of this.powerups) pu.draw(ctx);
            // Enemies
            this.spawner.draw(ctx);
            // Player
            this.player.draw(ctx);
            // Laser Beam ray — drawn between player and projectiles for layering punch
            if (this._laserBeam) {
                const lb = this._laserBeam;
                const flicker = 0.8 + 0.2 * Math.sin(this.time * 60);
                ctx.save();
                ctx.strokeStyle = '#ff0066';
                ctx.shadowColor = '#ff0066';
                ctx.shadowBlur = 18;
                ctx.lineWidth = 6 * flicker;
                ctx.globalAlpha = 0.9;
                ctx.beginPath();
                ctx.moveTo(lb.x1, lb.y1);
                ctx.lineTo(lb.x2, lb.y2);
                ctx.stroke();
                // Inner hot core
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.moveTo(lb.x1, lb.y1);
                ctx.lineTo(lb.x2, lb.y2);
                ctx.stroke();
                ctx.restore();
            }
            // Solar flare (in front of everything)
            this.solarFlare.draw(ctx, this.canvas.height);
            // Projectiles
            this.projectiles.draw(ctx);
            // Particles on top
            this.particles.draw(ctx);
            // Bomb flash overlay
            if (this.bombFlashTimer > 0) {
                ctx.fillStyle = `rgba(255, 255, 255, ${this.bombFlashTimer})`;
                ctx.fillRect(-50, -50, this.canvas.width + 100, this.canvas.height + 100);
            }
        }

        if (this.state === STATE.GAME_OVER) {
            this.spawner.draw(ctx);
            this.particles.draw(ctx);
        }

        // DYING red fade overlay — alpha grows from 0 → ~0.6 over 1.5s.
        // Drawn inside the shake transform so the bleed shakes with the camera.
        if (this.state === STATE.DYING) {
            const progress = 1 - Math.max(0, this._dyingTimer / 1.5);
            ctx.fillStyle = `rgba(180, 0, 0, ${progress * 0.6})`;
            ctx.fillRect(-50, -50, this.canvas.width + 100, this.canvas.height + 100);
        }

        ctx.restore();

        // HUD and overlays (not affected by shake)
        if (this.state === STATE.PLAYING || this.state === STATE.PAUSED || this.state === STATE.WAVE_CLEAR) {
            this.ui.drawHUD(ctx);
        }

        if (this.state === STATE.MENU)        this.ui.drawMenu(ctx);
        if (this.state === STATE.PAUSED)      this.ui.drawPause(ctx);
        if (this.state === STATE.SHOP)        this.shop.draw(ctx, this.canvas, this.player);
        if (this.state === STATE.WAVE_CLEAR)  this.ui.drawWaveClear(ctx);
        if (this.state === STATE.GAME_OVER)   this.ui.drawGameOver(ctx);

        // Screen flash overlay — driven by anim.screenFlash() (hit-stop, etc).
        const fa = this.anim.flash.alpha;
        if (fa > 0.01) {
            ctx.save();
            ctx.fillStyle = this.anim.flash.color;
            ctx.globalAlpha = fa;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.restore();
        }

        // Low-HP vignette — drawn last, only during gameplay-adjacent states
        const vi = this.anim.vignette.intensity;
        if (vi > 0.01 && (this.state === STATE.PLAYING || this.state === STATE.PAUSED || this.state === STATE.WAVE_CLEAR || this.state === STATE.DYING)) {
            const w = this.canvas.width;
            const h = this.canvas.height;
            const grad = ctx.createRadialGradient(
                w / 2, h / 2, Math.min(w, h) * 0.25,
                w / 2, h / 2, Math.max(w, h) * 0.75
            );
            grad.addColorStop(0, 'rgba(180, 0, 0, 0)');
            grad.addColorStop(1, `rgba(180, 0, 0, ${vi * 0.65})`);
            ctx.save();
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        }
    }

}
