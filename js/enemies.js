// ============================================================
// enemies.js — Asteroids and enemy ships
// ============================================================

// --- Base enemy ---
class Enemy {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.radius = 15 * GAME_SCALE;
        this.hp = 1;
        this.maxHp = 1;
        this.active = false;
        this.points = 10;
        this.type = 'asteroid';
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    isOffScreen(canvasW, canvasH) {
        return (this.x < -this.radius * 2 - 50 ||
                this.y < -this.radius * 2 - 50 ||
                this.y > canvasH + this.radius * 2 + 50);
    }

    takeDamage(amount) {
        this.hp -= amount;
        return this.hp <= 0;
    }
}

// ============================================================
// Asteroid — Rotating irregular polygon, 1 HP
// ============================================================
class Asteroid extends Enemy {
    constructor(canvasW, canvasH, sizeMultiplier = 1, spawnX, spawnY) {
        super();
        this.type = 'asteroid';
        const baseRadius = Utils.random(12, 28) * sizeMultiplier * GAME_SCALE;
        this.radius = baseRadius;
        this.sizeMultiplier = sizeMultiplier;
        this.hp = sizeMultiplier >= 1.4 ? 2 : 1; // big asteroids take 2 hits
        this.maxHp = this.hp;
        this.points = sizeMultiplier >= 1.4 ? 15 : 10;

        // Allow spawning at a specific position (for splits)
        this.x = spawnX !== undefined ? spawnX : canvasW + this.radius + Utils.random(10, 100);
        this.y = spawnY !== undefined ? spawnY : Utils.random(this.radius, canvasH - this.radius);
        this.vx = Utils.random(-180, -60);

        // Wavy or straight path
        this.wavy = Math.random() > 0.5;
        this.wavyAmp = Utils.random(20, 60);
        this.wavyFreq = Utils.random(1.5, 3);
        this.baseY = this.y;
        this.time = 0;

        this.rotation = 0;
        this.rotSpeed = Utils.random(-3, 3);

        // Generate shape
        this.vertices = Utils.generateAsteroidShape(this.radius, Utils.randomInt(7, 12));

        // Rich color palette
        const hue = Utils.randomInt(15, 50);
        const sat = Utils.randomInt(15, 40);
        const lit = Utils.randomInt(30, 50);
        this.baseColor = `hsl(${hue}, ${sat}%, ${lit}%)`;
        this.darkColor = `hsl(${hue}, ${sat + 5}%, ${lit - 15}%)`;
        this.lightColor = `hsl(${hue}, ${sat - 5}%, ${lit + 15}%)`;

        // Craters for texture
        this.craters = [];
        const craterCount = Utils.randomInt(2, 5);
        for (let i = 0; i < craterCount; i++) {
            const angle = Utils.random(0, Math.PI * 2);
            const dist = Utils.random(0.1, 0.6) * this.radius;
            this.craters.push({
                ox: Math.cos(angle) * dist,
                oy: Math.sin(angle) * dist,
                r: Utils.random(this.radius * 0.08, this.radius * 0.25)
            });
        }

        // Surface ridges
        this.ridges = [];
        const ridgeCount = Utils.randomInt(1, 3);
        for (let i = 0; i < ridgeCount; i++) {
            this.ridges.push({
                angle: Utils.random(0, Math.PI * 2),
                len: Utils.random(0.3, 0.7) * this.radius,
                offset: Utils.random(-0.3, 0.3) * this.radius
            });
        }

        this.active = true;
    }

    update(dt) {
        this.time += dt;
        super.update(dt);
        if (this.wavy) {
            this.y = this.baseY + Math.sin(this.time * this.wavyFreq) * this.wavyAmp;
        }
        this.rotation += this.rotSpeed * dt;
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Main body with gradient
        const grad = ctx.createRadialGradient(
            -this.radius * 0.2, -this.radius * 0.2, this.radius * 0.1,
            0, 0, this.radius
        );
        grad.addColorStop(0, this.lightColor);
        grad.addColorStop(0.6, this.baseColor);
        grad.addColorStop(1, this.darkColor);

        ctx.fillStyle = grad;
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;

        // Clip to asteroid shape for craters
        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Save and clip for internal detail
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.closePath();
        ctx.clip();

        // Craters
        for (const c of this.craters) {
            ctx.fillStyle = this.darkColor;
            ctx.beginPath();
            ctx.arc(c.ox, c.oy, c.r, 0, Math.PI * 2);
            ctx.fill();
            // Highlight rim
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.arc(c.ox - c.r * 0.15, c.oy - c.r * 0.15, c.r, -0.8, 1.0);
            ctx.stroke();
        }

        // Surface ridges
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        for (const r of this.ridges) {
            const sx = Math.cos(r.angle) * r.len + r.offset;
            const sy = Math.sin(r.angle) * r.len;
            ctx.beginPath();
            ctx.moveTo(-sx, -sy);
            ctx.quadraticCurveTo(r.offset * 0.5, r.offset * 0.5, sx, sy);
            ctx.stroke();
        }

        ctx.restore(); // unclip

        // Subtle edge highlight (top-left light source)
        ctx.strokeStyle = 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.85, -Math.PI * 0.8, -Math.PI * 0.2);
        ctx.stroke();

        ctx.restore();
    }
}

// ============================================================
// EnemyShip (Alien Critter) — Bug-like creature, scurries & spits
// ============================================================
class EnemyShip extends Enemy {
    constructor(canvasW, canvasH, tier = 1, assets = {}) {
        super();
        this.assets = assets;
        this.type = 'ship';
        this.tier = tier; // 1 = small critter, 2 = large critter
        this.radius = (tier === 1 ? 16 : 24) * GAME_SCALE;
        this.hp = tier === 1 ? 2 : 3;
        this.maxHp = this.hp;
        this.points = tier === 1 ? 25 : 50;

        this.x = canvasW + this.radius + Utils.random(10, 60);
        this.y = Utils.random(this.radius + 30, canvasH - this.radius - 30);
        this.vx = Utils.random(-120, -50);
        this.vy = 0;

        // Tracking behaviour — drift toward player y
        this.trackSpeed = Utils.random(40, 100);
        this.shootTimer = Utils.random(0.5, 2);
        this.shootInterval = tier === 1 ? Utils.random(1.5, 3) : Utils.random(1, 2);
        this.active = true;

        // Visual
        this.time = 0;
        this.legPhase = Math.random() * Math.PI * 2;
        this.hue = tier === 1 ? Utils.randomInt(0, 30) : Utils.randomInt(260, 290);
    }

    update(dt, playerY, projectilePool, audio) {
        super.update(dt);
        this.time += dt;

        // Drift toward player's Y
        if (playerY !== null) {
            const diff = playerY - this.y;
            this.vy = Utils.clamp(diff, -1, 1) * this.trackSpeed;
            this.y += this.vy * dt;
        }

        // Shoot
        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && this.x < this.canvas_w - 50) {
            this.shootTimer = this.shootInterval;
            this.fireAtPlayer(projectilePool, audio);
        }
    }

    fireAtPlayer(projectilePool, audio) {
        const p = projectilePool.get();
        if (p) {
            const speed = 350;
            p.init(this.x - this.radius, this.y, -speed, Utils.random(-40, 40),
                '#ff3366', '#ff3366', true);
            audio.playEnemyLaser();
        }
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x, this.y);

        const r = this.radius;
        const t = this.time;
        const hsl = `hsl(${this.hue}, 80%, 50%)`;
        const hslDim = `hsl(${this.hue}, 60%, 25%)`;
        const hslBright = `hsl(${this.hue}, 100%, 70%)`;

        // Legs — 3 per side, scuttling animation
        ctx.strokeStyle = hslDim;
        ctx.lineWidth = this.tier === 2 ? 2 : 1.5;
        ctx.lineCap = 'round';
        for (let side = -1; side <= 1; side += 2) {
            for (let i = 0; i < 3; i++) {
                const phase = this.legPhase + i * 1.2 + (side > 0 ? Math.PI * 0.5 : 0);
                const wave = Math.sin(t * 10 + phase) * 0.25;
                const baseAngle = side * 0.5 + (i - 1) * 0.4;
                const jx = Math.cos(baseAngle + wave) * r * 0.6;
                const jy = Math.sin(baseAngle + wave) * r * 0.6 * side;
                const tx = Math.cos(baseAngle + wave + side * 0.3) * r * 1.1;
                const ty = Math.sin(baseAngle + wave + side * 0.3) * r * 0.9 * side;
                ctx.beginPath();
                ctx.moveTo(0, side * r * 0.1);
                ctx.lineTo(jx, jy);
                ctx.lineTo(tx, ty);
                ctx.stroke();
            }
        }

        // Antennae
        ctx.strokeStyle = hsl;
        ctx.lineWidth = 1;
        const antWave = Math.sin(t * 4) * 0.2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.4, -r * 0.15);
        ctx.quadraticCurveTo(-r * 0.8, -r * 0.6 - antWave * r, -r * 0.9, -r * 0.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.4, r * 0.15);
        ctx.quadraticCurveTo(-r * 0.8, r * 0.6 + antWave * r, -r * 0.9, r * 0.5);
        ctx.stroke();
        // Antenna tips
        ctx.fillStyle = hslBright;
        ctx.shadowColor = hslBright;
        ctx.shadowBlur = 4;
        ctx.beginPath(); ctx.arc(-r * 0.9, -r * 0.5, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-r * 0.9, r * 0.5, 2, 0, Math.PI * 2); ctx.fill();

        // Segmented body — head + abdomen
        ctx.shadowBlur = 0;
        // Abdomen (rear)
        const abdGrad = ctx.createRadialGradient(r * 0.15, 0, 0, r * 0.15, 0, r * 0.5);
        abdGrad.addColorStop(0, hsl);
        abdGrad.addColorStop(1, hslDim);
        ctx.fillStyle = abdGrad;
        ctx.beginPath();
        ctx.ellipse(r * 0.15, 0, r * 0.5, r * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        // Shell pattern
        ctx.strokeStyle = `hsla(${this.hue}, 60%, 40%, 0.5)`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(r * 0.25, 0, r * 0.2, r * 0.15, 0.2, 0, Math.PI * 2);
        ctx.stroke();

        // Head (front)
        const headGrad = ctx.createRadialGradient(-r * 0.3, 0, 0, -r * 0.3, 0, r * 0.35);
        headGrad.addColorStop(0, hslBright);
        headGrad.addColorStop(1, hslDim);
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.ellipse(-r * 0.3, 0, r * 0.35, r * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes — beady, glowing
        const eyePulse = 0.7 + 0.3 * Math.sin(t * 5);
        ctx.fillStyle = '#ffee00';
        ctx.shadowColor = '#ffee00';
        ctx.shadowBlur = 5 * eyePulse;
        ctx.beginPath(); ctx.arc(-r * 0.45, -r * 0.12, r * 0.07, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-r * 0.45, r * 0.12, r * 0.07, 0, Math.PI * 2); ctx.fill();
        // Pupils
        ctx.fillStyle = '#220000';
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(-r * 0.47, -r * 0.12, r * 0.03, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-r * 0.47, r * 0.12, r * 0.03, 0, Math.PI * 2); ctx.fill();

        // Health bar (if damaged)
        if (this.hp < this.maxHp) {
            const barW = r * 1.5;
            const barH = 3;
            const frac = this.hp / this.maxHp;
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#333';
            ctx.fillRect(-barW / 2, -r - 8, barW, barH);
            ctx.fillStyle = frac > 0.5 ? '#00ff66' : '#ff3366';
            ctx.fillRect(-barW / 2, -r - 8, barW * frac, barH);
        }

        ctx.restore();
    }
}

