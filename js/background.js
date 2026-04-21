// ============================================================
// background.js — Multi-layer parallax starfield with moon
// ============================================================

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
    constructor(canvas) {
        this.canvas = canvas;
        this.baseX = canvas.width * 0.75;
        this.baseY = canvas.height * 0.2;
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

        // Moon body — subtle gradient
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

        ctx.restore();
    }
}

// ============================================================
// Background — Assembles all layers
// ============================================================
class Background {
    constructor(canvas) {
        this.canvas = canvas;
        this.time = 0;
        this.layers = [];
        this.moon = new Moon(canvas);
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

    resize(canvas) {
        this.canvas = canvas;
        this.moon.resize(canvas);
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

        // Moon (between distant and medium stars)
        this.moon.draw(ctx, this.time);

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
