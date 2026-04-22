// ============================================================
// player.js — Player ship with movement, shooting, power-ups
// ============================================================

class Player {
    constructor(canvas, assets) {
        this.canvas = canvas;
        this.assets = assets || {};
        this.x = 80;
        this.y = canvas.height / 2;
        this.width = 40;
        this.height = 30;
        this.radius = 18;       // collision radius
        this.speed = 420;
        this.vx = 0;
        this.vy = 0;
        this.accel = 1800;
        this.friction = 0.90;

        // Combat
        this.lives = 6;
        this.maxLives = 8;
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

        // Death Ray (laser beam power-up)
        this.deathRay = false;
        this.deathRayTimer = 0;
        this.deathRayWidth = 40; // beam thickness

        // Active shield ability (E key)
        this.shieldCharges = 3;
        this.maxShieldCharges = 3;
        this.activeShield = false;
        this.activeShieldTimer = 0;
        this.activeShieldDuration = 2.0;
        this.shieldRecharging = false;
        this.shieldRechargeTimer = 0;
        this.shieldRechargeDuration = 12;

        // Screen-clearing bomb (Q key)
        this.bombs = 2;
        this.maxBombs = 3;
        this.bombCooldown = 0;

        // Scrap & weapon upgrades (persistent via localStorage)
        this.scrap = parseInt(localStorage.getItem('ninDefenderScrap') || '0', 10);
        this.upgrades = JSON.parse(localStorage.getItem('ninDefenderUpgrades') || '{}');
        this.upgrades.damage   = this.upgrades.damage   || 0; // 0-5 levels
        this.upgrades.fireRate = this.upgrades.fireRate || 0;
        this.upgrades.speed    = this.upgrades.speed    || 0;
        this.upgrades.bombs    = this.upgrades.bombs    || 0;
        this.applyUpgrades();

        // Trail customization
        this.trailColors = [
            '#00ffff', '#ff3366', '#00ff66', '#ffaa00',
            '#ff00ff', '#4488ff', '#ffffff'
        ];
        this.trailColorNames = [
            'CYAN', 'CRIMSON', 'EMERALD', 'AMBER',
            'MAGENTA', 'COBALT', 'GHOST WHITE'
        ];
        this.trailIndex = parseInt(localStorage.getItem('ninDefenderTrail') || '0', 10);
        this.trailColor = this.trailColors[this.trailIndex];

        // Combo system (tracked here for score integration)
        this.combo = 0;
        this.comboTimer = 0;
        this.comboDuration = 2.0; // seconds before combo resets
        this.maxCombo = 0;
    }

