// ============================================================
// game.js — Game state machine, update loop, collision, HUD
// ============================================================

const STATE = {
    MENU:      'MENU',
    PLAYING:   'PLAYING',
    PAUSED:    'PAUSED',
    GAME_OVER: 'GAME_OVER'
};

const NIN_QUOTES = [
    // Head Like a Hole
    'HEAD LIKE A HOLE, BLACK AS YOUR SOUL',
    'BOW DOWN BEFORE THE ONE YOU SERVE',
    'YOU\'RE GOING TO GET WHAT YOU DESERVE',
    'GOD MONEY, I\'LL DO ANYTHING FOR YOU',
    'NO YOU CAN\'T TAKE IT, NO YOU CAN\'T TAKE THAT AWAY FROM ME',
    // Starfuckers Inc.
    'NOW I BELONG, I\'M ONE OF THE CHOSEN ONES',
    'MY MORAL STANDING IS LYING DOWN',
    'AND WHEN I SUCK YOU UP, NOT A DROP WILL GO TO WASTE.',
    'DOESN\'T IT MAKE YOU FEEL BETTER?',
    'ALL OUR PAIN, HOW DID WE EVER GET BY WITHOUT YOU?',
    // The Big Come Down
    'THERE IS NO PLACE I CAN GO, THERE IS NO PLACE I CAN HIDE',
    'THE BIG COME DOWN, ISN\'T THAT WHAT YOU WANTED?',
    'EVERYTHING IS FALLING APART',
    // Please
    'DON\'T YOU TELL ME HOW I FEEL',
    'YOU DON\'T KNOW JUST HOW FAR THAT I WOULD GO',
    'PLEASE',
    // The Collector
    'I AM THE COLLECTOR',
    'TRY FITTING IT ALL INSIDE',
    // Every Day Is Exactly The Same
    'I BELIEVE I CAN SEE THE FUTURE, CAUSE I REPEAT THE SAME ROUTINE',
    'EVERY DAY IS EXACTLY THE SAME',
    'I CAN FEEL THEIR EYES ARE WATCHING',
    'I THINK I USED TO HAVE A PURPOSE, THEN AGAIN THAT MIGHT HAVE BEEN A DREAM',
    'IS THERE SOMETHING I HAVE MISSED?',
    // Hurt
    'I HURT MYSELF TODAY, TO SEE IF I STILL FEEL',
    'WHAT HAVE I BECOME, MY SWEETEST FRIEND',
    'EVERYONE I KNOW GOES AWAY IN THE END',
    'I WILL LET YOU DOWN, I WILL MAKE YOU HURT',
    'YOU COULD HAVE IT ALL, MY EMPIRE OF DIRT',
    'THE NEEDLE TEARS A HOLE, THE OLD FAMILIAR STING',
    'I WEAR THIS CROWN OF THORNS UPON MY LIAR\'S CHAIR',
];

class Game {
    constructor(canvas, ctx, assets) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.assets = assets || {};

        // Sub-systems
        this.audio = new AudioManager();
        this.music = null; // created on first play

        // Menu music — plays on title/game-over screens
        this.menuMusic = new Audio('assets/not.mp3');
        this.menuMusic.loop = true;
        this.menuMusic.volume = 0.4;
        this.menuMusicStarted = false;
        this.shake = new ScreenShake();
        this.background = new Background(canvas, this.assets);
        this.particles = new ParticlePool(600);
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
        this.particles = new ParticlePool(600);
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
        this.leaderboard.push({ score, date: new Date().toLocaleDateString() });
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

    // ----- Main update -----
    update(dt) {
        this.menuTime += dt;

        if (this.state === STATE.MENU) {
            this.background.update(dt);
            return;
        }

        if (this.state === STATE.PAUSED) return;

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
            this.phaseAnnounceTimer = 3.0;

            // Spawn boss at each phase transition (except phase 0)
            if (currentPhase > 0 && this.bossSpawnedForPhase < currentPhase) {
                this.bossSpawnedForPhase = currentPhase;
                const boss = new Boss(this.canvas.width, this.canvas.height, currentPhase - 1);
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
        }

        // Solar flare collision with player
        if (this.solarFlare.active && !this.solarFlare.warning) {
            const hitbox = this.solarFlare.getHitbox();
            if (hitbox && Math.abs(this.player.x - hitbox.x) < hitbox.width / 2 + this.player.radius) {
                this.handlePlayerHit();
            }
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
            this.powerupTimer = Utils.random(10, 20);
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
            this.quoteInterval = Utils.random(8, 16);
            this.showRandomQuote();
        }

        // Collisions
        this.checkCollisions();
    }

