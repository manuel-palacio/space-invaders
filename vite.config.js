// Vite config — minimal setup for the static-canvas game.
// `root` stays at the project root (where index.html lives).
// `build.outDir` defaults to `dist/` which the Dockerfile copies to nginx.
import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: false,
    },
    server: {
        port: 5173,
        open: false,
    },
});
