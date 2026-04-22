// ============================================================
// background.js — Multi-layer parallax starfield with moon
// ============================================================

// Draw NIN logo on a planet surface
function drawNINLogo(ctx, x, y, size, style, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = (alpha || 0.3);
    const s = size;

    switch (style) {
        case 'block': {
            // Classic NIN block letters
            ctx.font = `bold ${s}px Arial Black, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#000';
            ctx.fillText('NIN', 0, 0);
            break;
        }
        case 'outline': {
            // Outlined NIN
            ctx.font = `bold ${s}px Arial Black, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = s * 0.08;
            ctx.lineJoin = 'round';
            ctx.strokeText('NIN', 0, 0);
            break;
        }
        case 'stencil': {
            // Stencil/carved look — dark fill with lighter inner
            ctx.font = `bold ${s}px Arial Black, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillText('NIN', 0, 0);
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillText('NIN', 1, 1);
            break;
        }
        case 'scratched': {
            // Scratched/etched into surface
            ctx.font = `bold ${s}px Arial Black, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillText('NIN', -1, -1);
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.fillText('NIN', 1, 1);
            break;
        }
        case 'glow': {
            // Glowing/branded
            ctx.font = `bold ${s}px Arial Black, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = '#cc0000';
            ctx.shadowBlur = s * 0.3;
            ctx.fillStyle = '#cc0000';
            ctx.fillText('NIN', 0, 0);
            ctx.shadowBlur = 0;
            break;
        }
    }
    ctx.restore();
}

class Star {
    constructor(canvas, speed, size, brightness) {
        this.canvas = canvas;
        this.speed = speed;
        this.size = size;
        this.brightness = brightness;
        this.twinkleSpeed = Utils.random(1, 4);
        this.twinkleOffset = Math.random() * Math.PI * 2;
        this.respawn(true);
    }

    respawn(initial) {
        this.x = initial ? Math.random() * this.canvas.width : this.canvas.width + Math.random() * 100;
        this.y = Math.random() * this.canvas.height;
    }

    update(dt) {
        this.x -= this.speed * dt;
        if (this.x < -5) {
            this.respawn(false);
        }
    }

    draw(ctx, time) {
        const twinkle = 0.5 + 0.5 * Math.sin(time * this.twinkleSpeed + this.twinkleOffset);
        const alpha = this.brightness * twinkle;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = this.size * 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ============================================================
// Moon — Large crescent with craters, domes, and antenna towers
// ============================================================
class Moon {
    constructor(canvas, assets) {
        this.canvas = canvas;
        this.assets = assets || {};
        this.baseX = canvas.width * Utils.random(0.55, 0.85);
        this.baseY = canvas.height * Utils.random(0.15, 0.8);
        this.radius = Math.min(canvas.width, canvas.height) * 0.15;
        this.scrollSpeed = 5; // very slow parallax
        this.craters = [];
        this.bases = [];
        this.generateFeatures();
    }

    generateFeatures() {
        this.craters = [];
        this.bases = [];
        // 6-10 craters across the visible face
        const craterCount = Utils.randomInt(6, 10);
        for (let i = 0; i < craterCount; i++) {
            const angle = Utils.random(-Math.PI * 0.6, Math.PI * 0.6);
            const dist = Utils.random(0.1, 0.85) * this.radius;
            this.craters.push({
                ox: Math.cos(angle) * dist,
                oy: Math.sin(angle) * dist,
                r: Utils.random(this.radius * 0.05, this.radius * 0.18)
            });
        }
        // 2-4 bases along the lower rim
        const baseCount = Utils.randomInt(2, 4);
        for (let i = 0; i < baseCount; i++) {
            const angle = Utils.random(-0.5, 0.5);
            const dist = this.radius * Utils.random(0.55, 0.8);
            this.bases.push({
                ox: Math.cos(angle) * dist,
                oy: Math.sin(Math.PI * 0.35 + angle * 0.3) * dist,
                size: Utils.random(4, 10),
                hasAntenna: Math.random() > 0.4,
                windowCount: Utils.randomInt(1, 3)
            });
        }
    }

    resize(canvas) {
        this.canvas = canvas;
        this.baseX = canvas.width * 0.75;
        this.baseY = canvas.height * 0.2;
        this.radius = Math.min(canvas.width, canvas.height) * 0.15;
        this.generateFeatures();
    }

    draw(ctx, time) {
        const x = this.baseX;
        const y = this.baseY;
        const r = this.radius;

        ctx.save();

        // Moon sprite — if available, draw image and skip procedural rendering
        if (this.assets.moon) {
            const img = this.assets.moon;
            const drawSize = r * 2.4;
            const drawW = drawSize * (img.width / img.height);
            ctx.globalAlpha = 0.9;
            ctx.drawImage(img, x - drawW / 2, y - drawSize / 2, drawW, drawSize);
            ctx.restore();
            return;
        }

        // Moon body — subtle gradient (Canvas fallback)
        const grad = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.1, x, y, r);
        grad.addColorStop(0, '#e8e0d0');
        grad.addColorStop(0.6, '#c4b89a');
        grad.addColorStop(1, '#8a7e68');
        ctx.fillStyle = grad;
        ctx.shadowColor = 'rgba(200, 190, 170, 0.4)';
        ctx.shadowBlur = 40;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Crescent shadow — dark arc overlapping to create crescent
        ctx.fillStyle = 'rgba(10, 10, 31, 0.85)';
        ctx.beginPath();
        ctx.arc(x + r * 0.35, y - r * 0.1, r * 0.9, 0, Math.PI * 2);
        ctx.fill();

        // Re-clip to moon circle for craters and bases
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.clip();

        // Craters
        this.craters.forEach(c => {
            const cx = x + c.ox;
            const cy = y + c.oy;
            // Crater shadow
            ctx.fillStyle = 'rgba(90, 80, 60, 0.5)';
            ctx.beginPath();
            ctx.arc(cx, cy, c.r, 0, Math.PI * 2);
            ctx.fill();
            // Crater highlight rim
            ctx.strokeStyle = 'rgba(200, 190, 170, 0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(cx - c.r * 0.15, cy - c.r * 0.15, c.r, -0.5, 1.2);
            ctx.stroke();
        });

        // Moon bases
        this.bases.forEach(b => {
            const bx = x + b.ox;
            const by = y + b.oy;

            // Dome
            ctx.fillStyle = '#aaa';
            ctx.beginPath();
            ctx.arc(bx, by, b.size, Math.PI, 0);
            ctx.fill();
            ctx.fillStyle = '#888';
            ctx.fillRect(bx - b.size, by, b.size * 2, b.size * 0.4);

            // Windows — lit yellowish
            const blink = Math.sin(time * 2 + b.ox) > 0;
            for (let w = 0; w < b.windowCount; w++) {
                const wx = bx - b.size * 0.5 + (w + 0.5) * (b.size / b.windowCount);
                ctx.fillStyle = blink ? '#ffdd66' : '#cc9933';
                ctx.shadowColor = '#ffdd66';
                ctx.shadowBlur = 4;
                ctx.fillRect(wx, by - b.size * 0.4, 2, 2);
                ctx.shadowBlur = 0;
            }

            // Antenna tower
            if (b.hasAntenna) {
                const ax = bx + b.size * 0.3;
                const aTop = by - b.size * 2;
                ctx.strokeStyle = '#bbb';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(ax, by);
                ctx.lineTo(ax, aTop);
                ctx.stroke();
                // Blinking light
                const blinkOn = Math.sin(time * 3 + b.size) > 0.3;
                ctx.fillStyle = blinkOn ? '#ff3333' : '#661111';
                ctx.shadowColor = '#ff3333';
                ctx.shadowBlur = blinkOn ? 6 : 0;
                ctx.beginPath();
                ctx.arc(ax, aTop, 1.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        });

        // NIN logo carved into the moon surface
        drawNINLogo(ctx, x - r * 0.2, y + r * 0.1, r * 0.5, 'scratched', 0.4);

        ctx.restore();
    }
}

// ============================================================
// Mars — Red planet with canyons and dust storms
// ============================================================
class Mars {
    constructor(canvas) {
        this.canvas = canvas;
        this.baseX = canvas.width * Utils.random(0.55, 0.85);
        this.baseY = canvas.height * Utils.random(0.15, 0.8);
        this.radius = Math.min(canvas.width, canvas.height) * Utils.random(0.12, 0.18);
        this.canyons = [];
        this.generateFeatures();
    }

    generateFeatures() {
        this.canyons = [];
        const count = Utils.randomInt(3, 6);
        for (let i = 0; i < count; i++) {
            this.canyons.push({
                angle: Utils.random(-0.6, 0.6),
                len: Utils.random(0.3, 0.8) * this.radius,
                width: Utils.random(1, 3),
                curve: Utils.random(-0.3, 0.3) * this.radius
            });
        }
    }

    resize(canvas) {
        this.canvas = canvas;
        this.baseX = canvas.width * 0.75;
        this.baseY = canvas.height * 0.22;
        this.radius = Math.min(canvas.width, canvas.height) * 0.15;
        this.generateFeatures();
    }

    draw(ctx, time) {
        const x = this.baseX;
        const y = this.baseY;
        const r = this.radius;

        ctx.save();

        // Planet body — rusty red gradient
        const grad = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.05, x, y, r);
        grad.addColorStop(0, '#d4845a');
        grad.addColorStop(0.4, '#c06030');
        grad.addColorStop(0.8, '#8b3a1a');
        grad.addColorStop(1, '#4a1a08');
        ctx.fillStyle = grad;
        ctx.shadowColor = 'rgba(200, 100, 50, 0.3)';
        ctx.shadowBlur = 35;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Clip for surface details
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.clip();

        // Polar ice cap
        ctx.fillStyle = 'rgba(220, 200, 180, 0.3)';
        ctx.beginPath();
        ctx.ellipse(x, y - r * 0.85, r * 0.4, r * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();

        // Canyons (Valles Marineris style)
        ctx.strokeStyle = 'rgba(60, 20, 5, 0.5)';
        for (const c of this.canyons) {
            const sx = x + Math.cos(c.angle - 0.5) * c.len;
            const sy = y + Math.sin(c.angle) * c.len * 0.5;
            const ex = x + Math.cos(c.angle + 0.5) * c.len;
            const ey = y + Math.sin(c.angle + 0.3) * c.len * 0.5;
            ctx.lineWidth = c.width;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.quadraticCurveTo(x + c.curve, y + c.curve * 0.5, ex, ey);
            ctx.stroke();
        }

        // Dust storm patches
        const stormAlpha = 0.08 + 0.05 * Math.sin(time * 0.5);
        ctx.fillStyle = `rgba(210, 160, 100, ${stormAlpha})`;
        ctx.beginPath();
        ctx.ellipse(x + r * 0.2, y + r * 0.1, r * 0.5, r * 0.2, 0.3, 0, Math.PI * 2);
        ctx.fill();

        // NIN logo branded into Mars surface
        drawNINLogo(ctx, x - r * 0.1, y, r * 0.4, 'block', 0.25);

        ctx.restore();
    }
}

// ============================================================
// GasGiant — Jupiter-like with colorful bands
// ============================================================
class GasGiant {
    constructor(canvas) {
        this.canvas = canvas;
        this.baseX = canvas.width * Utils.random(0.55, 0.85);
        this.baseY = canvas.height * Utils.random(0.15, 0.8);
        this.radius = Math.min(canvas.width, canvas.height) * Utils.random(0.15, 0.22);
        this.bands = [];
        this.generateFeatures();
    }

    generateFeatures() {
        this.bands = [];
        const count = Utils.randomInt(5, 8);
        const palette = [
            '#c4956a', '#d4a574', '#a07050', '#e8c090', '#8a6040',
            '#c08050', '#ddb888', '#b87848'
        ];
        for (let i = 0; i < count; i++) {
            this.bands.push({
                yOffset: -0.8 + (i / count) * 1.6,
                height: Utils.random(0.08, 0.2),
                color: palette[Utils.randomInt(0, palette.length - 1)],
                drift: Utils.random(-0.3, 0.3)
            });
        }
        // Great red spot
        this.spotAngle = Utils.random(-0.3, 0.3);
        this.spotY = Utils.random(-0.2, 0.3);
    }

    resize(canvas) {
        this.canvas = canvas;
        this.baseX = canvas.width * 0.75;
        this.baseY = canvas.height * 0.25;
        this.radius = Math.min(canvas.width, canvas.height) * 0.18;
        this.generateFeatures();
    }

    draw(ctx, time) {
        const x = this.baseX;
        const y = this.baseY;
        const r = this.radius;

        ctx.save();

        // Planet body
        const grad = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.1, x, y, r);
        grad.addColorStop(0, '#e8c898');
        grad.addColorStop(0.5, '#c49060');
        grad.addColorStop(1, '#6a4020');
        ctx.fillStyle = grad;
        ctx.shadowColor = 'rgba(200, 160, 100, 0.3)';
        ctx.shadowBlur = 40;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Clip and draw bands
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.clip();

        for (const band of this.bands) {
            const by = y + band.yOffset * r;
            const drift = Math.sin(time * 0.2 + band.drift * 10) * 2;
            ctx.fillStyle = band.color;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.ellipse(x + drift, by, r * 1.1, r * band.height, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Great Red Spot
        const spotX = x + this.spotAngle * r;
        const spotY = y + this.spotY * r;
        const spotGrad = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, r * 0.15);
        spotGrad.addColorStop(0, 'rgba(180, 60, 30, 0.6)');
        spotGrad.addColorStop(1, 'rgba(180, 60, 30, 0)');
        ctx.fillStyle = spotGrad;
        ctx.beginPath();
        ctx.ellipse(spotX, spotY, r * 0.15, r * 0.1, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // NIN logo glowing in the storm bands
        drawNINLogo(ctx, x, y - r * 0.15, r * 0.45, 'glow', 0.2);

        ctx.restore();
    }
}

// ============================================================
// IcePlanet — Blue-white frozen world
// ============================================================
class IcePlanet {
    constructor(canvas) {
        this.canvas = canvas;
        this.baseX = canvas.width * Utils.random(0.55, 0.85);
        this.baseY = canvas.height * Utils.random(0.15, 0.8);
        this.radius = Math.min(canvas.width, canvas.height) * Utils.random(0.1, 0.16);
        this.cracks = [];
        this.generateFeatures();
    }

    generateFeatures() {
        this.cracks = [];
        const count = Utils.randomInt(4, 8);
        for (let i = 0; i < count; i++) {
            const startAngle = Utils.random(0, Math.PI * 2);
            const dist = Utils.random(0.1, 0.7) * this.radius;
            this.cracks.push({
                sx: Math.cos(startAngle) * dist,
                sy: Math.sin(startAngle) * dist,
                angle: startAngle + Utils.random(-0.5, 0.5),
                len: Utils.random(0.2, 0.5) * this.radius,
                branches: Utils.randomInt(0, 2)
            });
        }
    }

    resize(canvas) {
        this.canvas = canvas;
        this.baseX = canvas.width * 0.75;
        this.baseY = canvas.height * 0.2;
        this.radius = Math.min(canvas.width, canvas.height) * 0.13;
        this.generateFeatures();
    }

    draw(ctx, time) {
        const x = this.baseX;
        const y = this.baseY;
        const r = this.radius;

        ctx.save();

        // Planet body — icy blue
        const grad = ctx.createRadialGradient(x - r * 0.2, y - r * 0.3, r * 0.05, x, y, r);
        grad.addColorStop(0, '#e8f4ff');
        grad.addColorStop(0.3, '#a8d8ea');
        grad.addColorStop(0.7, '#5090b0');
        grad.addColorStop(1, '#1a3a50');
        ctx.fillStyle = grad;
        ctx.shadowColor = 'rgba(100, 180, 255, 0.4)';
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Clip
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.clip();

        // Ice cracks
        const shimmer = 0.4 + 0.2 * Math.sin(time * 1.5);
        ctx.strokeStyle = `rgba(200, 230, 255, ${shimmer})`;
        ctx.lineWidth = 0.8;
        for (const c of this.cracks) {
            const ex = c.sx + Math.cos(c.angle) * c.len;
            const ey = c.sy + Math.sin(c.angle) * c.len;
            ctx.beginPath();
            ctx.moveTo(x + c.sx, y + c.sy);
            ctx.lineTo(x + ex, y + ey);
            ctx.stroke();
            // Branches
            for (let b = 0; b < c.branches; b++) {
                const bAngle = c.angle + Utils.random(-0.8, 0.8);
                const bLen = c.len * 0.4;
                ctx.beginPath();
                ctx.moveTo(x + (c.sx + ex) / 2, y + (c.sy + ey) / 2);
                ctx.lineTo(x + (c.sx + ex) / 2 + Math.cos(bAngle) * bLen,
                           y + (c.sy + ey) / 2 + Math.sin(bAngle) * bLen);
                ctx.stroke();
            }
        }

        // Atmospheric glow
        const glowGrad = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 1.1);
        glowGrad.addColorStop(0, 'rgba(100, 180, 255, 0)');
        glowGrad.addColorStop(1, 'rgba(100, 180, 255, 0.08)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.1, 0, Math.PI * 2);
        ctx.fill();

        // NIN logo frozen into the ice
        drawNINLogo(ctx, x + r * 0.05, y + r * 0.1, r * 0.4, 'outline', 0.2);

        ctx.restore();
    }
}

// ============================================================
// RingedPlanet — Saturn-like with tilted rings
// ============================================================
class RingedPlanet {
    constructor(canvas) {
        this.canvas = canvas;
        this.baseX = canvas.width * Utils.random(0.55, 0.85);
        this.baseY = canvas.height * Utils.random(0.15, 0.8);
        this.radius = Math.min(canvas.width, canvas.height) * Utils.random(0.1, 0.15);
        // Pick a random color theme
        const themes = [
            { body: ['#e8d8a0', '#c4a860', '#8a7030'], ring: '#d4c080', glow: 'rgba(200, 180, 100, 0.3)' },
            { body: ['#d0a8c8', '#a06888', '#603050'], ring: '#c090b0', glow: 'rgba(180, 100, 160, 0.3)' },
            { body: ['#a0c8d0', '#608898', '#304850'], ring: '#80b0c0', glow: 'rgba(100, 160, 200, 0.3)' }
        ];
        this.theme = themes[Utils.randomInt(0, themes.length - 1)];
        this.ringTilt = Utils.random(0.25, 0.4);
        this.ringGaps = Utils.randomInt(2, 4);
    }

    resize(canvas) {
        this.canvas = canvas;
        this.baseX = canvas.width * 0.75;
        this.baseY = canvas.height * 0.25;
        this.radius = Math.min(canvas.width, canvas.height) * 0.12;
    }

    draw(ctx, time) {
        const x = this.baseX;
        const y = this.baseY;
        const r = this.radius;
        const t = this.theme;

        ctx.save();

        // Back half of rings (behind planet)
        this.drawRings(ctx, x, y, r, time, true);

        // Planet body
        const grad = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.05, x, y, r);
        grad.addColorStop(0, t.body[0]);
        grad.addColorStop(0.6, t.body[1]);
        grad.addColorStop(1, t.body[2]);
        ctx.fillStyle = grad;
        ctx.shadowColor = t.glow;
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Subtle bands
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.globalAlpha = 0.15;
        for (let i = 0; i < 4; i++) {
            const by = y - r * 0.6 + i * r * 0.35;
            ctx.fillStyle = i % 2 === 0 ? t.body[0] : t.body[2];
            ctx.fillRect(x - r, by, r * 2, r * 0.15);
        }

        // NIN logo stenciled on the planet body
        drawNINLogo(ctx, x, y, r * 0.4, 'stencil', 0.3);

        ctx.restore();

        // Front half of rings (in front of planet)
        this.drawRings(ctx, x, y, r, time, false);

        ctx.restore();
    }

    drawRings(ctx, x, y, r, time, backHalf) {
        const innerR = r * 1.4;
        const outerR = r * 2.2;
        const tilt = this.ringTilt;

        ctx.save();
        ctx.translate(x, y);

        // Draw ring arcs
        const start = backHalf ? Math.PI : 0;
        const end = backHalf ? Math.PI * 2 : Math.PI;

        for (let i = 0; i < this.ringGaps; i++) {
            const ri = innerR + (outerR - innerR) * (i / this.ringGaps);
            const ro = innerR + (outerR - innerR) * ((i + 0.7) / this.ringGaps);
            const alpha = 0.25 - i * 0.04;

            ctx.strokeStyle = this.theme.ring;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = (ro - ri);

            ctx.beginPath();
            ctx.ellipse(0, 0, (ri + ro) / 2, (ri + ro) / 2 * tilt, 0, start, end);
            ctx.stroke();
        }

        ctx.globalAlpha = 1;
        ctx.restore();
    }
}

// ============================================================
// SolarFlare — Bright beam that sweeps vertically across the screen
// ============================================================
class SolarFlare {
    constructor() {
        this.x = 0;
        this.sweepSpeed = 400;
        this.width = 60;
        this.active = false;
        this.warningTimer = 0;
    }

    trigger(canvasW) {
        this.active = true;
        this.x = canvasW + 100;
        this.warningTimer = 2;
        this.startX = canvasW + 100;
    }

    update(dt) {
        if (!this.active) return;
        if (this.warningTimer > 0) {
            this.warningTimer -= dt;
            return;
        }
        this.x -= this.sweepSpeed * dt;
        if (this.x < -this.width) {
            this.active = false;
        }
    }

    draw(ctx, canvasH) {
        if (!this.active) return;

        ctx.save();

        if (this.warningTimer > 0) {
            // Pulsing red warning line at the start position
            const pulse = 0.4 + 0.6 * Math.abs(Math.sin(this.warningTimer * Math.PI * 4));
            ctx.strokeStyle = `rgba(255, 40, 40, ${pulse})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([8, 6]);
            ctx.beginPath();
            ctx.moveTo(this.startX, 0);
            ctx.lineTo(this.startX, canvasH);
            ctx.stroke();
            ctx.setLineDash([]);
        } else {
            // Bright orange-white vertical gradient beam with glow
            const halfW = this.width / 2;
            const grad = ctx.createLinearGradient(this.x - halfW, 0, this.x + halfW, 0);
            grad.addColorStop(0, 'rgba(255, 160, 40, 0)');
            grad.addColorStop(0.2, 'rgba(255, 180, 60, 0.3)');
            grad.addColorStop(0.4, 'rgba(255, 220, 150, 0.7)');
            grad.addColorStop(0.5, 'rgba(255, 255, 240, 1)');
            grad.addColorStop(0.6, 'rgba(255, 220, 150, 0.7)');
            grad.addColorStop(0.8, 'rgba(255, 180, 60, 0.3)');
            grad.addColorStop(1, 'rgba(255, 160, 40, 0)');

            // Outer glow
            ctx.shadowColor = 'rgba(255, 200, 80, 0.8)';
            ctx.shadowBlur = 40;
            ctx.fillStyle = grad;
            ctx.fillRect(this.x - halfW, 0, this.width, canvasH);

            // Core bright line
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#fff';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.fillRect(this.x - 2, 0, 4, canvasH);
        }

        ctx.restore();
    }

    getHitbox() {
        if (!this.active || this.warningTimer > 0) return null;
        return { x: this.x - this.width / 2, width: this.width };
    }
}