    showRandomQuote() {
        if (this.usedQuotes.length >= NIN_QUOTES.length) {
            this.usedQuotes = [];
        }
        const available = NIN_QUOTES.filter((_, i) => !this.usedQuotes.includes(i));
        const idx = NIN_QUOTES.indexOf(available[Utils.randomInt(0, available.length - 1)]);
        this.usedQuotes.push(idx);
        this.quoteText = NIN_QUOTES[idx];
        this.quoteTimer = this.quoteDuration;
    }

    spawnPowerUp() {
        const pu = new PowerUp();
        const type = POWERUP_KEYS[Utils.randomInt(0, POWERUP_KEYS.length - 1)];
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
                        const multiplier = this.player.getComboMultiplier();
                        this.score += e.points * multiplier;
                        // Scrap drops (1-3 per kill)
                        this.player.addScrap(Utils.randomInt(1, e.type === 'boss' ? 30 : 3));

                        // Asteroid spider burst — only after phase 4, 15% chance
                        if (e.type === 'asteroid' && currentPhase >= 4 && Math.random() < 0.15) {
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

                        // Asteroid splitting — big asteroids spawn 2-3 small fragments
                        if (e.type === 'asteroid' && e.sizeMultiplier >= 1.4) {
                            const fragCount = Utils.randomInt(2, 3);
                            for (let f = 0; f < fragCount; f++) {
                                const frag = new Asteroid(
                                    this.canvas.width, this.canvas.height,
                                    Utils.random(0.5, 0.7), // small fragment
                                    e.x, e.y
                                );
                                // Scatter in different directions
                                const spreadAngle = (f / fragCount) * Math.PI * 2 + Utils.random(-0.3, 0.3);
                                frag.vx = Utils.random(-150, -50) + Math.cos(spreadAngle) * 60;
                                frag.vy = Math.sin(spreadAngle) * Utils.random(40, 100);
                                frag.baseY = frag.y;
                                this.spawner.enemies.push(frag);
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

        // Scrap counter
        ctx.fillStyle = '#993300';
        ctx.fillText(`SCRAP: ${this.player.scrap}`, 16, 70);

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

        // Current phase indicator — top center
        if (this.lastPhase >= 0 && this.phaseAnnounceTimer <= 0) {
            ctx.font = '11px Courier New';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#3a3a3a';
            ctx.shadowBlur = 0;
            ctx.fillText(`PHASE ${this.lastPhase + 1}: ${PHASES[this.lastPhase].name}`, w / 2, 18);
        }

        // NIN quote — bottom center, fading
        if (this.quoteTimer > 0 && this.phaseAnnounceTimer <= 0 && !this.bossActive && h > 350) {
            const fadeIn = Math.min(1, (this.quoteDuration - this.quoteTimer) / 2.0);
            const fadeOut = Math.min(1, this.quoteTimer / 3.0);
            const alpha = Math.min(fadeIn, fadeOut) * 0.7;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.textAlign = 'center';
            ctx.font = `italic ${Math.min(w * 0.025, 18)}px Courier New`;
            ctx.fillStyle = '#d4d4d4';
            ctx.fillText(`"${this.quoteText}"`, w / 2, h * 0.55);
            ctx.restore();
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

        // Subtle scan lines effect
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        for (let y = 0; y < h; y += 4) {
            ctx.fillRect(0, y, w, 2);
        }

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
        ctx.font = `${Math.min(w * 0.02, 13)}px Courier New`;
        ctx.fillStyle = '#555';
        ctx.letterSpacing = '4px';
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
        // Scan lines
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2);

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
                ctx.fillText(`${i + 1}. ${entry.score}`, w / 2, h * 0.73 + 16 + i * 14);
            }
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
