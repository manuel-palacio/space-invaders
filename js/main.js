// ============================================================
// main.js — Entry point: asset loading, canvas setup, input, game loop
// ============================================================

(function () {
    'use strict';

    // ---- Mobile detection ----
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

    if (isTouchDevice) {
        document.body.classList.add('touch-device');

        // Request landscape orientation
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(() => {});
        }

        // Track portrait/landscape and toggle warning
        function checkOrientation() {
            if (window.innerHeight > window.innerWidth) {
                document.body.classList.add('touch-portrait');
                document.body.classList.remove('touch-device');
            } else {
                document.body.classList.remove('touch-portrait');
                document.body.classList.add('touch-device');
            }
        }
        checkOrientation();
        window.addEventListener('resize', checkOrientation);
        window.addEventListener('orientationchange', () => {
            setTimeout(checkOrientation, 200);
        });
    }

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    let game = null;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        updateGameScale(canvas.width);
        if (game) game.resize(canvas.width, canvas.height);
    }
    resize();
    window.addEventListener('resize', resize);

    // ---- Asset loading phase ----
    const loader = new AssetLoader();

    // Animate loading screen while assets resolve
    let loadingDone = false;
    function drawLoading() {
        if (loadingDone) return;
        AssetLoader.drawLoadingScreen(ctx, canvas, loader.getProgress());
        requestAnimationFrame(drawLoading);
    }
    drawLoading();

    loader.load(ASSET_MANIFEST).then(assets => {
        loadingDone = true;

        // Count how many images actually loaded
        const found = Object.values(assets).filter(Boolean).length;
        const total = Object.keys(assets).length;
        if (found > 0) {
            console.log(`Assets loaded: ${found}/${total} images found`);
        } else {
            console.log('No image assets found — using Canvas-drawn graphics');
        }

        // ---- Create game with loaded assets ----
        game = new Game(canvas, ctx, assets);

        // ---- Keyboard input ----
        window.addEventListener('keydown', e => {
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }
            game.onKeyDown(e.code);
        });
        window.addEventListener('keyup', e => {
            game.onKeyUp(e.code);
        });

        // ---- Touch input ----
        const joystickBase = document.getElementById('joystickBase');
        const joystickKnob = document.getElementById('joystickKnob');
        const fireButton = document.getElementById('fireButton');
        let joystickTouchId = null;

        joystickBase.addEventListener('touchstart', e => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            joystickTouchId = touch.identifier;
            handleJoystick(touch);
        });
        joystickBase.addEventListener('touchmove', e => {
            e.preventDefault();
            for (const touch of e.changedTouches) {
                if (touch.identifier === joystickTouchId) {
                    handleJoystick(touch);
                }
            }
        });
        joystickBase.addEventListener('touchend', e => {
            for (const touch of e.changedTouches) {
                if (touch.identifier === joystickTouchId) {
                    joystickTouchId = null;
                    game.joystick.active = false;
                    game.joystick.dx = 0;
                    game.joystick.dy = 0;
                    joystickKnob.style.transform = 'translate(0, 0)';
                }
            }
        });

        function handleJoystick(touch) {
            const rect = joystickBase.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            let dx = touch.clientX - cx;
            let dy = touch.clientY - cy;
            const maxDist = rect.width / 2;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > maxDist) {
                dx = (dx / dist) * maxDist;
                dy = (dy / dist) * maxDist;
            }
            joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
            game.joystick.active = true;
            game.joystick.dx = dx / maxDist;
            game.joystick.dy = dy / maxDist;
        }

        fireButton.addEventListener('touchstart', e => {
            e.preventDefault();
            game.touchFiring = true;
        });
        fireButton.addEventListener('touchend', () => {
            game.touchFiring = false;
        });
        fireButton.addEventListener('touchcancel', () => {
            game.touchFiring = false;
        });

        canvas.addEventListener('touchstart', e => {
            if (game.state === STATE.MENU || game.state === STATE.GAME_OVER) {
                e.preventDefault();
                game.audio.init();
                game.audio.resume();
                game.startGame();
            } else if (game.state === STATE.SHOP) {
                e.preventDefault();
                const touch = e.changedTouches[0];
                const rect = canvas.getBoundingClientRect();
                const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
                const y = (touch.clientY - rect.top) * (canvas.height / rect.height);
                const result = game.shop.handleTouch(x, y, game.player);
                if (result === 'continue') {
                    game.state = STATE.PLAYING;
                    game.spawner.timer = 2.0;
                }
            }
        });

        // Click anywhere on menu to start music (desktop)
        canvas.addEventListener('click', () => {
            if (game.state === STATE.MENU && !game.menuMusicStarted) {
                game.menuMusicStarted = true;
                game.menuMusic.currentTime = 0;
                game.menuMusic.play().catch(() => {});
            }
        });

        // Shield & Bomb touch buttons
        const shieldBtn = document.getElementById('shieldBtn');
        const bombBtn = document.getElementById('bombBtn');
        if (shieldBtn) {
            shieldBtn.addEventListener('touchstart', e => {
                e.preventDefault();
                game.onKeyDown('KeyE');
            });
            shieldBtn.addEventListener('touchend', () => {
                game.onKeyUp('KeyE');
            });
        }
        if (bombBtn) {
            bombBtn.addEventListener('touchstart', e => {
                e.preventDefault();
                game.onKeyDown('KeyQ');
            });
            bombBtn.addEventListener('touchend', () => {
                game.onKeyUp('KeyQ');
            });
        }

        // Mute button
        const muteBtn = document.getElementById('muteBtn');
        muteBtn.addEventListener('click', () => {
            game.audio.init();
            const muted = game.audio.toggleMute();
            muteBtn.textContent = muted ? '\u{1F507}' : '\u{1F50A}';
        });

        // ---- Game loop ----
        let lastTime = 0;
        const MAX_DT = 1 / 20;

        function loop(timestamp) {
            requestAnimationFrame(loop);
            let dt = (timestamp - lastTime) / 1000;
            lastTime = timestamp;
            if (dt > MAX_DT) dt = MAX_DT;
            if (dt <= 0) return;

            game.update(dt);
            game.render();
        }

        requestAnimationFrame(ts => {
            lastTime = ts;
            requestAnimationFrame(loop);
        });
    });

})();