// ============================================================
// BlackHole — Gravitational anomaly that pulls nearby objects
// ============================================================
class BlackHole {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.radius = 50;
        this.pullStrength = 300;
        this.active = false;
        this.lifetime = 8;
        this.timer = 0;
    }

    trigger(canvasW, canvasH) {
        this.x = Utils.random(canvasW * 0.3, canvasW * 0.7);
        this.y = Utils.random(canvasH * 0.25, canvasH * 0.75);
        this.radius = Utils.random(40, 60);
        this.active = true;
        this.lifetime = 8;
        this.timer = 0;
    }

    update(dt) {
        if (!this.active) return;
        this.timer += dt;
        if (this.timer >= this.lifetime) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.save();
        const x = this.x;
        const y = this.y;
        const r = this.radius;

        // Warping effect — dark radial gradient
        const warpGrad = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
        warpGrad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
        warpGrad.addColorStop(0.3, 'rgba(10, 0, 30, 0.4)');
        warpGrad.addColorStop(0.6, 'rgba(20, 0, 50, 0.1)');
        warpGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = warpGrad;
        ctx.beginPath();
        ctx.arc(x, y, r * 3, 0, Math.PI * 2);
        ctx.fill();

        // Swirling accretion disk — rotating rings
        const rotSpeed = this.timer * 1.5;
        for (let i = 3; i >= 1; i--) {
            const ringR = r * (1.2 + i * 0.35);
            const alpha = 0.15 + (3 - i) * 0.08;
            ctx.strokeStyle = i % 2 === 0
                ? `rgba(160, 80, 255, ${alpha})`
                : `rgba(80, 120, 255, ${alpha})`;
            ctx.lineWidth = 3 - i * 0.5;
            ctx.beginPath();
            ctx.ellipse(x, y, ringR, ringR * 0.35, rotSpeed + i * 0.8, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Purple/blue event horizon glow
        const glowGrad = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 1.3);
        glowGrad.addColorStop(0, 'rgba(60, 0, 120, 0.8)');
        glowGrad.addColorStop(0.4, 'rgba(100, 40, 200, 0.4)');
        glowGrad.addColorStop(0.7, 'rgba(60, 80, 220, 0.15)');
        glowGrad.addColorStop(1, 'rgba(40, 60, 180, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(x, y, r * 1.3, 0, Math.PI * 2);
        ctx.fill();

        // Dark core
        ctx.fillStyle = '#000';
        ctx.shadowColor = 'rgba(80, 0, 160, 0.8)';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    getPullForce(objX, objY) {
        if (!this.active) return { fx: 0, fy: 0 };
        const dx = this.x - objX;
        const dy = this.y - objY;
        const distSq = dx * dx + dy * dy;
        const maxRange = this.radius * 6;
        if (distSq > maxRange * maxRange || distSq < 1) return { fx: 0, fy: 0 };
        const dist = Math.sqrt(distSq);
        const strength = this.pullStrength / distSq;
        return {
            fx: (dx / dist) * strength,
            fy: (dy / dist) * strength
        };
    }
}

// ============================================================
// AsteroidBelt — Dense debris field that narrows the safe play area
// ============================================================
class AsteroidBelt {
    constructor() {
        this.topY = 0;
        this.bottomY = 0;
        this.active = false;
        this.timer = 0;
        this.lifetime = 10;
        this.particles = [];
    }

    trigger(canvasW, canvasH) {
        this.active = true;
        this.timer = 0;
        this.lifetime = 10;
        this.topY = canvasH * 0.2;
        this.bottomY = canvasH * 0.8;
        this.particles = [];

        for (let i = 0; i < 30; i++) {
            // Place roughly half in the top belt zone, half in the bottom
            const inTop = i < 15;
            const py = inTop
                ? Utils.random(0, this.topY)
                : Utils.random(this.bottomY, canvasH);
            const vertexCount = Utils.randomInt(5, 8);
            const vertices = [];
            for (let v = 0; v < vertexCount; v++) {
                const angle = (v / vertexCount) * Math.PI * 2;
                const rOff = Utils.random(0.6, 1.0);
                vertices.push({ angle, rOff });
            }
            this.particles.push({
                x: Utils.random(0, canvasW),
                y: py,
                vx: Utils.random(-80, -30),
                radius: Utils.random(3, 10),
                rotation: Utils.random(0, Math.PI * 2),
                rotSpeed: Utils.random(-2, 2),
                vertices
            });
        }
    }

    update(dt, canvasW) {
        if (!this.active) return;
        this.timer += dt;
        if (this.timer >= this.lifetime) {
            this.active = false;
            return;
        }
        for (const p of this.particles) {
            p.x += p.vx * dt;
            p.rotation += p.rotSpeed * dt;
            // Wrap around when off-screen left
            if (p.x < -p.radius * 2) {
                p.x = canvasW + p.radius * 2;
            }
        }
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.save();
        ctx.fillStyle = '#6a5a4a';
        ctx.strokeStyle = '#8a7a6a';
        ctx.lineWidth = 1;

        for (const p of this.particles) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);

            // Draw rocky polygon
            ctx.beginPath();
            for (let i = 0; i < p.vertices.length; i++) {
                const v = p.vertices[i];
                const px = Math.cos(v.angle) * p.radius * v.rOff;
                const py = Math.sin(v.angle) * p.radius * v.rOff;
                if (i === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.restore();
        }

        ctx.restore();
    }

    getSafeZone() {
        if (!this.active) return null;
        return { topY: this.topY, bottomY: this.bottomY };
    }
}

// ============================================================
// Background — Assembles all layers
// ============================================================
class Background {
    constructor(canvas, assets) {
        this.canvas = canvas;
        this.assets = assets || {};
        this.time = 0;
        this.layers = [];
        this.celestialBody = Background.randomCelestialBody(canvas, this.assets);
        this.buildLayers();
    }

    buildLayers() {
        this.layers = [];
        const w = this.canvas.width;
        const h = this.canvas.height;
        // Layer 0: distant tiny stars (slow)
        const layer0 = [];
        for (let i = 0; i < 80; i++) {
            layer0.push(new Star(this.canvas, Utils.random(8, 20), Utils.random(0.3, 0.8), Utils.random(0.2, 0.5)));
        }
        // Layer 1: medium stars
        const layer1 = [];
        for (let i = 0; i < 50; i++) {
            layer1.push(new Star(this.canvas, Utils.random(25, 55), Utils.random(0.8, 1.5), Utils.random(0.4, 0.8)));
        }
        // Layer 2: foreground bright stars (fast)
        const layer2 = [];
        for (let i = 0; i < 20; i++) {
            layer2.push(new Star(this.canvas, Utils.random(60, 120), Utils.random(1.2, 2.5), Utils.random(0.6, 1)));
        }
        this.layers = [layer0, layer1, layer2];
    }

    static randomCelestialBody(canvas, assets) {
        // If moon asset is loaded, 30% chance to use it; otherwise pick randomly
        const bodies = ['moon', 'mars', 'gasGiant', 'icePlanet', 'ringedPlanet'];
        const pick = bodies[Utils.randomInt(0, bodies.length - 1)];
        switch (pick) {
            case 'moon':        return new Moon(canvas, assets);
            case 'mars':        return new Mars(canvas);
            case 'gasGiant':    return new GasGiant(canvas);
            case 'icePlanet':   return new IcePlanet(canvas);
            case 'ringedPlanet':return new RingedPlanet(canvas);
            default:            return new Moon(canvas, assets);
        }
    }

    resize(canvas) {
        this.canvas = canvas;
        this.celestialBody.resize(canvas);
        this.buildLayers();
    }

    update(dt) {
        this.time += dt;
        for (const layer of this.layers) {
            for (const star of layer) {
                star.update(dt);
            }
        }
    }

    draw(ctx) {
        // Deep space gradient
        const grad = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        grad.addColorStop(0, '#0a0a1f');
        grad.addColorStop(0.5, '#0d0d2b');
        grad.addColorStop(1, '#0a0a1f');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Distant stars
        for (const star of this.layers[0]) {
            star.draw(ctx, this.time);
        }

        // Celestial body (between distant and medium stars)
        this.celestialBody.draw(ctx, this.time);

        // Medium stars
        for (const star of this.layers[1]) {
            star.draw(ctx, this.time);
        }

        // Foreground stars
        for (const star of this.layers[2]) {
            star.draw(ctx, this.time);
        }
    }
}
