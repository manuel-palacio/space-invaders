// ============================================================
// ui.js — UIRenderer: HUD, menu, pause, game-over, wave-clear
// ============================================================
// All non-gameplay canvas drawing lives here. The renderer holds a
// direct reference to the Game instance and reads state from it; it
// also owns its own local caches (scan-line image, quote word layout)
// since those exist purely for rendering.

import { Utils } from './utils.js';
import { PHASES } from './enemies.js';

export class UIRenderer {
    constructor(game) {
        this.game = game;
        this._scanCanvas = null;
        this._quoteWordPositions = null;
    }

    _getScanLines(w, h) {
        if (this._scanCanvas && this._scanCanvas.width === w && this._scanCanvas.height === h) {
            return this._scanCanvas;
        }
        this._scanCanvas = document.createElement('canvas');
        this._scanCanvas.width = w;
        this._scanCanvas.height = h;
        const sCtx = this._scanCanvas.getContext('2d');
        sCtx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        for (let y = 0; y < h; y += 4) sCtx.fillRect(0, y, w, 2);
        return this._scanCanvas;
    }

    // ----- HUD ----- (NIN industrial palette)
    drawHUD(ctx) {
        const g = this.game;
        const w = g.canvas.width;
        const h = g.canvas.height;

        ctx.save();
        // Score — top left
        ctx.font = 'bold 22px Courier New';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#cc0000';
        ctx.shadowColor = '#cc0000';
        ctx.shadowBlur = 6;
        ctx.fillText(`SCORE: ${g.score}`, 16, 34);
        ctx.font = '14px Courier New';
        ctx.fillStyle = '#555';
        ctx.shadowBlur = 0;
        ctx.fillText(`HI: ${g.highScore}`, 16, 54);

        // Scrap counter with pulse on gain
        if (g.scrapPulse > 0) g.scrapPulse -= 0.02;
        const scrapGlow = Math.max(0, g.scrapPulse);
        ctx.fillStyle = scrapGlow > 0 ? `rgb(${153 + Math.floor(102 * scrapGlow)}, ${51 + Math.floor(153 * scrapGlow)}, 0)` : '#993300';
        if (scrapGlow > 0) { ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 8 * scrapGlow; }
        ctx.fillText(`SCRAP: ${g.player.scrap}`, 16, 70);
        ctx.shadowBlur = 0;

        // Combo display
        if (g.player.combo >= 3) {
            const mult = g.player.getComboMultiplier();
            const comboPulse = 0.7 + 0.3 * Math.sin(g.time * 8);
            ctx.font = `bold ${16 + mult * 2}px Courier New`;
            ctx.fillStyle = mult >= 4 ? '#ff2200' : mult >= 3 ? '#cc0000' : '#993300';
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 8 * comboPulse;
            ctx.fillText(`COMBO x${mult} (${g.player.combo})`, 16, 88);
            ctx.shadowBlur = 0;
        }

        // Lives — top right (ship icons)
        for (let i = 0; i < g.player.lives; i++) {
            const lx = w - 30 - i * 30;
            const ly = 28;
            ctx.fillStyle = '#cc0000';
            ctx.shadowColor = '#cc0000';
            ctx.shadowBlur = 4;
            ctx.beginPath();
            ctx.moveTo(lx + 10, ly);
            ctx.lineTo(lx - 5, ly - 7);
            ctx.lineTo(lx - 2, ly);
            ctx.lineTo(lx - 5, ly + 7);
            ctx.closePath();
            ctx.fill();
        }

        // Active power-up indicators
        let puY = 70;
        ctx.font = '12px Courier New';
        ctx.textAlign = 'left';
        ctx.shadowBlur = 0;

        if (g.player.rapidFire) {
            ctx.fillStyle = '#cc0000';
            ctx.fillText(`RAPID FIRE ${Math.ceil(g.player.rapidFireTimer)}s`, 16, puY);
            puY += 18;
        }
        if (g.player.tripleShot) {
            ctx.fillStyle = '#993300';
            ctx.fillText(`TRIPLE SHOT ${Math.ceil(g.player.tripleShotTimer)}s`, 16, puY);
            puY += 18;
        }
        if (g.player.shield) {
            ctx.fillStyle = '#888';
            ctx.fillText(`SHIELD ${Math.ceil(g.player.shieldTimer)}s`, 16, puY);
            puY += 18;
        }
        if (g.player.activeShield) {
            ctx.fillStyle = '#aaa';
            ctx.fillText(`SHIELD ACTIVE ${Math.ceil(g.player.activeShieldTimer)}s`, 16, puY);
            puY += 18;
        }
        if (g.player.ricochet) {
            ctx.fillStyle = '#ff8800';
            ctx.fillText(`RICOCHET ${Math.ceil(g.player.ricochetTimer)}s`, 16, puY);
            puY += 18;
        }
        if (g.player.wingman) {
            ctx.fillStyle = '#4488ff';
            ctx.fillText(`WINGMAN ${Math.ceil(g.player.wingmanTimer)}s`, 16, puY);
            puY += 18;
        }
        if (g.player.timeWarp) {
            ctx.fillStyle = '#00ddff';
            ctx.fillText(`TIME WARP ${Math.ceil(g.player.timeWarpTimer)}s`, 16, puY);
            puY += 18;
        }
        if (g.player.laserBeam) {
            ctx.fillStyle = '#ff0066';
            ctx.fillText(`LASER BEAM ${Math.ceil(g.player.laserBeamTimer)}s`, 16, puY);
            puY += 18;
        }
        if (g.player.nukeOvercharge) {
            ctx.fillStyle = '#ff4400';
            ctx.fillText(`NUKE READY`, 16, puY);
            puY += 18;
        }
        // Power combo indicator
        const puCount = g.player.getActivePowerUpCount();
        if (puCount >= 2) {
            const comboMul = g.player.getPowerComboMultiplier();
            const comboPulse = 0.7 + 0.3 * Math.sin(g.time * 6);
            ctx.font = `bold ${14 + puCount * 2}px Courier New`;
            ctx.fillStyle = puCount >= 3 ? '#ff2200' : '#ff8800';
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 10 * comboPulse;
            ctx.fillText(`POWER COMBO x${comboMul}`, 16, puY);
            ctx.shadowBlur = 0;
            puY += 18;
        }
        // Synergy label — distinct combo names for the active power-up pairing
        const synergy = g.player.getActiveSynergy();
        if (synergy) {
            const labels = {
                CHAIN_REACTION: 'CHAIN REACTION',
                FIRE_SUPPORT:   'FIRE SUPPORT',
                PIERCE_SHOT:    'PIERCE SHOT',
                PENTA_SPREAD:   'PENTA SPREAD',
                BOUNCE_DRONE:   'BOUNCE DRONE',
            };
            const synergyPulse = 0.7 + 0.3 * Math.sin(g.time * 7);
            ctx.font = 'bold 13px Courier New';
            ctx.fillStyle = '#ff00ff';
            ctx.shadowColor = '#ff00ff';
            ctx.shadowBlur = 8 * synergyPulse;
            ctx.fillText(`SYNERGY: ${labels[synergy]}`, 16, puY);
            ctx.shadowBlur = 0;
            puY += 18;
        }

        // Boss preview panel — replaces the phase announcement during the
        // first ~2 seconds of a transition when a boss is incoming. Fades
        // out over the last 0.4s so it transitions cleanly to the phase name.
        if (g._bossPreview) {
            const bp = g._bossPreview;
            const fade = Math.min(1, bp.timer / 0.4);
            ctx.save();
            ctx.globalAlpha = fade;
            ctx.textAlign = 'center';

            // Subtle dark panel behind the text (not full-screen)
            const panelW = Math.min(w * 0.45, 380);
            const panelH = 90;
            const panelX = (w - panelW) / 2;
            const panelY = h * 0.12;
            ctx.fillStyle = 'rgba(8, 4, 4, 0.78)';
            ctx.fillRect(panelX, panelY, panelW, panelH);
            ctx.strokeStyle = bp.color;
            ctx.shadowColor = bp.color;
            ctx.shadowBlur = 12;
            ctx.lineWidth = 2;
            ctx.strokeRect(panelX, panelY, panelW, panelH);

            // Header line
            ctx.shadowBlur = 6;
            ctx.font = `bold 13px Courier New`;
            ctx.fillStyle = '#cccccc';
            ctx.fillText(`INCOMING — TIER ${bp.tier}`, w / 2, panelY + 20);

            // Boss name
            ctx.font = `bold 22px Courier New`;
            ctx.fillStyle = bp.color;
            ctx.fillText(bp.name, w / 2, panelY + 48);

            // Full HP bar preview
            ctx.shadowBlur = 0;
            const barW = panelW * 0.7;
            const barH = 8;
            const barX = (w - barW) / 2;
            const barY = panelY + 64;
            ctx.fillStyle = '#222';
            ctx.fillRect(barX, barY, barW, barH);
            ctx.fillStyle = bp.color;
            ctx.shadowColor = bp.color;
            ctx.shadowBlur = 8;
            ctx.fillRect(barX, barY, barW, barH); // full
            ctx.shadowBlur = 0;
            ctx.font = '11px Courier New';
            ctx.fillStyle = '#888';
            ctx.fillText(`${bp.maxHp} HP`, w / 2, barY + 22);

            ctx.restore();
        }

        // Phase announcement — center screen, fading (driven by GSAP via Anim)
        if (g.anim.phaseBanner.visible && !g._bossPreview) {
            const pb = g.anim.phaseBanner;
            ctx.save();
            ctx.globalAlpha = pb.alpha;
            ctx.textAlign = 'center';
            const baseSize = Math.min(w * 0.035, 28);
            ctx.font = `bold ${baseSize * pb.scale}px Courier New`;
            ctx.fillStyle = pb.color;
            ctx.shadowColor = pb.color;
            ctx.shadowBlur = 12;
            ctx.fillText(`— ${pb.text} —`, w / 2, h * 0.15);
            ctx.font = '13px Courier New';
            ctx.fillStyle = '#666';
            ctx.shadowBlur = 0;
            ctx.fillText(`PHASE ${g.lastPhase + 1}`, w / 2, h * 0.15 + 25);
            ctx.restore();
        }

        // Current phase indicator + speed run timer — top center
        if (g.lastPhase >= 0 && !g.anim.phaseBanner.visible) {
            ctx.font = 'bold 13px Courier New';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#888';
            ctx.shadowColor = '#cc0000';
            ctx.shadowBlur = 3;
            const phaseTime = Math.floor(g.time - g.phaseStartTime);
            const mins = Math.floor(phaseTime / 60);
            const secs = phaseTime % 60;
            const timeStr = mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
            ctx.fillText(`PHASE ${g.lastPhase + 1}: ${PHASES[g.lastPhase].name}  [${timeStr}]`, w / 2, 20);
            ctx.shadowBlur = 0;
        }

        // NIN quote — words flash one at a time at random positions
        if (g.quoteTimer > 0 && !g.anim.phaseBanner.visible && !g.bossActive && h > 350) {
            const elapsed = g.quoteDuration - g.quoteTimer;
            const words = g.quoteText.split(' ');
            // Scale word timing so long quotes still fit within ~8 seconds
            const wordDuration = Math.min(0.9, 7.0 / Math.max(words.length, 1));
            const totalDuration = words.length * wordDuration + 1.0;

            // Only render during the word sequence
            if (elapsed < totalDuration) {
                // Position words near center with slight scatter + cycling color
                const wordColors = ['#ffdd00', '#ff2200', '#00ff44', '#ff8800', '#00ddff', '#ff00ff', '#ff4488', '#88ff00'];
                if (!this._quoteWordPositions) {
                    const centerX = w / 2;
                    const centerY = h * 0.45;
                    const shuffled = [...wordColors].sort(() => Math.random() - 0.5);
                    this._quoteWordPositions = words.map((_, i) => ({
                        x: centerX + (Math.random() - 0.5) * w * 0.15,
                        y: centerY + (Math.random() - 0.5) * h * 0.08,
                        color: shuffled[i % shuffled.length]
                    }));
                }

                ctx.save();
                const fontSize = Math.min(w * 0.06, 48);
                ctx.textAlign = 'center';

                for (let i = 0; i < words.length; i++) {
                    const wordStart = i * wordDuration;
                    const wordTime = elapsed - wordStart;
                    if (wordTime < 0) continue;

                    const fadeDuration = 2.5;
                    let alpha;
                    if (wordTime < 0.1) {
                        alpha = wordTime / 0.1;
                    } else if (wordTime < 0.5) {
                        alpha = 1.0;
                    } else if (wordTime < 0.5 + fadeDuration) {
                        alpha = 1.0 - (wordTime - 0.5) / fadeDuration;
                    } else {
                        alpha = 0;
                    }

                    if (alpha <= 0.01) continue;

                    const pos = this._quoteWordPositions[i];
                    const scale = wordTime < 0.15 ? 1.3 - (wordTime / 0.15) * 0.3 : 1.0;
                    const rotation = ((i * 7 + 3) % 11 - 5) * 0.06;

                    ctx.globalAlpha = alpha;

                    ctx.save();
                    ctx.translate(pos.x, pos.y);
                    ctx.scale(scale, scale);
                    ctx.rotate(rotation);

                    ctx.font = `bold ${fontSize}px Impact, Arial Black, sans-serif`;
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 6;
                    ctx.lineJoin = 'round';
                    ctx.strokeText(words[i], 0, 0);

                    ctx.fillStyle = pos.color;
                    ctx.shadowColor = pos.color;
                    ctx.shadowBlur = wordTime < 0.2 ? 20 : 6;
                    ctx.fillText(words[i], 0, 0);

                    ctx.restore();
                }

                ctx.restore();
            }
        }

        // Shield charges — bottom left
        ctx.font = '13px Courier New';
        ctx.textAlign = 'left';
        const chargeY = h - 20;
        if (g.player.shieldRecharging) {
            const frac = 1 - g.player.shieldRechargeTimer / g.player.shieldRechargeDuration;
            ctx.fillStyle = '#444';
            ctx.fillText('SHIELD', 16, chargeY);
            const barW = 60;
            ctx.fillStyle = '#222';
            ctx.fillRect(75, chargeY - 9, barW, 8);
            ctx.fillStyle = '#888';
            ctx.shadowColor = '#888';
            ctx.shadowBlur = 3;
            ctx.fillRect(75, chargeY - 9, barW * frac, 8);
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = g.player.shieldCharges > 0 ? '#999' : '#444';
            const chargeText = 'E: SHIELD ' + '●'.repeat(g.player.shieldCharges) +
                               '○'.repeat(g.player.maxShieldCharges - g.player.shieldCharges);
            ctx.fillText(chargeText, 16, chargeY);
        }

        // Bomb charges
        ctx.fillStyle = g.player.bombs > 0 ? '#cc0000' : '#444';
        const bombText = 'Q: BOMB ' + '●'.repeat(g.player.bombs) +
                         '○'.repeat(Math.max(0, g.player.maxBombs - g.player.bombs));
        ctx.fillText(bombText, 16, chargeY - 18);

        // Trail color name — bottom right
        ctx.textAlign = 'right';
        ctx.fillStyle = g.player.trailColor || '#cc0000';
        ctx.fillText(`T: TRAIL [${g.player.trailColorNames[g.player.trailIndex]}]`, w - 16, h - 20);
        ctx.fillStyle = '#666';
        ctx.fillText(`Y: SKIN [${g.player.skinNames[g.player.skinIndex]}]`, w - 16, h - 36);

        ctx.restore();
    }

