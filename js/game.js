// ============================================================
// game.js — Game state machine, update loop, collision, HUD
// ============================================================

const STATE = {
    MENU:      'MENU',
    PLAYING:   'PLAYING',
    PAUSED:    'PAUSED',
    SHOP:      'SHOP',
    GAME_OVER: 'GAME_OVER'
};

class Game {
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
        this.leaderboard = JSON.parse(localStorage.getItem('ninDefenderLeaderboard') || '[]');

        // Bomb flash
        this.bombFlashTimer = 0;

        // State
        this.state = STATE.MENU;
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('ninDefenderHigh') || '0', 10);
        this.time = 0;
        this.powerupTimer = 0;

        // Phase announcement
        this.lastPhase = -1;
        this.phaseAnnounceTimer = 0;
        this.phaseAnnounceName = '';
        this.phaseStartTime = 0; // for speed run timer
        this.phaseAnnounceColor = '#ffffff';

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

        // Pre-rendered scan lines overlay
        this._scanCanvas = null;

        // Boss kill cinematic
        this._bossKillTimer = 0;
        this._bossKillX = 0;
        this._bossKillY = 0;
        this._bossKillStage = 0;

        // Menu animation
        this.menuTime = 0;
    }

    // ----- State transitions -----
    startGame() {
        this.audio.init();
        this.audio.resume();
        this.state = STATE.PLAYING;
        this.score = 0;
        this.time = 0;
        this.powerupTimer = Utils.random(8, 15);
        this.player.reset(this.canvas);
        this.spawner.reset();
        this.projectiles = new ProjectilePool(200);
        this.particles = new ParticlePool(1200);
        this.powerups = [];
        // Randomize celestial body each new game
        this.background = new Background(this.canvas, this.assets);
        // Reset quotes and phases
        this.lastPhase = -1;
        this.phaseAnnounceTimer = 0;
        this.quoteText = '';
        this.quoteTimer = 0;
        this.quoteInterval = Utils.random(3, 6);
        this.usedQuotes = [];
        // Boss & hazards
        this.bossActive = false;
        this.bossSpawnedForPhase = -1;
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
        this.state = STATE.GAME_OVER;
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('ninDefenderHigh', this.highScore.toString());
        }
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

    _getScanLines(w, h) {
        if (this._scanCanvas && this._scanCanvas.width === w && this._scanCanvas.height === h) {
            return this._scanCanvas;
        }
        this._scanCanvas = document.createElement('canvas');
        this._scanCanvas.width = w;
        this._scanCanvas.height = h;
        const sCtx = this._scanCanvas.getContext('2d');
        sCtx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        for (let y = 0; y < h; y += 4) sCtx.fillRect(0, y, w, 2);
        return this._scanCanvas;
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
            if (this.state === STATE.PLAYING || this.state === STATE.PAUSED) {
                this.pause();
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
                this.phaseAnnounceName = 'GOD MODE';
                this.phaseAnnounceColor = '#cc0000';
                this.phaseAnnounceTimer = 2.0;
                this._codeBuffer = '';
            } else if (this._codeBuffer.endsWith('CLOSER')) {
                // Spawn a max-level boss
                const boss = new Boss(this.canvas.width, this.canvas.height, 9, this.assets);
                boss.canvas_w = this.canvas.width;
                this.spawner.enemies.push(boss);
                this.bossActive = true;
                this.phaseAnnounceName = 'CLOSER';
                this.phaseAnnounceColor = '#ff2200';
                this.phaseAnnounceTimer = 2.0;
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

        if (this.state === STATE.GAME_OVER) {
            this.background.update(dt);
            this.particles.update(dt);
            return;
        }

        // --- PLAYING ---
        this.time += dt;
        this.background.update(dt);
        this.shake.update(dt);

        // Player
        this.player.update(dt, this.keys, this.joystick);
        this.player.drawTrail(this.particles);

        // Auto-fire if key held or touch
        if ((this.keys['Space'] || this.touchFiring) && this.state === STATE.PLAYING) {
            this.player.shoot(this.projectiles, this.particles, this.audio);
        }

        // Wingman auto-fire
        if (this.player.wingman && this.player.wingmanShootTimer <= 0) {
            this.player.wingmanShootTimer = 0.3;
            const p = this.projectiles.get();
            if (p) {
                p.init(this.player.wingmanX + 15, this.player.wingmanY,
                    600, Utils.random(-30, 30), '#4488ff', '#4488ff', false,
                    this.player.baseDamage || 1);
            }
        }

        // Activate shield on E key (consume the keypress)
        if (this.keys['KeyE'] && this.state === STATE.PLAYING) {
            this.player.activateShield(this.audio);
            this.keys['KeyE'] = false;
        }

        // Activate bomb on Q key
        if (this.keys['KeyQ'] && this.state === STATE.PLAYING) {
            const kills = this.player.activateBomb(this.audio, this.particles, this.spawner.enemies);
            if (kills > 0) {
                this.score += kills * 5;
                this.bombFlashTimer = 0.3;
                this.shake.shake(15, 0.5);
            }
            this.keys['KeyQ'] = false;
        }
        if (this.bombFlashTimer > 0) this.bombFlashTimer -= dt;

        // Cycle trail color on T key
        if (this.keys['KeyT'] && this.state === STATE.PLAYING) {
            this.player.cycleTrail();
            this.keys['KeyT'] = false;
        }

        // Enemies
        this.spawner.update(dt, this.score, this.canvas.width, this.canvas.height,
            this.projectiles, this.player.y, this.audio, this.player.x);

        // Phase announcement + boss spawning
        const currentPhase = this.spawner.currentPhase;
        if (currentPhase !== this.lastPhase) {
            this.lastPhase = currentPhase;
            const phaseInfo = PHASES[currentPhase];
            this.phaseAnnounceName = phaseInfo.name;
            this.phaseAnnounceColor = phaseInfo.color;
            this.phaseAnnounceTimer = 4.0;
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
            }
        }
        if (this.phaseAnnounceTimer > 0) this.phaseAnnounceTimer -= dt;

        // Check if boss is still alive
        if (this.bossActive) {
            const bossAlive = this.spawner.enemies.some(e => e.type === 'boss' && e.active);
            if (!bossAlive) this.bossActive = false;
        }

        // Boss kill cinematic — staged explosions before shop
        if (this._bossKillTimer > 0) {
            this._bossKillTimer -= dt;
            const elapsed = 2.0 - this._bossKillTimer;
            const bx = this._bossKillX;
            const by = this._bossKillY;

            // Stage 0: initial burst (0.0s)
            if (this._bossKillStage === 0) {
                this._bossKillStage = 1;
                this.shake.shake(20, 0.5);
                this.particles.createColorExplosion(bx, by,
                    ['#ffffff', '#ffdd00', '#ff8800'], 40, 400, 1.0, 7);
            }
            // Stage 1: secondary explosions (0.3s)
            if (this._bossKillStage === 1 && elapsed > 0.3) {
                this._bossKillStage = 2;
                this.shake.shake(15, 0.3);
                this.particles.createColorExplosion(bx + Utils.random(-30, 30), by + Utils.random(-30, 30),
                    ['#ff3366', '#ff6600', '#ffffff'], 30, 350, 0.8, 6);
                this.audio.playExplosion();
            }
            // Stage 2: ring explosion (0.7s)
            if (this._bossKillStage === 2 && elapsed > 0.7) {
                this._bossKillStage = 3;
                this.shake.shake(12, 0.3);
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    const rx = bx + Math.cos(angle) * 50;
                    const ry = by + Math.sin(angle) * 50;
                    this.particles.createColorExplosion(rx, ry,
                        ['#cc0000', '#ff4400', '#ffaa00'], 15, 250, 0.6, 4);
                }
                this.audio.playExplosion();
            }
            // Stage 3: final flash (1.2s)
            if (this._bossKillStage === 3 && elapsed > 1.2) {
                this._bossKillStage = 4;
                this.shake.shake(25, 0.4);
                this.particles.createColorExplosion(bx, by,
                    ['#ffffff', '#ffffff', '#ffddaa'], 60, 500, 1.2, 8);
                this.audio.playExplosion();
            }
            // Open shop after cinematic ends
            if (this._bossKillTimer <= 0) {
                this._bossKillStage = 0;
                this.state = STATE.SHOP;
                this.shop.selectedIndex = 0;
            }
        }

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
        this.solarFlare.update(dt);
        this.blackHole.update(dt);
        this.asteroidBelt.update(dt, this.canvas.width);

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

        // Projectiles
        this.projectiles.update(dt, this.canvas.width, this.canvas.height);

        // Particles
        this.particles.update(dt);

        // Power-ups
        this.powerupTimer -= dt;
        if (this.powerupTimer <= 0) {
            this.spawnPowerUp();
            this.powerupTimer = Utils.random(8, 15);
        }
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            this.powerups[i].update(dt, this.canvas.width);
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
        this._quoteWordPositions = null;
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
                    bullet.active = false;
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

                        // Boss kill — trigger cinematic
                        if (e.type === 'boss') {
                            this._bossKillTimer = 2.0;
                            this._bossKillX = e.x;
                            this._bossKillY = e.y;
                            this._bossKillStage = 0;
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
        const dead = this.player.hit();
        if (dead) {
            this.particles.createColorExplosion(this.player.x, this.player.y,
                ['#00ffff', '#ffffff', '#0088ff', '#ff3366'], 50, 300, 0.8, 5);
            this.shake.shake(12, 0.4);
            this.gameOver();
        } else {
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
        if (this.state === STATE.PLAYING || this.state === STATE.GAME_OVER) {
            ctx.translate(this.shake.offsetX, this.shake.offsetY);
        }

        // Background
        this.background.draw(ctx);

        if (this.state === STATE.PLAYING || this.state === STATE.PAUSED) {
            // Environmental hazards (behind gameplay)
            this.asteroidBelt.draw(ctx);
            this.blackHole.draw(ctx);
            // Power-ups
            for (const pu of this.powerups) pu.draw(ctx);
            // Enemies
            this.spawner.draw(ctx);
            // Player
            this.player.draw(ctx);
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

        ctx.restore();

        // HUD and overlays (not affected by shake)
        if (this.state === STATE.PLAYING || this.state === STATE.PAUSED) {
            this.drawHUD(ctx);
        }

        if (this.state === STATE.MENU)      this.drawMenu(ctx);
        if (this.state === STATE.PAUSED)     this.drawPause(ctx);
        if (this.state === STATE.SHOP)       this.shop.draw(ctx, this.canvas, this.player);
        if (this.state === STATE.GAME_OVER)  this.drawGameOver(ctx);
    }

    // ----- HUD ----- (NIN industrial palette)
    drawHUD(ctx) {
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.save();
        // Score — top left
        ctx.font = 'bold 22px Courier New';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#cc0000';
        ctx.shadowColor = '#cc0000';
        ctx.shadowBlur = 6;
        ctx.fillText(`SCORE: ${this.score}`, 16, 34);
        ctx.font = '14px Courier New';
        ctx.fillStyle = '#555';
        ctx.shadowBlur = 0;
        ctx.fillText(`HI: ${this.highScore}`, 16, 54);

        // Scrap counter with pulse on gain
        if (this.scrapPulse > 0) this.scrapPulse -= 0.02;
        const scrapGlow = Math.max(0, this.scrapPulse);
        ctx.fillStyle = scrapGlow > 0 ? `rgb(${153 + Math.floor(102 * scrapGlow)}, ${51 + Math.floor(153 * scrapGlow)}, 0)` : '#993300';
        if (scrapGlow > 0) { ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 8 * scrapGlow; }
        ctx.fillText(`SCRAP: ${this.player.scrap}`, 16, 70);
        ctx.shadowBlur = 0;

        // Combo display
        if (this.player.combo >= 3) {
            const mult = this.player.getComboMultiplier();
            const comboPulse = 0.7 + 0.3 * Math.sin(this.time * 8);
            ctx.font = `bold ${16 + mult * 2}px Courier New`;
            ctx.fillStyle = mult >= 4 ? '#ff2200' : mult >= 3 ? '#cc0000' : '#993300';
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 8 * comboPulse;
            ctx.fillText(`COMBO x${mult} (${this.player.combo})`, 16, 88);
            ctx.shadowBlur = 0;
        }

        // Lives — top right (ship icons)
        for (let i = 0; i < this.player.lives; i++) {
            const lx = w - 30 - i * 30;
            const ly = 28;
            ctx.fillStyle = '#cc0000';
            ctx.shadowColor = '#cc0000';
            ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.moveTo(lx + 10, ly);
            ctx.lineTo(lx - 5, ly - 7);
            ctx.lineTo(lx - 2, ly);
            ctx.lineTo(lx - 5, ly + 7);
            ctx.closePath();
            ctx.fill();
        }

        // Active power-up indicators
        let puY = 70;
        ctx.font = '12px Courier New';
        ctx.textAlign = 'left';
        ctx.shadowBlur = 0;

        if (this.player.rapidFire) {
            ctx.fillStyle = '#cc0000';
            ctx.fillText(`RAPID FIRE ${Math.ceil(this.player.rapidFireTimer)}s`, 16, puY);
            puY += 18;
        }
        if (this.player.tripleShot) {
            ctx.fillStyle = '#993300';
            ctx.fillText(`TRIPLE SHOT ${Math.ceil(this.player.tripleShotTimer)}s`, 16, puY);
            puY += 18;
        }
        if (this.player.shield) {
            ctx.fillStyle = '#888';
            ctx.fillText(`SHIELD ${Math.ceil(this.player.shieldTimer)}s`, 16, puY);
            puY += 18;
        }
        if (this.player.activeShield) {
            ctx.fillStyle = '#aaa';
            ctx.fillText(`SHIELD ACTIVE ${Math.ceil(this.player.activeShieldTimer)}s`, 16, puY);
            puY += 18;
        }
        if (this.player.ricochet) {
            ctx.fillStyle = '#ff8800';
            ctx.fillText(`RICOCHET ${Math.ceil(this.player.ricochetTimer)}s`, 16, puY);
            puY += 18;
        }
        if (this.player.wingman) {
            ctx.fillStyle = '#4488ff';
            ctx.fillText(`WINGMAN ${Math.ceil(this.player.wingmanTimer)}s`, 16, puY);
            puY += 18;
        }
        // Power combo indicator
        const puCount = this.player.getActivePowerUpCount();
        if (puCount >= 2) {
            const comboMul = this.player.getPowerComboMultiplier();
            const comboPulse = 0.7 + 0.3 * Math.sin(this.time * 6);
            ctx.font = `bold ${14 + puCount * 2}px Courier New`;
            ctx.fillStyle = puCount >= 3 ? '#ff2200' : '#ff8800';
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 10 * comboPulse;
            ctx.fillText(`POWER COMBO x${comboMul}`, 16, puY);
            ctx.shadowBlur = 0;
            puY += 18;
        }

        // Phase announcement — center screen, fading
        if (this.phaseAnnounceTimer > 0) {
            const fadeAlpha = Math.min(1, this.phaseAnnounceTimer / 0.5);
            ctx.save();
            ctx.globalAlpha = fadeAlpha;
            ctx.textAlign = 'center';
            ctx.font = `bold ${Math.min(w * 0.035, 28)}px Courier New`;
            ctx.fillStyle = '#cc0000';
            ctx.shadowColor = '#cc0000';
            ctx.shadowBlur = 12;
            ctx.fillText(`— ${this.phaseAnnounceName} —`, w / 2, h * 0.15);
            ctx.font = '13px Courier New';
            ctx.fillStyle = '#666';
            ctx.shadowBlur = 0;
            ctx.fillText(`PHASE ${this.lastPhase + 1}`, w / 2, h * 0.15 + 25);
            ctx.restore();
        }

        // Current phase indicator + speed run timer — top center
        if (this.lastPhase >= 0 && this.phaseAnnounceTimer <= 0) {
            ctx.font = 'bold 13px Courier New';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#888';
            ctx.shadowColor = '#cc0000';
            ctx.shadowBlur = 3;
            const phaseTime = Math.floor(this.time - this.phaseStartTime);
            const mins = Math.floor(phaseTime / 60);
            const secs = phaseTime % 60;
            const timeStr = mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
            ctx.fillText(`PHASE ${this.lastPhase + 1}: ${PHASES[this.lastPhase].name}  [${timeStr}]`, w / 2, 20);
            ctx.shadowBlur = 0;
        }

        // NIN quote — words flash one at a time at random positions
        if (this.quoteTimer > 0 && this.phaseAnnounceTimer <= 0 && !this.bossActive && h > 350) {
            const elapsed = this.quoteDuration - this.quoteTimer;
            const words = this.quoteText.split(' ');
            // Scale word timing so long quotes still fit within ~8 seconds
            const wordDuration = Math.min(0.9, 7.0 / Math.max(words.length, 1));
            const totalDuration = words.length * wordDuration + 1.0;

            // Only render during the word sequence
            if (elapsed < totalDuration) {
                // Position words near center with slight scatter + cycling color
                const wordColors = ['#ffdd00', '#ff2200', '#00ff44', '#ff8800', '#00ddff', '#ff00ff', '#ff4488', '#88ff00'];
                if (!this._quoteWordPositions) {
                    const centerX = w / 2;
                    const centerY = h * 0.45;
                    // Shuffle colors so each word gets a unique one
                    const shuffled = [...wordColors].sort(() => Math.random() - 0.5);
                    this._quoteWordPositions = words.map((_, i) => ({
                        x: centerX + (Math.random() - 0.5) * w * 0.15,
                        y: centerY + (Math.random() - 0.5) * h * 0.08,
                        color: shuffled[i % shuffled.length]
                    }));
                }

                ctx.save();
                const fontSize = Math.min(w * 0.06, 48);
                ctx.textAlign = 'center';

                for (let i = 0; i < words.length; i++) {
                    const wordStart = i * wordDuration;
                    const wordTime = elapsed - wordStart;
                    if (wordTime < 0) continue;

                    // Pop in (0.1s with scale), hold (0.4s), slow fade (2.5s)
                    const fadeDuration = 2.5;
                    let alpha;
                    if (wordTime < 0.1) {
                        alpha = wordTime / 0.1;
                    } else if (wordTime < 0.5) {
                        alpha = 1.0;
                    } else if (wordTime < 0.5 + fadeDuration) {
                        alpha = 1.0 - (wordTime - 0.5) / fadeDuration;
                    } else {
                        alpha = 0;
                    }

                    if (alpha <= 0.01) continue;

                    const pos = this._quoteWordPositions[i];

                    // Scale pop on appear + random tilt
                    const scale = wordTime < 0.15 ? 1.3 - (wordTime / 0.15) * 0.3 : 1.0;
                    // Stable rotation per word (seeded from index)
                    const rotation = ((i * 7 + 3) % 11 - 5) * 0.06;

                    ctx.globalAlpha = alpha;

                    ctx.save();
                    ctx.translate(pos.x, pos.y);
                    ctx.scale(scale, scale);
                    ctx.rotate(rotation);

                    // Black outline for comic pop
                    ctx.font = `bold ${fontSize}px Impact, Arial Black, sans-serif`;
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 6;
                    ctx.lineJoin = 'round';
                    ctx.strokeText(words[i], 0, 0);

                    // Colored fill per word
                    ctx.fillStyle = pos.color;
                    ctx.shadowColor = pos.color;
                    ctx.shadowBlur = wordTime < 0.2 ? 20 : 6;
                    ctx.fillText(words[i], 0, 0);

                    ctx.restore();
                }

                ctx.restore();
            }
        }

        // Shield charges — bottom left
        ctx.font = '13px Courier New';
        ctx.textAlign = 'left';
        const chargeY = h - 20;
        if (this.player.shieldRecharging) {
            const frac = 1 - this.player.shieldRechargeTimer / this.player.shieldRechargeDuration;
            ctx.fillStyle = '#444';
            ctx.fillText('SHIELD', 16, chargeY);
            const barW = 60;
            ctx.fillStyle = '#222';
            ctx.fillRect(75, chargeY - 9, barW, 8);
            ctx.fillStyle = '#888';
            ctx.shadowColor = '#888';
            ctx.shadowBlur = 3;
            ctx.fillRect(75, chargeY - 9, barW * frac, 8);
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = this.player.shieldCharges > 0 ? '#999' : '#444';
            const chargeText = 'E: SHIELD ' + '●'.repeat(this.player.shieldCharges) +
                               '○'.repeat(this.player.maxShieldCharges - this.player.shieldCharges);
            ctx.fillText(chargeText, 16, chargeY);
        }

        // Bomb charges
        ctx.fillStyle = this.player.bombs > 0 ? '#cc0000' : '#444';
        const bombText = 'Q: BOMB ' + '●'.repeat(this.player.bombs) +
                         '○'.repeat(Math.max(0, this.player.maxBombs - this.player.bombs));
        ctx.fillText(bombText, 16, chargeY - 18);

        // Trail color name — bottom right
        ctx.textAlign = 'right';
        ctx.fillStyle = this.player.trailColor || '#cc0000';
        ctx.fillText(`T: TRAIL [${this.player.trailColorNames[this.player.trailIndex]}]`, w - 16, h - 20);

        ctx.restore();
    }

    // ----- Menu ----- (NIN industrial)
    drawMenu(ctx) {
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.save();

        // Background image or dark overlay
        if (this.assets.splashBg) {
            Utils.drawCover(ctx, this.assets.splashBg, w, h);
            ctx.fillStyle = 'rgba(10, 10, 10, 0.6)';
            ctx.fillRect(0, 0, w, h);
        } else {
            ctx.fillStyle = 'rgba(10, 10, 10, 0.75)';
            ctx.fillRect(0, 0, w, h);
        }

        // Scan lines (pre-rendered)
        ctx.drawImage(this._getScanLines(w, h), 0, 0);

        // Title — NIN DEFENDER in harsh red
        ctx.textAlign = 'center';
        ctx.fillStyle = '#cc0000';
        ctx.shadowColor = '#cc0000';
        ctx.shadowBlur = 25;
        ctx.font = `bold ${Math.min(w * 0.08, 64)}px Courier New`;
        ctx.fillText('NIN DEFENDER', w / 2, h * 0.3);
        // Double-strike for glow intensity
        ctx.shadowBlur = 40;
        ctx.globalAlpha = 0.3;
        ctx.fillText('NIN DEFENDER', w / 2, h * 0.3);
        ctx.globalAlpha = 1;

        // Subtitle
        ctx.shadowBlur = 0;
        ctx.font = `${Math.min(w * 0.025, 16)}px Courier New`;
        ctx.fillStyle = '#999';
        ctx.fillText('NOTHING CAN STOP ME NOW', w / 2, h * 0.3 + 35);

        // Pulsing start prompt
        const pulse = 0.4 + 0.6 * Math.sin(this.menuTime * 2.5);
        ctx.globalAlpha = pulse;
        ctx.font = `bold ${Math.min(w * 0.025, 18)}px Courier New`;
        ctx.fillStyle = '#cc0000';
        ctx.fillText('[ PRESS SPACE ]', w / 2, h * 0.5);
        ctx.globalAlpha = 1;

        // Mobile hint
        if ('ontouchstart' in window) {
            ctx.font = `${Math.min(w * 0.02, 13)}px Courier New`;
            ctx.fillStyle = '#444';
            ctx.fillText('TAP ANYWHERE TO START', w / 2, h * 0.57);
        }

        // Controls
        ctx.font = 'bold 13px Courier New';
        ctx.fillStyle = '#777';
        const cy = h * 0.62;
        ctx.fillText('— CONTROLS —', w / 2, cy);
        ctx.font = '12px Courier New';
        const controls = [
            ['WASD / ARROWS', 'Move ship'],
            ['SPACE (hold)',  'Fire weapons'],
            ['E',             'Shield (3 charges)'],
            ['Q',             'Screen bomb'],
            ['T',             'Cycle trail'],
            ['P / ESC',       'Pause']
        ];
        controls.forEach(([key, desc], i) => {
            const y = cy + 20 + i * 18;
            ctx.textAlign = 'right';
            ctx.fillStyle = '#cc0000';
            ctx.fillText(key, w / 2 - 10, y);
            ctx.textAlign = 'left';
            ctx.fillStyle = '#888';
            ctx.fillText(desc, w / 2 + 10, y);
        });
        ctx.textAlign = 'center';

        // High score
        if (this.highScore > 0) {
            ctx.font = 'bold 14px Courier New';
            ctx.fillStyle = '#666';
            ctx.shadowBlur = 0;
            ctx.fillText(`HIGH SCORE: ${this.highScore}`, w / 2, h * 0.92);
        }

        ctx.restore();
    }

    // ----- Pause overlay ----- (NIN industrial)
    drawPause(ctx) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.save();
        ctx.fillStyle = 'rgba(5, 5, 5, 0.8)';
        ctx.fillRect(0, 0, w, h);
        // Scan lines
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2);

        ctx.textAlign = 'center';
        ctx.font = 'bold 48px Courier New';
        ctx.fillStyle = '#cc0000';
        ctx.shadowColor = '#cc0000';
        ctx.shadowBlur = 20;
        ctx.fillText('PAUSED', w / 2, h / 2 - 10);
        ctx.shadowBlur = 0;
        ctx.font = '16px Courier New';
        ctx.fillStyle = '#555';
        ctx.fillText('Press P or ESC to resume', w / 2, h / 2 + 30);
        ctx.restore();
    }

    // ----- Game Over ----- (NIN industrial)
    drawGameOver(ctx) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.save();

        if (this.assets.gameoverBg) {
            Utils.drawCover(ctx, this.assets.gameoverBg, w, h);
            ctx.fillStyle = 'rgba(5, 5, 5, 0.65)';
            ctx.fillRect(0, 0, w, h);
        } else {
            ctx.fillStyle = 'rgba(5, 5, 5, 0.85)';
            ctx.fillRect(0, 0, w, h);
        }
        // Scan lines (pre-rendered)
        ctx.drawImage(this._getScanLines(w, h), 0, 0);

        ctx.textAlign = 'center';

        // Glitchy GAME OVER — double render with offset for distortion
        ctx.font = `bold ${Math.min(w * 0.06, 48)}px Courier New`;
        const glitch = Math.sin(this.menuTime * 7) * 2;
        ctx.fillStyle = 'rgba(204, 0, 0, 0.3)';
        ctx.fillText('GAME OVER', w / 2 + glitch, h * 0.35 - 1);
        ctx.fillStyle = '#cc0000';
        ctx.shadowColor = '#cc0000';
        ctx.shadowBlur = 20;
        ctx.fillText('GAME OVER', w / 2, h * 0.35);

        ctx.shadowBlur = 0;
        ctx.font = 'bold 26px Courier New';
        ctx.fillStyle = '#d4d4d4';
        ctx.fillText(`SCORE: ${this.score}`, w / 2, h * 0.48);

        ctx.font = '16px Courier New';
        ctx.fillStyle = '#666';
        ctx.fillText(`HIGH SCORE: ${this.highScore}`, w / 2, h * 0.56);

        // Stats
        ctx.font = '14px Courier New';
        ctx.fillStyle = '#555';
        ctx.fillText(`SCRAP EARNED: ${this.player.scrap}`, w / 2, h * 0.62);
        if (this.player.maxCombo >= 3) {
            ctx.fillStyle = '#993300';
            ctx.fillText(`MAX COMBO: x${this.player.maxCombo}`, w / 2, h * 0.66);
        }

        // Leaderboard
        if (this.leaderboard.length > 0) {
            ctx.font = 'bold 12px Courier New';
            ctx.fillStyle = '#444';
            ctx.fillText('— TOP SCORES —', w / 2, h * 0.73);
            ctx.font = '11px Courier New';
            const maxShow = Math.min(5, this.leaderboard.length);
            for (let i = 0; i < maxShow; i++) {
                const entry = this.leaderboard[i];
                ctx.fillStyle = i === 0 ? '#cc0000' : '#444';
                const phase = entry.phase ? `P${entry.phase}` : '';
                const combo = entry.maxCombo ? `x${entry.maxCombo}` : '';
                const time = entry.time ? `${Math.floor(entry.time / 60)}:${(entry.time % 60).toString().padStart(2, '0')}` : '';
                ctx.fillText(`${i + 1}. ${entry.score}  ${phase}  ${time}  ${combo}`, w / 2, h * 0.73 + 16 + i * 14);
            }
        }

        // Scrap available hint
        if (this.player.scrap > 0) {
            ctx.font = '12px Courier New';
            ctx.fillStyle = '#993300';
            ctx.fillText(`SCRAP AVAILABLE: ${this.player.scrap} — spend it next run`, w / 2, h * 0.88);
        }

        const pulse = 0.4 + 0.6 * Math.sin(this.menuTime * 2.5);
        ctx.globalAlpha = pulse;
        ctx.font = 'bold 16px Courier New';
        ctx.fillStyle = '#cc0000';
        ctx.fillText('[ PRESS SPACE ]', w / 2, h * 0.93);
        ctx.globalAlpha = 1;

        ctx.restore();
    }
}
