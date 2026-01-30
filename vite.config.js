import { defineConfig } from 'vite';

export default defineConfig({
    root: './src',
    publicDir: '../public',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: 'src/index.html',
                privacy: 'src/privacy.html',
                'privacy-en': 'src/privacy-en.html'
            }
        }
    },
    server: {
        port: 3002,
        open: false
    }
});
