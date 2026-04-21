// ============================================================
// game.js — Game state machine, update loop, collision, HUD
// ============================================================

const STATE = {
    MENU:      'MENU',
    PLAYING:   'PLAYING',
    PAUSED:    'PAUSED',
    GAME_OVER: 'GAME_OVER'
};

class Game {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;

        // Sub-systems
        this.audio = new AudioManager();
        this.shake = new ScreenShake();
        this.background = new Background(canvas);
        this.particles = new ParticlePool(600);
        this.projectiles = new ProjectilePool(200);
        this.spawner = new EnemySpawner();
        this.player = new Player(canvas);
        this.powerups = [];

        // State
        this.state = STATE.MENU;
        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('galacticDefenderHigh') || '0', 10);
        this.time = 0;
        this.powerupTimer = 0;

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
            localStorage.setItem('galacticDefenderHigh', this.highScore.toString());
        }
        this.audio.playGameOver();
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

        // Enemies
        this.spawner.update(dt, this.score, this.canvas.width, this.canvas.height,
            this.projectiles, this.player.y, this.audio);

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

        // Collisions
        this.checkCollisions();
    }

    spawnPowerUp() {
        const pu = new PowerUp();
        const type = POWERUP_KEYS[Utils.randomInt(0, POWERUP_KEYS.length - 1)];
        pu.init(
            this.canvas.width + 20,
            Utils.random(40, this.canvas.height - 40),
            type
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
                        this.score += e.points;
                        // Big explosion
                        const colors = ['#ff3366', '#ff9900', '#ffdd00', '#ffffff'];
                        this.particles.createColorExplosion(e.x, e.y, colors,
                            e.type === 'ship' ? 30 : 18, 250, 0.6, 4);
                        this.shake.shake(e.type === 'ship' ? 6 : 3, 0.15);
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
            // Power-ups
            for (const pu of this.powerups) pu.draw(ctx);
            // Enemies
            this.spawner.draw(ctx);
            // Player
            this.player.draw(ctx);
            // Projectiles
            this.projectiles.draw(ctx);
            // Particles on top
            this.particles.draw(ctx);
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

    // ----- HUD -----
    drawHUD(ctx) {
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.save();
        // Score — top left
        ctx.font = 'bold 22px Courier New';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 8;
        ctx.fillText(`SCORE: ${this.score}`, 16, 34);
        ctx.font = '14px Courier New';
        ctx.fillStyle = '#888';
        ctx.shadowBlur = 0;
        ctx.fillText(`HI: ${this.highScore}`, 16, 54);

        // Lives — top right (ship icons)
        for (let i = 0; i < this.player.lives; i++) {
            const lx = w - 30 - i * 30;
            const ly = 28;
            ctx.fillStyle = '#00ffff';
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 5;
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
            ctx.fillStyle = POWERUP_TYPES.RAPID_FIRE.color;
            ctx.fillText(`RAPID FIRE ${Math.ceil(this.player.rapidFireTimer)}s`, 16, puY);
            puY += 18;
        }
        if (this.player.tripleShot) {
            ctx.fillStyle = POWERUP_TYPES.TRIPLE_SHOT.color;
            ctx.fillText(`TRIPLE SHOT ${Math.ceil(this.player.tripleShotTimer)}s`, 16, puY);
            puY += 18;
        }
        if (this.player.shield) {
            ctx.fillStyle = POWERUP_TYPES.SHIELD.color;
            ctx.fillText(`SHIELD ${Math.ceil(this.player.shieldTimer)}s`, 16, puY);
        }

        ctx.restore();
    }

    // ----- Menu -----
    drawMenu(ctx) {
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.save();
        // Darken
        ctx.fillStyle = 'rgba(10, 10, 31, 0.6)';
        ctx.fillRect(0, 0, w, h);

        // Title
        ctx.textAlign = 'center';
        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 20;
        ctx.font = `bold ${Math.min(w * 0.07, 56)}px Courier New`;
        ctx.fillText('GALACTIC DEFENDER', w / 2, h * 0.3);

        // Subtitle line
        ctx.shadowBlur = 0;
        ctx.font = `${Math.min(w * 0.025, 16)}px Courier New`;
        ctx.fillStyle = '#ff00ff';
        ctx.fillText('A SPACE SHOOTER ADVENTURE', w / 2, h * 0.3 + 35);

        // Pulsing start prompt
        const pulse = 0.5 + 0.5 * Math.sin(this.menuTime * 3);
        ctx.globalAlpha = pulse;
        ctx.font = `bold ${Math.min(w * 0.03, 20)}px Courier New`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText('PRESS SPACE TO START', w / 2, h * 0.55);
        ctx.globalAlpha = 1;

        // Mobile hint
        if ('ontouchstart' in window) {
            ctx.font = `${Math.min(w * 0.025, 14)}px Courier New`;
            ctx.fillStyle = '#888';
            ctx.fillText('TAP ANYWHERE TO START', w / 2, h * 0.62);
        }

        // Controls
        ctx.font = '13px Courier New';
        ctx.fillStyle = '#666';
        const cy = h * 0.75;
        ctx.fillText('WASD / ARROWS — Move', w / 2, cy);
        ctx.fillText('SPACE — Shoot', w / 2, cy + 20);
        ctx.fillText('P / ESC — Pause', w / 2, cy + 40);

        // High score
        if (this.highScore > 0) {
            ctx.font = 'bold 16px Courier New';
            ctx.fillStyle = '#ffdd00';
            ctx.shadowColor = '#ffdd00';
            ctx.shadowBlur = 6;
            ctx.fillText(`HIGH SCORE: ${this.highScore}`, w / 2, h * 0.9);
        }

        ctx.restore();
    }

    // ----- Pause overlay -----
    drawPause(ctx) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.save();
        ctx.fillStyle = 'rgba(10, 10, 31, 0.7)';
        ctx.fillRect(0, 0, w, h);
        ctx.textAlign = 'center';
        ctx.font = 'bold 48px Courier New';
        ctx.fillStyle = '#ff00ff';
        ctx.shadowColor = '#ff00ff';
        ctx.shadowBlur = 15;
        ctx.fillText('PAUSED', w / 2, h / 2 - 10);
        ctx.shadowBlur = 0;
        ctx.font = '18px Courier New';
        ctx.fillStyle = '#aaa';
        ctx.fillText('Press P or ESC to resume', w / 2, h / 2 + 30);
        ctx.restore();
    }

    // ----- Game Over -----
    drawGameOver(ctx) {
        const w = this.canvas.width;
        const h = this.canvas.height;
        ctx.save();
        ctx.fillStyle = 'rgba(10, 10, 31, 0.75)';
        ctx.fillRect(0, 0, w, h);
        ctx.textAlign = 'center';

        ctx.font = `bold ${Math.min(w * 0.06, 48)}px Courier New`;
        ctx.fillStyle = '#ff3366';
        ctx.shadowColor = '#ff3366';
        ctx.shadowBlur = 15;
        ctx.fillText('GAME OVER', w / 2, h * 0.35);

        ctx.shadowBlur = 0;
        ctx.font = 'bold 26px Courier New';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`SCORE: ${this.score}`, w / 2, h * 0.48);

        ctx.font = '18px Courier New';
        ctx.fillStyle = '#ffdd00';
        ctx.shadowColor = '#ffdd00';
        ctx.shadowBlur = 6;
        ctx.fillText(`HIGH SCORE: ${this.highScore}`, w / 2, h * 0.56);

        const pulse = 0.5 + 0.5 * Math.sin(this.menuTime * 3);
        ctx.globalAlpha = pulse;
        ctx.shadowBlur = 0;
        ctx.font = 'bold 18px Courier New';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('PRESS SPACE TO RESTART', w / 2, h * 0.7);
        ctx.globalAlpha = 1;

        ctx.restore();
    }
}