    // ----- Menu ----- (NIN industrial)
    drawMenu(ctx) {
        const g = this.game;
        const w = g.canvas.width;
        const h = g.canvas.height;

        ctx.save();

        // Background image or dark overlay
        if (g.assets.splashBg) {
            Utils.drawCover(ctx, g.assets.splashBg, w, h);
            ctx.fillStyle = 'rgba(10, 10, 10, 0.6)';
            ctx.fillRect(0, 0, w, h);
        } else {
            ctx.fillStyle = 'rgba(10, 10, 10, 0.75)';
            ctx.fillRect(0, 0, w, h);
        }

        // Scan lines (pre-rendered)
        ctx.drawImage(this._getScanLines(w, h), 0, 0);

        // Title — NIN DEFENDER in harsh red, GSAP-driven pulse via Anim.menuTitle
        const mt = g.anim.menuTitle;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#cc0000';
        ctx.shadowColor = '#cc0000';
        ctx.shadowBlur = mt.glow;
        const titleSize = Math.min(w * 0.08, 64) * mt.scale;
        ctx.font = `bold ${titleSize}px Courier New`;
        ctx.fillText('NIN DEFENDER', w / 2, h * 0.3);
        ctx.shadowBlur = mt.glow * 1.6;
        ctx.globalAlpha = 0.3;
        ctx.fillText('NIN DEFENDER', w / 2, h * 0.3);
        ctx.globalAlpha = 1;

        // Subtitle
        ctx.shadowBlur = 0;
        ctx.font = `${Math.min(w * 0.025, 16)}px Courier New`;
        ctx.fillStyle = '#999';
        ctx.fillText('NOTHING CAN STOP ME NOW', w / 2, h * 0.3 + 35);

        // Pulsing start prompt — GSAP-driven via Anim.menuPrompt
        ctx.globalAlpha = g.anim.menuPrompt.alpha;
        ctx.font = `bold ${Math.min(w * 0.025, 18)}px Courier New`;
        ctx.fillStyle = '#cc0000';
        ctx.fillText('[ PRESS SPACE ]', w / 2, h * 0.5);
        ctx.globalAlpha = 1;

        // Difficulty selector — current selection scale-pops on change
        ctx.font = 'bold 14px Courier New';
        const diffY = h * 0.56;
        const diffColors = ['#00cc44', '#cc8800', '#cc0000'];
        ctx.fillStyle = '#555';
        ctx.fillText('< DIFFICULTY >', w / 2, diffY);
        const diffScale = g.anim.menuDifficulty.scale;
        ctx.font = `bold ${16 * diffScale}px Courier New`;
        ctx.fillStyle = diffColors[g.difficultyIndex];
        ctx.fillText(g.difficulties[g.difficultyIndex], w / 2, diffY + 20);
        ctx.globalAlpha = 1;

        // Mobile hint
        if ('ontouchstart' in window) {
            ctx.font = `${Math.min(w * 0.02, 13)}px Courier New`;
            ctx.fillStyle = '#444';
            ctx.fillText('TAP ANYWHERE TO START', w / 2, h * 0.57);
        }

        // Controls
        ctx.font = 'bold 13px Courier New';
        ctx.fillStyle = '#777';
        const cy = h * 0.62;
        ctx.fillText('— CONTROLS —', w / 2, cy);
        ctx.font = '12px Courier New';
        const controls = [
            ['WASD / ARROWS', 'Move ship'],
            ['SPACE (hold)',  'Fire weapons'],
            ['E',             'Shield (3 charges)'],
            ['Q',             'Screen bomb'],
            ['T',             'Cycle trail'],
            ['Y',             'Cycle ship skin'],
            ['P / ESC',       'Pause']
        ];
        controls.forEach(([key, desc], i) => {
            const y = cy + 20 + i * 18;
            ctx.textAlign = 'right';
            ctx.fillStyle = '#cc0000';
            ctx.fillText(key, w / 2 - 10, y);
            ctx.textAlign = 'left';
            ctx.fillStyle = '#888';
            ctx.fillText(desc, w / 2 + 10, y);
        });
        ctx.textAlign = 'center';

        // High score
        if (g.highScore > 0) {
            ctx.font = 'bold 14px Courier New';
            ctx.fillStyle = '#666';
            ctx.shadowBlur = 0;
            ctx.fillText(`HIGH SCORE: ${g.highScore}`, w / 2, h * 0.92);
        }

        ctx.restore();
    }

