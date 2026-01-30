import { defineConfig } from 'vite';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        globals: true,
    },
});
