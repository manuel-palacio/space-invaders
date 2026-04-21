// ============================================================
// particles.js — Particle system with object pooling
// ============================================================

class Particle {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.life = 0;
        this.maxLife = 0;
        this.size = 2;
        this.color = '#fff';
        this.alpha = 1;
        this.active = false;
        this.shrink = true;
        this.friction = 0.98;
    }

    init(x, y, vx, vy, life, size, color, shrink = true, friction = 0.98) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = life;
        this.maxLife = life;
        this.size = size;
        this.color = color;
        this.alpha = 1;
        this.active = true;
        this.shrink = shrink;
        this.friction = friction;
    }

    update(dt) {
        if (!this.active) return;
        this.life -= dt;
        if (this.life <= 0) {
            this.active = false;
            return;
        }
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= this.friction;
        this.vy *= this.friction;
        const progress = this.life / this.maxLife;
        this.alpha = progress;
        if (this.shrink) {
            this.currentSize = this.size * progress;
        } else {
            this.currentSize = this.size;
        }
    }

    draw(ctx) {
        if (!this.active || this.alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = this.currentSize * 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(0.5, this.currentSize), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ============================================================
// ParticlePool — Pre-allocated pool to avoid GC pressure
// ============================================================
class ParticlePool {
    constructor(size) {
        this.pool = [];
        this.maxSize = size;
        for (let i = 0; i < size; i++) {
            this.pool.push(new Particle());
        }
    }

    get() {
        // Find an inactive particle to reuse
        for (let i = 0; i < this.pool.length; i++) {
            if (!this.pool[i].active) {
                return this.pool[i];
            }
        }
        // All in use — expand pool if under 2x limit, else skip
        if (this.pool.length < this.maxSize * 2) {
            const p = new Particle();
            this.pool.push(p);
            return p;
        }
        return null;
    }

    update(dt) {
        for (let i = 0; i < this.pool.length; i++) {
            if (this.pool[i].active) {
                this.pool[i].update(dt);
            }
        }
    }

    draw(ctx) {
        for (let i = 0; i < this.pool.length; i++) {
            if (this.pool[i].active) {
                this.pool[i].draw(ctx);
            }
        }
    }

    // --- Effect factories ---

    createExplosion(x, y, color, count, speed, life, size) {
        for (let i = 0; i < count; i++) {
            const p = this.get();
            if (!p) continue;
            const angle = Math.random() * Math.PI * 2;
            const spd = Utils.random(speed * 0.3, speed);
            p.init(
                x, y,
                Math.cos(angle) * spd,
                Math.sin(angle) * spd,
                Utils.random(life * 0.5, life),
                Utils.random(size * 0.5, size),
                color
            );
        }
    }

    createColorExplosion(x, y, colors, count, speed, life, size) {
        for (let i = 0; i < count; i++) {
            const p = this.get();
            if (!p) continue;
            const angle = Math.random() * Math.PI * 2;
            const spd = Utils.random(speed * 0.3, speed);
            const color = colors[Utils.randomInt(0, colors.length - 1)];
            p.init(
                x, y,
                Math.cos(angle) * spd,
                Math.sin(angle) * spd,
                Utils.random(life * 0.5, life),
                Utils.random(size * 0.5, size),
                color
            );
        }
    }

    createTrail(x, y, color, size) {
        const p = this.get();
        if (!p) return;
        p.init(
            x + Utils.random(-2, 2),
            y + Utils.random(-2, 2),
            Utils.random(-80, -30),
            Utils.random(-15, 15),
            Utils.random(0.1, 0.3),
            Utils.random(size * 0.5, size),
            color
        );
    }

    createMuzzleFlash(x, y, angle, color) {
        for (let i = 0; i < 5; i++) {
            const p = this.get();
            if (!p) continue;
            const spread = Utils.random(-0.3, 0.3);
            const spd = Utils.random(200, 400);
            p.init(
                x, y,
                Math.cos(angle + spread) * spd,
                Math.sin(angle + spread) * spd,
                0.08,
                Utils.random(1, 3),
                color
            );
        }
    }
}