    // ----- Wave Clear banner ----- (gold reward moment, GSAP-driven)
    drawWaveClear(ctx) {
        const g = this.game;
        if (!g.anim.waveBanner.visible) return;
        const w = g.canvas.width;
        const h = g.canvas.height;
        const wb = g.anim.waveBanner;

        ctx.save();
        ctx.globalAlpha = wb.alpha;
        ctx.textAlign = 'center';

        const baseSize = Math.min(w * 0.05, 40);
        ctx.font = `bold ${baseSize * wb.scale}px Courier New`;
        ctx.fillStyle = '#ffdd00';
        ctx.shadowColor = '#ffdd00';
        ctx.shadowBlur = 15;
        ctx.fillText('WAVE CLEAR', w / 2, h * 0.4);

        ctx.shadowBlur = 0;
        ctx.font = '13px Courier New';
        ctx.fillStyle = '#aa8800';
        ctx.fillText(`PHASE ${wb.phase + 1} COMPLETE`, w / 2, h * 0.4 + 35);

        ctx.restore();
    }

    // ----- Pause overlay ----- (NIN industrial)
    drawPause(ctx) {
        const g = this.game;
        const w = g.canvas.width;
        const h = g.canvas.height;
        ctx.save();
        ctx.fillStyle = 'rgba(5, 5, 5, 0.8)';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(this._getScanLines(w, h), 0, 0);

        ctx.textAlign = 'center';
        ctx.font = 'bold 48px Courier New';
        ctx.fillStyle = '#cc0000';
        ctx.shadowColor = '#cc0000';
        ctx.shadowBlur = 20;
        ctx.fillText('PAUSED', w / 2, h * 0.3);
        ctx.shadowBlur = 0;

        // Menu options
        const options = ['RESUME', 'RESTART', 'MAIN MENU'];
        const selected = g._pauseMenuIndex || 0;
        ctx.font = 'bold 18px Courier New';
        for (let i = 0; i < options.length; i++) {
            const oy = h * 0.45 + i * 40;
            if (i === selected) {
                ctx.fillStyle = '#cc0000';
                ctx.fillText('> ' + options[i] + ' <', w / 2, oy);
            } else {
                ctx.fillStyle = '#555';
                ctx.fillText(options[i], w / 2, oy);
            }
        }

        ctx.font = '12px Courier New';
        ctx.fillStyle = '#333';
        ctx.fillText('W/S to select • SPACE to confirm • P to resume', w / 2, h * 0.75);
        ctx.restore();
    }

