// ============================================================
// utils.js — Utility functions, audio manager, screen shake
// ============================================================

const Utils = {
    random(min, max) {
        return Math.random() * (max - min) + min;
    },

    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },

    circleCollision(x1, y1, r1, x2, y2, r2) {
        return Utils.distance(x1, y1, x2, y2) < r1 + r2;
    },

    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    },

    generateAsteroidShape(radius, vertices) {
        const points = [];
        for (let i = 0; i < vertices; i++) {
            const angle = (i / vertices) * Math.PI * 2;
            const r = radius * Utils.random(0.7, 1.3);
            points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
        }
        return points;
    },

    // Draw image with CSS "cover" behaviour — fills canvas, center-crops overflow
    drawCover(ctx, img, w, h) {
        const imgRatio = img.width / img.height;
        const canvasRatio = w / h;
        let dw, dh, dx, dy;
        if (imgRatio > canvasRatio) {
            dh = h;
            dw = h * imgRatio;
        } else {
            dw = w;
            dh = w / imgRatio;
        }
        dx = (w - dw) / 2;
        dy = (h - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
    }
};

// ============================================================
// ScreenShake
// ============================================================
class ScreenShake {
    constructor() {
        this.intensity = 0;
        this.duration = 0;
        this.timer = 0;
        this.offsetX = 0;
        this.offsetY = 0;
    }

    shake(intensity, duration) {
        if (intensity > this.intensity) {
            this.intensity = intensity;
            this.duration = duration;
            this.timer = duration;
        }
    }

    update(dt) {
        if (this.timer > 0) {
            this.timer -= dt;
            const progress = this.timer / this.duration;
            const cur = this.intensity * progress;
            this.offsetX = (Math.random() - 0.5) * 2 * cur;
            this.offsetY = (Math.random() - 0.5) * 2 * cur;
        } else {
            this.offsetX = 0;
            this.offsetY = 0;
            this.intensity = 0;
        }
    }
}

// ============================================================
// AudioManager — Web Audio API synthesised sound effects
// ============================================================
class AudioManager {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.initialized = false;
        this.masterGain = null;
    }

    init() {
        if (this.initialized) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.5;
            this.masterGain.connect(this.ctx.destination);
            this.initialized = true;
        } catch (e) {
            console.warn('Web Audio API not available');
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.masterGain) {
            this.masterGain.gain.value = this.muted ? 0 : 0.5;
        }
        return this.muted;
    }

    playLaser() {
        if (!this.ctx || this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.08);
    }

    playExplosion() {
        if (!this.ctx || this.muted) return;
        const now = this.ctx.currentTime;

        // Layer 1: Punchy low thump
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.3);
        oscGain.gain.setValueAtTime(0.5, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(oscGain);
        oscGain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.3);

        // Layer 2: Noise crackle with resonance
        const len = 0.5;
        const bufferSize = Math.floor(this.ctx.sampleRate * len);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            // Shaped noise — sharp attack, rumbling tail
            const t = i / bufferSize;
            const env = t < 0.05 ? t / 0.05 : Math.pow(1 - t, 2);
            data[i] = (Math.random() * 2 - 1) * env;
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + len);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3500, now);
        filter.frequency.exponentialRampToValueAtTime(60, now + len);
        filter.Q.setValueAtTime(5, now);
        filter.Q.linearRampToValueAtTime(0.5, now + len * 0.5);
        source.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        source.start(now);

        // Layer 3: Mid-frequency crunch (delayed slightly)
        const osc2 = this.ctx.createOscillator();
        const osc2Gain = this.ctx.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(200, now + 0.02);
        osc2.frequency.exponentialRampToValueAtTime(40, now + 0.25);
        osc2Gain.gain.setValueAtTime(0, now);
        osc2Gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
        osc2Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc2.connect(osc2Gain);
        osc2Gain.connect(this.masterGain);
        osc2.start(now);
        osc2.stop(now + 0.25);
    }

    playSmallExplosion() {
        if (!this.ctx || this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.15);
    }

    playPowerUp() {
        if (!this.ctx || this.muted) return;
        const now = this.ctx.currentTime;
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            const t = now + i * 0.06;
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start(t);
            osc.stop(t + 0.15);
        });
    }

    playGameOver() {
        if (!this.ctx || this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc2.type = 'square';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(55, now + 1.5);
        osc2.frequency.setValueAtTime(438, now);
        osc2.frequency.exponentialRampToValueAtTime(54, now + 1.5);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0, now + 1.5);
        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc2.start(now);
        osc.stop(now + 1.5);
        osc2.stop(now + 1.5);
    }

    playHit() {
        if (!this.ctx || this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(60, now + 0.25);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.25);
    }

    playEnemyLaser() {
        if (!this.ctx || this.muted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now);
        osc.stop(now + 0.1);
    }
}

