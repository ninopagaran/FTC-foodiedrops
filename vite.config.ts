
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Ensures assets are linked relatively (critical for GoDaddy/shared hosting)
  build: {
    outDir: 'out', // output to 'out' folder instead of 'dist'
    emptyOutDir: true,
  },
});
