// ============================================================
// main.js — Entry point: canvas setup, input, game loop
// ============================================================

(function () {
    'use strict';

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    let game = null;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        if (game) game.resize(canvas.width, canvas.height);
    }
    resize();
    window.addEventListener('resize', resize);

    game = new Game(canvas, ctx);

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

    // Joystick
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

    // Fire button
    fireButton.addEventListener('touchstart', e => {
        e.preventDefault();
        game.touchFiring = true;
    });
    fireButton.addEventListener('touchend', e => {
        game.touchFiring = false;
    });
    fireButton.addEventListener('touchcancel', () => {
        game.touchFiring = false;
    });

    // Tap-to-start on mobile (anywhere except controls)
    canvas.addEventListener('touchstart', e => {
        if (game.state === STATE.MENU || game.state === STATE.GAME_OVER) {
            e.preventDefault();
            game.audio.init();
            game.audio.resume();
            game.startGame();
        }
    });

    // Mute button
    const muteBtn = document.getElementById('muteBtn');
    muteBtn.addEventListener('click', () => {
        game.audio.init();
        const muted = game.audio.toggleMute();
        muteBtn.textContent = muted ? '\u{1F507}' : '\u{1F50A}';
    });

    // ---- Game loop with fixed-ish timestep ----
    let lastTime = 0;
    const MAX_DT = 1 / 20; // cap to prevent spiral of death

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

})();