    reset(canvas) {
        this.canvas = canvas;
        this.x = 80;
        this.y = canvas.height / 2;
        this.vx = 0;
        this.vy = 0;
        this.lives = 6;
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
        this.deathRay = false;
        this.deathRayTimer = 0;
        this.fireRate = this.baseFireRate;
        this.shieldCharges = 3;
        this.activeShield = false;
        this.activeShieldTimer = 0;
        this.shieldRecharging = false;
        this.shieldRechargeTimer = 0;
        this.bombs = 2;
        this.bombCooldown = 0;
        this.combo = 0;
        this.comboTimer = 0;
        this.maxCombo = 0;
        this.applyUpgrades();
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
            case 'DEATH_RAY':
                this.deathRay = true;
                this.deathRayTimer = POWERUP_TYPES.DEATH_RAY.duration;
                break;
        }
    }

    applyUpgrades() {
        // Apply upgrade levels to base stats
        const dmgLevel = this.upgrades ? this.upgrades.damage : 0;
        const frLevel  = this.upgrades ? this.upgrades.fireRate : 0;
        const spdLevel = this.upgrades ? this.upgrades.speed : 0;
        const bmbLevel = this.upgrades ? this.upgrades.bombs : 0;
        this.baseDamage = 1 + dmgLevel * 0.5;        // 1 → 3.5 at max
        this.baseFireRate = 0.18 - frLevel * 0.015;   // 0.18 → 0.105 at max
        this.fireRate = this.baseFireRate;
        this.speed = 420 + spdLevel * 30;             // 420 → 570 at max
        this.maxBombs = 2 + bmbLevel;                 // 2 → 7 at max
    }

    addScrap(amount) {
        this.scrap += amount;
        localStorage.setItem('ninDefenderScrap', this.scrap.toString());
    }

    buyUpgrade(type) {
        const costs = { damage: 50, fireRate: 50, speed: 40, bombs: 60 };
        const cost = costs[type] * (this.upgrades[type] + 1);
        if (this.scrap < cost || this.upgrades[type] >= 5) return false;
        this.scrap -= cost;
        this.upgrades[type]++;
        localStorage.setItem('ninDefenderScrap', this.scrap.toString());
        localStorage.setItem('ninDefenderUpgrades', JSON.stringify(this.upgrades));
        this.applyUpgrades();
        return true;
    }

    getUpgradeCost(type) {
        const costs = { damage: 50, fireRate: 50, speed: 40, bombs: 60 };
        return costs[type] * (this.upgrades[type] + 1);
    }

    cycleTrail() {
        this.trailIndex = (this.trailIndex + 1) % this.trailColors.length;
        this.trailColor = this.trailColors[this.trailIndex];
        localStorage.setItem('ninDefenderTrail', this.trailIndex.toString());
    }

    activateBomb(audio, particles, enemies) {
        if (this.bombs <= 0 || this.bombCooldown > 0 || !this.alive) return false;
        this.bombs--;
        this.bombCooldown = 1.0;
        // Kill all enemies on screen
        let kills = 0;
        for (const e of enemies) {
            if (e.active) {
                e.active = false;
                kills++;
                if (particles) {
                    particles.createColorExplosion(e.x, e.y,
                        ['#ffffff', '#ffdd00', '#ff8800'], 15, 200, 0.4, 3);
                }
            }
        }
        // Big screen flash effect
        if (particles) {
            particles.createColorExplosion(this.x, this.y,
                ['#ffffff', '#ffddaa', '#ffaa44'], 60, 400, 1.0, 6);
        }
        if (audio) audio.playExplosion();
        return kills;
    }

    registerKill() {
        this.combo++;
        this.comboTimer = this.comboDuration;
        if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    }

    getComboMultiplier() {
        if (this.combo < 3) return 1;
        if (this.combo < 6) return 2;
        if (this.combo < 10) return 3;
        if (this.combo < 20) return 4;
        return 5;
    }

    activateShield(audio) {
        if (this.activeShield || this.shieldRecharging || this.shieldCharges <= 0) return;
        this.activeShield = true;
        this.activeShieldTimer = this.activeShieldDuration;
        this.shieldCharges--;
        if (audio) audio.playPowerUp();
        // Start recharge once all charges depleted
        if (this.shieldCharges <= 0) {
            this.shieldRecharging = true;
            this.shieldRechargeTimer = this.shieldRechargeDuration;
        }
    }

    hit() {
        if (this.invincible) return false;
        // Active shield (player-triggered) absorbs hit
        if (this.activeShield) {
            this.activeShield = false;
            this.activeShieldTimer = 0;
            this.invincible = true;
            this.invincibleTimer = 1.0;
            return false;
        }
        // Power-up shield absorbs hit
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

        // Wrap right/top/bottom edges, block left edge
        if (this.x > this.canvas.width + this.width / 2) this.x = -this.width / 2;
        this.x = Math.max(this.x, this.width / 2); // can't go off left
        if (this.y > this.canvas.height + this.height / 2) this.y = -this.height / 2;
        if (this.y < -this.height / 2) this.y = this.canvas.height + this.height / 2;

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

        // Death Ray timer
        if (this.deathRay) {
            this.deathRayTimer -= dt;
            if (this.deathRayTimer <= 0) {
                this.deathRay = false;
            }
        }

        // Active shield timer
        if (this.activeShield) {
            this.activeShieldTimer -= dt;
            if (this.activeShieldTimer <= 0) {
                this.activeShield = false;
            }
        }

        // Shield recharge
        if (this.shieldRecharging) {
            this.shieldRechargeTimer -= dt;
            if (this.shieldRechargeTimer <= 0) {
                this.shieldRecharging = false;
                this.shieldCharges = this.maxShieldCharges;
            }
        }

        // Bomb cooldown
        if (this.bombCooldown > 0) this.bombCooldown -= dt;

        // Combo timer
        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.combo = 0;
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
        const dmg = this.baseDamage || 1;
        const p = projectilePool.get();
        if (p) {
            p.init(tipX, tipY, bulletSpeed, 0, '#00ffff', '#00ffff', false, dmg);
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
    }

    draw(ctx) {
        if (!this.alive || !this.visible) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Engine trail — flickering cyan/blue flame (always drawn, even with sprite)
        const flicker = 0.7 + 0.3 * Math.sin(this.engineTime * 25);
        const trailLen = 15 + 5 * flicker;

        ctx.save();
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 12 * flicker;
        ctx.fillStyle = `rgba(0, 255, 255, ${0.5 * flicker})`;
        ctx.beginPath();
        ctx.moveTo(-this.width / 2, -4);
        ctx.lineTo(-this.width / 2 - trailLen, 0);
        ctx.lineTo(-this.width / 2, 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = `rgba(255, 255, 255, ${0.4 * flicker})`;
        ctx.beginPath();
        ctx.moveTo(-this.width / 2, -2);
        ctx.lineTo(-this.width / 2 - trailLen * 0.5, 0);
        ctx.lineTo(-this.width / 2, 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Ship body — sprite or Canvas fallback
        if (this.assets.playerShip) {
            const img = this.assets.playerShip;
            const drawH = this.height * 2;
            const drawW = drawH * (img.width / img.height);
            ctx.save();
            ctx.rotate(Math.PI / 2); // sprite faces up → rotate to face right
            ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();
        } else {
            ctx.fillStyle = '#ddeeff';
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 1.5;
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 8;

            ctx.beginPath();
            ctx.moveTo(this.width / 2, 0);
            ctx.lineTo(-this.width / 2 + 5, -this.height / 2);
            ctx.lineTo(-this.width / 2, -this.height / 2 + 5);
            ctx.lineTo(-this.width / 2 + 8, 0);
            ctx.lineTo(-this.width / 2, this.height / 2 - 5);
            ctx.lineTo(-this.width / 2 + 5, this.height / 2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#00ffff';
            ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.ellipse(5, 0, 5, 3, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Shield effect — power-up or active shield
        if (this.shield || this.activeShield) {
            const sPulse = 0.6 + 0.4 * Math.sin(this.engineTime * 4);
            const isActive = this.activeShield;
            // Active shield is brighter, hexagonal
            if (isActive) {
                const sr = this.radius + 10;
                ctx.strokeStyle = `rgba(0, 220, 255, ${sPulse * 0.8})`;
                ctx.shadowColor = '#00ddff';
                ctx.shadowBlur = 20 * sPulse;
                ctx.lineWidth = 2.5;
                // Hexagon shape
                ctx.beginPath();
                for (let i = 0; i < 6; i++) {
                    const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
                    const hx = Math.cos(a) * sr;
                    const hy = Math.sin(a) * sr;
                    if (i === 0) ctx.moveTo(hx, hy);
                    else ctx.lineTo(hx, hy);
                }
                ctx.closePath();
                ctx.stroke();
                // Inner glow fill
                ctx.fillStyle = `rgba(0, 180, 255, ${0.08 * sPulse})`;
                ctx.fill();
            } else {
                ctx.strokeStyle = `rgba(0, 170, 255, ${sPulse * 0.7})`;
                ctx.shadowColor = '#00aaff';
                ctx.shadowBlur = 15;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        // Death Ray beam
        if (this.deathRay) {
            ctx.save();
            // Reset translate since beam needs screen coords
            ctx.restore();
            ctx.save();

            const beamX = this.x + this.width / 2;
            const beamY = this.y;
            const beamW = this.canvas.width - beamX + 50;
            const halfH = this.deathRayWidth / 2;
            const t = Date.now() / 1000;
            const flicker = 0.8 + 0.2 * Math.sin(t * 20);

            // Outer glow
            const outerGrad = ctx.createLinearGradient(beamX, beamY - halfH * 2, beamX, beamY + halfH * 2);
            outerGrad.addColorStop(0, 'rgba(204, 0, 0, 0)');
            outerGrad.addColorStop(0.3, `rgba(255, 30, 0, ${0.15 * flicker})`);
            outerGrad.addColorStop(0.5, `rgba(255, 50, 0, ${0.3 * flicker})`);
            outerGrad.addColorStop(0.7, `rgba(255, 30, 0, ${0.15 * flicker})`);
            outerGrad.addColorStop(1, 'rgba(204, 0, 0, 0)');
            ctx.fillStyle = outerGrad;
            ctx.fillRect(beamX, beamY - halfH * 2, beamW, halfH * 4);

            // Core beam
            const coreGrad = ctx.createLinearGradient(beamX, beamY - halfH, beamX, beamY + halfH);
            coreGrad.addColorStop(0, 'rgba(255, 50, 0, 0.1)');
            coreGrad.addColorStop(0.3, `rgba(255, 100, 50, ${0.7 * flicker})`);
            coreGrad.addColorStop(0.5, `rgba(255, 200, 150, ${0.9 * flicker})`);
            coreGrad.addColorStop(0.7, `rgba(255, 100, 50, ${0.7 * flicker})`);
            coreGrad.addColorStop(1, 'rgba(255, 50, 0, 0.1)');
            ctx.fillStyle = coreGrad;
            ctx.shadowColor = '#ff2200';
            ctx.shadowBlur = 20 * flicker;
            ctx.fillRect(beamX, beamY - halfH, beamW, halfH * 2);

            // Hot white center line
            ctx.fillStyle = `rgba(255, 255, 220, ${0.6 * flicker})`;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ffffff';
            ctx.fillRect(beamX, beamY - 3, beamW, 6);

            // NIN text stamped along the beam
            ctx.shadowBlur = 0;
            ctx.font = 'bold 18px Courier New';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const spacing = 80;
            const scrollOffset = (t * 200) % spacing;
            for (let nx = beamX + 30 - scrollOffset; nx < beamX + beamW; nx += spacing) {
                const textAlpha = 0.4 + 0.3 * Math.sin(t * 8 + nx * 0.05);
                ctx.fillStyle = `rgba(255, 255, 255, ${textAlpha})`;
                ctx.fillText('NIN', nx, beamY);
            }

            ctx.restore();
            return; // skip the normal ctx.restore below
        }

        ctx.restore();
    }

    drawTrail(particles) {
        if (!this.alive) return;
        particles.createTrail(
            this.x - this.width / 2,
            this.y,
            this.trailColor || '#00ffff',
            2.5
        );
    }
}
