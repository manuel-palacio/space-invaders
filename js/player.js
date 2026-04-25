// ============================================================
// player.js — Player ship with movement, shooting, power-ups
// ============================================================

class Player {
    constructor(canvas, assets) {
        this.canvas = canvas;
        this.assets = assets || {};
        this.x = 80;
        this.y = canvas.height / 2;
        this.width = 40 * GAME_SCALE;
        this.height = 30 * GAME_SCALE;
        this.radius = 18 * GAME_SCALE;
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

        // Ricochet (bouncing bullets power-up)
        this.ricochet = false;
        this.ricochetTimer = 0;

        // Wingman drone (companion ship)
        this.wingman = false;
        this.wingmanTimer = 0;
        this.wingmanX = 0;
        this.wingmanY = 0;
        this.wingmanShootTimer = 0;


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
        this.upgrades.damage   = this.upgrades.damage   || 0;
        this.upgrades.fireRate = this.upgrades.fireRate || 0;
        this.upgrades.speed    = this.upgrades.speed    || 0;
        this.upgrades.bombs    = this.upgrades.bombs    || 0;
        this.upgrades.shields  = this.upgrades.shields  || 0;
        this.upgrades.lives    = this.upgrades.lives    || 0;
        this.applyUpgrades();

        // Trail customization
        this.trailColors = [
            '#00ffff', '#ff3366', '#00ff66', '#ffaa00',
            '#ff00ff', '#4488ff', '#ffffff',
            '#ff0066', '#cc0000', '#ffdd00', '#00aaff'
        ];
        this.trailColorNames = [
            'CYAN', 'CRIMSON', 'EMERALD', 'AMBER',
            'MAGENTA', 'COBALT', 'GHOST WHITE',
            'NEON PINK', 'BLOOD RED', 'SOLAR GOLD', 'ICE BLUE'
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
        this.ricochet = false;
        this.ricochetTimer = 0;
        this.wingman = false;
        this.wingmanTimer = 0;
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

    getActivePowerUpCount() {
        let count = 0;
        if (this.rapidFire) count++;
        if (this.tripleShot) count++;
        if (this.shield) count++;
        if (this.ricochet) count++;
        if (this.wingman) count++;
        return count;
    }

    getPowerComboMultiplier() {
        const count = this.getActivePowerUpCount();
        if (count >= 3) return 3.0;
        if (count >= 2) return 2.0;
        return 1.0;
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
            case 'RICOCHET':
                this.ricochet = true;
                this.ricochetTimer = POWERUP_TYPES.RICOCHET.duration;
                break;
            case 'WINGMAN':
                this.wingman = true;
                this.wingmanTimer = POWERUP_TYPES.WINGMAN.duration;
                this.wingmanX = this.x - 30;
                this.wingmanY = this.y + 40;
                break;
        }
    }

    applyUpgrades() {
        // Apply upgrade levels to base stats
        const dmgLevel = this.upgrades ? this.upgrades.damage : 0;
        const frLevel  = this.upgrades ? this.upgrades.fireRate : 0;
        const spdLevel = this.upgrades ? this.upgrades.speed : 0;
        const bmbLevel = this.upgrades ? this.upgrades.bombs : 0;
        this.baseDamage = 1 + dmgLevel * 0.5;
        this.baseFireRate = 0.18 - frLevel * 0.015;
        this.fireRate = this.baseFireRate;
        this.speed = 420 + spdLevel * 30;
        this.maxBombs = 2 + bmbLevel;
        const shdLevel = this.upgrades ? this.upgrades.shields : 0;
        const livLevel = this.upgrades ? this.upgrades.lives : 0;
        this.maxShieldCharges = 3 + shdLevel;
        this.maxLives = 8 + livLevel;
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
        if (this.bombs <= 0 || this.bombCooldown > 0 || !this.alive) {
            if (this.bombs <= 0 && audio) audio.playSmallExplosion();
            return false;
        }
        this.bombs--;
        this.bombCooldown = 1.0;
        // Kill all non-boss enemies; damage bosses for 25% HP
        let kills = 0;
        for (const e of enemies) {
            if (!e.active) continue;
            if (e.type === 'boss') {
                e.takeDamage(Math.ceil(e.maxHp * 0.25));
                if (particles) {
                    particles.createColorExplosion(e.x, e.y,
                        ['#ffffff', '#ffdd00'], 20, 200, 0.5, 4);
                }
            } else {
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
        // Rage mode — brief invincibility on respawn
        this.invincible = true;
        this.invincibleTimer = 3.0;
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

        // Ricochet timer
        if (this.ricochet) {
            this.ricochetTimer -= dt;
            if (this.ricochetTimer <= 0) {
                this.ricochet = false;
            }
        }

        // Wingman timer + follow
        if (this.wingman) {
            this.wingmanTimer -= dt;
            if (this.wingmanTimer <= 0) {
                this.wingman = false;
            } else {
                // Follow player with lag
                this.wingmanX += (this.x - 35 - this.wingmanX) * 4 * dt;
                this.wingmanY += (this.y + 40 - this.wingmanY) * 4 * dt;
                this.wingmanShootTimer -= dt;
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
        // Bullets follow the ship's tilt angle
        const tilt = Math.atan2(this.vy, Math.abs(this.vx) + 1) * 0.35;
        const bvx = bulletSpeed * Math.cos(tilt);
        const bvy = bulletSpeed * Math.sin(tilt);

        const bounceCount = this.ricochet ? 3 : 0;
        const bulletColor = this.ricochet ? '#ff8800' : '#00ffff';
        const p = projectilePool.get();
        if (p) {
            const extraVy = this.ricochet ? Utils.random(-80, 80) : 0;
            p.init(tipX, tipY, bvx, bvy + extraVy, bulletColor, bulletColor, false, dmg);
            p.bounces = bounceCount;
        }

        // Triple shot extras — spread relative to firing angle
        if (this.tripleShot) {
            const spread = 0.18;
            const p2 = projectilePool.get();
            if (p2) {
                p2.init(tipX, tipY - 5,
                    bulletSpeed * Math.cos(tilt - spread), bulletSpeed * Math.sin(tilt - spread),
                    '#00ff66', '#00ff66', false, dmg);
                p2.bounces = bounceCount;
            }
            const p3 = projectilePool.get();
            if (p3) {
                p3.init(tipX, tipY + 5,
                    bulletSpeed * Math.cos(tilt + spread), bulletSpeed * Math.sin(tilt + spread),
                    '#00ff66', '#00ff66', false, dmg);
                p3.bounces = bounceCount;
            }
        }

        particles.createMuzzleFlash(tipX + 5, tipY, 0, '#00ffff');
    }

    draw(ctx) {
        if (!this.alive || !this.visible) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Bank/tilt on vertical movement
        const tilt = Math.atan2(this.vy, Math.abs(this.vx) + 1) * 0.35;
        ctx.rotate(tilt);

        // Engine trail — scales with speed, uses trail color
        const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        const speedFrac = Math.min(1, spd / this.speed);
        const flicker = 0.7 + 0.3 * Math.sin(this.engineTime * 25);
        const trailLen = (12 + 15 * speedFrac) * flicker;

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

        // Power-up hull glow
        const puCount = this.getActivePowerUpCount();
        if (puCount > 0) {
            const puColors = [];
            if (this.rapidFire) puColors.push('#ffdd00');
            if (this.tripleShot) puColors.push('#00ff66');
            if (this.ricochet) puColors.push('#ff8800');
            if (this.wingman) puColors.push('#4488ff');
            const glowColor = puColors[Math.floor(this.engineTime * 3) % puColors.length] || '#cc0000';
            ctx.strokeStyle = glowColor;
            ctx.shadowColor = glowColor;
            ctx.shadowBlur = 8 + puCount * 4;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.4 + 0.2 * Math.sin(this.engineTime * 6);
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
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

        // Life progress bar below ship
        {
            const barW = this.width * 1.2;
            const barH = 4;
            const barX = -barW / 2;
            const barY = this.height / 2 + 8;
            const frac = this.lives / this.maxLives;
            ctx.shadowBlur = 0;
            // Background
            ctx.fillStyle = 'rgba(60, 60, 60, 0.6)';
            ctx.fillRect(barX, barY, barW, barH);
            // Fill — color shifts from green to red
            let barColor;
            if (frac > 0.6) barColor = '#00cc44';
            else if (frac > 0.3) barColor = '#cc8800';
            else barColor = '#cc0000';
            ctx.fillStyle = barColor;
            ctx.shadowColor = barColor;
            ctx.shadowBlur = 4;
            ctx.fillRect(barX, barY, barW * frac, barH);
            ctx.shadowBlur = 0;
            // Border
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(barX, barY, barW, barH);
        }

        // Wingman drone — aggressive NIN-themed attack drone
        if (this.wingman) {
            ctx.save();
            ctx.translate(this.wingmanX - this.x, this.wingmanY - this.y);
            const t = this.engineTime;
            const wPulse = 0.7 + 0.3 * Math.sin(t * 8);

            // Energy aura
            ctx.fillStyle = `rgba(204, 0, 0, ${0.1 * wPulse})`;
            ctx.shadowColor = '#cc0000';
            ctx.shadowBlur = 15 * wPulse;
            ctx.beginPath();
            ctx.arc(0, 0, 18, 0, Math.PI * 2);
            ctx.fill();

            // Engine exhaust — dual flame
            const wFlicker = 0.6 + 0.4 * Math.sin(t * 25);
            ctx.fillStyle = `rgba(255, 50, 0, ${0.6 * wFlicker})`;
            ctx.shadowColor = '#ff3300';
            ctx.shadowBlur = 10 * wFlicker;
            ctx.beginPath();
            ctx.moveTo(-8, -4);
            ctx.lineTo(-16 - 8 * wFlicker, -1);
            ctx.lineTo(-8, 0);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-8, 4);
            ctx.lineTo(-16 - 8 * wFlicker, 1);
            ctx.lineTo(-8, 0);
            ctx.closePath();
            ctx.fill();

            // Hull — angular attack drone
            const hullGrad = ctx.createLinearGradient(-10, -8, 10, 8);
            hullGrad.addColorStop(0, '#1a1a1a');
            hullGrad.addColorStop(0.5, '#333');
            hullGrad.addColorStop(1, '#1a1a1a');
            ctx.fillStyle = hullGrad;
            ctx.strokeStyle = '#cc0000';
            ctx.shadowColor = '#cc0000';
            ctx.shadowBlur = 4;
            ctx.lineWidth = 1;
            // Main body
            ctx.beginPath();
            ctx.moveTo(14, 0);      // nose
            ctx.lineTo(4, -7);      // upper forward
            ctx.lineTo(-6, -9);     // upper wing
            ctx.lineTo(-8, -3);     // upper rear
            ctx.lineTo(-8, 3);      // lower rear
            ctx.lineTo(-6, 9);      // lower wing
            ctx.lineTo(4, 7);       // lower forward
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Red accent stripe
            ctx.fillStyle = '#cc0000';
            ctx.shadowBlur = 0;
            ctx.fillRect(-4, -1, 12, 2);

            // Weapon port glow
            ctx.fillStyle = `rgba(255, 100, 0, ${wPulse})`;
            ctx.shadowColor = '#ff6600';
            ctx.shadowBlur = 5 * wPulse;
            ctx.beginPath();
            ctx.arc(12, 0, 2, 0, Math.PI * 2);
            ctx.fill();

            // NIN micro text
            ctx.shadowBlur = 0;
            ctx.font = 'bold 5px Arial Black, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = `rgba(204, 0, 0, ${0.5 + 0.3 * wPulse})`;
            ctx.fillText('NIN', 0, 2);

            ctx.restore();
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
