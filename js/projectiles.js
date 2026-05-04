// ============================================================
// projectiles.js — Laser projectiles with pooling
// ============================================================

import { GAME_SCALE } from './utils.js';

export class Projectile {
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
        this.pierce = false;
        this.splitOnBounce = false;
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
        this.radius = (isEnemy ? 3 : 4) * GAME_SCALE;
        this.bounces = 0; // remaining bounces (0 = no bounce)
        this.pierce = false;
        this.splitOnBounce = false;
    }

    update(dt, canvasW, canvasH) {
        if (!this.active) return;
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Bounce off top/bottom edges if ricochet is active
        if (this.bounces > 0 && !this.isEnemy) {
            if (this.y <= 0) { this.y = 0; this.vy = Math.abs(this.vy); this.bounces--; }
            if (this.y >= canvasH) { this.y = canvasH; this.vy = -Math.abs(this.vy); this.bounces--; }
        }

        // Off-screen check with margin
        if (this.x < -20 || this.x > canvasW + 20 ||
            (this.bounces <= 0 && (this.y < -20 || this.y > canvasH + 20))) {
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
export class ProjectilePool {
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
        // Tracks bullets that bounced this frame and should split — detected by
        // the bounces counter dropping. Splitting happens after the main update
        // pass so we don't iterate over the new bullets we just spawned.
        const splitParents = [];
        for (let i = 0; i < this.pool.length; i++) {
            const p = this.pool[i];
            if (!p.active) continue;
            const beforeBounces = p.bounces;
            p.update(dt, canvasW, canvasH);
            if (p.splitOnBounce && p.active && p.bounces < beforeBounces) {
                splitParents.push(p);
            }
        }
        // Spawn 2 splits per bounce, smaller and at diverging angles.
        for (const parent of splitParents) {
            this._spawnSplits(parent);
        }
        this._rebuildCache();
    }

    _spawnSplits(parent) {
        const angle = 0.4;
        const cos = Math.cos(angle), sin = Math.sin(angle);
        const splits = [
            { vx:  parent.vx * cos - parent.vy * sin, vy:  parent.vx * sin + parent.vy * cos },
            { vx:  parent.vx * cos + parent.vy * sin, vy: -parent.vx * sin + parent.vy * cos },
        ];
        for (const s of splits) {
            const child = this.get();
            if (!child) break;
            child.init(parent.x, parent.y, s.vx, s.vy,
                parent.color, parent.glowColor, false, Math.max(1, parent.damage * 0.5));
            child.radius = parent.radius * 0.7;
            // Splits don't re-split (avoid runaway cascades) but inherit remaining bounces.
            child.bounces = Math.max(0, parent.bounces);
            child.splitOnBounce = false;
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
        return this._cachedActive;
    }

    getPlayerBullets() {
        return this._cachedPlayer;
    }

    getEnemyBullets() {
        return this._cachedEnemy;
    }

    // Rebuild cached lists once per frame during update
    _rebuildCache() {
        this._cachedActive = [];
        this._cachedPlayer = [];
        this._cachedEnemy = [];
        for (let i = 0; i < this.pool.length; i++) {
            const p = this.pool[i];
            if (!p.active) continue;
            this._cachedActive.push(p);
            if (p.isEnemy) this._cachedEnemy.push(p);
            else this._cachedPlayer.push(p);
        }
    }
}