    // ----- Game Over ----- (NIN industrial)
    drawGameOver(ctx) {
        const g = this.game;
        const w = g.canvas.width;
        const h = g.canvas.height;
        ctx.save();

        if (g.assets.gameoverBg) {
            Utils.drawCover(ctx, g.assets.gameoverBg, w, h);
            ctx.fillStyle = 'rgba(5, 5, 5, 0.65)';
            ctx.fillRect(0, 0, w, h);
        } else {
            ctx.fillStyle = 'rgba(5, 5, 5, 0.85)';
            ctx.fillRect(0, 0, w, h);
        }
        // Scan lines (pre-rendered)
        ctx.drawImage(this._getScanLines(w, h), 0, 0);

        ctx.textAlign = 'center';

        // Glitchy GAME OVER — double render with offset for distortion
        ctx.font = `bold ${Math.min(w * 0.06, 48)}px Courier New`;
        const glitch = Math.sin(g.menuTime * 7) * 2;
        ctx.fillStyle = 'rgba(204, 0, 0, 0.3)';
        ctx.fillText('GAME OVER', w / 2 + glitch, h * 0.35 - 1);
        ctx.fillStyle = '#cc0000';
        ctx.shadowColor = '#cc0000';
        ctx.shadowBlur = 20;
        ctx.fillText('GAME OVER', w / 2, h * 0.35);

        // Animated score reveal — scale popped in by anim.gameOverReveal()
        ctx.shadowBlur = 0;
        const go = g.anim.gameOver;
        const scoreScale = Math.max(0.001, go.scoreScale);
        const scoreSize = 26 * scoreScale;
        ctx.font = `bold ${scoreSize}px Courier New`;
        ctx.fillStyle = '#d4d4d4';
        ctx.fillText(`SCORE: ${g.score.toLocaleString()}`, w / 2, h * 0.48);

        ctx.font = '16px Courier New';
        ctx.fillStyle = '#666';
        ctx.fillText(`HIGH SCORE: ${g.highScore.toLocaleString()}`, w / 2, h * 0.56);

        // NEW BEST badge — fades in with scale-pop after the score lands.
        if (go.isNewBest && go.pbAlpha > 0) {
            ctx.save();
            ctx.globalAlpha = go.pbAlpha;
            const pbScale = Math.max(0.001, go.pbScale);
            ctx.font = `bold ${18 * pbScale}px Courier New`;
            ctx.fillStyle = '#ffdd00';
            ctx.shadowColor = '#ffdd00';
            ctx.shadowBlur = 12;
            ctx.fillText(`★ NEW BEST  +${go.pbDelta.toLocaleString()}`, w / 2, h * 0.51);
            ctx.restore();
        }

        // Stats
        ctx.font = '14px Courier New';
        ctx.fillStyle = '#555';
        ctx.fillText(`SCRAP EARNED: ${g.player.scrap}`, w / 2, h * 0.62);
        if (g.player.maxCombo >= 3) {
            ctx.fillStyle = '#993300';
            ctx.fillText(`MAX COMBO: x${g.player.maxCombo}`, w / 2, h * 0.66);
        }

        // Leaderboard
        if (g.leaderboard.length > 0) {
            ctx.font = 'bold 12px Courier New';
            ctx.fillStyle = '#444';
            ctx.fillText('— TOP SCORES —', w / 2, h * 0.73);
            ctx.font = '11px Courier New';
            const maxShow = Math.min(5, g.leaderboard.length);
            for (let i = 0; i < maxShow; i++) {
                const entry = g.leaderboard[i];
                ctx.fillStyle = i === 0 ? '#cc0000' : '#444';
                const phase = entry.phase ? `P${entry.phase}` : '';
                const combo = entry.maxCombo ? `x${entry.maxCombo}` : '';
                const time = entry.time ? `${Math.floor(entry.time / 60)}:${(entry.time % 60).toString().padStart(2, '0')}` : '';
                ctx.fillText(`${i + 1}. ${entry.score}  ${phase}  ${time}  ${combo}`, w / 2, h * 0.73 + 16 + i * 14);
            }
        }

        // Scrap available hint
        if (g.player.scrap > 0) {
            ctx.font = '12px Courier New';
            ctx.fillStyle = '#993300';
            ctx.fillText(`SCRAP AVAILABLE: ${g.player.scrap} — spend it next run`, w / 2, h * 0.88);
        }

        const pulse = 0.4 + 0.6 * Math.sin(g.menuTime * 2.5);
        ctx.globalAlpha = pulse;
        ctx.font = 'bold 16px Courier New';
        ctx.fillStyle = '#cc0000';
        ctx.fillText('[ PRESS SPACE ]', w / 2, h * 0.93);
        ctx.globalAlpha = 1;

        ctx.restore();
    }
}