// ============================================================
// Drone (Space Firefly) — Tiny bioluminescent insect, swarms
// ============================================================
class Drone extends Enemy {
    constructor(canvasW, canvasH, offsetY = 0) {
        super();
        this.type = 'drone';
        this.radius = 8 * GAME_SCALE;
        this.hp = 1;
        this.maxHp = 1;
        this.points = 15;

        this.x = canvasW + this.radius + Utils.random(10, 40);
        this.y = Utils.random(this.radius + 40, canvasH - this.radius - 40) + offsetY;
        this.vx = Utils.random(-260, -180);

        // Sine-wave movement
        this.baseY = this.y;
        this.wavyAmp = Utils.random(30, 70);
        this.wavyFreq = Utils.random(3, 5);
        this.time = Math.random() * Math.PI * 2;

        // Visual
        this.pulseTime = 0;
        this.hue = Utils.randomInt(50, 80); // warm yellow-green bioluminescence
        this.wingPhase = Math.random() * Math.PI * 2;
        this.active = true;
    }

    update(dt) {
        this.time += dt;
        this.pulseTime += dt;
        this.x += this.vx * dt;
        this.y = this.baseY + Math.sin(this.time * this.wavyFreq) * this.wavyAmp;
    }

    draw(ctx) {
        if (!this.active) return;
        const r = this.radius;
        const t = this.pulseTime;
        const pulse = 0.5 + 0.5 * Math.sin(t * 6);
        const hsl = `hsl(${this.hue}, 100%, ${55 + 20 * pulse}%)`;
        const hslDim = `hsl(${this.hue}, 60%, 20%)`;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Bioluminescent glow aura
        ctx.fillStyle = `hsla(${this.hue}, 100%, 60%, ${0.15 * pulse})`;
        ctx.shadowColor = hsl;
        ctx.shadowBlur = 12 * pulse;
        ctx.beginPath();
        ctx.arc(0, 0, r * 2, 0, Math.PI * 2);
        ctx.fill();

        // Wings — rapid flutter
        const wingAngle = Math.sin(t * 25 + this.wingPhase) * 0.6;
        ctx.fillStyle = `hsla(${this.hue}, 80%, 50%, 0.3)`;
        ctx.shadowBlur = 3;
        // Upper wing
        ctx.save();
        ctx.rotate(-wingAngle);
        ctx.beginPath();
        ctx.ellipse(r * 0.1, -r * 0.3, r * 0.8, r * 0.25, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        // Lower wing
        ctx.save();
        ctx.rotate(wingAngle);
        ctx.beginPath();
        ctx.ellipse(r * 0.1, r * 0.3, r * 0.8, r * 0.25, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Body — small oval
        ctx.fillStyle = hslDim;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.5, r * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();

        // Glowing abdomen
        ctx.fillStyle = hsl;
        ctx.shadowColor = hsl;
        ctx.shadowBlur = 8 * pulse;
        ctx.beginPath();
        ctx.arc(r * 0.2, 0, r * 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Eyes — tiny dots
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 2;
        ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.08, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-r * 0.3, r * 0.08, 1.5, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
    }
}

// ============================================================
// Bomber (Space Octopus) — Tentacled alien, drops ink bombs
// ============================================================
class Bomber extends Enemy {
    constructor(canvasW, canvasH) {
        super();
        this.type = 'bomber';
        this.radius = 22 * GAME_SCALE;
        this.hp = 4;
        this.maxHp = 4;
        this.points = 60;

        this.x = canvasW + this.radius + Utils.random(10, 60);
        this.y = Utils.random(this.radius + 50, canvasH - this.radius - 50);
        this.vx = Utils.random(-70, -35);
        this.vy = 0;

        // Ink bomb drop
        this.shootTimer = Utils.random(1, 2.5);
        this.shootInterval = Utils.random(2, 3.5);
        this.canvas_w = canvasW;

        // Visual
        this.time = 0;
        this.tentacleCount = 6;
        this.active = true;
    }

    update(dt, playerY, projectilePool, audio) {
        this.x += this.vx * dt;
        this.time += dt;

        // Undulating vertical drift
        this.vy = Math.sin(this.time * 1.5) * 25;
        this.y += this.vy * dt;

        // Drop ink bombs
        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && this.x < this.canvas_w - 50) {
            this.shootTimer = this.shootInterval;
            this.dropBombs(projectilePool, audio);
        }
    }

    dropBombs(projectilePool, audio) {
        // 3-shot spread: ink blobs
        const angles = [-Math.PI * 0.85, -Math.PI, Math.PI * 0.85];
        const speed = 200;
        for (const angle of angles) {
            const p = projectilePool.get();
            if (p) {
                p.init(this.x, this.y + this.radius * 0.5,
                    Math.cos(angle) * speed, Math.sin(angle) * speed,
                    '#8833cc', '#6622aa', true);
            }
        }
        if (audio) audio.playEnemyLaser();
    }

    draw(ctx) {
        if (!this.active) return;
        const r = this.radius;
        const t = this.time;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Tentacles — flowing, animated
        ctx.lineCap = 'round';
        for (let i = 0; i < this.tentacleCount; i++) {
            const angle = (i / this.tentacleCount) * Math.PI * 1.4 + Math.PI * 0.3;
            const wave1 = Math.sin(t * 3 + i * 1.2) * 0.3;
            const wave2 = Math.sin(t * 2.5 + i * 0.8) * 0.2;
            const startX = Math.cos(angle) * r * 0.5;
            const startY = Math.sin(angle) * r * 0.5;
            const midX = Math.cos(angle + wave1) * r * 1.1;
            const midY = Math.sin(angle + wave1) * r * 1.1;
            const endX = Math.cos(angle + wave1 + wave2) * r * 1.6;
            const endY = Math.sin(angle + wave1 + wave2) * r * 1.4;

            ctx.strokeStyle = `hsla(275, 60%, ${35 + i * 3}%, 0.7)`;
            ctx.lineWidth = 3 - i * 0.3;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.quadraticCurveTo(midX, midY, endX, endY);
            ctx.stroke();

            // Sucker dots along tentacle
            ctx.fillStyle = `hsla(275, 50%, 50%, 0.4)`;
            ctx.beginPath();
            ctx.arc(midX, midY, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // Head — bulbous dome
        const headGrad = ctx.createRadialGradient(-r * 0.1, -r * 0.15, 0, 0, 0, r * 0.7);
        headGrad.addColorStop(0, '#bb66ee');
        headGrad.addColorStop(0.5, '#7722aa');
        headGrad.addColorStop(1, '#3a1155');
        ctx.fillStyle = headGrad;
        ctx.shadowColor = '#aa44ff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.1, r * 0.65, r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();

        // Mantle pattern — bioluminescent spots
        const spotPulse = 0.4 + 0.6 * Math.sin(t * 2);
        ctx.fillStyle = `rgba(200, 150, 255, ${0.3 * spotPulse})`;
        ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.25, r * 0.1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.15, -r * 0.2, r * 0.07, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -r * 0.35, r * 0.06, 0, Math.PI * 2); ctx.fill();

        // Eyes — large, intelligent
        ctx.shadowBlur = 0;
        // Eye whites
        ctx.fillStyle = '#eeddff';
        ctx.beginPath();
        ctx.ellipse(-r * 0.22, -r * 0.05, r * 0.16, r * 0.12, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(r * 0.18, -r * 0.05, r * 0.16, r * 0.12, 0.1, 0, Math.PI * 2);
        ctx.fill();
        // Pupils — rectangular like octopus
        ctx.fillStyle = '#110022';
        ctx.beginPath();
        ctx.ellipse(-r * 0.22, -r * 0.03, r * 0.04, r * 0.09, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(r * 0.18, -r * 0.03, r * 0.04, r * 0.09, 0, 0, Math.PI * 2);
        ctx.fill();

        // Health bar
        if (this.hp < this.maxHp) {
            const barW = r * 1.5;
            const barH = 3;
            const frac = this.hp / this.maxHp;
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#333';
            ctx.fillRect(-barW / 2, -r - 10, barW, barH);
            ctx.fillStyle = frac > 0.5 ? '#00ff66' : '#ff3366';
            ctx.fillRect(-barW / 2, -r - 10, barW * frac, barH);
        }

        ctx.restore();
    }
}

// ============================================================
// SpaceMine (Space Jellyfish) — Drifts, stings on proximity
// ============================================================
class SpaceMine extends Enemy {
    constructor(canvasW, canvasH) {
        super();
        this.type = 'mine';
        this.radius = 12 * GAME_SCALE;
        this.hp = 1;
        this.maxHp = 1;
        this.points = 20;

        this.x = canvasW + this.radius + Utils.random(10, 80);
        this.y = Utils.random(this.radius + 20, canvasH - this.radius - 20);
        this.vx = Utils.random(-80, -30);
        this.vy = Utils.random(-15, 15);

        // Proximity sting
        this.detonateRadius = 80;
        this.detonated = false;

        // Visual
        this.time = Math.random() * Math.PI * 2;
        this.tentacleCount = Utils.randomInt(5, 8);
        this.hue = Utils.randomInt(300, 340); // pink-magenta
        this.active = true;
    }

    update(dt, playerY, projectilePool, audio, playerX) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.time += dt;

        // Proximity detonation check
        if (playerX !== undefined && playerY !== undefined && !this.detonated) {
            const dist = Utils.distance(this.x, this.y, playerX, playerY);
            if (dist < this.detonateRadius) {
                this.detonate(projectilePool, audio);
            }
        }
    }

    detonate(projectilePool, audio) {
        this.detonated = true;
        // Fire stinger projectiles in a ring
        const count = 8;
        const speed = 220;
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const p = projectilePool.get();
            if (p) {
                p.init(this.x, this.y,
                    Math.cos(angle) * speed, Math.sin(angle) * speed,
                    '#ff66cc', '#ff44aa', true);
            }
        }
        if (audio) audio.playExplosion();
        this.active = false;
    }

    draw(ctx) {
        if (!this.active) return;
        const r = this.radius;
        const t = this.time;
        const pulse = 0.5 + 0.5 * Math.sin(t * 3);

        ctx.save();
        ctx.translate(this.x, this.y);

        // Trailing tentacles — flowing downward
        ctx.lineCap = 'round';
        for (let i = 0; i < this.tentacleCount; i++) {
            const tentAngle = (i / this.tentacleCount) * Math.PI * 0.8 + Math.PI * 0.6;
            const wave = Math.sin(t * 2.5 + i * 1.5) * 0.4;
            const len1 = r * 1.2;
            const len2 = r * (1.8 + 0.3 * Math.sin(t * 1.5 + i));
            const mx = Math.cos(tentAngle + wave * 0.5) * len1;
            const my = Math.sin(tentAngle + wave * 0.5) * len1;
            const ex = Math.cos(tentAngle + wave) * len2;
            const ey = Math.sin(tentAngle + wave) * len2;

            ctx.strokeStyle = `hsla(${this.hue}, 70%, 60%, ${0.4 + 0.2 * pulse})`;
            ctx.lineWidth = 1.5 - i * 0.1;
            ctx.beginPath();
            ctx.moveTo(Math.cos(tentAngle) * r * 0.4, Math.sin(tentAngle) * r * 0.4);
            ctx.quadraticCurveTo(mx, my, ex, ey);
            ctx.stroke();
        }

        // Bell/dome — translucent
        const bellGrad = ctx.createRadialGradient(0, -r * 0.1, 0, 0, 0, r * 0.6);
        bellGrad.addColorStop(0, `hsla(${this.hue}, 80%, 80%, ${0.6 + 0.2 * pulse})`);
        bellGrad.addColorStop(0.6, `hsla(${this.hue}, 60%, 50%, 0.4)`);
        bellGrad.addColorStop(1, `hsla(${this.hue}, 50%, 30%, 0.15)`);
        ctx.fillStyle = bellGrad;
        ctx.shadowColor = `hsl(${this.hue}, 80%, 60%)`;
        ctx.shadowBlur = 8 * pulse;

        // Bell shape — dome on top, flat-ish bottom
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.55, Math.PI, 0);
        ctx.quadraticCurveTo(r * 0.55, r * 0.2, r * 0.3, r * 0.25);
        ctx.lineTo(-r * 0.3, r * 0.25);
        ctx.quadraticCurveTo(-r * 0.55, r * 0.2, -r * 0.55, 0);
        ctx.fill();

        // Inner glow pattern
        ctx.fillStyle = `hsla(${this.hue + 30}, 100%, 70%, ${0.3 * pulse})`;
        ctx.beginPath();
        ctx.arc(0, -r * 0.1, r * 0.15, 0, Math.PI * 2);
        ctx.fill();

        // Proximity warning — subtle glow when player is near
        ctx.strokeStyle = `hsla(${this.hue}, 80%, 70%, ${pulse * 0.2})`;
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }
}

// ============================================================
// StealthFighter (Space Chameleon) — Color-shifting lizard alien
// ============================================================
class StealthFighter extends Enemy {
    constructor(canvasW, canvasH) {
        super();
        this.type = 'stealth';
        this.radius = 14 * GAME_SCALE;
        this.hp = 2;
        this.maxHp = 2;
        this.points = 40;

        this.x = canvasW + this.radius + Utils.random(10, 60);
        this.y = Utils.random(this.radius + 40, canvasH - this.radius - 40);
        this.vx = Utils.random(-220, -140);

        // Zigzag
        this.zigTimer = 0;
        this.zigInterval = Utils.random(0.6, 1.2);
        this.zigDir = Math.random() > 0.5 ? 1 : -1;
        this.zigSpeed = Utils.random(120, 200);
        this.canvasH = canvasH;

        // Stealth cloak — color shifting
        this.time = 0;
        this.cloakCycle = Utils.random(2, 4);
        this.hueShift = Utils.random(0, 360);
        this.active = true;
    }

    update(dt) {
        this.time += dt;
        this.x += this.vx * dt;
        this.hueShift += dt * 60; // color shifts over time

        // Zigzag
        this.zigTimer += dt;
        if (this.zigTimer >= this.zigInterval) {
            this.zigTimer = 0;
            this.zigDir *= -1;
        }
        this.y += this.zigDir * this.zigSpeed * dt;
        this.y = Utils.clamp(this.y, this.radius + 10, this.canvasH - this.radius - 10);
    }

    getAlpha() {
        const t = (this.time % this.cloakCycle) / this.cloakCycle;
        const wave = Math.sin(t * Math.PI * 2);
        return wave > 0.3 ? 0.15 + 0.85 * ((wave - 0.3) / 0.7) : 0.15;
    }

    draw(ctx) {
        if (!this.active) return;
        const r = this.radius;
        const t = this.time;
        const alpha = this.getAlpha();
        const hue = this.hueShift % 360;
        const bodyColor = `hsla(${hue}, 60%, 35%, ${alpha})`;
        const spotColor = `hsla(${(hue + 120) % 360}, 80%, 50%, ${alpha * 0.6})`;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Curled tail
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        const tailCurl = Math.sin(t * 3) * 0.3;
        ctx.beginPath();
        ctx.moveTo(r * 0.4, 0);
        ctx.quadraticCurveTo(r * 0.9, r * 0.2, r * 1.1, -r * 0.1 + tailCurl * r);
        ctx.quadraticCurveTo(r * 1.2, -r * 0.4 + tailCurl * r, r * 1.0, -r * 0.5 + tailCurl * r);
        ctx.stroke();

        // Body — lizard shape
        const bodyGrad = ctx.createRadialGradient(-r * 0.1, 0, 0, 0, 0, r * 0.6);
        bodyGrad.addColorStop(0, `hsla(${hue}, 50%, 45%, ${alpha})`);
        bodyGrad.addColorStop(1, `hsla(${hue}, 60%, 20%, ${alpha})`);
        ctx.fillStyle = bodyGrad;
        ctx.shadowColor = `hsl(${hue}, 70%, 50%)`;
        ctx.shadowBlur = 4 * alpha;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.6, r * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();

        // Head
        ctx.fillStyle = `hsla(${hue}, 55%, 40%, ${alpha})`;
        ctx.beginPath();
        ctx.ellipse(-r * 0.5, 0, r * 0.35, r * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();

        // Snout
        ctx.beginPath();
        ctx.ellipse(-r * 0.75, 0, r * 0.15, r * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Color-shift spots on body
        ctx.fillStyle = spotColor;
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(r * 0.1, -r * 0.1, r * 0.07, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-r * 0.1, r * 0.12, r * 0.06, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.25, r * 0.05, r * 0.05, 0, Math.PI * 2); ctx.fill();

        // Legs — stubby, lizard-like
        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = 2;
        const legWave = Math.sin(t * 8) * 0.2;
        // Front legs
        ctx.beginPath(); ctx.moveTo(-r * 0.3, -r * 0.3); ctx.lineTo(-r * 0.5, -r * 0.6 - legWave * r); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-r * 0.3, r * 0.3); ctx.lineTo(-r * 0.5, r * 0.6 + legWave * r); ctx.stroke();
        // Back legs
        ctx.beginPath(); ctx.moveTo(r * 0.2, -r * 0.3); ctx.lineTo(r * 0.4, -r * 0.6 + legWave * r); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r * 0.2, r * 0.3); ctx.lineTo(r * 0.4, r * 0.6 - legWave * r); ctx.stroke();

        // Eye — large, rotating independently
        const eyeAngle = Math.sin(t * 2) * 0.5;
        ctx.fillStyle = `hsla(55, 100%, 60%, ${alpha})`;
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 5 * alpha;
        ctx.beginPath();
        ctx.arc(-r * 0.55, -r * 0.12, r * 0.1, 0, Math.PI * 2);
        ctx.fill();
        // Pupil — slit
        ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
        ctx.shadowBlur = 0;
        ctx.save();
        ctx.translate(-r * 0.55, -r * 0.12);
        ctx.rotate(eyeAngle);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.02, r * 0.07, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.globalAlpha = 1;

        // Health bar (always fully visible)
        if (this.hp < this.maxHp) {
            const barW = r * 1.5;
            const barH = 3;
            const frac = this.hp / this.maxHp;
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#333';
            ctx.fillRect(-barW / 2, -r - 8, barW, barH);
            ctx.fillStyle = frac > 0.5 ? '#00ff66' : '#ff3366';
            ctx.fillRect(-barW / 2, -r - 8, barW * frac, barH);
        }

        ctx.restore();
    }
}

// ============================================================
// SpiderDrone — Creepy multi-legged alien, crawls across screen
// ============================================================
class SpiderDrone extends Enemy {
    constructor(canvasW, canvasH) {
        super();
        this.type = 'spider';
        this.radius = 16 * GAME_SCALE;
        this.hp = 3;
        this.maxHp = 3;
        this.points = 45;

        this.x = canvasW + this.radius + Utils.random(10, 60);
        this.y = Utils.random(this.radius + 50, canvasH - this.radius - 50);
        this.vx = Utils.random(-100, -55);
        this.vy = 0;
        this.canvas_w = canvasW;

        // Erratic crawl movement
        this.crawlTimer = 0;
        this.crawlInterval = Utils.random(0.4, 0.8);
        this.crawlDir = Math.random() > 0.5 ? 1 : -1;
        this.crawlSpeed = Utils.random(80, 160);
        this.canvasH = canvasH;

        // Web shooting
        this.shootTimer = Utils.random(1, 2.5);
        this.shootInterval = Utils.random(2, 3.5);

        // Leg animation
        this.time = 0;
        this.legCount = 4; // per side
        this.legPhaseOffset = Utils.random(0, Math.PI * 2);

        // Eye glow
        this.eyePulse = 0;
        this.active = true;
    }

    update(dt, playerY, projectilePool, audio) {
        this.time += dt;
        this.eyePulse += dt;
        this.x += this.vx * dt;

        // Erratic vertical crawl
        this.crawlTimer += dt;
        if (this.crawlTimer >= this.crawlInterval) {
            this.crawlTimer = 0;
            this.crawlDir = Math.random() > 0.5 ? 1 : -1;
            this.crawlInterval = Utils.random(0.3, 0.7);
        }
        this.y += this.crawlDir * this.crawlSpeed * dt;
        this.y = Utils.clamp(this.y, this.radius + 10, this.canvasH - this.radius - 10);

        // Shoot webs
        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && this.x < this.canvas_w - 50) {
            this.shootTimer = this.shootInterval;
            this.shootWeb(projectilePool, audio);
        }
    }

    shootWeb(projectilePool, audio) {
        // Fire a spread of 2 slow-moving "web" projectiles
        const speed = 180;
        const spread = Utils.random(0.15, 0.35);
        for (let i = -1; i <= 1; i += 2) {
            const p = projectilePool.get();
            if (p) {
                p.init(this.x - this.radius, this.y,
                    -speed, i * speed * spread,
                    '#44ff22', '#66ff44', true);
            }
        }
        if (audio) audio.playEnemyLaser();
    }

    draw(ctx) {
        if (!this.active) return;
        const r = this.radius;
        const t = this.time;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Legs — 4 per side, animated with alternating gait
        ctx.strokeStyle = '#66aa33';
        ctx.shadowColor = '#44ff22';
        ctx.shadowBlur = 3;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';

        for (let side = -1; side <= 1; side += 2) {
            for (let i = 0; i < this.legCount; i++) {
                const phase = this.legPhaseOffset + i * 0.8 + (side > 0 ? Math.PI : 0);
                const legWave = Math.sin(t * 8 + phase) * 0.3;

                // Leg joint positions
                const baseAngle = (side * 0.6) + (i - 1.5) * 0.35;
                const jointX1 = Math.cos(baseAngle + legWave) * r * 0.7;
                const jointY1 = Math.sin(baseAngle + legWave) * r * 0.7 * side;
                const tipAngle = baseAngle + legWave * 1.5 + side * 0.4;
                const tipX = Math.cos(tipAngle) * r * 1.4;
                const tipY = Math.sin(tipAngle) * r * 1.1 * side;

                ctx.beginPath();
                ctx.moveTo(0, side * r * 0.15);
                ctx.lineTo(jointX1, jointY1);
                ctx.lineTo(tipX, tipY);
                ctx.stroke();
            }
        }

        // Body — bulbous abdomen + thorax
        ctx.shadowBlur = 0;

        // Abdomen (rear, larger)
        const abdGrad = ctx.createRadialGradient(r * 0.15, 0, 0, r * 0.15, 0, r * 0.55);
        abdGrad.addColorStop(0, '#445522');
        abdGrad.addColorStop(0.6, '#2a3311');
        abdGrad.addColorStop(1, '#111800');
        ctx.fillStyle = abdGrad;
        ctx.beginPath();
        ctx.ellipse(r * 0.15, 0, r * 0.55, r * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Abdomen markings — toxic pattern
        ctx.fillStyle = 'rgba(120, 200, 50, 0.3)';
        ctx.beginPath();
        ctx.ellipse(r * 0.25, 0, r * 0.15, r * 0.2, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(r * 0.05, -r * 0.1, r * 0.08, r * 0.1, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Thorax (front, smaller)
        const thorGrad = ctx.createRadialGradient(-r * 0.35, 0, 0, -r * 0.35, 0, r * 0.35);
        thorGrad.addColorStop(0, '#3a4a1a');
        thorGrad.addColorStop(1, '#1a2208');
        ctx.fillStyle = thorGrad;
        ctx.beginPath();
        ctx.ellipse(-r * 0.35, 0, r * 0.35, r * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes — multiple, glowing red
        const eyeGlow = 0.6 + 0.4 * Math.sin(this.eyePulse * 5);
        ctx.fillStyle = `rgba(255, 20, 20, ${eyeGlow})`;
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 6 * eyeGlow;

        // Main eyes (2 large)
        ctx.beginPath();
        ctx.arc(-r * 0.55, -r * 0.1, r * 0.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-r * 0.55, r * 0.1, r * 0.08, 0, Math.PI * 2);
        ctx.fill();

        // Secondary eyes (4 smaller)
        ctx.fillStyle = `rgba(255, 80, 20, ${eyeGlow * 0.7})`;
        ctx.shadowBlur = 3 * eyeGlow;
        const smallEyes = [
            [-r * 0.6, -r * 0.2], [-r * 0.6, r * 0.2],
            [-r * 0.48, -r * 0.18], [-r * 0.48, r * 0.18]
        ];
        for (const [ex, ey] of smallEyes) {
            ctx.beginPath();
            ctx.arc(ex, ey, r * 0.04, 0, Math.PI * 2);
            ctx.fill();
        }

        // Mandibles — small pincers
        ctx.strokeStyle = '#88aa44';
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1.5;
        const mandibleWave = Math.sin(t * 6) * 0.15;
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, -r * 0.05);
        ctx.quadraticCurveTo(-r * 0.75, -r * 0.15 - mandibleWave * r, -r * 0.7, -r * 0.25);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, r * 0.05);
        ctx.quadraticCurveTo(-r * 0.75, r * 0.15 + mandibleWave * r, -r * 0.7, r * 0.25);
        ctx.stroke();

        // Health bar
        if (this.hp < this.maxHp) {
            const barW = r * 1.5;
            const barH = 3;
            const frac = this.hp / this.maxHp;
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#333';
            ctx.fillRect(-barW / 2, -r - 10, barW, barH);
            ctx.fillStyle = frac > 0.5 ? '#00ff66' : '#ff3366';
            ctx.fillRect(-barW / 2, -r - 10, barW * frac, barH);
        }

        ctx.restore();
    }
}

// ============================================================
// AlienGhost — Translucent, drifts through space, teleports
// ============================================================
class AlienGhost extends Enemy {
    constructor(canvasW, canvasH) {
        super();
        this.type = 'ghost';
        this.radius = 14 * GAME_SCALE;
        this.hp = 2;
        this.maxHp = 2;
        this.points = 35;

        this.x = canvasW + this.radius + Utils.random(10, 60);
        this.y = Utils.random(this.radius + 40, canvasH - this.radius - 40);
        this.vx = Utils.random(-90, -40);
        this.vy = 0;
        this.canvasH = canvasH;

        // Float movement
        this.time = 0;
        this.floatFreq = Utils.random(1, 2.5);
        this.floatAmp = Utils.random(40, 80);
        this.baseY = this.y;

        // Teleport
        this.teleportTimer = Utils.random(2, 4);
        this.teleportInterval = Utils.random(2.5, 4.5);
        this.teleportFlash = 0;

        this.active = true;
    }

    update(dt) {
        this.time += dt;
        this.x += this.vx * dt;
        this.y = this.baseY + Math.sin(this.time * this.floatFreq) * this.floatAmp;

        // Teleport cooldown
        if (this.teleportFlash > 0) this.teleportFlash -= dt;
        this.teleportTimer -= dt;
        if (this.teleportTimer <= 0) {
            this.teleportTimer = this.teleportInterval;
            this.teleportFlash = 0.3;
            // Teleport to a random Y
            this.baseY = Utils.random(this.radius + 40, this.canvasH - this.radius - 40);
        }
    }

    draw(ctx) {
        if (!this.active) return;
        const r = this.radius;
        const t = this.time;

        // Teleport flash
        if (this.teleportFlash > 0) {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.fillStyle = `rgba(180, 100, 255, ${this.teleportFlash})`;
            ctx.shadowColor = '#bb66ff';
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(0, 0, r * 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        ctx.save();
        ctx.translate(this.x, this.y);

        // Ghostly transparency oscillation
        const alphaBase = 0.3 + 0.3 * Math.sin(t * 2);

        // Wispy tail
        ctx.globalAlpha = alphaBase * 0.5;
        ctx.fillStyle = '#8844cc';
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            const tailX = r * 0.3 + i * r * 0.25;
            const tailY = Math.sin(t * 3 + i) * r * 0.3;
            const tailLen = r * (0.5 + 0.2 * Math.sin(t * 2 + i));
            ctx.moveTo(tailX, tailY - r * 0.1);
            ctx.quadraticCurveTo(tailX + tailLen * 0.5, tailY + r * 0.1, tailX + tailLen, tailY + r * 0.3);
            ctx.quadraticCurveTo(tailX + tailLen * 0.5, tailY - r * 0.1, tailX, tailY + r * 0.1);
        }
        ctx.fill();

        // Main body — rounded blob shape
        ctx.globalAlpha = alphaBase;
        const bodyGrad = ctx.createRadialGradient(-r * 0.1, -r * 0.1, 0, 0, 0, r);
        bodyGrad.addColorStop(0, 'rgba(200, 150, 255, 0.8)');
        bodyGrad.addColorStop(0.5, 'rgba(130, 80, 200, 0.5)');
        bodyGrad.addColorStop(1, 'rgba(80, 40, 150, 0.1)');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.arc(0, -r * 0.1, r * 0.8, Math.PI, 0);
        ctx.quadraticCurveTo(r * 0.8, r * 0.5, r * 0.3, r * 0.6);
        ctx.quadraticCurveTo(0, r * 0.8, -r * 0.3, r * 0.6);
        ctx.quadraticCurveTo(-r * 0.8, r * 0.5, -r * 0.8, 0);
        ctx.fill();

        // Eyes — hollow, menacing
        ctx.globalAlpha = alphaBase + 0.3;
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#cc88ff';
        ctx.shadowBlur = 8;
        // Left eye
        ctx.beginPath();
        ctx.ellipse(-r * 0.25, -r * 0.15, r * 0.15, r * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Right eye
        ctx.beginPath();
        ctx.ellipse(r * 0.15, -r * 0.15, r * 0.15, r * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Dark pupils
        ctx.fillStyle = '#220044';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.ellipse(-r * 0.25, -r * 0.1, r * 0.07, r * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(r * 0.15, -r * 0.1, r * 0.07, r * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();

        // Mouth — eerie grin
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, r * 0.1, r * 0.25, 0.2, Math.PI - 0.2);
        ctx.stroke();

        ctx.globalAlpha = 1;

        // Health bar
        if (this.hp < this.maxHp) {
            const barW = r * 1.5;
            const barH = 3;
            const frac = this.hp / this.maxHp;
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#333';
            ctx.fillRect(-barW / 2, -r - 10, barW, barH);
            ctx.fillStyle = frac > 0.5 ? '#00ff66' : '#ff3366';
            ctx.fillRect(-barW / 2, -r - 10, barW * frac, barH);
        }

        ctx.restore();
    }
}

// ============================================================
// AlienDevil — Fiery, aggressive, charges at player
// ============================================================
class AlienDevil extends Enemy {
    constructor(canvasW, canvasH) {
        super();
        this.type = 'devil';
        this.radius = 18 * GAME_SCALE;
        this.hp = 4;
        this.maxHp = 4;
        this.points = 55;

        this.x = canvasW + this.radius + Utils.random(10, 60);
        this.y = Utils.random(this.radius + 50, canvasH - this.radius - 50);
        this.vx = Utils.random(-80, -40);
        this.vy = 0;
        this.canvasH = canvasH;
        this.canvas_w = canvasW;

        // Charge attack
        this.chargeTimer = Utils.random(1.5, 3);
        this.chargeInterval = Utils.random(2.5, 4);
        this.charging = false;
        this.chargeSpeed = 0;
        this.normalVx = this.vx;

        // Shoot fireballs
        this.shootTimer = Utils.random(1, 2);
        this.shootInterval = Utils.random(1.5, 2.5);

        // Visual
        this.time = 0;
        this.active = true;
    }

    update(dt, playerY, projectilePool, audio) {
        this.time += dt;

        if (this.charging) {
            this.x += this.chargeSpeed * dt;
            // Charging lasts briefly then returns to normal
            this.chargeSpeed *= 0.98;
            if (Math.abs(this.chargeSpeed) < 50) {
                this.charging = false;
                this.vx = this.normalVx;
            }
        } else {
            this.x += this.vx * dt;

            // Drift toward player Y aggressively
            if (playerY !== undefined) {
                const diff = playerY - this.y;
                this.vy = Utils.clamp(diff, -1, 1) * 120;
                this.y += this.vy * dt;
                this.y = Utils.clamp(this.y, this.radius + 10, this.canvasH - this.radius - 10);
            }

            // Charge attack
            this.chargeTimer -= dt;
            if (this.chargeTimer <= 0 && this.x < this.canvas_w - 100) {
                this.chargeTimer = this.chargeInterval;
                this.charging = true;
                this.chargeSpeed = -400; // fast burst toward player
            }
        }

        // Shoot fireballs
        this.shootTimer -= dt;
        if (this.shootTimer <= 0 && this.x < this.canvas_w - 50) {
            this.shootTimer = this.shootInterval;
            const p = projectilePool.get();
            if (p) {
                p.init(this.x - this.radius, this.y,
                    -280, Utils.random(-60, 60),
                    '#ff4400', '#ff6600', true);
            }
            if (audio) audio.playEnemyLaser();
        }
    }

    draw(ctx) {
        if (!this.active) return;
        const r = this.radius;
        const t = this.time;
        const fireFlicker = 0.7 + 0.3 * Math.sin(t * 12);

        ctx.save();
        ctx.translate(this.x, this.y);

        // Fiery aura
        ctx.fillStyle = `rgba(255, 60, 0, ${0.15 * fireFlicker})`;
        ctx.shadowColor = '#ff4400';
        ctx.shadowBlur = 15 * fireFlicker;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Horns
        ctx.strokeStyle = '#cc2200';
        ctx.fillStyle = '#aa1100';
        ctx.shadowBlur = 4;
        ctx.lineWidth = 2;
        // Left horn
        ctx.beginPath();
        ctx.moveTo(-r * 0.3, -r * 0.5);
        ctx.quadraticCurveTo(-r * 0.6, -r * 1.3, -r * 0.15, -r * 1.1);
        ctx.lineTo(-r * 0.2, -r * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Right horn
        ctx.beginPath();
        ctx.moveTo(r * 0.3, -r * 0.5);
        ctx.quadraticCurveTo(r * 0.6, -r * 1.3, r * 0.15, -r * 1.1);
        ctx.lineTo(r * 0.2, -r * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Head body — dark red
        const headGrad = ctx.createRadialGradient(-r * 0.1, -r * 0.1, 0, 0, 0, r * 0.8);
        headGrad.addColorStop(0, '#881100');
        headGrad.addColorStop(0.7, '#550808');
        headGrad.addColorStop(1, '#220000');
        ctx.fillStyle = headGrad;
        ctx.shadowColor = '#ff2200';
        ctx.shadowBlur = 6 * fireFlicker;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
        ctx.fill();

        // Glowing eyes — menacing yellow-red
        const eyeGlow = 0.7 + 0.3 * Math.sin(t * 6);
        ctx.fillStyle = `rgba(255, 200, 0, ${eyeGlow})`;
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 10 * eyeGlow;
        // Slanted evil eyes
        ctx.save();
        ctx.translate(-r * 0.25, -r * 0.15);
        ctx.rotate(-0.2);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.15, r * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.translate(r * 0.2, -r * 0.15);
        ctx.rotate(0.2);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.15, r * 0.08, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Mouth — jagged evil grin
        ctx.strokeStyle = `rgba(255, 100, 0, ${0.6 + 0.4 * fireFlicker})`;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 3;
        ctx.beginPath();
        ctx.moveTo(-r * 0.35, r * 0.2);
        for (let i = 0; i < 5; i++) {
            const mx = -r * 0.35 + (i + 0.5) * (r * 0.7 / 5);
            const my = r * 0.2 + (i % 2 === 0 ? r * 0.15 : 0);
            ctx.lineTo(mx, my);
        }
        ctx.lineTo(r * 0.35, r * 0.2);
        ctx.stroke();

        // Flame trail when charging
        if (this.charging) {
            ctx.fillStyle = `rgba(255, 80, 0, ${0.5 * fireFlicker})`;
            ctx.shadowColor = '#ff4400';
            ctx.shadowBlur = 12;
            ctx.beginPath();
            ctx.moveTo(r * 0.6, -r * 0.2);
            ctx.lineTo(r * 1.5 + Math.random() * r * 0.5, 0);
            ctx.lineTo(r * 0.6, r * 0.2);
            ctx.closePath();
            ctx.fill();
        }

        // Health bar
        if (this.hp < this.maxHp) {
            const barW = r * 1.5;
            const barH = 3;
            const frac = this.hp / this.maxHp;
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#333';
            ctx.fillRect(-barW / 2, -r * 1.2 - 10, barW, barH);
            ctx.fillStyle = frac > 0.5 ? '#00ff66' : '#ff3366';
            ctx.fillRect(-barW / 2, -r * 1.2 - 10, barW * frac, barH);
        }

        ctx.restore();
    }
}

// ============================================================
// Boss — Large, multi-phase boss with cycling attack patterns
// ============================================================
class Boss extends Enemy {
    constructor(canvasW, canvasH, bossType = 0, assets = {}) {
        super();
        this.type = 'boss';
        this.assets = assets;
        this.bossType = Utils.clamp(bossType, 0, 9);
        this.radius = (30 + this.bossType * 2) * GAME_SCALE;

        // HP scales gently: easy bosses (8-18), medium (24-36), hard (44-60)
        // Base HP scales with boss type; effective HP stays reasonable
        // because it's measured in "seconds to kill" not raw HP
        const hpTable = [10, 14, 18, 22, 28, 34, 40, 48, 56, 65];
        this.hp = hpTable[this.bossType] || 10;
        this.maxHp = this.hp;
        this.points = 200 + this.bossType * 150;

        // Spawn from right, move to x = canvasW * 0.75 then stop
        this.x = canvasW + this.radius + 60;
        this.y = canvasH / 2;
        this.vx = -120;
        this.vy = 0;
        this.canvas_w = canvasW;
        this.canvasH = canvasH;
        this.stopX = canvasW * 0.75;
        this.arrived = false;

        // Attack patterns scale with boss type
        // Easy bosses: only 1-2 patterns, slow cycle
        // Hard bosses: all 3 patterns, fast cycle
        this.patternIndex = 0;
        this.patternTimer = 0;
        if (this.bossType <= 2) {
            this.patternInterval = 3.5; // slow attacks
            this.maxPatterns = 1;       // aimed only
        } else if (this.bossType <= 5) {
            this.patternInterval = 3.0;
            this.maxPatterns = 2;       // aimed + barrage
        } else {
            this.patternInterval = 2.2;
            this.maxPatterns = 3;       // all patterns
        }
        this.spiralAngle = 0;

        // Bullet speed scales with boss type
        this.bulletSpeedMul = 0.6 + this.bossType * 0.05; // 0.6x to 1.05x

        // Visual timers
        this.time = 0;
        this.corePhase = 0;
        this.shieldRotation = 0;

        // Boss theme colors indexed by bossType 0-9
        this.themeColors = [
            '#aa7733', // bronze (asteroid boss)
            '#ff6644', // orange-red (scout boss)
            '#44ff66', // green (drone boss)
            '#ff4444', // red (mine boss)
            '#66ff22', // lime (spider boss)
            '#bb66ff', // purple (ghost boss)
            '#aa55ff', // violet (bomber boss)
            '#00cccc', // cyan (stealth boss)
            '#ff4400', // fire (devil boss)
            '#ff3366'  // magenta (chaos boss)
        ];
        this.color = this.themeColors[this.bossType] || '#ffffff';

        this.active = true;
    }

    update(dt, playerY, projectilePool, audio) {
        this.time += dt;
        this.corePhase += dt * 4;
        this.shieldRotation += dt * 1.2;

        // Move toward stop position, then hover in place
        if (!this.arrived) {
            this.x += this.vx * dt;
            if (this.x <= this.stopX) {
                this.x = this.stopX;
                this.arrived = true;
            }
        } else {
            // Gentle vertical drift while fighting
            this.y += Math.sin(this.time * 0.8) * 40 * dt;
            this.y = Utils.clamp(this.y, this.radius + 20, this.canvasH - this.radius - 20);
        }

        // Cycle attack patterns once arrived
        if (this.arrived) {
            this.patternTimer += dt;
            if (this.patternTimer >= this.patternInterval) {
                this.patternTimer = 0;
                this.patternIndex = (this.patternIndex + 1) % this.maxPatterns;
            }

            // Fire based on current pattern
            if (this.patternTimer < dt * 1.5) {
                switch (this.patternIndex) {
                    case 0:
                        this.fireAimed(playerY, projectilePool, audio);
                        break;
                    case 1:
                        this.fireBarrage(projectilePool, audio);
                        break;
                    case 2:
                        this.fireSpiral(projectilePool, audio);
                        break;
                }
                // Late bosses: fire a bonus wall pattern
                if (this.bossType >= 7) {
                    this.fireWall(projectilePool, audio);
                }
            }
        }

        // Advance spiral angle over time for rotation effect
        this.spiralAngle += dt * 2;
    }

    fireAimed(playerY, projectilePool, audio) {
        const speed = 400 * this.bulletSpeedMul;
        // Easy bosses fire 1-2 projectiles, hard bosses fire 3
        const count = this.bossType <= 2 ? 1 : this.bossType <= 5 ? 2 : 3;
        const spread = count === 1 ? [0] : count === 2 ? [-1, 1] : [-1, 0, 1];
        for (const i of spread) {
            const p = projectilePool.get();
            if (p) {
                const dy = (playerY !== undefined && playerY !== null)
                    ? (playerY - this.y) + i * 30
                    : i * 40;
                p.init(this.x - this.radius, this.y + i * 12,
                    -speed, dy * 0.8,
                    this.color, '#ff4444', true);
            }
        }
        if (audio) audio.playEnemyLaser();
    }

    fireSpiral(projectilePool, audio) {
        // Only used by hard bosses (type 6+) — rotating ring
        const count = 4 + this.bossType; // 10-13 for hard bosses
        const speed = 250 * this.bulletSpeedMul;
        for (let i = 0; i < count; i++) {
            const angle = this.spiralAngle + (i / count) * Math.PI * 2;
            const p = projectilePool.get();
            if (p) {
                p.init(this.x, this.y,
                    Math.cos(angle) * speed, Math.sin(angle) * speed,
                    this.color, '#ffaa00', true);
            }
        }
        if (audio) audio.playEnemyLaser();
    }

    fireBarrage(projectilePool, audio) {
        const speed = 320 * this.bulletSpeedMul;
        // Easy/medium bosses fire 2-3, hard bosses fire 5
        const count = this.bossType <= 3 ? 2 : this.bossType <= 6 ? 3 : 5;
        const spreadAngle = 0.5;
        for (let i = 0; i < count; i++) {
            const center = (count - 1) / 2;
            const angle = Math.PI + (i - center) * (spreadAngle / Math.max(count - 1, 1));
            const p = projectilePool.get();
            if (p) {
                p.init(this.x - this.radius, this.y,
                    Math.cos(angle) * speed, Math.sin(angle) * speed,
                    this.color, '#ff6666', true);
            }
        }
        if (audio) audio.playEnemyLaser();
    }

    fireWall(projectilePool, audio) {
        // Wall of bullets with a gap for the player to dodge through
        const speed = 200 * this.bulletSpeedMul;
        const gap = Utils.random(0.2, 0.8);
        const rows = 12;
        for (let i = 0; i < rows; i++) {
            const frac = i / (rows - 1);
            if (Math.abs(frac - gap) < 0.15) continue;
            const p = projectilePool.get();
            if (p) {
                const yPos = this.canvasH * frac;
                p.init(this.x - this.radius, yPos,
                    -speed, 0, this.color, '#ff4444', true);
            }
        }
        if (audio) audio.playEnemyLaser();
    }

    draw(ctx) {
        if (!this.active) return;
        const r = this.radius;
        const t = this.time;
        const color = this.color;
        const pulse = 0.6 + 0.4 * Math.sin(this.corePhase);

        ctx.save();
        ctx.translate(this.x, this.y);

        // Dispatch to themed boss drawing (all canvas-animated)
        const drawMethods = {
            0: '_drawCritterBoss',
            1: '_drawFireflyBoss',
            2: '_drawJellyfishBoss',
            3: '_drawSpiderBoss',
            4: '_drawGhostBoss',
            5: '_drawOctopusBoss',
            6: '_drawChameleonBoss',
        };
        const method = drawMethods[this.bossType] || (this.bossType >= 7 ? '_drawDevilBoss' : '_drawDefaultBoss');
        this[method](ctx, r, t, color, pulse);

        this._drawBossHealthBar(ctx, r);
        ctx.restore();
    }

    _drawBossHealthBar(ctx, r) {
        const barW = r * 2.2;
        const barH = 5;
        const frac = this.hp / this.maxHp;
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(-barW / 2, -r - 18, barW, barH);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-barW / 2, -r - 18, barW, barH);
        let barColor;
        if (frac > 0.6) barColor = '#00ff66';
        else if (frac > 0.3) barColor = '#ffaa00';
        else barColor = '#ff3366';
        ctx.fillStyle = barColor;
        ctx.fillRect(-barW / 2, -r - 18, barW * frac, barH);
    }

    _drawCritterBoss(ctx, r, t, color, pulse) {
        // Giant armored bug — antennae, mandibles, segmented shell, legs

        // Legs — 4 per side, scuttling
        ctx.strokeStyle = '#884422';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        for (let side = -1; side <= 1; side += 2) {
            for (let i = 0; i < 4; i++) {
                const phase = i * 1.0 + (side > 0 ? Math.PI * 0.4 : 0);
                const wave = Math.sin(t * 6 + phase) * 0.2;
                const baseAngle = side * 0.45 + (i - 1.5) * 0.35;
                const jx = Math.cos(baseAngle + wave) * r * 0.7;
                const jy = Math.sin(baseAngle + wave) * r * 0.65 * side;
                const tx = Math.cos(baseAngle + wave + side * 0.3) * r * 1.2;
                const ty = Math.sin(baseAngle + wave + side * 0.3) * r * 1.0 * side;
                ctx.beginPath();
                ctx.moveTo(0, side * r * 0.12);
                ctx.lineTo(jx, jy);
                ctx.lineTo(tx, ty);
                ctx.stroke();
            }
        }

        // Antennae
        ctx.strokeStyle = '#cc6633';
        ctx.lineWidth = 2;
        const antWave = Math.sin(t * 3) * 0.25;
        ctx.beginPath();
        ctx.moveTo(-r * 0.45, -r * 0.15);
        ctx.quadraticCurveTo(-r * 0.9, -r * 0.7 - antWave * r, -r, -r * 0.55);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.45, r * 0.15);
        ctx.quadraticCurveTo(-r * 0.9, r * 0.7 + antWave * r, -r, r * 0.55);
        ctx.stroke();
        // Tips
        ctx.fillStyle = '#ffaa00';
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 5;
        ctx.beginPath(); ctx.arc(-r, -r * 0.55, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-r, r * 0.55, 3, 0, Math.PI * 2); ctx.fill();

        // Abdomen — segmented shell
        ctx.shadowBlur = 0;
        const abdGrad = ctx.createRadialGradient(r * 0.15, 0, 0, r * 0.15, 0, r * 0.55);
        abdGrad.addColorStop(0, '#cc6633');
        abdGrad.addColorStop(0.6, '#884420');
        abdGrad.addColorStop(1, '#442210');
        ctx.fillStyle = abdGrad;
        ctx.beginPath();
        ctx.ellipse(r * 0.15, 0, r * 0.55, r * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        // Shell segments
        ctx.strokeStyle = 'rgba(50, 20, 10, 0.6)';
        ctx.lineWidth = 1.5;
        for (let s = -2; s <= 2; s++) {
            const sx = r * 0.15 + s * r * 0.12;
            ctx.beginPath();
            ctx.moveTo(sx, -r * 0.38);
            ctx.lineTo(sx, r * 0.38);
            ctx.stroke();
        }
        // Shell pattern spots
        ctx.fillStyle = `rgba(255, 180, 60, ${0.3 + 0.15 * pulse})`;
        ctx.beginPath(); ctx.ellipse(r * 0.25, -r * 0.1, r * 0.08, r * 0.06, 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(r * 0.05, r * 0.12, r * 0.07, r * 0.05, -0.3, 0, Math.PI * 2); ctx.fill();

        // Head
        const headGrad = ctx.createRadialGradient(-r * 0.35, 0, 0, -r * 0.35, 0, r * 0.38);
        headGrad.addColorStop(0, '#dd7744');
        headGrad.addColorStop(1, '#663318');
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.ellipse(-r * 0.35, 0, r * 0.38, r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes — large, glowing yellow
        const eyePulse = 0.7 + 0.3 * Math.sin(t * 5);
        ctx.fillStyle = `rgba(255, 220, 0, ${eyePulse})`;
        ctx.shadowColor = '#ffdd00';
        ctx.shadowBlur = 8 * eyePulse;
        ctx.beginPath(); ctx.arc(-r * 0.5, -r * 0.13, r * 0.08, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-r * 0.5, r * 0.13, r * 0.08, 0, Math.PI * 2); ctx.fill();
        // Pupils
        ctx.fillStyle = '#331100';
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(-r * 0.52, -r * 0.13, r * 0.035, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-r * 0.52, r * 0.13, r * 0.035, 0, Math.PI * 2); ctx.fill();

        // Mandibles — pinching
        ctx.strokeStyle = '#aa5522';
        ctx.lineWidth = 3;
        const mWave = Math.sin(t * 4) * 0.12;
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, -r * 0.08);
        ctx.quadraticCurveTo(-r * 0.85, -r * 0.2 - mWave * r, -r * 0.8, -r * 0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, r * 0.08);
        ctx.quadraticCurveTo(-r * 0.85, r * 0.2 + mWave * r, -r * 0.8, r * 0.3);
        ctx.stroke();
    }

    _drawFireflyBoss(ctx, r, t, color, pulse) {
        // Giant queen firefly — pulsing bioluminescence, wings, swarm aura
        const glow = 0.5 + 0.5 * Math.sin(t * 4);

        // Aura of light
        ctx.fillStyle = `rgba(220, 255, 0, ${0.08 * glow})`;
        ctx.shadowColor = '#ddff00';
        ctx.shadowBlur = 30 * glow;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.4, 0, Math.PI * 2);
        ctx.fill();

        // Wings — large, translucent, fluttering
        const wingAngle = Math.sin(t * 12) * 0.4;
        ctx.fillStyle = `rgba(200, 255, 50, ${0.15 + 0.1 * glow})`;
        ctx.shadowBlur = 8;
        ctx.save(); ctx.rotate(-wingAngle);
        ctx.beginPath(); ctx.ellipse(0, -r * 0.3, r * 0.9, r * 0.35, -0.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.save(); ctx.rotate(wingAngle);
        ctx.beginPath(); ctx.ellipse(0, r * 0.3, r * 0.9, r * 0.35, 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // Body
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#3a3a10';
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.45, r * 0.25, 0, 0, Math.PI * 2); ctx.fill();

        // Glowing abdomen
        const abdGrad = ctx.createRadialGradient(r * 0.15, 0, 0, r * 0.15, 0, r * 0.3);
        abdGrad.addColorStop(0, `rgba(255, 255, 50, ${0.8 * glow})`);
        abdGrad.addColorStop(1, `rgba(150, 200, 0, ${0.3 * glow})`);
        ctx.fillStyle = abdGrad;
        ctx.shadowColor = '#ddff00';
        ctx.shadowBlur = 15 * glow;
        ctx.beginPath(); ctx.ellipse(r * 0.15, 0, r * 0.3, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();

        // Eyes
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.08, r * 0.06, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-r * 0.3, r * 0.08, r * 0.06, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(-r * 0.32, -r * 0.08, r * 0.03, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-r * 0.32, r * 0.08, r * 0.03, 0, Math.PI * 2); ctx.fill();
    }

    _drawJellyfishBoss(ctx, r, t, color, pulse) {
        // Giant jellyfish — dome bell, long tentacles, ethereal glow

        // Tentacles — long, flowing
        ctx.lineCap = 'round';
        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 0.9 + Math.PI * 0.55;
            const w1 = Math.sin(t * 2 + i * 0.8) * 0.3;
            const w2 = Math.sin(t * 1.5 + i * 1.2) * 0.25;
            const len1 = r * 1.3;
            const len2 = r * (2.0 + 0.3 * Math.sin(t + i));
            const mx = Math.cos(angle + w1) * len1;
            const my = Math.sin(angle + w1) * len1;
            const ex = Math.cos(angle + w1 + w2) * len2;
            const ey = Math.sin(angle + w1 + w2) * len2;
            ctx.strokeStyle = `hsla(320, 70%, 60%, ${0.4 + 0.2 * pulse})`;
            ctx.lineWidth = 3 - i * 0.2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * r * 0.4, Math.sin(angle) * r * 0.4);
            ctx.quadraticCurveTo(mx, my, ex, ey);
            ctx.stroke();
        }

        // Bell dome
        const bellGrad = ctx.createRadialGradient(0, -r * 0.1, 0, 0, 0, r * 0.6);
        bellGrad.addColorStop(0, `hsla(320, 80%, 75%, ${0.6 + 0.2 * pulse})`);
        bellGrad.addColorStop(0.5, `hsla(320, 60%, 45%, 0.4)`);
        bellGrad.addColorStop(1, `hsla(320, 50%, 25%, 0.15)`);
        ctx.fillStyle = bellGrad;
        ctx.shadowColor = '#ff66cc';
        ctx.shadowBlur = 12 * pulse;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.55, Math.PI, 0);
        ctx.quadraticCurveTo(r * 0.55, r * 0.25, r * 0.3, r * 0.3);
        ctx.lineTo(-r * 0.3, r * 0.3);
        ctx.quadraticCurveTo(-r * 0.55, r * 0.25, -r * 0.55, 0);
        ctx.fill();

        // Inner glow
        ctx.fillStyle = `hsla(330, 100%, 70%, ${0.3 * pulse})`;
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 0.15, 0, Math.PI * 2); ctx.fill();
    }

    _drawGhostBoss(ctx, r, t, color, pulse) {
        // Giant wraith — translucent, wispy, hollow eyes

        // Wispy trails
        const alphaBase = 0.3 + 0.3 * Math.sin(t * 1.5);
        ctx.globalAlpha = alphaBase * 0.4;
        ctx.fillStyle = '#8844cc';
        for (let i = 0; i < 5; i++) {
            const tx = r * 0.3 + i * r * 0.2;
            const ty = Math.sin(t * 2 + i) * r * 0.25;
            const tLen = r * (0.5 + 0.3 * Math.sin(t * 1.5 + i));
            ctx.beginPath();
            ctx.moveTo(tx, ty - r * 0.1);
            ctx.quadraticCurveTo(tx + tLen * 0.5, ty + r * 0.15, tx + tLen, ty + r * 0.3);
            ctx.quadraticCurveTo(tx + tLen * 0.5, ty - r * 0.1, tx, ty + r * 0.1);
            ctx.fill();
        }

        // Main body — ghostly blob
        ctx.globalAlpha = alphaBase;
        const bodyGrad = ctx.createRadialGradient(-r * 0.1, -r * 0.1, 0, 0, 0, r * 0.7);
        bodyGrad.addColorStop(0, 'rgba(200, 150, 255, 0.7)');
        bodyGrad.addColorStop(0.5, 'rgba(120, 70, 200, 0.4)');
        bodyGrad.addColorStop(1, 'rgba(60, 30, 120, 0.1)');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.arc(0, -r * 0.1, r * 0.65, Math.PI, 0);
        ctx.quadraticCurveTo(r * 0.65, r * 0.4, r * 0.25, r * 0.5);
        ctx.quadraticCurveTo(0, r * 0.7, -r * 0.25, r * 0.5);
        ctx.quadraticCurveTo(-r * 0.65, r * 0.4, -r * 0.65, 0);
        ctx.fill();

        // Hollow eyes
        ctx.globalAlpha = alphaBase + 0.4;
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#cc88ff';
        ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.ellipse(-r * 0.2, -r * 0.12, r * 0.13, r * 0.17, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(r * 0.12, -r * 0.12, r * 0.13, r * 0.17, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#220044';
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.ellipse(-r * 0.2, -r * 0.08, r * 0.06, r * 0.1, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(r * 0.12, -r * 0.08, r * 0.06, r * 0.1, 0, 0, Math.PI * 2); ctx.fill();

        // Eerie mouth
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, r * 0.1, r * 0.2, 0.2, Math.PI - 0.2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    _drawChameleonBoss(ctx, r, t, color, pulse) {
        // Giant chameleon — color-shifting, curled tail, rotating eyes
        const hue = (t * 40) % 360;
        const bodyColor = `hsl(${hue}, 50%, 30%)`;
        const spotColor = `hsl(${(hue + 120) % 360}, 70%, 45%)`;

        // Curled tail
        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        const tailCurl = Math.sin(t * 2) * 0.2;
        ctx.beginPath();
        ctx.moveTo(r * 0.4, 0);
        ctx.quadraticCurveTo(r * 0.9, r * 0.2, r * 1.2, -r * 0.1 + tailCurl * r);
        ctx.quadraticCurveTo(r * 1.4, -r * 0.5, r * 1.1, -r * 0.6 + tailCurl * r);
        ctx.quadraticCurveTo(r * 0.8, -r * 0.5, r * 0.9, -r * 0.3);
        ctx.stroke();

        // Legs — stubby
        ctx.lineWidth = 4;
        const legWave = Math.sin(t * 5) * 0.15;
        ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.3); ctx.lineTo(-r * 0.4, -r * 0.65 - legWave * r); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-r * 0.2, r * 0.3); ctx.lineTo(-r * 0.4, r * 0.65 + legWave * r); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r * 0.15, -r * 0.3); ctx.lineTo(r * 0.3, -r * 0.6 + legWave * r); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r * 0.15, r * 0.3); ctx.lineTo(r * 0.3, r * 0.6 - legWave * r); ctx.stroke();

        // Body
        const bGrad = ctx.createRadialGradient(-r * 0.1, 0, 0, 0, 0, r * 0.55);
        bGrad.addColorStop(0, `hsl(${hue}, 40%, 40%)`);
        bGrad.addColorStop(1, `hsl(${hue}, 50%, 18%)`);
        ctx.fillStyle = bGrad;
        ctx.shadowColor = `hsl(${hue}, 60%, 40%)`;
        ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.55, r * 0.38, 0, 0, Math.PI * 2); ctx.fill();

        // Head
        ctx.fillStyle = `hsl(${hue}, 45%, 35%)`;
        ctx.beginPath(); ctx.ellipse(-r * 0.45, 0, r * 0.3, r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-r * 0.7, 0, r * 0.15, r * 0.13, 0, 0, Math.PI * 2); ctx.fill();

        // Color spots
        ctx.fillStyle = spotColor;
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(r * 0.1, -r * 0.1, r * 0.08, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-r * 0.1, r * 0.13, r * 0.06, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.25, r * 0.05, r * 0.05, 0, Math.PI * 2); ctx.fill();

        // Eyes — large, independent rotation
        const eye1Angle = Math.sin(t * 1.5) * 0.6;
        const eye2Angle = Math.sin(t * 2.1 + 1) * 0.6;
        ctx.fillStyle = `hsl(55, 100%, 55%)`;
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(-r * 0.5, -r * 0.15, r * 0.1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(-r * 0.5, r * 0.15, r * 0.1, 0, Math.PI * 2); ctx.fill();
        // Slit pupils
        ctx.fillStyle = '#000';
        ctx.shadowBlur = 0;
        ctx.save(); ctx.translate(-r * 0.5, -r * 0.15); ctx.rotate(eye1Angle);
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.02, r * 0.07, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.save(); ctx.translate(-r * 0.5, r * 0.15); ctx.rotate(eye2Angle);
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.02, r * 0.07, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    _drawSpiderBoss(ctx, r, t, color, pulse) {
        // Giant spider boss — 6 legs per side, bulbous body, many eyes
        const legCount = 6;

        // Legs — long, animated
        ctx.strokeStyle = '#44aa11';
        ctx.shadowColor = '#66ff22';
        ctx.shadowBlur = 4;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        for (let side = -1; side <= 1; side += 2) {
            for (let i = 0; i < legCount; i++) {
                const phase = i * 0.7 + (side > 0 ? Math.PI * 0.3 : 0);
                const wave = Math.sin(t * 5 + phase) * 0.25;
                const baseAngle = side * 0.5 + (i - legCount / 2 + 0.5) * 0.3;
                const jx = Math.cos(baseAngle + wave) * r * 0.8;
                const jy = Math.sin(baseAngle + wave) * r * 0.7 * side;
                const tx = Math.cos(baseAngle + wave + side * 0.35) * r * 1.5;
                const ty = Math.sin(baseAngle + wave + side * 0.35) * r * 1.2 * side;
                ctx.beginPath();
                ctx.moveTo(0, side * r * 0.1);
                ctx.lineTo(jx, jy);
                ctx.lineTo(tx, ty);
                ctx.stroke();
            }
        }

        // Abdomen (rear, large)
        ctx.shadowBlur = 0;
        const abdGrad = ctx.createRadialGradient(r * 0.15, 0, 0, r * 0.15, 0, r * 0.6);
        abdGrad.addColorStop(0, '#3a5510');
        abdGrad.addColorStop(0.6, '#1a2a08');
        abdGrad.addColorStop(1, '#0a1000');
        ctx.fillStyle = abdGrad;
        ctx.beginPath();
        ctx.ellipse(r * 0.2, 0, r * 0.6, r * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        // Toxic markings
        ctx.fillStyle = `rgba(100, 200, 30, ${0.3 + 0.2 * pulse})`;
        ctx.beginPath(); ctx.ellipse(r * 0.3, -r * 0.1, r * 0.15, r * 0.1, 0.2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(r * 0.1, r * 0.15, r * 0.1, r * 0.08, -0.3, 0, Math.PI * 2); ctx.fill();

        // Head/thorax (front)
        const headGrad = ctx.createRadialGradient(-r * 0.35, 0, 0, -r * 0.35, 0, r * 0.4);
        headGrad.addColorStop(0, '#2a3a0a');
        headGrad.addColorStop(1, '#0a1200');
        ctx.fillStyle = headGrad;
        ctx.beginPath();
        ctx.ellipse(-r * 0.35, 0, r * 0.4, r * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();

        // Multiple eyes — 8 glowing red
        const eyeGlow = 0.6 + 0.4 * Math.sin(t * 4);
        ctx.fillStyle = `rgba(255, 0, 0, ${eyeGlow})`;
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 8 * eyeGlow;
        const eyes = [
            [-r * 0.55, -r * 0.12, r * 0.06], [-r * 0.55, r * 0.12, r * 0.06],
            [-r * 0.5, -r * 0.22, r * 0.04], [-r * 0.5, r * 0.22, r * 0.04],
            [-r * 0.6, -r * 0.05, r * 0.04], [-r * 0.6, r * 0.05, r * 0.04],
            [-r * 0.45, -r * 0.18, r * 0.03], [-r * 0.45, r * 0.18, r * 0.03],
        ];
        for (const [ex, ey, er] of eyes) {
            ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
        }

        // Mandibles
        ctx.strokeStyle = '#88aa22';
        ctx.shadowBlur = 0;
        ctx.lineWidth = 3;
        const mWave = Math.sin(t * 3) * 0.15;
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, -r * 0.08);
        ctx.quadraticCurveTo(-r * 0.85, -r * 0.25 - mWave * r, -r * 0.75, -r * 0.35);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, r * 0.08);
        ctx.quadraticCurveTo(-r * 0.85, r * 0.25 + mWave * r, -r * 0.75, r * 0.35);
        ctx.stroke();
    }

    _drawOctopusBoss(ctx, r, t, color, pulse) {
        // Giant octopus boss — tentacles and bulbous head
        const tentCount = 8;
        ctx.lineCap = 'round';

        // Tentacles
        for (let i = 0; i < tentCount; i++) {
            const angle = (i / tentCount) * Math.PI * 1.6 + Math.PI * 0.2;
            const w1 = Math.sin(t * 2 + i * 1.0) * 0.35;
            const w2 = Math.sin(t * 1.8 + i * 0.6) * 0.25;
            const sx = Math.cos(angle) * r * 0.5;
            const sy = Math.sin(angle) * r * 0.5;
            const mx = Math.cos(angle + w1) * r * 1.2;
            const my = Math.sin(angle + w1) * r * 1.1;
            const ex = Math.cos(angle + w1 + w2) * r * 1.8;
            const ey = Math.sin(angle + w1 + w2) * r * 1.5;
            ctx.strokeStyle = `hsla(275, 50%, ${30 + i * 3}%, 0.7)`;
            ctx.lineWidth = 5 - i * 0.3;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.quadraticCurveTo(mx, my, ex, ey);
            ctx.stroke();
        }

        // Head dome
        const hGrad = ctx.createRadialGradient(-r * 0.1, -r * 0.1, 0, 0, 0, r * 0.65);
        hGrad.addColorStop(0, '#cc66ff');
        hGrad.addColorStop(0.5, '#7722bb');
        hGrad.addColorStop(1, '#330066');
        ctx.fillStyle = hGrad;
        ctx.shadowColor = '#aa44ff';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.1, r * 0.6, r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();

        // Bioluminescent spots
        ctx.fillStyle = `rgba(200, 150, 255, ${0.4 * pulse})`;
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.2, r * 0.08, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(r * 0.15, -r * 0.15, r * 0.06, 0, Math.PI * 2); ctx.fill();

        // Eyes — large, intelligent
        ctx.fillStyle = '#eeddff';
        ctx.beginPath(); ctx.ellipse(-r * 0.2, -r * 0.05, r * 0.14, r * 0.1, -0.1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(r * 0.15, -r * 0.05, r * 0.14, r * 0.1, 0.1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#110022';
        ctx.beginPath(); ctx.ellipse(-r * 0.2, -r * 0.03, r * 0.04, r * 0.08, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(r * 0.15, -r * 0.03, r * 0.04, r * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    }

    _drawDevilBoss(ctx, r, t, color, pulse) {
        // Devil/demon boss — horns, fire, menacing
        const fireFlicker = 0.7 + 0.3 * Math.sin(t * 12);

        // Fire aura
        ctx.fillStyle = `rgba(255, 40, 0, ${0.15 * fireFlicker})`;
        ctx.shadowColor = '#ff4400';
        ctx.shadowBlur = 20 * fireFlicker;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2);
        ctx.fill();

        // Horns — large
        ctx.strokeStyle = '#aa1100';
        ctx.fillStyle = '#661100';
        ctx.shadowBlur = 6;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-r * 0.2, -r * 0.5);
        ctx.quadraticCurveTo(-r * 0.5, -r * 1.4, -r * 0.05, -r * 1.2);
        ctx.lineTo(-r * 0.1, -r * 0.5);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(r * 0.2, -r * 0.5);
        ctx.quadraticCurveTo(r * 0.5, -r * 1.4, r * 0.05, -r * 1.2);
        ctx.lineTo(r * 0.1, -r * 0.5);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        // Head — dark red sphere
        const headGrad = ctx.createRadialGradient(-r * 0.1, -r * 0.1, 0, 0, 0, r * 0.7);
        headGrad.addColorStop(0, '#881100');
        headGrad.addColorStop(0.6, '#440808');
        headGrad.addColorStop(1, '#220000');
        ctx.fillStyle = headGrad;
        ctx.shadowColor = '#ff2200';
        ctx.shadowBlur = 10 * fireFlicker;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
        ctx.fill();

        // Glowing eyes
        const eyeGlow = 0.7 + 0.3 * Math.sin(t * 6);
        ctx.fillStyle = `rgba(255, 200, 0, ${eyeGlow})`;
        ctx.shadowColor = '#ffaa00';
        ctx.shadowBlur = 12 * eyeGlow;
        ctx.save();
        ctx.translate(-r * 0.22, -r * 0.12);
        ctx.rotate(-0.25);
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.13, r * 0.06, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.translate(r * 0.18, -r * 0.12);
        ctx.rotate(0.25);
        ctx.beginPath(); ctx.ellipse(0, 0, r * 0.13, r * 0.06, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // Jagged mouth
        ctx.strokeStyle = `rgba(255, 100, 0, ${0.7 + 0.3 * fireFlicker})`;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(-r * 0.3, r * 0.15);
        for (let i = 0; i < 6; i++) {
            const mx = -r * 0.3 + (i + 0.5) * (r * 0.6 / 6);
            const my = r * 0.15 + (i % 2 === 0 ? r * 0.12 : 0);
            ctx.lineTo(mx, my);
        }
        ctx.lineTo(r * 0.3, r * 0.15);
        ctx.stroke();
    }

    _drawDefaultBoss(ctx, r, t, color, pulse) {
        // --- Engine glow (rear) ---
        const engineFlicker = 0.7 + 0.3 * Math.sin(t * 15);
        ctx.fillStyle = `rgba(100, 150, 255, ${0.4 * engineFlicker})`;
        ctx.shadowColor = '#4488ff';
        ctx.shadowBlur = 14 * engineFlicker;
        ctx.beginPath();
        ctx.moveTo(r * 0.6, -r * 0.25);
        ctx.lineTo(r * 0.6 + 20 * engineFlicker, 0);
        ctx.lineTo(r * 0.6, r * 0.25);
        ctx.closePath();
        ctx.fill();
        // Second engine
        ctx.beginPath();
        ctx.moveTo(r * 0.5, -r * 0.5);
        ctx.lineTo(r * 0.5 + 14 * engineFlicker, -r * 0.35);
        ctx.lineTo(r * 0.5, -r * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(r * 0.5, r * 0.2);
        ctx.lineTo(r * 0.5 + 14 * engineFlicker, r * 0.35);
        ctx.lineTo(r * 0.5, r * 0.5);
        ctx.closePath();
        ctx.fill();

        // --- Rotating shield segments (decorative) ---
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.3 + 0.2 * Math.sin(t * 3);
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.lineWidth = 2;
        const shieldSegments = 6;
        for (let i = 0; i < shieldSegments; i++) {
            const segAngle = this.shieldRotation + (i / shieldSegments) * Math.PI * 2;
            const arcStart = segAngle;
            const arcEnd = segAngle + 0.4;
            ctx.beginPath();
            ctx.arc(0, 0, r * 1.15, arcStart, arcEnd);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // --- Ship body — large imposing hull ---
        // Outer hull gradient
        const hullGrad = ctx.createRadialGradient(-r * 0.1, 0, r * 0.1, 0, 0, r);
        hullGrad.addColorStop(0, this.lightenColor(color, 40));
        hullGrad.addColorStop(0.5, this.darkenColor(color, 30));
        hullGrad.addColorStop(1, this.darkenColor(color, 70));
        ctx.fillStyle = hullGrad;
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.lineWidth = 2;

        // Main body shape — aggressive angular ship
        ctx.beginPath();
        ctx.moveTo(-r * 0.9, 0);             // nose
        ctx.lineTo(-r * 0.5, -r * 0.35);     // upper nose edge
        ctx.lineTo(-r * 0.1, -r * 0.55);     // upper wing root
        ctx.lineTo(r * 0.4, -r * 0.7);       // upper wing tip
        ctx.lineTo(r * 0.5, -r * 0.45);      // upper wing trailing
        ctx.lineTo(r * 0.25, -r * 0.3);      // hull recess upper
        ctx.lineTo(r * 0.45, 0);             // rear center
        ctx.lineTo(r * 0.25, r * 0.3);       // hull recess lower
        ctx.lineTo(r * 0.5, r * 0.45);       // lower wing trailing
        ctx.lineTo(r * 0.4, r * 0.7);        // lower wing tip
        ctx.lineTo(-r * 0.1, r * 0.55);      // lower wing root
        ctx.lineTo(-r * 0.5, r * 0.35);      // lower nose edge
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Inner hull detail lines
        ctx.strokeStyle = `rgba(255, 255, 255, 0.15)`;
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, 0);
        ctx.lineTo(r * 0.2, -r * 0.25);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, 0);
        ctx.lineTo(r * 0.2, r * 0.25);
        ctx.stroke();

        // --- Pulsing energy core (center) ---
        const coreR = r * (0.15 + 0.05 * pulse);
        const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR * 2);
        coreGrad.addColorStop(0, '#ffffff');
        coreGrad.addColorStop(0.3, color);
        coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = coreGrad;
        ctx.shadowColor = color;
        ctx.shadowBlur = 15 * pulse;
        ctx.beginPath();
        ctx.arc(-r * 0.15, 0, coreR * 2, 0, Math.PI * 2);
        ctx.fill();
        // Bright inner core
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 8 * pulse;
        ctx.beginPath();
        ctx.arc(-r * 0.15, 0, coreR * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // --- Weapon ports (front) ---
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(-r * 0.75, -r * 0.08, r * 0.04, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-r * 0.75, r * 0.08, r * 0.04, 0, Math.PI * 2);
        ctx.fill();

    }

    // Helper: darken a hex/named color by mixing toward black
    darkenColor(hexColor, amount) {
        // Parse common hex colors; fallback for named colors
        const rgb = this.parseColor(hexColor);
        const factor = (100 - amount) / 100;
        const r = Math.floor(rgb.r * factor);
        const g = Math.floor(rgb.g * factor);
        const b = Math.floor(rgb.b * factor);
        return `rgb(${r},${g},${b})`;
    }

    // Helper: lighten a hex color by mixing toward white
    lightenColor(hexColor, amount) {
        const rgb = this.parseColor(hexColor);
        const factor = amount / 100;
        const r = Math.min(255, Math.floor(rgb.r + (255 - rgb.r) * factor));
        const g = Math.min(255, Math.floor(rgb.g + (255 - rgb.g) * factor));
        const b = Math.min(255, Math.floor(rgb.b + (255 - rgb.b) * factor));
        return `rgb(${r},${g},${b})`;
    }

    // Parse hex color string to {r, g, b}
    parseColor(hex) {
        if (hex.charAt(0) === '#') {
            const bigint = parseInt(hex.slice(1), 16);
            return {
                r: (bigint >> 16) & 255,
                g: (bigint >> 8) & 255,
                b: bigint & 255
            };
        }
        // Fallback for non-hex
        return { r: 180, g: 50, b: 50 };
    }
}

// ============================================================
// EnemySpawner — Manages waves with difficulty scaling
// ============================================================
// Phase definitions — each phase has a featured enemy and a score threshold
const PHASES = [
    // Phases 1-5: easy — generous gaps, one new enemy type per phase
    { name: 'ASTEROID FIELD',     threshold: 0,    featured: 'asteroid',  color: '#aa7733' },
    { name: 'CRITTER COLONY',     threshold: 600,  featured: 'ship',      color: '#ff6644' },
    { name: 'FIREFLY SWARM',      threshold: 1000, featured: 'drone',     color: '#44ff66' },
    { name: 'JELLYFISH DRIFT',    threshold: 1800, featured: 'mine',      color: '#ff88cc' },
    { name: 'ARACHNID SECTOR',    threshold: 2800, featured: 'spider',    color: '#66ff22' },
    // Phases 6-10: difficulty ramps up
    { name: 'GHOST NEBULA',       threshold: 4000, featured: 'ghost',     color: '#bb66ff' },
    { name: 'OCTOPUS DEN',        threshold: 5500, featured: 'bomber',    color: '#cc44ff' },
    { name: 'CHAMELEON VOID',     threshold: 7500, featured: 'stealth',   color: '#00cccc' },
    { name: 'DEVIL\'S DOMAIN',    threshold: 10000, featured: 'devil',    color: '#ff4400' },
    { name: 'TOTAL CHAOS',        threshold: 13000, featured: 'all',      color: '#ff3366' }
];

class EnemySpawner {
    constructor(assets) {
        this.assets = assets || {};
        this.timer = 0;
        this.baseInterval = 2.2;
        this.enemies = [];
        this.currentPhase = 0;
        this.phaseAnnouncedAt = -1; // score when last announcement was shown
    }

    getPhase(score) {
        for (let i = PHASES.length - 1; i >= 0; i--) {
            if (score >= PHASES[i].threshold) return i;
        }
        return 0;
    }

    update(dt, score, canvasW, canvasH, projectilePool, playerY, audio, playerX) {
        this.timer -= dt;

        // Phase check
        const phase = this.getPhase(score);
        if (phase !== this.currentPhase) {
            this.currentPhase = phase;
            this.phaseAnnouncedAt = score;
        }

        const phaseInfo = PHASES[this.currentPhase];
        // Smooth exponential spawn interval — no cliff between phases
        const interval = Math.max(0.45, 2.2 * Math.pow(0.82, phase));
        const largeTier = phase >= 5 ? 0.2 : 0;

        if (this.timer <= 0) {
            this.timer = interval + Utils.random(-0.3, 0.3);

            const roll = Math.random();
            const featured = phaseInfo.featured;

            // 65% chance to spawn the featured enemy, rest is mixed
            if (featured !== 'all' && roll < 0.65) {
                this.spawnByType(featured, canvasW, canvasH, largeTier);
            } else {
                this.spawnMixed(score, canvasW, canvasH, largeTier);
            }

            // Phase 10 (TOTAL CHAOS): double spawn
            if (phase >= 9) {
                this.spawnMixed(score, canvasW, canvasH, 0.4);
            }

            // Phase 5+: chance to spawn enemies from behind
            if (phase >= 4 && Math.random() < (phase >= 9 ? 0.4 : 0.2)) {
                const behindPool = ['drone', 'asteroid'];
                if (phase >= 7) behindPool.push('ship');
                const pick = behindPool[Utils.randomInt(0, behindPool.length - 1)];
                const e = this._spawnFromBehind(pick, canvasW, canvasH);
                if (e) this.enemies.push(e);
            }
        }

        // Update all enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            switch (e.type) {
                case 'ship':
                case 'bomber':
                case 'spider':
                case 'devil':
                case 'boss':
                    e.update(dt, playerY, projectilePool, audio);
                    break;
                case 'mine':
                    e.update(dt, playerY, projectilePool, audio, playerX);
                    break;
                default:
                    e.update(dt);
            }
            if (!e.active || e.isOffScreen(canvasW, canvasH)) {
                this.enemies.splice(i, 1);
            }
        }
    }

    spawnByType(type, canvasW, canvasH, largeTier) {
        switch (type) {
            case 'asteroid': {
                const sizeMul = Math.random() < 0.4 ? Utils.random(1.5, 2.0) : 1;
                this.enemies.push(new Asteroid(canvasW, canvasH, sizeMul));
                break;
            }
            case 'drone': {
                const count = Utils.randomInt(3, 5);
                for (let i = 0; i < count; i++) {
                    this.enemies.push(new Drone(canvasW, canvasH, i * 15 - count * 7));
                }
                break;
            }
            case 'spider':
                const sp = new SpiderDrone(canvasW, canvasH);
                sp.canvas_w = canvasW;
                this.enemies.push(sp);
                break;
            case 'ghost':
                this.enemies.push(new AlienGhost(canvasW, canvasH));
                break;
            case 'bomber': {
                const b = new Bomber(canvasW, canvasH);
                b.canvas_w = canvasW;
                this.enemies.push(b);
                break;
            }
            case 'stealth':
                this.enemies.push(new StealthFighter(canvasW, canvasH));
                break;
            case 'devil': {
                const d = new AlienDevil(canvasW, canvasH);
                d.canvas_w = canvasW;
                this.enemies.push(d);
                break;
            }
            case 'ship': {
                const tier = Math.random() < largeTier ? 2 : 1;
                const ship = new EnemyShip(canvasW, canvasH, tier, this.assets);
                ship.canvas_w = canvasW;
                this.enemies.push(ship);
                break;
            }
            case 'mine':
                this.enemies.push(new SpaceMine(canvasW, canvasH));
                break;
        }
    }

    spawnMixed(score, canvasW, canvasH, largeTier) {
        // Build pool of available types — matches phase thresholds
        const pool = ['asteroid'];
        if (score >= 600)   pool.push('ship');
        if (score >= 1000)  pool.push('drone');
        if (score >= 1800)  pool.push('mine');
        if (score >= 2800)  pool.push('spider');
        if (score >= 4000)  pool.push('ghost');
        if (score >= 5500)  pool.push('bomber');
        if (score >= 7500)  pool.push('stealth');
        if (score >= 10000) pool.push('devil');

        const pick = pool[Utils.randomInt(0, pool.length - 1)];
        this.spawnByType(pick, canvasW, canvasH, largeTier);
    }

    _spawnFromBehind(type, canvasW, canvasH) {
        const y = Utils.random(30, canvasH - 30);
        switch (type) {
            case 'asteroid': {
                const a = new Asteroid(canvasW, canvasH, 1, -30, y);
                a.vx = Utils.random(80, 160); // flies rightward
                return a;
            }
            case 'drone': {
                const d = new Drone(canvasW, canvasH, 0);
                d.x = -20;
                d.y = y;
                d.vx = Utils.random(180, 260); // fast rightward
                d.baseY = y;
                return d;
            }
            case 'ship': {
                const s = new EnemyShip(canvasW, canvasH, 1, this.assets);
                s.x = -20;
                s.y = y;
                s.vx = Utils.random(60, 120);
                s.canvas_w = canvasW;
                return s;
            }
        }
        return null;
    }

    draw(ctx) {
        for (const e of this.enemies) {
            if (e.active) e.draw(ctx);
        }
    }

    reset() {
        this.enemies = [];
        this.timer = 3; // grace period at start
    }
}
