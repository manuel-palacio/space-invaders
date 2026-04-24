// ============================================================
// shop.js — Inter-wave upgrade shop (NIN industrial style)
// ============================================================

class ShopItem {
    constructor(id, name, description, baseCost, maxLevel, apply) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.baseCost = baseCost;
        this.maxLevel = maxLevel;
        this.apply = apply; // function(player)
    }

    getCost(currentLevel) {
        return this.baseCost * (currentLevel + 1);
    }
}

const SHOP_ITEMS = [
    new ShopItem('damage', 'DAMAGE', '+0.5 bullet damage', 50, 5,
        (p) => { p.baseDamage = 1 + p.upgrades.damage * 0.5; }),
    new ShopItem('fireRate', 'FIRE RATE', 'faster shooting', 50, 5,
        (p) => { p.baseFireRate = 0.18 - p.upgrades.fireRate * 0.015; p.fireRate = p.baseFireRate; }),
    new ShopItem('speed', 'SPEED', '+30 ship speed', 40, 5,
        (p) => { p.speed = 420 + p.upgrades.speed * 30; }),
    new ShopItem('bombs', 'BOMBS', '+1 max bomb', 60, 5,
        (p) => { p.maxBombs = 2 + p.upgrades.bombs; }),
    new ShopItem('shields', 'SHIELDS', '+1 shield charge', 45, 4,
        (p) => { p.maxShieldCharges = 3 + (p.upgrades.shields || 0); p.shieldCharges = p.maxShieldCharges; }),
    new ShopItem('lives', 'MAX LIVES', '+1 max life', 80, 4,
        (p) => { p.maxLives = 8 + (p.upgrades.lives || 0); }),
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
        const itemH = Math.min(h * 0.1, 55);
        const itemW = Math.min(w * 0.7, 500);
        const startX = (w - itemW) / 2;

        ctx.font = '14px Courier New';
        ctx.textAlign = 'left';

        for (let i = 0; i < SHOP_ITEMS.length; i++) {
            const item = SHOP_ITEMS[i];
            const level = player.upgrades[item.id] || 0;
            const cost = item.getCost(level);
            const maxed = level >= item.maxLevel;
            const canAfford = player.scrap >= cost;
            const selected = i === this.selectedIndex;
            const iy = startY + i * itemH;

            // Selection highlight
            if (selected) {
                ctx.fillStyle = 'rgba(204, 0, 0, 0.12)';
                ctx.fillRect(startX - 10, iy - itemH * 0.6, itemW + 20, itemH - 4);
                ctx.strokeStyle = '#cc0000';
                ctx.lineWidth = 1;
                ctx.strokeRect(startX - 10, iy - itemH * 0.6, itemW + 20, itemH - 4);

                // Selector arrow
                ctx.fillStyle = '#cc0000';
                ctx.font = 'bold 16px Courier New';
                ctx.fillText('>', startX - 25, iy - itemH * 0.15);
            }

            // Item name
            ctx.font = 'bold 15px Courier New';
            ctx.fillStyle = maxed ? '#555' : selected ? '#ffffff' : '#999';
            ctx.fillText(item.name, startX, iy - itemH * 0.15);

            // Description
            ctx.font = '12px Courier New';
            ctx.fillStyle = '#555';
            ctx.fillText(item.description, startX, iy + itemH * 0.15);

            // Level pips
            const pipX = startX + itemW * 0.55;
            ctx.font = '13px Courier New';
            for (let l = 0; l < item.maxLevel; l++) {
                ctx.fillStyle = l < level ? '#cc0000' : '#333';
                ctx.fillText('■', pipX + l * 14, iy - itemH * 0.15);
            }

            // Cost or MAXED
            ctx.textAlign = 'right';
            if (maxed) {
                ctx.font = 'bold 13px Courier New';
                ctx.fillStyle = '#444';
                ctx.fillText('MAXED', startX + itemW, iy - itemH * 0.15);
            } else {
                ctx.font = '13px Courier New';
                ctx.fillStyle = canAfford ? '#993300' : '#441111';
                ctx.fillText(`${cost} SCRAP`, startX + itemW, iy - itemH * 0.15);
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

        // Controls hint
        ctx.textAlign = 'center';
        ctx.font = '11px Courier New';
        ctx.fillStyle = '#444';
        ctx.fillText('W/S to select • SPACE to buy • ENTER to continue', w / 2, h * 0.96);

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
        const level = player.upgrades[item.id] || 0;
        if (level >= item.maxLevel) { this.errorFlash = 1; return false; }
        const cost = item.getCost(level);
        if (player.scrap < cost) { this.errorFlash = 1; return false; }

        player.scrap -= cost;
        player.upgrades[item.id] = level + 1;
        item.apply(player);
        localStorage.setItem('ninDefenderScrap', player.scrap.toString());
        localStorage.setItem('ninDefenderUpgrades', JSON.stringify(player.upgrades));
        this.purchaseFlash = 1;
        return true;
    }
}
