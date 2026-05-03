// ============================================================
// shop.js — Inter-wave upgrade shop (NIN industrial style)
// ============================================================

// ShopItem is polymorphic on `kind`: 'upgrade' | 'consumable' | 'cosmetic'.
// Each kind owns its own getCost/getDescription/canPurchase/apply via injected
// callbacks; the default behavior matches stat upgrades for backwards compat.
class ShopItem {
    constructor(opts) {
        this.id        = opts.id;
        this.name      = opts.name;
        this.kind      = opts.kind || 'upgrade';
        this.baseCost  = opts.baseCost ?? 0;
        this.maxLevel  = opts.maxLevel ?? 0;
        this._apply             = opts.apply             || (() => {});
        this._getDescription    = opts.getDescription;
        this._getCost           = opts.getCost;
        this._canPurchase       = opts.canPurchase;
    }

    getCost(player) {
        if (this._getCost) return this._getCost(player);
        const level = player.upgrades[this.id] || 0;
        return Math.floor(this.baseCost * Math.pow(1.8, level));
    }

    getDescription(player) {
        return this._getDescription ? this._getDescription(player) : '';
    }

    canPurchase(player) {
        if (this._canPurchase) return this._canPurchase(player);
        const level = player.upgrades[this.id] || 0;
        return level < this.maxLevel && player.scrap >= this.getCost(player);
    }

    apply(player) { this._apply(player); }
}

// Helpers — describe stat upgrades as "current → next" using the canonical
// formulas in player.applyUpgrades. Keep these in sync with that file if the
// math ever changes (the formula values appear here for display only).
function upgradeApply(id) {
    return (p) => { p.upgrades[id] = (p.upgrades[id] || 0) + 1; p.applyUpgrades(); };
}
function statDesc(label, fn, unit, lvlKey, maxLevel) {
    return (p) => {
        const lvl = p.upgrades[lvlKey] || 0;
        const cur = fn(lvl);
        const next = fn(lvl + 1);
        if (lvl >= maxLevel) return `${label}: ${cur}${unit} (MAX)`;
        return `${label}: ${cur}${unit} → ${next}${unit}`;
    };
}

const SHOP_ITEMS = [
    // ----- Stat upgrades -----
    new ShopItem({
        id: 'damage', name: 'DAMAGE', kind: 'upgrade',
        baseCost: 50, maxLevel: 5,
        apply: upgradeApply('damage'),
        getDescription: statDesc('DMG', (l) => (1 + l * 0.5).toFixed(1), '', 'damage', 5),
    }),
    new ShopItem({
        id: 'fireRate', name: 'FIRE RATE', kind: 'upgrade',
        baseCost: 50, maxLevel: 5,
        apply: upgradeApply('fireRate'),
        getDescription: statDesc('RATE', (l) => (0.18 - l * 0.015).toFixed(3), 's', 'fireRate', 5),
    }),
    new ShopItem({
        id: 'speed', name: 'SPEED', kind: 'upgrade',
        baseCost: 40, maxLevel: 5,
        apply: upgradeApply('speed'),
        getDescription: statDesc('SPD', (l) => 420 + l * 30, '', 'speed', 5),
    }),
    new ShopItem({
        id: 'bombs', name: 'MAX BOMBS', kind: 'upgrade',
        baseCost: 60, maxLevel: 5,
        apply: upgradeApply('bombs'),
        getDescription: statDesc('MAX', (l) => 2 + l, '', 'bombs', 5),
    }),
    new ShopItem({
        id: 'shields', name: 'MAX SHIELDS', kind: 'upgrade',
        baseCost: 45, maxLevel: 4,
        apply: upgradeApply('shields'),
        getDescription: statDesc('MAX', (l) => 3 + l, '', 'shields', 4),
    }),
    new ShopItem({
        id: 'lives', name: 'MAX LIVES', kind: 'upgrade',
        baseCost: 80, maxLevel: 4,
        apply: upgradeApply('lives'),
        getDescription: statDesc('MAX', (l) => 8 + l, '', 'lives', 4),
    }),

    // ----- Consumables — refill current stockpile, no level cap -----
    new ShopItem({
        id: 'restock_bombs', name: 'RESTOCK BOMBS', kind: 'consumable',
        getCost: (p) => Math.max(1, p.maxBombs - p.bombs) * 30,
        getDescription: (p) => `BOMBS: ${p.bombs}/${p.maxBombs}`,
        canPurchase: (p) => p.bombs < p.maxBombs && p.scrap >= (p.maxBombs - p.bombs) * 30,
        apply: (p) => { p.bombs = p.maxBombs; },
    }),
    new ShopItem({
        id: 'restore_shields', name: 'RESTORE SHIELDS', kind: 'consumable',
        getCost: (p) => Math.max(1, p.maxShieldCharges - p.shieldCharges) * 20,
        getDescription: (p) => `SHIELDS: ${p.shieldCharges}/${p.maxShieldCharges}`,
        canPurchase: (p) => p.shieldCharges < p.maxShieldCharges
                            && p.scrap >= (p.maxShieldCharges - p.shieldCharges) * 20,
        apply: (p) => { p.shieldCharges = p.maxShieldCharges; },
    }),

    // ----- Cosmetics — free, cycles to next variant -----
    new ShopItem({
        id: 'trail_color', name: 'TRAIL COLOR', kind: 'cosmetic',
        getCost: () => 0,
        getDescription: (p) => `TRAIL: ${p.trailColorNames[p.trailIndex]}`,
        canPurchase: () => true,
        apply: (p) => { p.cycleTrail(); },
    }),
    new ShopItem({
        id: 'ship_skin', name: 'SHIP SKIN', kind: 'cosmetic',
        getCost: () => 0,
        getDescription: (p) => `SKIN: ${p.skinNames[p.skinIndex]}`,
        canPurchase: () => true,
        apply: (p) => { p.cycleSkin(); },
    }),
];

