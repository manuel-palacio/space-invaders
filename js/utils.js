// ============================================================
// utils.js — Utility functions, audio manager, screen shake
// ============================================================

// Global scale factor — 1.0 at 1920px width, scales down on smaller screens
let GAME_SCALE = 1.0;
function updateGameScale(canvasWidth) {
    GAME_SCALE = Math.max(0.5, Math.min(1.0, canvasWidth / 1200));
}

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
            // Separate SFX bus — audible but quieter than music
            this.sfxGain = this.ctx.createGain();
            this.sfxGain.gain.value = 0.6;
            this.sfxGain.connect(this.masterGain);
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
        oscGain.gain.setValueAtTime(1.0, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(oscGain);
        oscGain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.3);

        // Layer 2: Noise crackle with resonance
        const len = 0.5;
        const bufferSize = Math.floor(this.ctx.sampleRate * len);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            const t = i / bufferSize;
            const env = t < 0.05 ? t / 0.05 : Math.pow(1 - t, 2);
            data[i] = (Math.random() * 2 - 1) * env;
        }
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.8, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + len);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(3500, now);
        filter.frequency.exponentialRampToValueAtTime(60, now + len);
        filter.Q.setValueAtTime(5, now);
        filter.Q.linearRampToValueAtTime(0.5, now + len * 0.5);
        source.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.sfxGain);
        source.start(now);

        // Layer 3: Mid-frequency crunch (delayed slightly)
        const osc2 = this.ctx.createOscillator();
        const osc2Gain = this.ctx.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(200, now + 0.02);
        osc2.frequency.exponentialRampToValueAtTime(40, now + 0.25);
        osc2Gain.gain.setValueAtTime(0, now);
        osc2Gain.gain.linearRampToValueAtTime(0.4, now + 0.02);
        osc2Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc2.connect(osc2Gain);
        osc2Gain.connect(this.sfxGain);
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
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(this.sfxGain);
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
            gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            osc.connect(gain);
            gain.connect(this.sfxGain);
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
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0, now + 1.5);
        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(this.sfxGain);
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
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        gain.connect(this.sfxGain);
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
        gain.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.1);
    }

    startDeathRay() {
        if (!this.ctx || this.muted) return;
        if (this._deathRayNodes) this.stopDeathRay();
        const now = this.ctx.currentTime;

        // Continuous frying/sizzle noise
        const bufLen = 2;
        const sr = this.ctx.sampleRate;
        const buf = this.ctx.createBuffer(1, sr * bufLen, sr);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1);
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;
        noise.loop = true;

        // Bandpass for electric sizzle
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 2000;
        bp.Q.value = 3;

        // Low rumble oscillator
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 80;

        const oscGain = this.ctx.createGain();
        oscGain.gain.value = 0.15;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.value = 0.25;

        noise.connect(bp);
        bp.connect(noiseGain);
        noiseGain.connect(this.sfxGain);
        osc.connect(oscGain);
        oscGain.connect(this.sfxGain);

        noise.start(now);
        osc.start(now);

        this._deathRayNodes = [noise, osc];
        this._deathRayGains = [noiseGain, oscGain];
    }

    stopDeathRay() {
        if (!this._deathRayNodes) return;
        const now = this.ctx.currentTime;
        this._deathRayGains.forEach(g => {
            g.gain.linearRampToValueAtTime(0, now + 0.1);
        });
        setTimeout(() => {
            this._deathRayNodes.forEach(n => { try { n.stop(); } catch(_){} });
            this._deathRayNodes = null;
            this._deathRayGains = null;
        }, 150);
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

        // Track playlist — shuffled each game
        this.tracks = [
            'assets/collectormaster.mp3',
            'assets/discipline.mp3',
            'assets/end.mp3',
            'assets/capital.mp3',
            'assets/soldier.mp3',
            'assets/destroyer.mp3',
            'assets/deep.mp3',
            'assets/pretty.mp3',
            'assets/entity.mp3'
        ];
        this.trackIndex = 0;

        // Create Audio element and wire through Web Audio
        this.audio = new Audio();
        this.audio.volume = 0.5;

        if (this.ctx) {
            this.source = this.ctx.createMediaElementSource(this.audio);
            this.gainNode = this.ctx.createGain();
            this.gainNode.gain.value = 0.5;
            this.source.connect(this.gainNode);
            this.gainNode.connect(this.masterGain);
        }

        // When a track ends, pick a random different one
        this.audio.addEventListener('ended', () => {
            if (!this.playing) return;
            this._playRandom();
        });
    }

    _playRandom() {
        // Pick a random track, avoiding the one that just played
        let next;
        do {
            next = Math.floor(Math.random() * this.tracks.length);
        } while (next === this.trackIndex && this.tracks.length > 1);
        this.trackIndex = next;
        this.audio.src = this.tracks[next];
        this.audio.play().catch(() => {});
    }

    start() {
        if (this.playing) return;

        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        this.playing = true;
        this.trackIndex = -1; // no previous track
        this._playRandom();
    }

    stop() {
        if (!this.playing) return;
        this.playing = false;
        this.audio.pause();
        this.audio.currentTime = 0;
    }

    /**
     * Set energy level 0-1. Scales volume from 0.3 (quiet) to 0.7 (full).
     */
    setIntensity(level) {
        this.intensity = Math.max(0, Math.min(1, level));
        if (!this.playing) return;
        const vol = 0.3 + this.intensity * 0.4;
        if (this.gainNode) {
            this.gainNode.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.3);
        } else {
            this.audio.volume = vol;
        }
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

        // Background — pure black
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, w, h);

        // Title — blood red
        ctx.textAlign = 'center';
        ctx.font = `bold ${Math.min(w * 0.05, 36)}px Courier New`;
        ctx.fillStyle = '#cc0000';
        ctx.shadowColor = '#cc0000';
        ctx.shadowBlur = 15;
        ctx.fillText('NIN DEFENDER', w / 2, h * 0.4);

        // Loading text
        ctx.shadowBlur = 0;
        ctx.font = '13px Courier New';
        ctx.fillStyle = '#444';
        ctx.fillText('LOADING...', w / 2, h * 0.52);

        // Progress bar — red fill on dark grey
        const barW = Math.min(300, w * 0.6);
        const barH = 4;
        const bx = (w - barW) / 2;
        const by = h * 0.57;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(bx, by, barW, barH);
        ctx.fillStyle = '#cc0000';
        ctx.shadowColor = '#cc0000';
        ctx.shadowBlur = 6;
        ctx.fillRect(bx, by, barW * progress, barH);
        ctx.shadowBlur = 0;
    }
}
