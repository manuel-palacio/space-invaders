// ============================================================
// player.js — Player ship with movement, shooting, power-ups
// ============================================================

class Player {
    constructor(canvas) {
        this.canvas = canvas;
        this.x = 80;
        this.y = canvas.height / 2;
        this.width = 40;
        this.height = 30;
        this.radius = 18;       // collision radius
        this.speed = 320;
        this.vx = 0;
        this.vy = 0;
        this.accel = 1200;
        this.friction = 0.88;

        // Combat
        this.lives = 3;
        this.maxLives = 5;
        this.shootCooldown = 0;
        this.baseFireRate = 0.18; // seconds between shots
        this.fireRate = this.baseFireRate;

        // State
        this.invincible = false;
        this.invincibleTimer = 0;
        this.invincibleDuration = 2.0;
        this.flickerTimer = 0;
        this.visible = true;
        this.alive = true;
        this.engineTime = 0;

        // Power-ups
        this.tripleShot = false;
        this.tripleShotTimer = 0;
        this.rapidFire = false;
        this.rapidFireTimer = 0;
        this.shield = false;
        this.shieldTimer = 0;
    }

    reset(canvas) {
        this.canvas = canvas;
        this.x = 80;
        this.y = canvas.height / 2;
        this.vx = 0;
        this.vy = 0;
        this.lives = 3;
        this.invincible = false;
        this.invincibleTimer = 0;
        this.alive = true;
        this.shootCooldown = 0;
        this.tripleShot = false;
        this.tripleShotTimer = 0;
        this.rapidFire = false;
        this.rapidFireTimer = 0;
        this.shield = false;
        this.shieldTimer = 0;
        this.fireRate = this.baseFireRate;
    }

    applyPowerUp(type) {
        switch (type) {
            case 'RAPID_FIRE':
                this.rapidFire = true;
                this.rapidFireTimer = POWERUP_TYPES.RAPID_FIRE.duration;
                this.fireRate = this.baseFireRate * 0.4;
                break;
            case 'TRIPLE_SHOT':
                this.tripleShot = true;
                this.tripleShotTimer = POWERUP_TYPES.TRIPLE_SHOT.duration;
                break;
            case 'SHIELD':
                this.shield = true;
                this.shieldTimer = POWERUP_TYPES.SHIELD.duration;
                break;
            case 'EXTRA_LIFE':
                if (this.lives < this.maxLives) this.lives++;
                break;
        }
    }

    hit() {
        if (this.invincible) return false;
        if (this.shield) {
            this.shield = false;
            this.shieldTimer = 0;
            this.invincible = true;
            this.invincibleTimer = 1.0;
            return false; // shield absorbed
        }
        this.lives--;
        if (this.lives <= 0) {
            this.alive = false;
            return true; // dead
        }
        this.invincible = true;
        this.invincibleTimer = this.invincibleDuration;
        return false;
    }

