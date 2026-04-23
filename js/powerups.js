// ============================================================
// powerups.js — Collectible power-up items
// ============================================================

const POWERUP_TYPES = {
    RAPID_FIRE:  { name: 'Rapid Fire',  color: '#ffdd00', duration: 8 },
    TRIPLE_SHOT: { name: 'Triple Shot', color: '#00ff66', duration: 10 },
    SHIELD:      { name: 'Shield',      color: '#00aaff', duration: 12 },
    EXTRA_LIFE:  { name: 'Extra Life',  color: '#ff66cc', duration: 0 },
    RICOCHET:    { name: 'Ricochet',   color: '#ff8800', duration: 12 },
    WINGMAN:     { name: 'Wingman',    color: '#4488ff', duration: 15 }
};

const POWERUP_KEYS = Object.keys(POWERUP_TYPES);

class PowerUp {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.radius = 14;
        this.type = null;
        this.active = false;
        this.time = 0;
        this.bobOffset = Math.random() * Math.PI * 2;
    }

    init(x, y, type, assets) {
        this.x = x;
        this.y = y;
        this.vx = -100;          // drift left
        this.vy = 0;
        this.type = type;
        this.assets = assets || {};
        this.active = true;
        this.time = 0;
        this.bobOffset = Math.random() * Math.PI * 2;
    }

    update(dt, canvasW) {
        if (!this.active) return;
        this.time += dt;
        this.x += this.vx * dt;
        this.y += Math.sin(this.time * 3 + this.bobOffset) * 30 * dt; // gentle bob

        if (this.x < -30) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) return;
        const info = POWERUP_TYPES[this.type];
        const pulse = 0.85 + 0.15 * Math.sin(this.time * 5);
        const r = this.radius * pulse;

        ctx.save();

        // Outer glow ring
        ctx.strokeStyle = info.color;
        ctx.shadowColor = info.color;
        ctx.shadowBlur = 15;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.time * 4);
        ctx.beginPath();
        ctx.arc(this.x, this.y, r + 4, 0, Math.PI * 2);
        ctx.stroke();

        // Inner — sprite icon or filled circle with letter
        const assetKey = POWERUP_ASSET_MAP[this.type];
        const iconImg = this.assets && this.assets[assetKey];

        if (iconImg) {
            ctx.globalAlpha = 0.95;
            ctx.shadowBlur = 10;
            ctx.shadowColor = info.color;
            const imgSize = r * 2;
            ctx.drawImage(iconImg, this.x - imgSize / 2, this.y - imgSize / 2, imgSize, imgSize);
        } else {
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = info.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#000';
            ctx.shadowBlur = 0;
            ctx.font = `bold ${Math.floor(r)}px Courier New`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            let icon = '?';
            if (this.type === 'RAPID_FIRE')  icon = 'R';
            if (this.type === 'TRIPLE_SHOT') icon = 'T';
            if (this.type === 'SHIELD')      icon = 'S';
            if (this.type === 'EXTRA_LIFE')  icon = '+';
            if (this.type === 'RICOCHET')    icon = 'B';
            if (this.type === 'WINGMAN')     icon = 'W';
            ctx.fillText(icon, this.x, this.y + 1);
        }

        ctx.restore();
    }
}