// ============================================================
// MusicManager — Procedural dark ambient / industrial background music
// ============================================================
class MusicManager {
    constructor(audioCtx, masterGain) {
        this.ctx = audioCtx;
        this.masterGain = masterGain;
        this.playing = false;
        this.intensity = 0.5;
        this.nodes = [];          // all oscillators/sources to stop on stop()
        this.gains = {};          // named gain nodes for intensity control
        this.hitTimer = null;
    }

    start() {
        if (this.playing || !this.ctx) return;

        // Ensure AudioContext is running (browser autoplay policy)
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        this.playing = true;

        // ---- Master bus for all music layers ----
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = 0.55;          // audible but not overpowering
        this.musicBus.connect(this.masterGain);

        this._startBassDrone();
        this._startMidPad();
        this._startAtmosphericShimmer();
        this._scheduleIndustrialHit();
    }

    stop() {
        if (!this.playing) return;
        this.playing = false;

        // Stop all running oscillators / sources
        const now = this.ctx.currentTime;
        this.nodes.forEach(n => {
            try { n.stop(now + 0.05); } catch (_) { /* already stopped */ }
        });
        this.nodes = [];

        // Fade music bus out quickly
        if (this.musicBus) {
            this.musicBus.gain.linearRampToValueAtTime(0, now + 0.1);
            setTimeout(() => {
                try { this.musicBus.disconnect(); } catch (_) {}
            }, 200);
        }

        if (this.hitTimer) {
            clearTimeout(this.hitTimer);
            this.hitTimer = null;
        }

        this.gains = {};
    }

    /**
     * Set energy level 0-1.  0 = near-silent deep drone only,
     * 1 = all layers at full designed volume.
     */
    setIntensity(level) {
        this.intensity = Math.max(0, Math.min(1, level));
        if (!this.playing) return;
        const now = this.ctx.currentTime;

        // Bass drone: always present but scales 0.4 - 1.0
        if (this.gains.bass) {
            this.gains.bass.gain.linearRampToValueAtTime(
                0.4 + this.intensity * 0.6, now + 0.3);
        }
        // Mid pad: scales 0 - 1
        if (this.gains.pad) {
            this.gains.pad.gain.linearRampToValueAtTime(
                this.intensity, now + 0.3);
        }
        // Shimmer: scales 0.2 - 1
        if (this.gains.shimmer) {
            this.gains.shimmer.gain.linearRampToValueAtTime(
                0.2 + this.intensity * 0.8, now + 0.3);
        }
    }

    // ---- Layer 1: Deep bass drone ----
    _startBassDrone() {
        const now = this.ctx.currentTime;

        // Primary sine drone
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 45;

        // Slow LFO modulating the drone pitch between ~40-55 Hz
        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.07;              // very slow wobble

        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 7;                   // +/- 7 Hz swing
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        // Volume envelope
        const gain = this.ctx.createGain();
        gain.gain.value = 0.7;
        this.gains.bass = gain;

        // Subtle sub-harmonic layer for warmth
        const sub = this.ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.value = 22.5;              // one octave below
        const subGain = this.ctx.createGain();
        subGain.gain.value = 0.3;

        osc.connect(gain);
        sub.connect(subGain);
        subGain.connect(gain);
        gain.connect(this.musicBus);

        osc.start(now);
        lfo.start(now);
        sub.start(now);
        this.nodes.push(osc, lfo, sub);
    }

    // ---- Layer 2: Pulsing mid-frequency pad ----
    _startMidPad() {
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 140;

        // Bandpass filter to keep only the narrow mid band
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 160;
        bp.Q.value = 4;

        // Amplitude LFO for pulsing effect
        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.25;              // gentle pulse

        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 0.15;

        const padGain = this.ctx.createGain();
        padGain.gain.value = 0.20;               // audible pad volume

        // Intensity multiplier
        const intensityGain = this.ctx.createGain();
        intensityGain.gain.value = this.intensity;
        this.gains.pad = intensityGain;

        // LFO modulates padGain amplitude
        lfo.connect(lfoGain);
        lfoGain.connect(padGain.gain);

        osc.connect(bp);
        bp.connect(padGain);
        padGain.connect(intensityGain);
        intensityGain.connect(this.musicBus);

        osc.start(now);
        lfo.start(now);
        this.nodes.push(osc, lfo);
    }

    // ---- Layer 3: Occasional metallic / industrial hits ----
    _scheduleIndustrialHit() {
        if (!this.playing) return;

        // Random delay between 4-8 seconds
        const delay = (4 + Math.random() * 4) * 1000;
        this.hitTimer = setTimeout(() => {
            if (!this.playing) return;
            this._fireHit();
            this._scheduleIndustrialHit();
        }, delay);
    }