    update(dt, keys, joystick) {
        this.engineTime += dt;

        // --- Input ---
        let ax = 0, ay = 0;
        if (keys['ArrowLeft']  || keys['KeyA']) ax -= 1;
        if (keys['ArrowRight'] || keys['KeyD']) ax += 1;
        if (keys['ArrowUp']    || keys['KeyW']) ay -= 1;
        if (keys['ArrowDown']  || keys['KeyS']) ay += 1;

        // Joystick override (mobile)
        if (joystick.active) {
            ax = joystick.dx;
            ay = joystick.dy;
        }

        // Normalize diagonal
        const len = Math.sqrt(ax * ax + ay * ay);
        if (len > 1) { ax /= len; ay /= len; }

        this.vx += ax * this.accel * dt;
        this.vy += ay * this.accel * dt;
        this.vx *= this.friction;
        this.vy *= this.friction;

        // Cap speed
        const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (spd > this.speed) {
            this.vx = (this.vx / spd) * this.speed;
            this.vy = (this.vy / spd) * this.speed;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Clamp to screen
        this.x = Utils.clamp(this.x, this.width / 2, this.canvas.width - this.width / 2);
        this.y = Utils.clamp(this.y, this.height / 2, this.canvas.height - this.height / 2);

        // Shoot cooldown
        if (this.shootCooldown > 0) this.shootCooldown -= dt;

        // Power-up timers
        if (this.rapidFire) {
            this.rapidFireTimer -= dt;
            if (this.rapidFireTimer <= 0) {
                this.rapidFire = false;
                this.fireRate = this.baseFireRate;
            }
        }
        if (this.tripleShot) {
            this.tripleShotTimer -= dt;
            if (this.tripleShotTimer <= 0) {
                this.tripleShot = false;
            }
        }
        if (this.shield) {
            this.shieldTimer -= dt;
            if (this.shieldTimer <= 0) {
                this.shield = false;
            }
        }

        // Invincibility
        if (this.invincible) {
            this.invincibleTimer -= dt;
            this.flickerTimer += dt;
            this.visible = Math.sin(this.flickerTimer * 30) > 0;
            if (this.invincibleTimer <= 0) {
                this.invincible = false;
                this.visible = true;
            }
        }
    }

    shoot(projectilePool, particles, audio) {
        if (this.shootCooldown > 0 || !this.alive) return;
        this.shootCooldown = this.fireRate;

        const bulletSpeed = 700;
        const tipX = this.x + this.width / 2;
        const tipY = this.y;

        // Center shot
        const p = projectilePool.get();
        if (p) {
            p.init(tipX, tipY, bulletSpeed, 0, '#00ffff', '#00ffff', false);
        }

        // Triple shot extras
        if (this.tripleShot) {
            const spread = 0.2;
            const p2 = projectilePool.get();
            if (p2) p2.init(tipX, tipY, bulletSpeed * Math.cos(spread), bulletSpeed * Math.sin(-spread), '#00ff66', '#00ff66', false);
            const p3 = projectilePool.get();
            if (p3) p3.init(tipX, tipY, bulletSpeed * Math.cos(spread), bulletSpeed * Math.sin(spread), '#00ff66', '#00ff66', false);
        }

        particles.createMuzzleFlash(tipX + 5, tipY, 0, '#00ffff');
        audio.playLaser();
    }

    draw(ctx) {
        if (!this.alive || !this.visible) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Engine trail — flickering cyan/blue flame
        const flicker = 0.7 + 0.3 * Math.sin(this.engineTime * 25);
        const trailLen = 15 + 5 * flicker;

        ctx.save();
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 12 * flicker;
        // Main flame
        ctx.fillStyle = `rgba(0, 255, 255, ${0.5 * flicker})`;
        ctx.beginPath();
        ctx.moveTo(-this.width / 2, -4);
        ctx.lineTo(-this.width / 2 - trailLen, 0);
        ctx.lineTo(-this.width / 2, 4);
        ctx.closePath();
        ctx.fill();
        // Inner white core
        ctx.fillStyle = `rgba(255, 255, 255, ${0.4 * flicker})`;
        ctx.beginPath();
        ctx.moveTo(-this.width / 2, -2);
        ctx.lineTo(-this.width / 2 - trailLen * 0.5, 0);
        ctx.lineTo(-this.width / 2, 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Ship body — sleek arrow shape
        ctx.fillStyle = '#ddeeff';
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.moveTo(this.width / 2, 0);                     // nose
        ctx.lineTo(-this.width / 2 + 5, -this.height / 2); // top wing
        ctx.lineTo(-this.width / 2, -this.height / 2 + 5); // wing notch
        ctx.lineTo(-this.width / 2 + 8, 0);                // rear center
        ctx.lineTo(-this.width / 2, this.height / 2 - 5);  // wing notch
        ctx.lineTo(-this.width / 2 + 5, this.height / 2);  // bottom wing
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cockpit window
        ctx.fillStyle = '#00ffff';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.ellipse(5, 0, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Shield effect
        if (this.shield) {
            const sPulse = 0.6 + 0.4 * Math.sin(this.engineTime * 4);
            ctx.strokeStyle = `rgba(0, 170, 255, ${sPulse * 0.7})`;
            ctx.shadowColor = '#00aaff';
            ctx.shadowBlur = 15;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    }

    drawTrail(particles) {
        if (!this.alive) return;
        particles.createTrail(
            this.x - this.width / 2,
            this.y,
            '#00ffff',
            2.5
        );
    }
}
