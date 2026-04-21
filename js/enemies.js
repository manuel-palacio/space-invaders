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
        this.radius = 15;
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
    constructor(canvasW, canvasH, sizeMultiplier = 1) {
        super();
        this.type = 'asteroid';
        const baseRadius = Utils.random(12, 28) * sizeMultiplier;
        this.radius = baseRadius;
        this.hp = 1;
        this.maxHp = 1;
        this.points = 10;

        this.x = canvasW + this.radius + Utils.random(10, 100);
        this.y = Utils.random(this.radius, canvasH - this.radius);
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
        this.color = `hsl(${Utils.randomInt(20, 45)}, ${Utils.randomInt(10, 30)}%, ${Utils.randomInt(35, 55)}%)`;
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

        ctx.fillStyle = this.color;
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }
}

// ============================================================
// EnemyShip — Triangular ship that shoots back, 2-3 HP
// ============================================================
class EnemyShip extends Enemy {
    constructor(canvasW, canvasH, tier = 1) {
        super();
        this.type = 'ship';
        this.tier = tier; // 1 = small, 2 = large
        this.radius = tier === 1 ? 16 : 24;
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
        this.engineFlicker = 0;
        this.hue = tier === 1 ? Utils.randomInt(320, 360) : Utils.randomInt(260, 290);
    }

    update(dt, playerY, projectilePool, audio) {
        super.update(dt);
        this.engineFlicker += dt * 20;

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
        const flicker = 0.7 + 0.3 * Math.sin(this.engineFlicker);
        const hsl = `hsl(${this.hue}, 100%, 50%)`;
        const hslDim = `hsl(${this.hue}, 80%, 30%)`;

        // Engine glow
        ctx.fillStyle = `rgba(255, 50, 50, ${0.3 * flicker})`;
        ctx.shadowColor = '#ff3333';
        ctx.shadowBlur = 8 * flicker;
        ctx.beginPath();
        ctx.moveTo(r * 0.3, -3);
        ctx.lineTo(r * 0.3 + 10 * flicker, 0);
        ctx.lineTo(r * 0.3, 3);
        ctx.closePath();
        ctx.fill();

        // Ship body — pointed left (facing player)
        ctx.fillStyle = hslDim;
        ctx.strokeStyle = hsl;
        ctx.shadowColor = hsl;
        ctx.shadowBlur = 6;
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(-r, 0);             // nose (faces left)
        ctx.lineTo(r * 0.4, -r * 0.7); // top wing
        ctx.lineTo(r * 0.3, 0);        // rear center
        ctx.lineTo(r * 0.4, r * 0.7);  // bottom wing
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cockpit
        ctx.fillStyle = hsl;
        ctx.shadowBlur = 3;
        ctx.beginPath();
        ctx.arc(-r * 0.3, 0, r * 0.15, 0, Math.PI * 2);
        ctx.fill();

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
// EnemySpawner — Manages waves with difficulty scaling
// ============================================================
class EnemySpawner {
    constructor() {
        this.timer = 0;
        this.baseInterval = 1.5; // seconds between spawns
        this.enemies = [];
    }

    update(dt, score, canvasW, canvasH, projectilePool, playerY, audio) {
        this.timer -= dt;

        // Difficulty scaling: spawn faster and tougher enemies as score increases
        const difficulty = Math.floor(score / 200);
        const interval = Math.max(0.3, this.baseInterval - difficulty * 0.08);
        const shipChance = Math.min(0.5, 0.1 + difficulty * 0.03);
        const largeTier = difficulty >= 3 ? 0.15 : 0;

        if (this.timer <= 0) {
            this.timer = interval + Utils.random(-0.3, 0.3);

            const roll = Math.random();
            if (roll < shipChance) {
                const tier = Math.random() < largeTier ? 2 : 1;
                const ship = new EnemyShip(canvasW, canvasH, tier);
                ship.canvas_w = canvasW;
                this.enemies.push(ship);
            } else {
                this.enemies.push(new Asteroid(canvasW, canvasH));
            }
        }

        // Update enemies
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (e.type === 'ship') {
                e.update(dt, playerY, projectilePool, audio);
            } else {
                e.update(dt);
            }
            if (!e.active || e.isOffScreen(canvasW, canvasH)) {
                this.enemies.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        for (const e of this.enemies) {
            if (e.active) e.draw(ctx);
        }
    }

    reset() {
        this.enemies = [];
        this.timer = 2; // grace period at start
    }
}
