// ============================================================
// animations.js — GSAP-backed cinematic & UI animations
// ============================================================
// Owns all cinematic state and choreography. Game.update() drives
// the ticker via tick(); Game.startGame()/gameOver() call killAll()
// to cancel anything in flight.

import { gsap } from 'gsap';
import { Utils } from './utils.js';

export class Anim {
    constructor({ shake, particles, audio }) {
        this.shake = shake;
        this.particles = particles;
        this.audio = audio;
        this.activeTimelines = [];

        // Detach GSAP from its own RAF — Game.update() drives ticking
        // via tick(gameTime). lagSmoothing(0) disables GSAP's frame-skip
        // catch-up; gameTime is authoritative and pauses with the game.
        gsap.ticker.remove(gsap.updateRoot);
        gsap.ticker.lagSmoothing(0);

        // Per-cinematic visual state — read by Game's render code each frame.
        this.phaseBanner = { visible: false, text: '', alpha: 0, scale: 1, color: '#cc0000' };
        this.waveBanner  = { visible: false, alpha: 0, scale: 1, phase: 0 };
        this.flash       = { alpha: 0, color: '#ffffff' };

        // Menu polish state. menuTimelines is separate from activeTimelines so
        // killAll() (cinematic cancel) does not stop the idle menu loops.
        // The low-HP vignette is also tracked here for the same reason.
        this.menuTitle      = { scale: 1, glow: 25 };
        this.menuPrompt     = { alpha: 1 };
        this.menuDifficulty = { scale: 1 };
        this.menuTimelines  = [];
        this.vignette       = { intensity: 0 };
        this._vignettePulse = null;

        // Game-over reveal state (set by gameOverReveal, read by ui.drawGameOver).
        this.gameOver = {
            alpha: 0,
            scoreScale: 0.5,
            pbScale: 0.5,
            pbAlpha: 0,
            pbDelta: 0,
            isNewBest: false,
            score: 0,
        };
    }

    // Once per frame from Game.update(). gameTime is monotonic seconds.
    // Pause = stop incrementing gameTime → cinematics freeze in place.
    tick(gameTime) {
        gsap.updateRoot(gameTime);
    }

    killAll() {
        for (const tl of this.activeTimelines) tl.kill();
        this.activeTimelines = [];
        this.phaseBanner.visible = false;
        this.phaseBanner.alpha = 0;
        this.waveBanner.visible = false;
        this.waveBanner.alpha = 0;
        this.flash.alpha = 0;
    }

    _track(tl, onAfter) {
        this.activeTimelines.push(tl);
        const prior = tl.eventCallback('onComplete');
        tl.eventCallback('onComplete', () => {
            this.activeTimelines = this.activeTimelines.filter(t => t !== tl);
            if (prior) prior();
            if (onAfter) onAfter();
        });
        return tl;
    }

    // ----- Boss kill cinematic — staged explosions over 2.0s -----
    // Beats preserved from prior state machine: 0.0, 0.3, 0.7, 1.2.
    bossKillCinematic(x, y, onComplete) {
        const tl = gsap.timeline();

        tl.call(() => {
            this.shake.shake(20, 0.5);
            this.particles.createColorExplosion(x, y,
                ['#ffffff', '#ffdd00', '#ff8800'], 40, 400, 1.0, 7);
        });

        tl.call(() => {
            this.shake.shake(15, 0.3);
            this.particles.createColorExplosion(
                x + Utils.random(-30, 30), y + Utils.random(-30, 30),
                ['#ff3366', '#ff6600', '#ffffff'], 30, 350, 0.8, 6);
            this.audio.playExplosion();
        }, null, 0.3);

        tl.call(() => {
            this.shake.shake(12, 0.3);
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const rx = x + Math.cos(angle) * 50;
                const ry = y + Math.sin(angle) * 50;
                this.particles.createColorExplosion(rx, ry,
                    ['#cc0000', '#ff4400', '#ffaa00'], 15, 250, 0.6, 4);
            }
            this.audio.playExplosion();
        }, null, 0.7);

        tl.call(() => {
            this.shake.shake(25, 0.4);
            this.particles.createColorExplosion(x, y,
                ['#ffffff', '#ffffff', '#ffddaa'], 60, 500, 1.2, 8);
            this.audio.playExplosion();
        }, null, 1.2);

        // Pad the timeline to the full 2.0s so onComplete fires at 2.0,
        // not at the last .call (1.2). Preserves the original cinematic length.
        tl.to({}, { duration: 0.8 });

