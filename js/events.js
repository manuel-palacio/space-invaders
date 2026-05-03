// ============================================================
// events.js — Tiny inline event emitter (Mitt-equivalent, ~10 lines)
// ============================================================
// Global `emitter` decouples gameplay events (player shooting, dying,
// wingman expiring, bomb activation, enemy kills) from their visual/audio
// side-effects. Subsystems emit; game.js subscribes and does the rest.
//
// Subscribe in game.js (typically game.js constructor):
//     emitter.on('shot:fired', ({ x, y }) => particles.createMuzzleFlash(x, y));
//
// Emit from anywhere:
//     emitter.emit('shot:fired', { x: tipX, y: tipY });

function mitt(all = new Map()) {
    return {
        all,
        on(type, handler) {
            const handlers = all.get(type);
            if (handlers) handlers.push(handler);
            else all.set(type, [handler]);
        },
        off(type, handler) {
            const handlers = all.get(type);
            if (handlers) {
                if (handler) handlers.splice(handlers.indexOf(handler) >>> 0, 1);
                else all.set(type, []);
            }
        },
        emit(type, evt) {
            let handlers = all.get(type);
            if (handlers) handlers.slice().forEach(h => h(evt));
            handlers = all.get('*');
            if (handlers) handlers.slice().forEach(h => h(type, evt));
        },
        clear() { all.clear(); },
    };
}

// Single shared instance — load order in index.html ensures this exists
// before game.js / player.js construct anything.
const emitter = mitt();