class Shop {
    constructor() {
        this.selectedIndex = 0;
        this.purchaseFlash = 0;
        this.errorFlash = 0;
    }

    draw(ctx, canvas, player) {
        const w = canvas.width;
        const h = canvas.height;

        ctx.save();

        // Dark overlay
        ctx.fillStyle = 'rgba(5, 5, 5, 0.92)';
        ctx.fillRect(0, 0, w, h);

        // Scan lines
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 2);

        // Title
        ctx.textAlign = 'center';
        ctx.font = `bold ${Math.min(w * 0.04, 32)}px Courier New`;
        ctx.fillStyle = '#cc0000';
        ctx.shadowColor = '#cc0000';
        ctx.shadowBlur = 15;
        ctx.fillText('— UPGRADE SHOP —', w / 2, h * 0.1);
        ctx.shadowBlur = 0;

        // Scrap counter
        ctx.font = 'bold 18px Courier New';
        ctx.fillStyle = '#993300';
        ctx.fillText(`SCRAP: ${player.scrap}`, w / 2, h * 0.16);

        // Items
        const startY = h * 0.24;
        // Scale items to fit — ensure CONTINUE button isn't clipped
        const availableH = h * 0.6; // space between startY and continue button
        const itemH = Math.min(availableH / SHOP_ITEMS.length, 55);
        const itemW = Math.min(w * 0.7, 500);
        const startX = (w - itemW) / 2;

        ctx.font = '14px Courier New';
        ctx.textAlign = 'left';

        let prevKind = null;
        for (let i = 0; i < SHOP_ITEMS.length; i++) {
            const item = SHOP_ITEMS[i];
            const selected = i === this.selectedIndex;
            const iy = startY + i * itemH;

            // Section divider between kinds (upgrade → consumable → cosmetic)
            if (prevKind && prevKind !== item.kind) {
                ctx.strokeStyle = 'rgba(204, 0, 0, 0.2)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(startX - 10, iy - itemH * 0.7);
                ctx.lineTo(startX + itemW + 10, iy - itemH * 0.7);
                ctx.stroke();
            }
            prevKind = item.kind;

            // Selection highlight
            if (selected) {
                ctx.fillStyle = 'rgba(204, 0, 0, 0.12)';
                ctx.fillRect(startX - 10, iy - itemH * 0.6, itemW + 20, itemH - 4);
                ctx.strokeStyle = '#cc0000';
                ctx.lineWidth = 1;
                ctx.strokeRect(startX - 10, iy - itemH * 0.6, itemW + 20, itemH - 4);
                ctx.fillStyle = '#cc0000';
                ctx.font = 'bold 16px Courier New';
                ctx.fillText('>', startX - 25, iy - itemH * 0.15);
            }

            // Greying logic — different per kind
            const cost = item.getCost(player);
            const canAfford = player.scrap >= cost;
            const purchasable = item.canPurchase(player);
            const dimmed = !purchasable;

            // Item name
            ctx.font = 'bold 15px Courier New';
            ctx.fillStyle = dimmed ? '#555' : selected ? '#ffffff' : '#999';
            ctx.fillText(item.name, startX, iy - itemH * 0.15);

            // Description (current → next, or current/max for consumables)
            ctx.font = '12px Courier New';
            ctx.fillStyle = '#555';
            ctx.fillText(item.getDescription(player), startX, iy + itemH * 0.15);

            // Right side: pips for upgrades; cost / FREE / MAXED for the rest.
            ctx.font = '13px Courier New';
            ctx.textAlign = 'right';
            if (item.kind === 'upgrade') {
                const level = player.upgrades[item.id] || 0;
                const maxed = level >= item.maxLevel;
                // pips
                const pipsRightEdge = startX + itemW - 70;
                const pipX = pipsRightEdge - item.maxLevel * 14;
                for (let l = 0; l < item.maxLevel; l++) {
                    ctx.fillStyle = l < level ? '#cc0000' : '#333';
                    ctx.fillText('■', pipX + l * 14, iy - itemH * 0.15);
                }
                if (maxed) {
                    ctx.fillStyle = '#444';
                    ctx.fillText('MAXED', startX + itemW, iy - itemH * 0.15);
                } else {
                    ctx.fillStyle = canAfford ? '#993300' : '#441111';
                    ctx.fillText(`${cost} SCRAP`, startX + itemW, iy - itemH * 0.15);
                }
            } else if (item.kind === 'consumable') {
                if (!purchasable && cost === 0) {
                    ctx.fillStyle = '#444';
                    ctx.fillText('FULL', startX + itemW, iy - itemH * 0.15);
                } else {
                    ctx.fillStyle = canAfford ? '#993300' : '#441111';
                    ctx.fillText(`${cost} SCRAP`, startX + itemW, iy - itemH * 0.15);
                }
            } else if (item.kind === 'cosmetic') {
                ctx.fillStyle = '#666';
                ctx.fillText('FREE', startX + itemW, iy - itemH * 0.15);
            }
            ctx.textAlign = 'left';
        }