        return this._track(tl, onComplete);
    }

    // ----- Wave-clear banner — gold "WAVE CLEAR" with scale-pop + hold + fade -----
    // Total ~2.5s (matches original _waveClearTimer = 2.5).
    waveClearBanner(phase, onComplete) {
        this.waveBanner.phase = phase;
        this.waveBanner.visible = true;
        this.waveBanner.alpha = 0;
        this.waveBanner.scale = 0.7;

        const tl = gsap.timeline();
        tl.to(this.waveBanner, { alpha: 1, scale: 1.0, duration: 0.35, ease: 'back.out(1.7)' })
          .to(this.waveBanner, { alpha: 1, duration: 1.65 })
          .to(this.waveBanner, { alpha: 0, duration: 0.5, ease: 'power2.out' });

        return this._track(tl, () => {
            this.waveBanner.visible = false;
            if (onComplete) onComplete();
        });
    }

    // ----- Phase announce — generic mid-screen text overlay -----
    // duration = total visible time (default 2.0; phase transitions use 4.0).
    phaseAnnounce(text, { color = '#cc0000', duration = 2.0 } = {}, onComplete) {
        this.phaseBanner.text = text;
        this.phaseBanner.color = color;
        this.phaseBanner.visible = true;
        this.phaseBanner.alpha = 0;
        this.phaseBanner.scale = 0.85;

        const hold = Math.max(0.1, duration - 0.75);
        const tl = gsap.timeline();
        tl.to(this.phaseBanner, { alpha: 1, scale: 1.0, duration: 0.25, ease: 'back.out(1.4)' })
          .to(this.phaseBanner, { alpha: 1, duration: hold })
          .to(this.phaseBanner, { alpha: 0, duration: 0.5, ease: 'power2.out' });

        return this._track(tl, () => {
            this.phaseBanner.visible = false;
            if (onComplete) onComplete();
        });
    }

    // ----- Reusable: screen flash overlay -----
    screenFlash({ color = '#ffffff', intensity = 0.6, duration = 0.15 } = {}) {
        this.flash.color = color;
        this.flash.alpha = 0;
        const tl = gsap.timeline();
        tl.to(this.flash, { alpha: intensity, duration: duration * 0.3, ease: 'power2.out' })
          .to(this.flash, { alpha: 0, duration: duration * 0.7, ease: 'power2.out' });
        return this._track(tl);
    }

    // ----- Reusable: HUD pop — scale overshoot on any numeric prop -----
    popHUD(target, prop, { from = 1.4, to = 1.0, duration = 0.25 } = {}) {
        target[prop] = from;
        const tl = gsap.timeline();
        tl.to(target, { [prop]: to, duration, ease: 'back.out(2)' });
        return this._track(tl);
    }

    // ----- Menu polish — idle loops + input pops -----
    startMenuLoops() {
        this.stopMenuLoops();
        this.menuTitle.scale = 1;
        this.menuTitle.glow = 25;
        this.menuPrompt.alpha = 1;
        this.menuDifficulty.scale = 1;

        const titleTl = gsap.timeline({ repeat: -1, yoyo: true });
        titleTl.to(this.menuTitle,
            { scale: 1.04, glow: 38, duration: 1.8, ease: 'sine.inOut' });
        this.menuTimelines.push(titleTl);

        const promptTl = gsap.timeline({ repeat: -1, yoyo: true });
        promptTl.to(this.menuPrompt,
            { alpha: 0.35, duration: 0.7, ease: 'sine.inOut' });
        this.menuTimelines.push(promptTl);
    }

    stopMenuLoops() {
        for (const tl of this.menuTimelines) tl.kill();
        this.menuTimelines = [];
        this.menuTitle.scale = 1;
        this.menuTitle.glow = 25;
        this.menuPrompt.alpha = 1;
        this.menuDifficulty.scale = 1;
    }

    popDifficulty() {
        this.menuDifficulty.scale = 1.3;
        const tl = gsap.timeline();
        tl.to(this.menuDifficulty,
            { scale: 1.0, duration: 0.3, ease: 'back.out(2)' });
        this.menuTimelines.push(tl);
        tl.eventCallback('onComplete', () => {
            this.menuTimelines = this.menuTimelines.filter(t => t !== tl);
        });
        return tl;
    }

    // Game-over reveal — fades in the panel, pops the score with overshoot,
    // and (if a new personal best) animates a gold "NEW BEST" badge below.
    gameOverReveal({ score, pbDelta = 0, isNewBest = false } = {}) {
        Object.assign(this.gameOver, {
            score,
            pbDelta,
            isNewBest,
            alpha: 0,
            scoreScale: 0.5,
            pbAlpha: 0,
            pbScale: 0.5,
        });
        const tl = gsap.timeline();
        tl.to(this.gameOver, { alpha: 1, duration: 0.4, ease: 'power2.out' });
        tl.to(this.gameOver, { scoreScale: 1.0, duration: 0.5, ease: 'back.out(1.8)' }, '-=0.1');
        if (isNewBest && pbDelta > 0) {
            tl.to(this.gameOver, { pbAlpha: 1, pbScale: 1.0,
                duration: 0.4, ease: 'back.out(2.0)' }, '+=0.2');
            tl.call(() => this.screenFlash({ color: '#ffdd00', intensity: 0.4, duration: 0.3 }), null, '-=0.3');
        }
        return this._track(tl);
    }

    // Low-HP vignette — pulsing red edge gradient. Idempotent start; safe to
    // call every frame while lives are critical. Uses menuTimelines so
    // killAll() (cinematic cancel) leaves it alone.
    startVignette() {
        if (this._vignettePulse) return;
        const tl = gsap.timeline({ repeat: -1, yoyo: true });
        tl.to(this.vignette, { intensity: 0.75, duration: 0.65, ease: 'sine.inOut' });
        this._vignettePulse = tl;
        this.menuTimelines.push(tl);
    }

    stopVignette() {
        if (this._vignettePulse) {
            this.menuTimelines = this.menuTimelines.filter(t => t !== this._vignettePulse);
            this._vignettePulse.kill();
            this._vignettePulse = null;
        }
        gsap.to(this.vignette, { intensity: 0, duration: 0.4, ease: 'power2.out' });
    }
}
