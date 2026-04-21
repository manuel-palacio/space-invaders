// ============================================================
// projectiles.js — Laser projectiles with pooling
// ============================================================

class Projectile {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.radius = 3;
        this.color = '#00ffff';
        this.glowColor = '#00ffff';
        this.active = false;
        this.isEnemy = false;
        this.damage = 1;
    }

    init(x, y, vx, vy, color, glowColor, isEnemy, damage = 1) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.glowColor = glowColor;
        this.active = true;
        this.isEnemy = isEnemy;
        this.damage = damage;
        this.radius = isEnemy ? 3 : 4;
    }

    update(dt, canvasW, canvasH) {
        if (!this.active) return;
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Off-screen check with margin
        if (this.x < -20 || this.x > canvasW + 20 ||
            this.y < -20 || this.y > canvasH + 20) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = 12;

        if (this.isEnemy) {
            // Enemy bullets — small circles
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Player bullets — elongated ellipse
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, this.radius * 3, this.radius, 0, 0, Math.PI * 2);
            ctx.fill();
            // Bright core
            ctx.fillStyle = '#fff';
            ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, this.radius * 1.5, this.radius * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

// ============================================================
// ProjectilePool
// ============================================================
class ProjectilePool {
    constructor(size) {
        this.pool = [];
        this.maxSize = size;
        for (let i = 0; i < size; i++) {
            this.pool.push(new Projectile());
        }
    }

    get() {
        for (let i = 0; i < this.pool.length; i++) {
            if (!this.pool[i].active) {
                return this.pool[i];
            }
        }
        if (this.pool.length < this.maxSize * 2) {
            const p = new Projectile();
            this.pool.push(p);
            return p;
        }
        return null;
    }

    update(dt, canvasW, canvasH) {
        for (let i = 0; i < this.pool.length; i++) {
            if (this.pool[i].active) {
                this.pool[i].update(dt, canvasW, canvasH);
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

    getActive() {
        return this.pool.filter(p => p.active);
    }

    getPlayerBullets() {
        return this.pool.filter(p => p.active && !p.isEnemy);
    }

    getEnemyBullets() {
        return this.pool.filter(p => p.active && p.isEnemy);
    }
}