    _fireHit() {
        if (!this.ctx || !this.playing) return;
        const now = this.ctx.currentTime;

        // Noise burst
        const len = 0.15 + Math.random() * 0.15;
        const sampleRate = this.ctx.sampleRate;
        const bufSize = Math.floor(sampleRate * len);
        const buf = this.ctx.createBuffer(1, bufSize, sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) {
            const t = i / bufSize;
            const env = t < 0.02 ? t / 0.02 : Math.pow(1 - t, 3);
            data[i] = (Math.random() * 2 - 1) * env;
        }

        const src = this.ctx.createBufferSource();
        src.buffer = buf;

        // Resonant bandpass gives metallic character
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 800 + Math.random() * 2400;  // random timbre
        bp.Q.value = 15 + Math.random() * 25;

        const gain = this.ctx.createGain();
        const vol = (0.10 + Math.random() * 0.12) * this.intensity;
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + len);

        src.connect(bp);
        bp.connect(gain);
        gain.connect(this.musicBus);
        src.start(now);

        // Clean up — don't accumulate in this.nodes since they auto-stop
        src.onended = () => {
            try { bp.disconnect(); gain.disconnect(); } catch (_) {}
        };
    }

    // ---- Layer 4: High atmospheric shimmer ----
    _startAtmosphericShimmer() {
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 3800;

        // Slow detuned second oscillator for beating
        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = 3803;              // 3 Hz beating

        // Tremolo LFO
        const trem = this.ctx.createOscillator();
        trem.type = 'sine';
        trem.frequency.value = 0.4;

        const tremGain = this.ctx.createGain();
        tremGain.gain.value = 0.015;

        const shimGain = this.ctx.createGain();
        shimGain.gain.value = 0.015;              // very quiet

        // Intensity multiplier
        const intensityGain = this.ctx.createGain();
        intensityGain.gain.value = 0.2 + this.intensity * 0.8;
        this.gains.shimmer = intensityGain;

        // Tremolo modulates shimmer volume
        trem.connect(tremGain);
        tremGain.connect(shimGain.gain);

        osc.connect(shimGain);
        osc2.connect(shimGain);
        shimGain.connect(intensityGain);
        intensityGain.connect(this.musicBus);

        osc.start(now);
        osc2.start(now);
        trem.start(now);
        this.nodes.push(osc, osc2, trem);
    }
}

// ============================================================
// Asset manifest — drop PNGs into assets/ to upgrade visuals
// ============================================================
const ASSET_MANIFEST = {
    splashBg:    'assets/splash-bg.png',
    gameoverBg:  'assets/gameover-bg.png',
    playerShip:  'assets/player-ship.png',
    enemySmall:  'assets/enemy-small.png',
    enemyLarge:  'assets/enemy-large.png',
    moon:        'assets/moon.png',
    puRapidFire: 'assets/powerups/rapid-fire.png',
    puTripleShot:'assets/powerups/triple-shot.png',
    puShield:    'assets/powerups/shield.png',
    puExtraLife: 'assets/powerups/extra-life.png'
};

// Maps power-up type keys to asset keys
const POWERUP_ASSET_MAP = {
    RAPID_FIRE:  'puRapidFire',
    TRIPLE_SHOT: 'puTripleShot',
    SHIELD:      'puShield',
    EXTRA_LIFE:  'puExtraLife'
};

// ============================================================
// AssetLoader — Preloads images, silently skips missing ones
// ============================================================
class AssetLoader {
    constructor() {
        this.assets = {};
        this.loaded = 0;
        this.total = 0;
    }

    load(manifest) {
        const entries = Object.entries(manifest);
        this.total = entries.length;
        this.loaded = 0;

        const promises = entries.map(([key, path]) => {
            return new Promise(resolve => {
                const img = new Image();
                img.onload = () => {
                    this.assets[key] = img;
                    this.loaded++;
                    resolve();
                };
                img.onerror = () => {
                    this.assets[key] = null; // graceful fallback
                    this.loaded++;
                    resolve();
                };
                img.src = path;
            });
        });

        return Promise.all(promises).then(() => this.assets);
    }

    getProgress() {
        return this.total === 0 ? 1 : this.loaded / this.total;
    }

    // Draw a loading bar on canvas while assets load
    static drawLoadingScreen(ctx, canvas, progress) {
        const w = canvas.width;
        const h = canvas.height;

        // Background
        ctx.fillStyle = '#0a0a1f';
        ctx.fillRect(0, 0, w, h);

        // Title
        ctx.textAlign = 'center';
        ctx.font = `bold ${Math.min(w * 0.05, 36)}px Courier New`;
        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 15;
        ctx.fillText('GALACTIC DEFENDER', w / 2, h * 0.4);

        // Loading text
        ctx.shadowBlur = 0;
        ctx.font = '14px Courier New';
        ctx.fillStyle = '#888';
        ctx.fillText('LOADING ASSETS...', w / 2, h * 0.52);

        // Progress bar
        const barW = Math.min(300, w * 0.6);
        const barH = 6;
        const bx = (w - barW) / 2;
        const by = h * 0.57;
        ctx.fillStyle = '#222';
        ctx.fillRect(bx, by, barW, barH);
        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 8;
        ctx.fillRect(bx, by, barW * progress, barH);
        ctx.shadowBlur = 0;
    }
}