        // Purchase flash
        if (this.purchaseFlash > 0) {
            ctx.fillStyle = `rgba(0, 204, 0, ${this.purchaseFlash * 0.3})`;
            ctx.fillRect(0, 0, w, h);
        }
        if (this.errorFlash > 0) {
            ctx.fillStyle = `rgba(204, 0, 0, ${this.errorFlash * 0.3})`;
            ctx.fillRect(0, 0, w, h);
        }

        // Continue button
        const btnW = 200;
        const btnH = 36;
        const btnX = (w - btnW) / 2;
        const btnY = h * 0.86;
        ctx.fillStyle = '#cc0000';
        ctx.fillRect(btnX, btnY, btnW, btnH);
        ctx.font = 'bold 14px Courier New';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText('CONTINUE', w / 2, btnY + 24);
        // Store button bounds for touch
        this._continueBtn = { x: btnX, y: btnY, w: btnW, h: btnH };
        this._itemStartY = startY;
        this._itemH = itemH;
        this._canvasH = h;

        // Controls hint — touch-aware
        ctx.textAlign = 'center';
        ctx.font = '11px Courier New';
        ctx.fillStyle = '#444';
        const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        ctx.fillText(isMobile
            ? 'TAP to select • TAP again to buy • CONTINUE to proceed'
            : 'W/S to select • SPACE to buy • ENTER to continue', w / 2, h * 0.96);

        ctx.restore();
    }

    update(dt) {
        if (this.purchaseFlash > 0) this.purchaseFlash -= dt * 3;
        if (this.errorFlash > 0) this.errorFlash -= dt * 3;
    }

    moveUp() {
        this.selectedIndex = (this.selectedIndex - 1 + SHOP_ITEMS.length) % SHOP_ITEMS.length;
    }

    moveDown() {
        this.selectedIndex = (this.selectedIndex + 1) % SHOP_ITEMS.length;
    }

    handleTouch(x, y, player) {
        // Check continue button
        if (this._continueBtn &&
            x >= this._continueBtn.x && x <= this._continueBtn.x + this._continueBtn.w &&
            y >= this._continueBtn.y && y <= this._continueBtn.y + this._continueBtn.h) {
            return 'continue';
        }
        // Check item taps
        if (this._itemStartY && this._itemH) {
            for (let i = 0; i < SHOP_ITEMS.length; i++) {
                const iy = this._itemStartY + i * this._itemH;
                if (y >= iy - this._itemH * 0.6 && y < iy + this._itemH * 0.4) {
                    if (this.selectedIndex === i) {
                        this.tryPurchase(player);
                    } else {
                        this.selectedIndex = i;
                    }
                    return 'item';
                }
            }
        }
        return null;
    }

    tryPurchase(player) {
        const item = SHOP_ITEMS[this.selectedIndex];
        if (!item.canPurchase(player)) { this.errorFlash = 1; return false; }
        const cost = item.getCost(player);
        player.scrap -= cost;
        item.apply(player);
        localStorage.setItem('ninDefenderScrap', player.scrap.toString());
        localStorage.setItem('ninDefenderUpgrades', JSON.stringify(player.upgrades));
        this.purchaseFlash = 1;
        return true;
    }
}
